// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';
import { sessionManager } from 'src/app/utils/sessionManager';

const initialState = {
  configPanelOpen: false,
  navigationModeActivated: false,
  currentMode: 'playground', // Default to playground mode to match existing behavior
  alertThreshold: 0.8,
  quality: 50,
  voiceControlEnabled: false,
  showModal: true,
};

export const useMetaStore = create((set) => ({
  ...initialState,

  setConfigPanelOpen: (open) => set({ configPanelOpen: open }),

  // Keep existing setNavigationModeActivated for backward compatibility
  setNavigationModeActivated: (activated) => {
    const newMode = activated ? 'navigation' : 'playground';
    set({
      navigationModeActivated: activated,
      currentMode: newMode,
    });
  },

  // New setCurrentMode action with backward compatibility
  // Supports three modes: 'playground', 'navigation', 'chat'
  setCurrentMode: (mode) => {
    const navigationModeActivated = mode === 'navigation';
    set({
      currentMode: mode,
      navigationModeActivated: navigationModeActivated,
    });
  },

  setAlertThreshold: (alertThreshold) => set({ alertThreshold }),
  setQuality: (quality) => set({ quality }),
  setVoiceControlEnabled: (enabled) => set({ voiceControlEnabled: enabled }),
  setShowModal: (show) => set({ showModal: show }),

  resetAll: () => set(initialState),
  logout: () => sessionManager.logout(),
}));
