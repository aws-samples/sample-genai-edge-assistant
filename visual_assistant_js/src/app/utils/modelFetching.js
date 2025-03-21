// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { fetchAuthSession } from '@aws-amplify/auth';
import axios from 'axios';
import JSZip from 'jszip';
import crypto from 'crypto';
import { useServiceSelectionStore } from 'src/app/stores/serviceSelectionStore';

// Performs partial hashing of large files by sampling beginning, middle and end chunks
// Returns a SHA-256 hash that's good enough for validation while being fast
async function partialHash(fileData) {
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalSize = fileData.byteLength;

  // Take samples from beginning, middle, and end
  const startChunk = fileData.slice(0, chunkSize);
  const middleOffset = Math.floor(totalSize / 2);
  const middleChunk = fileData.slice(middleOffset, middleOffset + chunkSize);
  const endChunk = fileData.slice(Math.max(totalSize - chunkSize, 0));

  // Process chunks concurrently
  const [startHash, middleHash, endHash] = await Promise.all([
    crypto.createHash('sha256').update(Buffer.from(startChunk)).digest('hex'),
    crypto.createHash('sha256').update(Buffer.from(middleChunk)).digest('hex'),
    crypto.createHash('sha256').update(Buffer.from(endChunk)).digest('hex'),
  ]);

  // Combine hashes and file size
  const finalHash = crypto
    .createHash('sha256')
    .update(startHash)
    .update(middleHash)
    .update(endHash)
    .update(totalSize.toString())
    .digest('hex');

  return finalHash;
}

const FILE_TYPE_HANDLERS = {
  json: {
    getContent: (file) => file.async('text'),
    contentType: 'application/json',
    getHash: (data) =>
      crypto.createHash('sha256').update(Buffer.from(data)).digest('hex'),
    getLength: (data) => new TextEncoder().encode(data).length,
  },
  onnx: {
    getContent: (file) => file.async('arraybuffer'),
    contentType: 'application/octet-stream',
    getHash: (data) => partialHash(data),
    getLength: (data) => data.byteLength,
  },
};

export async function fetchModelUrl() {
  try {
    const currentSession = await fetchAuthSession();
    const token = currentSession.tokens.idToken.toString();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_GATEWAY_ENDPOINT}/getmodelurl`,
      {
        headers: {
          Authorization: token,
        },
      },
    );
    return await response.json();
  } catch (error) {
    console.error('Error fetching model URL:', error);
    throw error;
  }
}

export async function downloadAndCacheModels(modelsToDownload) {
  const store = useServiceSelectionStore.getState();
  store.resetDownloadState();

  console.log(`Starting downloads for models: ${modelsToDownload.join(', ')}`);

  const downloadPromises = modelsToDownload.map(async (modelKey) => {
    const modelData = store.remoteModelInfo[modelKey];

    if (!modelData) {
      console.error(`No model data found for ${modelKey}`);
      store.setDownloadProgress(modelKey, -1);
      throw new Error(`No download data for ${modelKey}`);
    }

    const { download_url, ETag: serverETag } = modelData;
    console.log(`Starting download for ${modelKey}...`);

    try {
      await downloadAndCacheModel(modelKey, download_url, serverETag);
      console.log(`Successfully downloaded and cached ${modelKey}`);
    } catch (error) {
      console.error('Error downloading model:', modelKey, error);
      store.setDownloadProgress(modelKey, -1);
      throw error;
    }
  });

  const results = await Promise.allSettled(downloadPromises);
  console.log('Download results:', results);

  // Check if any downloads failed
  const failedDownloads = results.filter((r) => r.status === 'rejected');
  if (failedDownloads.length > 0) {
    console.error('Failed downloads:', failedDownloads);
    throw new Error(
      `Failed to download: ${failedDownloads.map((f) => f.reason).join(', ')}`,
    );
  }
}

async function downloadAndCacheModel(modelKey, url, serverETag) {
  const store = useServiceSelectionStore.getState();

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      onDownloadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        store.setDownloadProgress(modelKey, percentCompleted);
      },
    });

    console.log('Fetching model:', modelKey, response.status);
    await cacheModel(modelKey, response.data, serverETag);
  } catch (error) {
    console.error('Error processing model:', modelKey, error);    throw error;
  }
}

async function cacheModel(modelKey, data, ETag) {
  const store = useServiceSelectionStore.getState();
  store.setCachingStatus(modelKey, 'CACHING');
  const cache = await caches.open('transformers-cache');
  const zip = await JSZip.loadAsync(data);

  const manifest = { etag: ETag, files: {} };
  const cacheOperations = [];

  try {
    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (relativePath.startsWith('__MACOSX/')) {
        continue;
      }

      const extensionName = relativePath.split('.').pop();
      const handler = FILE_TYPE_HANDLERS[extensionName];

      if (!handler) {
        console.error(`Unknown file type: ${extensionName}`);
        continue;
      }

      const fileData = await handler.getContent(file);
      const contentLength = handler.getLength(fileData);

      if (!contentLength) {
        throw new Error(`Failed to process file: ${relativePath}`);
      }

      manifest.files[relativePath] = await handler.getHash(fileData);

      cacheOperations.push(
        cache.put(
          `/models/${modelKey}/${relativePath}`,
          new Response(fileData, {
            headers: {
              'Content-Type': handler.contentType,
              'Content-Length': contentLength.toString(),
            },
          }),
        ),
      );
    }

    await Promise.all(cacheOperations);

    await cache.put(
      `/models/${modelKey}/manifest.json`,
      new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    store.setCachingStatus(modelKey, 'CACHED');
  } catch (err) {
    store.setCachingStatus(modelKey, 'ERROR');
    throw err;
  }
}

export async function getCachedManifest(modelKey) {
  const cache = await caches.open('transformers-cache');
  const response = await cache.match(`/models/${modelKey}/manifest.json`);
  return response ? await response.json() : null;
}

export async function validateCachedFiles(modelKey, manifest) {
  const cache = await caches.open('transformers-cache');

  for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
    const response = await cache.match(`/models/${modelKey}/${relativePath}`);
    if (!response) {
      return false;
    }

    const data = await response.clone().arrayBuffer();
    const extension = relativePath.split('.').pop();
    const handler = FILE_TYPE_HANDLERS[extension];

    if (!handler) {
      console.error(`Unknown file type: ${extension}`);
      return false;
    }

    const actualHash = await handler.getHash(data);
    if (actualHash !== expectedHash) {
      return false;
    }
  }

  return true;
}

export async function deleteModelsCache(modelKeys) {
  const cache = await caches.open('transformers-cache');
  const keys = await cache.keys();
  const deletionPromises = keys
    .filter((key) =>
      modelKeys.some((model) => key.url.includes(`/models/${model}/`)),
    )
    .map((key) => cache.delete(key));
  await Promise.all(deletionPromises);
}

export async function deleteAllCache() {
  const cache = await caches.open('transformers-cache');
  const keys = await cache.keys();
  await Promise.all(keys.map((key) => cache.delete(key)));
}
