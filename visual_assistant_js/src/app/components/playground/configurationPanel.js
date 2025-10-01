// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import {
  Box,
  Button,
  ColumnLayout,
  Container,
  Header,
  Slider,
  SpaceBetween,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useDepthStore } from 'src/app/stores/depthStore';
import { useDetectionStore } from 'src/app/stores/detectionStore';
import { useMetaStore } from 'src/app/stores/metaStore';
import { WORKER_TO_MODEL_MAP, CHAT_MODEL_MAP } from 'src/app/globals';
import { deleteAllCache, deleteModelsCache } from 'src/app/utils/modelFetching';

const ConfigurationPanel = () => {
  const alertThreshold = useMetaStore((state) => state.alertThreshold);
  const setAlertThreshold = useMetaStore((state) => state.setAlertThreshold);
  const quality = useMetaStore((state) => state.quality);
  const depthSize = useDepthStore((state) => state.size);
  const setObjectDepthSize = useDepthStore((state) => state.setSize);
  const objectDetSize = useDetectionStore((state) => state.objectDetSize);
  const setObjectDetSize = useDetectionStore((state) => state.setObjectDetSize);
  const threshold = useDetectionStore((state) => state.threshold);
  const setThreshold = useDetectionStore((state) => state.setThreshold);
  const setConfigPanelOpen = useMetaStore((state) => state.setConfigPanelOpen);
  const voiceControlEnabled = useMetaStore(
    (state) => state.voiceControlEnabled,
  );
  const setVoiceControlEnabled = useMetaStore(
    (state) => state.setVoiceControlEnabled,
  );
  const currentMode = useMetaStore((state) => state.currentMode);
  const workerKeys = Object.keys(WORKER_TO_MODEL_MAP);

  return (
    <Container>
      <SpaceBetween size="xs">
        <Header
          variant="h2"
          actions={
            <Button
              iconName="close"
              variant="icon"
              onClick={() => setConfigPanelOpen(false)}
              ariaLabel="Close configuration panel"
            />
          }
        >
          Configuration
        </Header>

        <SpaceBetween size="xs">
          <Header variant="h3">Models cache management</Header>
          <ColumnLayout columns={1} variant="text-grid">
            <SpaceBetween size="xs">
              <div>
                You should reload the page after having deleted one or multiple
                caches to avoid any incoherent state.
              </div>
              <SpaceBetween size="xs">
                {workerKeys.map((key) => (
                  <Button
                    key={key}
                    onClick={() => deleteModelsCache(WORKER_TO_MODEL_MAP[key])}
                    variant="primary"
                    iconName="remove"
                  >
                    Delete {key} cache
                  </Button>
                ))}
                {/* Add chat model cache deletion */}
                <Button
                  onClick={() => deleteModelsCache(['chat'])}
                  variant="primary"
                  iconName="remove"
                >
                  Delete chat cache
                </Button>
              </SpaceBetween>
              <Button
                onClick={deleteAllCache}
                variant="normal"
                iconName="remove"
              >
                Delete whole Transformers.js cache
              </Button>
            </SpaceBetween>
          </ColumnLayout>
        </SpaceBetween>

        <SpaceBetween size="xs">
          <Header
            variant="h3"
            description="Voice control for switching modes. Say 'switch mode' to cycle through modes, or say 'switch to playground', 'switch to navigation', or 'switch to chat' for specific modes."
          >
            Voice control
          </Header>
          <Box>
            <Button
              onClick={() => setVoiceControlEnabled(!voiceControlEnabled)}
              variant={voiceControlEnabled ? 'primary' : 'normal'}
            >
              {voiceControlEnabled ? 'Disable' : 'Enable'} voice control
            </Button>
            {voiceControlEnabled && (
              <Box margin={{ top: 'xxs' }}>
                <StatusIndicator type="success">
                  Active - Current mode:{' '}
                  {currentMode === 'navigation' ? 'Navigation' :
                    currentMode === 'chat' ? 'Chat' : 'Playground'}
                </StatusIndicator>
              </Box>
            )}
          </Box>
        </SpaceBetween>

        <SpaceBetween size="xs">
          <Header variant="h3">Video settings</Header>
          <ColumnLayout columns={1} variant="text-grid">
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">
                Video quality{' '}
                <StatusIndicator type="info">Coming soon</StatusIndicator>
              </Box>
              <Slider disabled value={quality} max={100} min={1} />
            </SpaceBetween>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">
                Video scale{' '}
                <StatusIndicator type="info">Coming soon</StatusIndicator>
              </Box>
              <Slider disabled value={quality} max={100} min={1} />
            </SpaceBetween>
          </ColumnLayout>
        </SpaceBetween>

        <SpaceBetween size="xs">
          <Header variant="h3">Alert system</Header>
          <ColumnLayout columns={1} variant="text-grid">
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Max distance for alert</Box>
              <Slider
                onChange={({ detail }) => setAlertThreshold(detail.value)}
                value={alertThreshold}
                max={5}
                step={0.1}
                min={0.1}
              />
            </SpaceBetween>
          </ColumnLayout>
        </SpaceBetween>

        <SpaceBetween size="xs">
          <Header variant="h3">Object detection</Header>
          <ColumnLayout columns={1} variant="text-grid">
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Feature extractor size</Box>
              <Slider
                onChange={({ detail }) => setObjectDetSize(detail.value)}
                value={objectDetSize}
                max={256}
                min={1}
              />
            </SpaceBetween>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Detection threshold</Box>
              <Slider
                onChange={({ detail }) => setThreshold(detail.value)}
                value={threshold}
                max={100}
                min={1}
              />
            </SpaceBetween>
          </ColumnLayout>
        </SpaceBetween>

        <SpaceBetween size="xs">
          <Header variant="h3">Depth estimation</Header>
          <ColumnLayout columns={1} variant="text-grid">
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Feature extractor size</Box>
              <Slider
                onChange={({ detail }) => setObjectDepthSize(detail.value)}
                value={depthSize}
                max={1024}
                min={1}
              />
            </SpaceBetween>
          </ColumnLayout>
        </SpaceBetween>
      </SpaceBetween>
    </Container>
  );
};

export default ConfigurationPanel;
