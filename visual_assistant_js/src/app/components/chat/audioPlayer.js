// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, SpaceBetween, Button } from '@cloudscape-design/components';

export default function AudioPlayer({ audioBlob, recordedDuration, onReRecord, onCancel, onConfirm }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recordedDuration || 0);
  const audioRef = useRef(null);

  // Update duration when recordedDuration prop changes
  useEffect(() => {
    if (recordedDuration && recordedDuration > 0) {
      setDuration(recordedDuration);
    }
  }, [recordedDuration]);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load(); // Force load to get metadata
      }
      return () => URL.revokeObjectURL(url);
    }
  }, [audioBlob]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {return;}

    const handleLoadedMetadata = () => {
      // Use audio metadata duration if available, otherwise keep recorded duration
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioBlob]); // Re-run when audioBlob changes

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) {return '0:00';}
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SpaceBetween size="s">
      <audio ref={audioRef} />

      <SpaceBetween direction="horizontal" size="s" alignItems="center">
        <Button
          variant="icon"
          iconName={isPlaying ? 'pause' : 'play'}
          onClick={togglePlay}
        />
        <Box fontSize="body-s">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Box>
      </SpaceBetween>

      <SpaceBetween direction="horizontal" size="s">
        <Button variant="normal" onClick={onReRecord}>
          Re-record
        </Button>
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Send Audio
        </Button>
      </SpaceBetween>
    </SpaceBetween>
  );
}