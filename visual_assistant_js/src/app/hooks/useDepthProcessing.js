// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';
import { useEffect, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { useDepthStore } from 'src/app/stores/depthStore';
import { useLogsStore } from 'src/app/stores/logsStore';
import FrameManager from 'src/app/utils/frameManager';

const PROGRESS_UPDATE_INTERVAL = 500;

export function useDepthProcessing() {
  const depthWorker = useRef(null);
  const lastProgressUpdate = useRef(0);
  const canvasRef = useRef(null);

  const size = useDepthStore((state) => state.size);
  const status = useDepthStore((state) => state.workerState.status);
  const setAll = useDepthStore((state) => state.setAll);
  const resetAll = useDepthStore((state) => state.resetAll);
  const setWorkerState = useDepthStore(
    (state) => state.setWorkerState,
    shallow,
  );

  const addLog = useLogsStore((state) => state.addLog);
  const clearLogs = useLogsStore((state) => state.clearLogs);

  useEffect(() => {
    console.warn('setWorkerState up');
    return () => {
      console.warn('setWorkerState down');
    };
  }, [setWorkerState]);

  // Message handler function defined inside useEffect since it only needs to be created once
  function handleMessage(e) {
    const { status } = e.data;

    switch (status) {
    case 'log':
      addLog('depth', {
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
      console.warn('Depth model ready');
      console.log(`Depth model initialized using ${e.data.device}`);
      depthWorker.current.postMessage({
        type: 'process',
        frame: FrameManager.getInstance().getCurrentFrame(),
        depthSize: useDepthStore.getState().size,
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
        console.log(`Loading depth model: ${e.data.progress}`);
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
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = e.data.outputs.width;
        canvas.height = e.data.outputs.height;
        ctx.putImageData(e.data.outputs, 0, 0);
      }

      setAll({
        fps: e.data.fps,
        actualDepthWidth: e.data.outputs.width,
        actualDepthHeight: e.data.outputs.height,
        actualDepth: e.data.actualDepth,
      });

      const currentFrame = FrameManager.getInstance().getCurrentFrame();

      if (currentFrame && depthWorker.current) {
        depthWorker.current.postMessage({
          type: 'process',
          frame: currentFrame,
          depthSize: useDepthStore.getState().size,
        });
      }
      break;
    }
    }
  }

  const terminateWorker = () => {
    if (depthWorker.current) {
      depthWorker.current.removeEventListener('message', handleMessage);
      depthWorker.current.terminate();
      depthWorker.current = null;
      resetAll();
      clearLogs('depth');
    }
    console.log('Terminating depth worker');
  };

  const initializeWorker = () => {
    // Create worker and set up message handler
    if (!depthWorker.current) {
      console.log('Instantiating depth worker');
      depthWorker.current = window.depthWorker = new Worker(
        new URL('../workers/depth-worker.js', import.meta.url),
        { type: 'module' },
      );
      depthWorker.current.addEventListener('message', handleMessage);
      clearLogs('depth');
    }
  };

  const toggleWorker = () => {
    depthWorker.current ? terminateWorker() : initializeWorker();
  };

  return {
    canvasRef,
    toggleWorker,
    status,
  };
}
