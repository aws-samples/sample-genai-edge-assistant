// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';

const initialState = {
  busy: false,
  url: null,
  fps: 0,
  workerState: {
    isReady: false,
    status: 'off',
    progress: 0,
    error: null,
  },
};

export const useAudioStore = create((set) => ({
  ...initialState,
  setBusy: (busy) => set({ busy }),
  setUrl: (url) => set({ url }),
  setFps: (fps) => set({ fps }),
  setWorkerState: (workerState) => set({ workerState }),
  setAll: (state) => set(state),
  resetAll: () => set(initialState),
}));
