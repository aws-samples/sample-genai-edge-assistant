// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';

const INITIAL_OBJECT_DET_SIZE = 128;
const INITIAL_THRESHOLD = 50;

const initialState = {
  fps: 0,
  objectDetSize: INITIAL_OBJECT_DET_SIZE,
  threshold: INITIAL_THRESHOLD,
  overlay: {
    sizes: [],
    outputs: [],
    id2label: [],
  },
  detectionInfo: {
    sizes: [],
    outputs: [],
    id2label: [],
  },
  workerState: {
    isReady: false,
    status: 'off',
    progress: 0,
    error: null,
  },
};

export const useDetectionStore = create((set) => ({
  ...initialState,
  setFps: (fps) => set({ fps }),
  setObjectDetSize: (size) => set({ objectDetSize: size }),
  setThreshold: (threshold) => set({ threshold }),
  setOverlay: (overlay) => set({ overlay }),
  setDetectionInfo: (detectionInfo) => set({ detectionInfo }),
  setWorkerState: (workerState) => set({ workerState }),
  setAll: (state) => set(state),
  resetAll: () => set(initialState),
}));
