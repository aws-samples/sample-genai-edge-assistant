// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';

const initialState = {
  fps: 0,
  caption: '-----',
  workerState: {
    isReady: false,
    status: 'off',
    progress: 0,
    error: null,
  },
};

export const useImageCaptioningStore = create((set) => ({
  ...initialState,
  setFps: (fps) => set({ fps }),
  setCaption: (caption) => set({ caption }),
  setWorkerState: (workerState) => set({ workerState }),
  setAll: (state) => set(state),
  resetAll: () => set(initialState),
}));
