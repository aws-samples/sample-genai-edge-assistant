// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, SpaceBetween, Button } from '@cloudscape-design/components';

export default function ChatAudioPlayer({ audioUrl, duration: storedDuration, name }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(storedDuration || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {return;}

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleLoadedMetadata = () => {
      // Update duration from metadata if we don't have stored duration
      if (!storedDuration && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [storedDuration]);

  const togglePlay = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current?.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to play audio:', error);
      }
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) {return '0:00';}
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <SpaceBetween direction="horizontal" size="s" alignItems="center">
        <Button
          variant="icon"
          iconName={isPlaying ? 'pause' : 'play'}
          onClick={togglePlay}
          ariaLabel={isPlaying ? 'Pause audio' : 'Play audio'}
        />
        <Box fontSize="body-s" color="text-body-secondary">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Box>
      </SpaceBetween>

      <Box variant="small" color="text-body-secondary" padding={{ top: 'xxs' }}>
        {name}
        {duration > 0 && ` • Duration: ${Math.round(duration)}s`}
      </Box>
    </Box>
  );
}