// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Simple audio processing utilities
 */

export const blobToArrayBuffer = async (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(blob);
  });
};

export const processAudioBlobForBackend = async (blob, duration = null) => {
  const buffer = await blobToArrayBuffer(blob);
  const metadata = {
    size: blob.size,
    type: blob.type,
    duration: duration || 0,
    processedAt: new Date().toISOString(),
  };
  return { buffer, metadata };
};