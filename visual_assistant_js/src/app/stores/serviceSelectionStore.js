// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';
import { WORKER_TO_MODEL_MAP } from 'src/app/globals';
import {
  validateCachedFiles,
  getCachedManifest,
} from 'src/app/utils/modelFetching';

export const useServiceSelectionStore = create((set, get) => ({
  selectedServices: {},
  modelStatus: {},
  remoteModelInfo: {},
  downloadProgress: {},
  cachingStatus: {},

  isServiceReady: (service) => {
    const { modelStatus } = get();
    return WORKER_TO_MODEL_MAP[service].every(
      (model) => modelStatus[model] === 'valid',
    );
  },

  setSelectedService: (service, isSelected) =>
    set((state) => ({
      selectedServices: { ...state.selectedServices, [service]: isSelected },
    })),

  validateAndUpdateModelStatus: async () => {
    const newModelStatus = {};
    for (const model of Object.values(WORKER_TO_MODEL_MAP).flat()) {
      const manifest = await getCachedManifest(model);
      if (manifest) {
        const isValid = await validateCachedFiles(model, manifest);
        newModelStatus[model] = isValid ? 'valid' : 'invalid';
      } else {
        newModelStatus[model] = 'missing';
      }
    }
    set({ modelStatus: newModelStatus });
  },

  updateRemoteModelInfo: (info) => set({ remoteModelInfo: info }),

  setDownloadProgress: (modelKey, progress) =>
    set((state) => ({
      downloadProgress: { ...state.downloadProgress, [modelKey]: progress },
    })),

  setCachingStatus: (modelKey, status) =>
    set((state) => ({
      cachingStatus: { ...state.cachingStatus, [modelKey]: status },
    })),

  getModelDownloadStatus: (model) => {
    const { modelStatus, remoteModelInfo } = get();
    const localStatus = modelStatus[model];
    const remoteInfo = remoteModelInfo[model];

    if (!remoteInfo || !remoteInfo.download_url) {
      return 'unavailable';
    }

    if (localStatus === 'missing') {
      return 'needsDownload';
    }

    if (localStatus === 'invalid') {
      return 'outdated';
    }

    if (localStatus === 'valid') {
      return 'upToDate';
    }

    return 'processing';
  },

  resetDownloadState: () =>
    set((state) => ({
      downloadProgress: {},
      cachingStatus: {},
    })),
}));
