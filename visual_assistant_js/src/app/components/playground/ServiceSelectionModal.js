// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useState } from 'react';
import {
  Modal,
  SpaceBetween,
  Checkbox,
  Button,
  Box,
  Spinner,
  Alert,
} from '@cloudscape-design/components';
import { useServiceSelectionStore } from 'src/app/stores/serviceSelectionStore';
import { useMetaStore } from 'src/app/stores/metaStore';
import {
  fetchModelUrl,
  downloadAndCacheModels,
} from 'src/app/utils/modelFetching';
import { WORKER_TO_MODEL_MAP } from 'src/app/globals';
import { useAuthenticator } from '@aws-amplify/ui-react';

const RATE_LIMIT = {
  MAX_DOWNLOADS: 5,          // Maximum number of downloads allowed
  TIME_WINDOW: 3600000,      // Time window in milliseconds (1 hour)
  COOLDOWN: 300000,          // Cooldown period in milliseconds (5 minutes)
};

class RateLimiter {
  constructor() {
    this.loadState();
  }

  loadState() {
    if (typeof window === 'undefined') {
      this.downloadHistory = [];
      this.isInCooldown = false;
      return;
    }

    try {
      const savedState = localStorage.getItem('downloadRateLimit');
      if (savedState) {
        const { downloadHistory, isInCooldown } = JSON.parse(savedState);
        this.downloadHistory = downloadHistory;
        this.isInCooldown = isInCooldown;
      } else {
        this.downloadHistory = [];
        this.isInCooldown = false;
      }
    } catch (e) {
      console.error('Error loading rate limit state:', e);
      this.downloadHistory = [];
      this.isInCooldown = false;
    }
    this.cooldownTimeout = null;
  }

  saveState() {
    if (typeof window === 'undefined') {return;}

    try {
      localStorage.setItem(
        'downloadRateLimit',
        JSON.stringify({
          downloadHistory: this.downloadHistory,
          isInCooldown: this.isInCooldown,
        })
      );
    } catch (e) {
      console.error('Error saving rate limit state:', e);
    }
  }

  canDownload() {
    const now = Date.now();

    // Clear old entries outside the time window
    this.downloadHistory = this.downloadHistory.filter(
      (timestamp) => now - timestamp < RATE_LIMIT.TIME_WINDOW
    );

    // Check if in cooldown
    if (this.isInCooldown) {
      return false;
    }

    // Check if within rate limit
    return this.downloadHistory.length < RATE_LIMIT.MAX_DOWNLOADS;
  }

  recordDownload() {
    this.downloadHistory.push(Date.now());

    // If reached limit, set cooldown
    if (this.downloadHistory.length >= RATE_LIMIT.MAX_DOWNLOADS) {
      this.isInCooldown = true;
      this.cooldownTimeout = setTimeout(() => {
        this.isInCooldown = false;
        this.downloadHistory = [];
        this.saveState();
      }, RATE_LIMIT.COOLDOWN);
    }
    this.saveState();
  }

  getRemainingDownloads() {
    return RATE_LIMIT.MAX_DOWNLOADS - this.downloadHistory.length;
  }

  getCooldownTimeRemaining() {
    if (!this.isInCooldown) {return 0;}
    return RATE_LIMIT.COOLDOWN - (Date.now() - this.downloadHistory[this.downloadHistory.length - 1]);
  }
}

// Create a singleton instance
const rateLimiter = new RateLimiter();

const ServiceSelectionModal = () => {
  const { showModal, setShowModal } = useMetaStore();
  const {
    selectedServices,
    setSelectedService,
    validateAndUpdateModelStatus,
    updateRemoteModelInfo,
    getModelDownloadStatus,
    remoteModelInfo,
  } = useServiceSelectionStore();

  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  const [serviceStatus, setServiceStatus] = useState({});
  const [isProcessing, setIsProcessing] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (showModal && authStatus === 'authenticated') {
      const fetchRemoteModelInfo = async () => {
        if (navigator.onLine) {
          try {
            const modelUrlData = await fetchModelUrl();
            updateRemoteModelInfo(modelUrlData);
            setFetchFailed(false);
          } catch (error) {
            console.error('Failed to fetch remote model info:', error);
            setFetchFailed(true);
          }
        }

        setIsProcessing(true);
        await validateAndUpdateModelStatus();
        await updateServiceStatus();
        setIsProcessing(false);
      };

      fetchRemoteModelInfo();
    }
  }, [showModal, authStatus, validateAndUpdateModelStatus, updateRemoteModelInfo]);

  const updateServiceStatus = async () => {
    const newServiceStatus = await Object.entries(WORKER_TO_MODEL_MAP).reduce(
      async (accPromise, [service, models]) => {
        const acc = await accPromise;
        const modelStatuses = await Promise.all(
          models.map(getModelDownloadStatus),
        );

        if (
          modelStatuses.some((status) =>
            ['unavailable', 'outdatedUnavailable'].includes(status),
          )
        ) {
          acc[service] = 'unavailable';
        } else if (modelStatuses.every((status) => status === 'upToDate')) {
          acc[service] = 'ready';
        } else if (
          modelStatuses.some((status) =>
            ['needsDownload', 'outdated'].includes(status),
          )
        ) {
          acc[service] = 'needsDownload';
        } else {
          acc[service] = 'processing';
        }

        return acc;
      },
      Promise.resolve({}),
    );

    setServiceStatus(newServiceStatus);
  };

  const handleConfirm = async () => {
    try {
      const selectedModels = Object.entries(selectedServices)
        .filter(([_, isSelected]) => isSelected)
        .flatMap(([service, _]) => WORKER_TO_MODEL_MAP[service]);

      const modelsToDownload = [];

      for (const model of selectedModels) {
        const status = await getModelDownloadStatus(model);
        if (status === 'needsDownload' || status === 'outdated') {
          modelsToDownload.push(model);
        }
      }

      // Only check rate limiting if there are models to download
      if (modelsToDownload.length > 0) {
        if (!rateLimiter.canDownload()) {
          const cooldownTime = rateLimiter.getCooldownTimeRemaining();
          if (cooldownTime > 0) {
            setError(
              `Download rate limit reached. Please wait ${Math.ceil(
                cooldownTime / 60000
              )} minutes before trying again.`
            );
            return;
          }
        }

        if (modelsToDownload.length > rateLimiter.getRemainingDownloads()) {
          setError(
            `You can only download ${rateLimiter.getRemainingDownloads()} more models in the current time window.`
          );
          return;
        }
      }

      setShowModal(false);

      if (modelsToDownload.length > 0) {
        try {
          // Record the download attempt only when actually downloading
          rateLimiter.recordDownload();

          await downloadAndCacheModels(modelsToDownload);
          await validateAndUpdateModelStatus();
          await updateServiceStatus();
        } catch (error) {
          console.error('Error during model download:', error);
          setError(error.message);
        }
      }
    } catch (error) {
      console.error('Error in handleConfirm:', error);
      setError(error.message);
    }
  };

  const statusMessages = {
    ready: { text: '(ready)', color: 'text-status-success' },
    needsDownload: { text: '(needs download)', color: 'text-status-warning' },
    processing: { text: '(processing)', color: 'text-status-info' },
    unavailable: {
      text: '(currently unavailable)',
      color: 'text-status-error',
    },
  };

  const renderServiceCheckbox = (service) => {
    const status = serviceStatus[service];
    const isReady = status === 'ready';
    const hasUndownloadableModel = WORKER_TO_MODEL_MAP[service].some(
      (model) => !remoteModelInfo[model],
    );
    const isDisabled =
      !navigator.onLine ||
      fetchFailed ||
      status === 'unavailable' ||
      isReady ||
      hasUndownloadableModel;

    const statusMessage = statusMessages[status];

    return (
      <SpaceBetween size="xs" key={service}>
        <Checkbox
          onChange={({ detail }) => setSelectedService(service, detail.checked)}
          checked={selectedServices[service] || false}
          disabled={isDisabled}
        >
          {service}
          {statusMessage && (
            <Box
              color={statusMessage.color}
              display="inline"
              padding={{ left: 'xs' }}
            >
              {statusMessage.text}
            </Box>
          )}
        </Checkbox>
      </SpaceBetween>
    );
  };

  return (
    <Modal
      onDismiss={() => setShowModal(false)}
      visible={showModal}
      header="Select desired ML models"
    >
      {isProcessing ? (
        <Box textAlign="center">
          <Spinner size="large" />
          <Box variant="p" padding={{ top: 'l' }}>
            Verifying model status...
          </Box>
        </Box>
      ) : (
        <SpaceBetween size="l">
          {!navigator.onLine && (
            <Alert type="error">
              You are currently offline. Model download is not available.
            </Alert>
          )}
          {fetchFailed && (
            <Alert type="error">
              Failed to fetch latest model information. Model download is not
              available.
            </Alert>
          )}
          {error && (
            <Alert type="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {Object.keys(WORKER_TO_MODEL_MAP).map((service) =>
            renderServiceCheckbox(service),
          )}
          <Box textAlign="right">
            <Button
              onClick={handleConfirm}
              variant="primary"
              disabled={!navigator.onLine || fetchFailed}
            >
              Confirm
            </Button>
          </Box>
        </SpaceBetween>
      )}
    </Modal>
  );
};

export default ServiceSelectionModal;
