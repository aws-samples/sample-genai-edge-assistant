// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import {
  Alert,
  Grid,
  ProgressBar,
  Icon,
  Spinner,
} from '@cloudscape-design/components';
import { useServiceSelectionStore } from 'src/app/stores/serviceSelectionStore';

const STATUS_CONFIGS = {
  error: {
    status: 'error',
    icon: <Icon name="error" />,
    text: 'Error occurred during download',
  },
  needsDownload: {
    status: 'pending',
    icon: <Icon name="download" />,
    text: 'Ready to download',
  },
  outdated: {
    status: 'warning',
    icon: <Icon name="warning" />,
    text: 'Update available',
  },
  downloading: {
    status: 'in-progress',
    icon: <Icon name="download" />,
    text: 'Downloading...',
  },
  caching: {
    status: 'in-progress',
    icon: <Spinner size="normal" />,
    text: 'Caching...',
  },
  upToDate: {
    status: 'success',
    icon: <Icon name="status-positive" />,
    text: 'Ready to use',
  },
  processing: {
    status: 'in-progress',
    icon: <Spinner size="normal" />,
    text: 'Processing...',
  },
  unavailable: {
    status: 'error',
    icon: <Icon name="error" />,
    text: 'Not available for download',
  },
};

const ModelsDownloadInfoBox = () => {
  const downloadProgress = useServiceSelectionStore(
    (state) => state.downloadProgress,
  );
  const cachingStatus = useServiceSelectionStore(
    (state) => state.cachingStatus,
  );
  const getModelDownloadStatus = useServiceSelectionStore(
    (state) => state.getModelDownloadStatus,
  );

  if (
    !downloadProgress ||
    !cachingStatus ||
    Object.keys(downloadProgress).length === 0 ||
    (Object.values(downloadProgress).every((progress) => progress === 100) &&
      Object.values(cachingStatus).every((status) => status === 'CACHED'))
  ) {
    return null;
  }

  const getModelStatus = (modelName) => {
    const progress = downloadProgress[modelName];
    const caching = cachingStatus[modelName];

    if (progress === -1) {
      return {
        ...STATUS_CONFIGS.error,
        text: `Error downloading ${modelName}`,
        value: 0,
      };
    }

    if (progress < 100) {
      return {
        ...STATUS_CONFIGS.downloading,
        value: progress,
        description: `Downloading ${modelName}`,
      };
    }

    if (caching === 'CACHING') {
      return {
        ...STATUS_CONFIGS.caching,
        value: 100,
        description: `Caching ${modelName}...`,
      };
    }

    if (caching === 'CACHED') {
      return {
        ...STATUS_CONFIGS.upToDate,
        value: 100,
        description: `${modelName} ready`,
      };
    }

    if (caching === 'ERROR') {
      return {
        ...STATUS_CONFIGS.error,
        value: 100,
        description: `Error caching ${modelName}`,
      };
    }

    return {
      ...STATUS_CONFIGS.error,
      value: 0,
      description: `Unknown status for ${modelName}`,
    };
  };


  return (
    <Alert status="info">
      {Object.keys(downloadProgress).map((modelName) => {
        const modelStatus = getModelStatus(modelName);
        return (
          <Grid
            gridDefinition={[
              { colspan: { default: 12, xs: 4 } },
              { colspan: { default: 12, xs: 8 } },
            ]}
            disableGutters={true}
            key={modelName}
          >
            <div className="flex items-center">
              {modelStatus.icon}
              <span className="ml-2">{modelName}</span>
            </div>
            <ProgressBar
              value={modelStatus.value}
              description={modelStatus.description}
              status={modelStatus.status}
            />
          </Grid>
        );
      })}
    </Alert>
  );
};

export default ModelsDownloadInfoBox;
