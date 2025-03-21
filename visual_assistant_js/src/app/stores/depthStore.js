// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';

const INITIAL_DEPTH_SIZE = 256;

const initialState = {
  fps: 0,
  size: INITIAL_DEPTH_SIZE,
  actualDepth: null,
  actualDepthWidth: null,
  actualDepthHeight: null,
  workerState: {
    isReady: false,
    status: 'off',
    progress: 0,
    error: null,
  },
};

export const useDepthStore = create((set) => ({
  ...initialState,

  setFps: (fps) => set({ fps }),
  setSize: (size) => set({ size }),
  setActualDepth: (actualDepth) => set({ actualDepth }),
  setActualDepthDimensions: (width, height) =>
    set({ actualDepthWidth: width, actualDepthHeight: height }),
  setWorkerState: (workerState) => set({ workerState }),
  setAll: (state) => set(state),
  resetAll: () => set(initialState),
}));
