// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { useState } from 'react';
import { SpaceBetween } from '@cloudscape-design/components';
import AudioRecorder from './audioRecorder';
import AudioPlayer from './audioPlayer';

export default function AudioRecorderPreview({ onAudioConfirmed, onCancel }) {
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);

  const handleAudioReady = (blob, dur) => {
    setAudioBlob(blob);
    setDuration(dur);
  };

  const handleReRecord = () => {
    setAudioBlob(null);
    setDuration(0);
  };

  const handleConfirm = () => {
    onAudioConfirmed?.(audioBlob, duration);
    setAudioBlob(null);
    setDuration(0);
  };

  const handleCancel = () => {
    setAudioBlob(null);
    setDuration(0);
    onCancel?.();
  };

  return (
    <SpaceBetween size="s">
      {!audioBlob ? (
        <AudioRecorder onAudioReady={handleAudioReady} onCancel={handleCancel} />
      ) : (
        <AudioPlayer
          audioBlob={audioBlob}
          recordedDuration={duration}
          onReRecord={handleReRecord}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
        />
      )}
    </SpaceBetween>
  );
}