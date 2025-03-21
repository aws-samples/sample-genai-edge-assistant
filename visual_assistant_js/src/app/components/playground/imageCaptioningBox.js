// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import {
  Container,
  Header,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useImageCaptioningStore } from 'src/app/stores/imageCaptioningStore';
import { useAudioStore } from 'src/app/stores/audioStore';
import { useImageCaptioningProcessing } from 'src/app/hooks/useImageCaptioningProcessing';
import { useAudioProcessing } from 'src/app/hooks/useAudioProcessing';

const ImageCaptioningBox = () => {
  const { status: imageCaptioningStatus } = useImageCaptioningProcessing();
  const { status: audioStatus } = useAudioProcessing();

  const caption = useImageCaptioningStore((state) => state.caption);
  const { isReady: isImageCaptioningRunning } = useImageCaptioningStore(
    (state) => state.workerState,
  );

  // If TTS is enabled for audio
  const audioUrl = useAudioStore((state) => state.url);

  const isAudioEnabled = audioStatus !== 'off';

  if (imageCaptioningStatus === 'off') {
    return null;
  }

  return (
    <Container
      header={
        <Header
          variant="h3"
          info={
            <StatusIndicator
              type={!isImageCaptioningRunning ? 'stopped' : 'loading'}
            >
              {!isImageCaptioningRunning ? 'stopped' : 'running'}
            </StatusIndicator>
          }
        >
          Image captioning {isAudioEnabled && 'and audio synthesis'}
        </Header>
      }
    >
      {caption || 'Analyzing image...'}

      <br />
      <br />
      {audioUrl && (
        <audio controls src={audioUrl}>
          <i>Your browser does not support the audio element.</i>
        </audio>
      )}
    </Container>
  );
};

export default ImageCaptioningBox;
