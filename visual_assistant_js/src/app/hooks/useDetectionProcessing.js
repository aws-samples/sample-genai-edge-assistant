// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';
import { useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { useDetectionStore } from 'src/app/stores/detectionStore';
import { useLogsStore } from 'src/app/stores/logsStore';
import FrameManager from 'src/app/utils/frameManager';

const PROGRESS_UPDATE_INTERVAL = 500;

export function useDetectionProcessing() {
  const detectionWorker = useRef(null);
  const lastProgressUpdate = useRef(0);

  const objectDetSize = useDetectionStore((state) => state.objectDetSize);
  const status = useDetectionStore((state) => state.workerState.status);
  const setObjectDetSize = useDetectionStore((state) => state.setObjectDetSize);
  const setThreshold = useDetectionStore((state) => state.setThreshold);
  const setAll = useDetectionStore((state) => state.setAll);
  const resetAll = useDetectionStore((state) => state.resetAll);

  const setWorkerState = useDetectionStore(
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
      addLog('detection', {
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

      console.log(`Detection model initialized using ${e.data.device}`);
      detectionWorker.current.postMessage({
        type: 'process',
        frame: FrameManager.getInstance().getCurrentFrame(),
        objectDetSize: useDetectionStore.getState().objectDetSize,
      });
      break;

    case 'loading': {
      const now = Date.now();
      if (now - lastProgressUpdate.current >= PROGRESS_UPDATE_INTERVAL) {
        lastProgressUpdate.current = now;
        setWorkerState({
          status: 'loading',
          progress: e.data.progress,
        });
      }
      break;
    }

    case 'error':
      setWorkerState({
        status: 'error',
        error: e.data.error,
      });
      break;

    case 'complete': {
      console.log('Detection result received');
      const { sizes, outputs, id2label, fps } = e.data;
      setAll({
        fps,
        detectionInfo: {
          sizes,
          outputs,
          id2label,
        },
        overlay: {
          sizes,
          outputs,
          id2label,
        },
      });

      const currentFrame = FrameManager.getInstance().getCurrentFrame();

      if (currentFrame && detectionWorker.current) {
        detectionWorker.current.postMessage({
          type: 'process',
          frame: currentFrame,
          objectDetSize: useDetectionStore.getState().objectDetSize,
        });
      }
      break;
    }
    }
  }

  const terminateWorker = () => {
    if (detectionWorker.current) {
      detectionWorker.current.removeEventListener('message', handleMessage);
      detectionWorker.current.terminate();
      detectionWorker.current = null;
      resetAll();
      clearLogs('detection');
    }
    console.log('Terminating detection worker');
  };

  const initializeWorker = () => {
    // Create worker and set up message handler
    if (!detectionWorker.current) {
      console.log('Instantiating detection worker');
      detectionWorker.current = window.detectionWorker = new Worker(
        new URL('../workers/detection-worker.js', import.meta.url),
        { type: 'module' },
      );
      detectionWorker.current.addEventListener('message', handleMessage);
      clearLogs('detection');
    }
  };

  const toggleWorker = () => {
    detectionWorker.current ? terminateWorker() : initializeWorker();
  };

  return { toggleWorker, status };
}
