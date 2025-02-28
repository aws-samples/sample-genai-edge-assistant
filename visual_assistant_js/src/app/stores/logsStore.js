// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';

const initialState = {
  workerLogs: {
    depth: [],
    detection: [],
    audio: [],
    imageCaptioning: [],
  },
};

export const useLogsStore = create((set) => ({
  ...initialState,

  addLog: (worker, log) =>
    set((state) => ({
      workerLogs: {
        ...state.workerLogs,
        [worker]: [...(state.workerLogs[worker] || []), log],
      },
    })),

  clearLogs: (worker) =>
    set((state) => ({
      workerLogs: {
        ...state.workerLogs,
        [worker]: [],
      },
    })),

  clearAllLogs: () => set({ workerLogs: initialState.workerLogs }),
}));
