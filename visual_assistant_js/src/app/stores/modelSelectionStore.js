// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';

const defaultModels = [
  {
    id: 'sagemaker-gemma',
    name: 'Gemma 3n',
    type: 'sagemaker',
    status: 'ready',
  },
  {
    id: 'local-llm',
    name: 'Local LLM (Janus Pro 1B)',
    type: 'local',
    status: 'ready',
  },
];

export const useModelSelectionStore = create((set, get) => ({
  currentModel: defaultModels[0],
  availableModels: defaultModels,

  setCurrentModel: (model) => set({ currentModel: model }),

  getReadyModels: () => get().availableModels.filter((m) => m.status === 'ready'),
}));