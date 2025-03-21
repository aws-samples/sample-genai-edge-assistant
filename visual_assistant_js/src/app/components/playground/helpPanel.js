// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import { StatusIndicator } from '@cloudscape-design/components';
import HelpPanel from '@cloudscape-design/components/help-panel';
import Icon from '@cloudscape-design/components/icon';
import { useAudioStore } from 'src/app/stores/audioStore';
import { useDepthStore } from 'src/app/stores/depthStore';
import { useDetectionStore } from 'src/app/stores/detectionStore';
import { useImageCaptioningStore } from 'src/app/stores/imageCaptioningStore';
import { useDepthProcessing } from 'src/app/hooks/useDepthProcessing';
import { useDetectionProcessing } from 'src/app/hooks/useDetectionProcessing';
import { useImageCaptioningProcessing } from 'src/app/hooks/useImageCaptioningProcessing';
import { useAudioProcessing } from 'src/app/hooks/useAudioProcessing';

// Custom help panel component that displays FPS metrics for different models
// and video format information
const CustomHelpPanel = () => {
  const { status: depthStatus } = useDepthProcessing();
  const { status: detectionStatus } = useDetectionProcessing();
  const { status: imageCaptioningStatus } = useImageCaptioningProcessing();
  const { status: audioStatus } = useAudioProcessing();

  const { isReady: isDepthRunning } = useDepthStore(
    (state) => state.workerState,
  );
  const { isReady: isDetectionRunning } = useDetectionStore(
    (state) => state.workerState,
  );
  const { isReady: isImageCaptioningRunning } = useImageCaptioningStore(
    (state) => state.workerState,
  );
  const { isReady: isAudioRunning } = useAudioStore(
    (state) => state.workerState,
  );

  const depthFps = useDepthStore((state) => state.fps);
  const detectionFps = useDetectionStore((state) => state.fps);
  const imageCaptioningFps = useImageCaptioningStore((state) => state.fps);
  const audioFps = useAudioStore((state) => state.fps);

  const getStatusIndicatorType = (status, isRunning) => {
    if (status === 'off') {
      return 'stopped';
    }
    if (status === 'ready' && isRunning) {
      return 'info';
    }
    return 'pending';
  };

  const getStatusText = (status, isRunning, fps) => {
    if (status === 'off') {
      return '----';
    }
    if (status === 'ready' && isRunning) {
      return `${fps.toFixed(1)} FPS`;
    }
    return 'loading';
  };

  return (
    <HelpPanel
      footer={
        <div>
          <h3>
            About <Icon name="external" />
          </h3>
          <ul>
            <li>
              <a href="https://aws.amazon.com/">Amazon Web Services</a>
            </li>
            <li>
              <a href="http://github.com/xenova/transformers.js">
                🤗 Transformers.js
              </a>
            </li>
            <li>
              <a href="https://cloudscape.design/">Cloudscape design</a>
            </li>
          </ul>
        </div>
      }
      header={<h2>Monitoring</h2>}
    >
      <div>
        <h3>Models performance</h3>
        <StatusIndicator
          type={getStatusIndicatorType(depthStatus, isDepthRunning)}
        >
          Depth estimation:{' '}
          {getStatusText(depthStatus, isDepthRunning, depthFps)}
        </StatusIndicator>
        <br />
        <StatusIndicator
          type={getStatusIndicatorType(detectionStatus, isDetectionRunning)}
        >
          Object detection:{' '}
          {getStatusText(detectionStatus, isDetectionRunning, detectionFps)}
        </StatusIndicator>
        <br />
        <StatusIndicator
          type={getStatusIndicatorType(
            imageCaptioningStatus,
            isImageCaptioningRunning,
          )}
        >
          Image captioning:{' '}
          {getStatusText(
            imageCaptioningStatus,
            isImageCaptioningRunning,
            imageCaptioningFps,
          )}
        </StatusIndicator>
        <br />
        <StatusIndicator
          type={getStatusIndicatorType(audioStatus, isAudioRunning)}
        >
          Audio: {getStatusText(audioStatus, isAudioRunning, audioFps)}
        </StatusIndicator>
      </div>
    </HelpPanel>
  );
};

export default CustomHelpPanel;
