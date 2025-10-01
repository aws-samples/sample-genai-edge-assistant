// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useState } from 'react';
import {
  Modal,
  SpaceBetween,
  Button,
  Box,
  Alert,
  ProgressBar,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useServiceSelectionStore } from 'src/app/stores/serviceSelectionStore';
import {
  fetchModelUrl,
  downloadAndCacheModels,
  getCachedManifest,
  validateCachedFiles,
} from 'src/app/utils/modelFetching';
import { CHAT_MODEL_MAP } from 'src/app/globals';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function ChatModelModal({ visible, onDismiss, onModelReady }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [modelStatus, setModelStatus] = useState('checking');
  const { authStatus } = useAuthenticator();

  const {
    remoteModelInfo,
    updateRemoteModelInfo,
    downloadProgress: storeDownloadProgress,
    cachingStatus,
  } = useServiceSelectionStore();

  // Check model status on mount
  useEffect(() => {
    if (visible) {
      fetchRemoteModelInfo().then(() => {
        checkModelStatus();
      });
    }
  }, [visible]);

  // Update download progress
  useEffect(() => {
    const chatProgress = storeDownloadProgress['chat'];
    if (chatProgress !== undefined) {
      setDownloadProgress(chatProgress);
    }
  }, [storeDownloadProgress]);

  const checkModelStatus = async () => {
    try {
      const manifest = await getCachedManifest('chat');
      const remoteInfo = remoteModelInfo['chat'];

      if (!manifest) {
        setModelStatus('missing');
      } else if (!remoteInfo) {
        // No remote info, check if files are valid
        const isValid = await validateCachedFiles('chat', manifest);
        setModelStatus(isValid ? 'ready' : 'invalid');
      } else {
        // Compare ETags to detect updates
        const localETag = manifest.etag;
        const serverETag = remoteInfo.ETag;

        if (localETag !== serverETag) {
          // Server has newer version
          setModelStatus('outdated');
        } else {
          // ETags match, validate files
          const isValid = await validateCachedFiles('chat', manifest);
          setModelStatus(isValid ? 'ready' : 'invalid');
          if (isValid && onModelReady) {
            onModelReady();
          }
        }
      }
    } catch (error) {
      console.error('Error checking model status:', error);
      setModelStatus('error');
    }
  };

  const fetchRemoteModelInfo = async () => {
    if (authStatus !== 'authenticated') {return;}

    try {
      const modelUrlData = await fetchModelUrl();
      updateRemoteModelInfo(modelUrlData);
    } catch (error) {
      console.error('Error fetching model info:', error);
      setError('Failed to fetch model information');
    }
  };

  const handleDownload = async () => {
    if (!remoteModelInfo['chat']) {
      setError('Model not available for download');
      return;
    }

    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      await downloadAndCacheModels(['chat']);
      setModelStatus('ready');
      if (onModelReady) {
        onModelReady();
      }
    } catch (error) {
      console.error('Download failed:', error);
      setError(`Download failed: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const getStatusIndicator = () => {
    switch (modelStatus) {
    case 'ready':
      return <StatusIndicator type="success">Model ready</StatusIndicator>;
    case 'missing':
      return <StatusIndicator type="warning">Model not downloaded</StatusIndicator>;
    case 'invalid':
      return <StatusIndicator type="error">Model corrupted</StatusIndicator>;
    case 'outdated':
      return <StatusIndicator type="warning">New version available</StatusIndicator>;
    case 'checking':
      return <StatusIndicator type="pending">Checking model...</StatusIndicator>;
    default:
      return <StatusIndicator type="error">Unknown status</StatusIndicator>;
    }
  };

  const canDownload = ['missing', 'invalid', 'outdated'].includes(modelStatus) && remoteModelInfo['chat'] && !isDownloading;
  const showProgress = isDownloading && downloadProgress > 0;

  return (
    <Modal
      onDismiss={onDismiss}
      visible={visible}
      header="Local Chat Model"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            {canDownload && (
              <Button
                variant="primary"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                Download Model
              </Button>
            )}
            {modelStatus === 'ready' && (
              <Button variant="primary" onClick={onDismiss}>
                Use Model
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween direction="vertical" size="m">
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box>
          <SpaceBetween direction="vertical" size="s">
            <Box variant="h3">Janus Pro 1B Chat Model</Box>
            <Box variant="p">
              This model enables local chat functionality with image understanding capabilities.
              The model will be downloaded and cached locally for offline use.
            </Box>

            <Box>
              <strong>Status:</strong> {getStatusIndicator()}
            </Box>

            {showProgress && (
              <Box>
                <Box variant="small" color="text-body-secondary" margin={{ bottom: 'xs' }}>
                  Downloading model... {downloadProgress}%
                </Box>
                <ProgressBar
                  value={downloadProgress}
                  variant={downloadProgress === 100 ? 'success' : 'default'}
                />
              </Box>
            )}

            {cachingStatus['chat'] === 'CACHING' && (
              <Box>
                <StatusIndicator type="in-progress">
                  Processing and caching model files...
                </StatusIndicator>
              </Box>
            )}

            {modelStatus === 'missing' && !remoteModelInfo['chat'] && (
              <Alert type="warning">
                Model is not available for download. Please check your internet connection and try again.
              </Alert>
            )}
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </Modal>
  );
}