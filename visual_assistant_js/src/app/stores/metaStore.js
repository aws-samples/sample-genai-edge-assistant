// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';

const initialState = {
  configPanelOpen: false,
  navigationModeActivated: false,
  alertThreshold: 0.8,
  quality: 50,
  voiceControlEnabled: false,
  showModal: true,
};

export const useMetaStore = create((set) => ({
  ...initialState,

  setConfigPanelOpen: (open) => set({ configPanelOpen: open }),
  setNavigationModeActivated: (activated) =>
    set({ navigationModeActivated: activated }),
  setAlertThreshold: (alertThreshold) => set({ alertThreshold }),
  setQuality: (quality) => set({ quality }),
  setVoiceControlEnabled: (enabled) => set({ voiceControlEnabled: enabled }),
  setShowModal: (show) => set({ showModal: show }),

  resetAll: () => set(initialState),
  logout: () => sessionManager.logout(),
}));
