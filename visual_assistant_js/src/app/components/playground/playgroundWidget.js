// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Container,
  Grid,
  Header,
  SpaceBetween,
  Toggle,
  AppLayout,
} from '@cloudscape-design/components';
import ConfigurationPanel from 'src/app/components/playground/configurationPanel';
import { useAudioProcessing } from 'src/app/hooks/useAudioProcessing';
import { useDepthProcessing } from 'src/app/hooks/useDepthProcessing';
import { useDetectionProcessing } from 'src/app/hooks/useDetectionProcessing';
import { useImageCaptioningProcessing } from 'src/app/hooks/useImageCaptioningProcessing';
import { useServiceSelectionStore } from 'src/app/stores/serviceSelectionStore';
import ModelsDownloadInfoBox from 'src/app/components/playground/modelsDownloadInfoBox';
import WorkerLogsBox from 'src/app/components/playground/workerLogsBox';
import { useDepthStore } from 'src/app/stores/depthStore';
import PlaygroundCamera from 'src/app/components/playground/playgroundCameras';
import { useMetaStore } from 'src/app/stores/metaStore';
import ServiceSelectionModal from 'src/app/components/playground/ServiceSelectionModal';
import ObjectDistancesBox from 'src/app/components/playground/objectDistancesBox';
import CustomHelpPanel from 'src/app/components/playground/helpPanel';
import ImageCaptioningBox from 'src/app/components/playground/imageCaptioningBox';
import TopBar from 'src/app/components/topBar';

export default function PlaygroundMode() {
  const {
    canvasRef: depthDrawingCanvasRef,
    toggleWorker: toggleDepthWorker,
    status: depthStatus,
  } = useDepthProcessing();

  const { toggleWorker: toggleDetectionWorker, status: detectionStatus } =
    useDetectionProcessing();

  const { toggleWorker: toggleAudioWorker, status: audioStatus } =
    useAudioProcessing();

  const {
    toggleWorker: toggleImageCaptioningWorker,
    status: imageCaptioningStatus,
  } = useImageCaptioningProcessing();

  const { selectedServices, validateAndUpdateModelStatus, isServiceReady } =
    useServiceSelectionStore();

  const { configPanelOpen, setConfigPanelOpen } = useMetaStore();

  const [toolsOpen, setToolsOpen] = useState(true);

  const { isReady: isDepthRunning } = useDepthStore(
    (state) => state.workerState,
  );

  useEffect(() => {
    validateAndUpdateModelStatus();
  }, [selectedServices]);

  useEffect(() => {
    const helpMediaQuery = window.matchMedia('(max-width: 992px)');
    const configMediaQuery = window.matchMedia('(max-width: 1200px)');

    const handleMediaQueryChange = (e) => {
      setToolsOpen(!e.matches);
    };

    const handleConfigMediaQueryChange = (e) => {
      setConfigPanelOpen(!e.matches);
    };

    handleMediaQueryChange(helpMediaQuery);
    handleConfigMediaQueryChange(configMediaQuery);

    helpMediaQuery.addEventListener('change', handleMediaQueryChange);
    configMediaQuery.addEventListener('change', handleConfigMediaQueryChange);

    return () => {
      helpMediaQuery.removeEventListener('change', handleMediaQueryChange);
      configMediaQuery.removeEventListener(
        'change',
        handleConfigMediaQueryChange,
      );
    };
  }, [setConfigPanelOpen]);

  const handleToggleWorker = (worker, toggleFn) => {
    if (isServiceReady(worker)) {
      toggleFn();
    }
  };

  const disableAllWorkers = () => {
    const workers = [
      { name: 'depth', status: depthStatus, toggle: toggleDepthWorker },
      {
        name: 'detection',
        status: detectionStatus,
        toggle: toggleDetectionWorker,
      },
      { name: 'audio', status: audioStatus, toggle: toggleAudioWorker },
      {
        name: 'imageCaptioning',
        status: imageCaptioningStatus,
        toggle: toggleImageCaptioningWorker,
      },
    ];

    workers.forEach(({ name, status, toggle }) => {
      if (status !== 'off') {
        handleToggleWorker(name, toggle);
      }
    });
  };

  useEffect(() => {
    if (!isDepthRunning && depthDrawingCanvasRef.current) {
      const ctx = depthDrawingCanvasRef.current.getContext('2d');
      ctx.clearRect(
        0,
        0,
        depthDrawingCanvasRef.current.width,
        depthDrawingCanvasRef.current.height,
      );
    }
  }, [isDepthRunning, depthDrawingCanvasRef]);

  useEffect(() => {
    return () => {
      disableAllWorkers();
    };
  }, []);

  const content = (
    <SpaceBetween size="m">
      <div
        style={{
          backgroundColor: '#000000',
        }}
        id="top-bar"
      >
        <TopBar />
      </div>
      <Container
        header={
          <Header
            variant="h3"
            description="Toggle workers activation. Reload the page to be prompted again for models download."
          >
            ML workers dashboard
          </Header>
        }
      >
        <Grid
          gridDefinition={[
            { colspan: { default: 12, s: 6, m: 4 } },
            { colspan: { default: 12, s: 6, m: 4 } },
            { colspan: { default: 12, s: 12, m: 4 } },
          ]}
        >
          <Container disablePaddings={true} className="p-2">
            <div className="flex items-center space-x-2">
              <Toggle
                checked={depthStatus !== 'off'}
                onChange={() => handleToggleWorker('depth', toggleDepthWorker)}
                disabled={
                  !isServiceReady('depth') ||
                  (depthStatus !== 'off' && depthStatus !== 'ready')
                }
              >
                Depth estimation
              </Toggle>
              <i className="text-sm text-gray-500">({depthStatus})</i>
            </div>
          </Container>

          <Container disablePaddings={true} className="p-2">
            <div className="flex items-center space-x-2">
              <Toggle
                checked={detectionStatus !== 'off'}
                onChange={() =>
                  handleToggleWorker('detection', toggleDetectionWorker)
                }
                disabled={
                  !isServiceReady('detection') ||
                  (detectionStatus !== 'off' && detectionStatus !== 'ready')
                }
              >
                Object detection
              </Toggle>
              <i className="text-sm text-gray-500">({detectionStatus})</i>
            </div>
          </Container>

          <Container disablePaddings={true} className="p-2">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <Toggle
                  checked={imageCaptioningStatus !== 'off'}
                  onChange={() => {
                    if (audioStatus !== 'off') {
                      handleToggleWorker('audio', toggleAudioWorker);
                    }
                    handleToggleWorker(
                      'imageCaptioning',
                      toggleImageCaptioningWorker,
                    );
                  }}
                  disabled={
                    audioStatus === 'loading' ||
                    !isServiceReady('imageCaptioning') ||
                    (imageCaptioningStatus !== 'off' &&
                      imageCaptioningStatus !== 'ready')
                  }
                >
                  Image captioning
                </Toggle>
                <i className="text-sm text-gray-500">
                  ({imageCaptioningStatus})
                </i>
              </div>

              <div className="flex items-center space-x-2">
                <Toggle
                  checked={audioStatus !== 'off'}
                  description={
                    imageCaptioningStatus !== 'ready'
                      ? '⚠️ Requires text captioning'
                      : ''
                  }
                  onChange={() =>
                    handleToggleWorker('audio', toggleAudioWorker)
                  }
                  disabled={
                    imageCaptioningStatus !== 'ready' ||
                    !isServiceReady('audio') ||
                    audioStatus === 'loading'
                  }
                >
                  Text to audio
                </Toggle>
                <i className="text-sm text-gray-500">({audioStatus})</i>
              </div>
            </div>
          </Container>
        </Grid>
      </Container>

      <ModelsDownloadInfoBox />
      <PlaygroundCamera depthDrawingCanvasRef={depthDrawingCanvasRef} />
      <ObjectDistancesBox />
      <ImageCaptioningBox />
      <WorkerLogsBox />
    </SpaceBetween>
  );

  return (
    <>
      <AppLayout
        navigation={
          <div style={{ padding: '16px' }}>
            <ConfigurationPanel />
          </div>
        }
        navigationWidth={350}
        navigationOpen={configPanelOpen}
        onNavigationChange={({ detail }) => setConfigPanelOpen(detail.open)}
        content={<ContentLayout>{content}</ContentLayout>}
        tools={<CustomHelpPanel />}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        contentType="default"
        toolsWidth={300}
      />
      <ServiceSelectionModal />
    </>
  );
}
