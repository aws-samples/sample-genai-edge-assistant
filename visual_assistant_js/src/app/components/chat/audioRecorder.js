// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, SpaceBetween, Button, Alert } from '@cloudscape-design/components';

export default function AudioRecorder({ onAudioReady, onCancel, disabled = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const durationRef = useRef(0); // Track duration with ref

  useEffect(() => {
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const newDuration = prev + 1;
          durationRef.current = newDuration; // Keep ref in sync
          return newDuration;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const recordedDuration = durationRef.current; // Use ref value
        if (recordedDuration === 0) {
          console.warn('AudioRecorder: Recording duration is 0, this may indicate a timing issue');
        }
        onAudioReady?.(audioBlob, recordedDuration);
        cleanup();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      durationRef.current = 0; // Reset ref too
      setError(null);
    } catch (err) {
      setError('Failed to access microphone');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    onCancel?.();
  };

  const cleanup = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    clearInterval(timerRef.current);
    setIsRecording(false);
    setDuration(0);
    durationRef.current = 0; // Reset ref too
    audioChunksRef.current = [];
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SpaceBetween size="s">
      {error && <Alert type="error">{error}</Alert>}

      <Box fontSize="body-m" fontWeight="bold">
        {formatTime(duration)}
      </Box>

      <SpaceBetween direction="horizontal" size="s">
        {!isRecording ? (
          <Button
            variant="primary"
            iconName="microphone"
            onClick={startRecording}
            disabled={disabled}
          >
            Start Recording
          </Button>
        ) : (
          <>
            <Button variant="primary" iconName="check" onClick={stopRecording}>
              Stop & Save
            </Button>
            <Button variant="link" onClick={cancelRecording}>
              Cancel
            </Button>
          </>
        )}
      </SpaceBetween>
    </SpaceBetween>
  );
}