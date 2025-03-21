// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';
import { useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { useImageCaptioningStore } from 'src/app/stores/imageCaptioningStore';
import { useLogsStore } from 'src/app/stores/logsStore';
import FrameManager from 'src/app/utils/frameManager';

const PROGRESS_UPDATE_INTERVAL = 500;

export function useImageCaptioningProcessing() {
  const imageCaptioningWorker = useRef(null);
  const lastProgressUpdate = useRef(0);

  const caption = useImageCaptioningStore((state) => state.caption);
  const status = useImageCaptioningStore((state) => state.workerState.status);
  const setAll = useImageCaptioningStore((state) => state.setAll);
  const resetAll = useImageCaptioningStore((state) => state.resetAll);

  const setWorkerState = useImageCaptioningStore(
    (state) => state.setWorkerState,
    shallow,
  );

  const addLog = useLogsStore((state) => state.addLog);
  const clearLogs = useLogsStore((state) => state.clearLogs);

  // Message handler function defined inside useEffect since it only needs to be created once
  function handleMessage(e) {
    const { status } = e.data;

    switch (status) {
    case 'log':
      addLog('imageCaptioning', {
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

      console.log(
        `Image captioning model initialized using ${e.data.device}`,
      );
      const currentFrame = FrameManager.getInstance().getCurrentFrame();
      if (currentFrame) {
        imageCaptioningWorker.current.postMessage({
          type: 'process',
          frame: currentFrame,
        });
      }
      break;

    case 'loading': {
      const now = Date.now();
      if (now - lastProgressUpdate.current >= PROGRESS_UPDATE_INTERVAL) {
        lastProgressUpdate.current = now;
        setWorkerState({
          status: 'loading',
          progress: e.data.progress,
        });

        console.log(`Loading image Captioning model: ${e.data.progress}`);
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
      if (e.data.output !== caption) {
        setAll({
          caption: e.data.output || caption,
          fps: e.data.fps,
        });
      } else {
        setAll({ fps: e.data.fps });
      }

      const currentFrame = FrameManager.getInstance().getCurrentFrame();
      if (currentFrame && imageCaptioningWorker.current) {
        imageCaptioningWorker.current.postMessage({
          type: 'process',
          frame: currentFrame,
        });
      }
      break;
    }
    }
  }

  const terminateWorker = () => {
    if (imageCaptioningWorker.current) {
      imageCaptioningWorker.current.removeEventListener(
        'message',
        handleMessage,
      );
      imageCaptioningWorker.current.terminate();
      imageCaptioningWorker.current = null;
      resetAll();
      clearLogs('imageCaptioning');
    }
    console.log('Terminating image captioning worker');
  };

  const initializeWorker = () => {
    // Create worker and set up message handler
    if (!imageCaptioningWorker.current) {
      console.log('Instantiating image captioning worker');
      imageCaptioningWorker.current = window.imageCaptioningWorker = new Worker(
        new URL('../workers/image-captioning-worker.js', import.meta.url),
        { type: 'module' },
      );
      imageCaptioningWorker.current.addEventListener('message', handleMessage);
      clearLogs('imageCaptioning');
    }
  };

  const toggleWorker = () => {
    imageCaptioningWorker.current ? terminateWorker() : initializeWorker();
  };

  return { toggleWorker, status };
}
