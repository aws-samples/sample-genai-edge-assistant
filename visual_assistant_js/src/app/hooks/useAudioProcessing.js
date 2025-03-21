// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';
import { useEffect, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { useAudioStore } from 'src/app/stores/audioStore';
import { useImageCaptioningStore } from 'src/app/stores/imageCaptioningStore';
import { useLogsStore } from 'src/app/stores/logsStore';

const PROGRESS_UPDATE_INTERVAL = 500;

export function useAudioProcessing() {
  const audioWorker = useRef(null);
  const lastProgressUpdate = useRef(0);

  const busy = useAudioStore((state) => state.busy);
  const url = useAudioStore((state) => state.url);
  const fps = useAudioStore((state) => state.fps);
  const status = useAudioStore((state) => state.workerState.status);
  const setBusy = useAudioStore((state) => state.setBusy);
  const setUrl = useAudioStore((state) => state.setUrl);
  const setFps = useAudioStore((state) => state.setFps);
  const setAll = useAudioStore((state) => state.setAll);
  const resetAll = useAudioStore((state) => state.resetAll);

  const text = useImageCaptioningStore((state) => state.caption);

  const setWorkerState = useAudioStore(
    (state) => state.setWorkerState,
    shallow,
  );

  const addLog = useLogsStore((state) => state.addLog);
  const clearLogs = useLogsStore((state) => state.clearLogs);

  useEffect(() => {
    if (status === 'ready') {
      console.log('Audio worker is ready');
      console.warn('Busy: ', busy);
      console.log('text: ', text);
      if (!busy) {
        if (text.length > 0) {
          console.log('Sending for audio synthsis');
          audioWorker.current?.postMessage({
            type: 'process',
            text: text,
          });
          setBusy(true);
        }
      }
    }
  }, [text, status]);

  // Message handler function defined inside useEffect since it only needs to be created once
  function handleMessage(e) {
    const { status } = e.data;

    switch (status) {
    case 'log':
      addLog('audio', {
        type: e.data.type,
        message: e.data.message,
        timestamp: e.data.timestamp,
      });
      break;

    case 'ready':
      setWorkerState({
        isReady: true,
        status: 'ready',
      });
      console.log(`Audio model initialized using ${e.data.device}`);
      break;

    case 'loading': {
      const now = Date.now();
      if (now - lastProgressUpdate.current >= PROGRESS_UPDATE_INTERVAL) {
        lastProgressUpdate.current = now;
        setWorkerState({
          status: 'loading',
          progress: e.data.progress,
        });
        console.log(`Loading audio model: ${e.data.progress}`);
      }
      break;
    }

    case 'error':
      setWorkerState({
        status: 'error',
        error: e.data.error,
      });
      console.error('Worker error:', e.data.error);
      break;

    case 'complete': {
      if (e.data.audioUrl != 'test') {
        console.log('Audio processing complete with URL', e.data);
        setAll({
          url: e.data.audioUrl,
          fps: e.data.fps,
          busy: false,
        });
      }
      break;
    }
    }
  }

  const terminateWorker = () => {
    if (audioWorker.current) {
      audioWorker.current.removeEventListener('message', handleMessage);
      audioWorker.current.terminate();
      audioWorker.current = null;
      resetAll();
      clearLogs('audio');
    }
    console.log('Terminating audio worker');
  };

  const initializeWorker = () => {
    // Create worker and set up message handler
    if (!audioWorker.current) {
      console.log('Instantiating audio worker');
      setWorkerState({
        isReady: false,
        status: 'loading',
      });
      audioWorker.current = window.audioWorker = new Worker(
        new URL('../workers/audio-worker.js', import.meta.url),
        { type: 'module' },
      );
      audioWorker.current.addEventListener('message', handleMessage);
      clearLogs('audio');
    }
  };

  const toggleWorker = () => {
    audioWorker.current ? terminateWorker() : initializeWorker();
  };

  return { toggleWorker, status };
}
