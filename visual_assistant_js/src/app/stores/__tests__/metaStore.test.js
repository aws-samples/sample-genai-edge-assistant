// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useMetaStore } from 'src/app/stores/metaStore';

// Mock sessionManager
jest.mock('../../utils/sessionManager', () => ({
  sessionManager: {
    logout: jest.fn(),
  },
}));

describe('metaStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMetaStore.getState().resetAll();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useMetaStore.getState();
      expect(state.navigationModeActivated).toBe(false);
      expect(state.currentMode).toBe('playground');
      expect(state.configPanelOpen).toBe(false);
      expect(state.alertThreshold).toBe(0.8);
      expect(state.quality).toBe(50);
      expect(state.voiceControlEnabled).toBe(false);
      expect(state.showModal).toBe(true);
    });
  });

  describe('setCurrentMode', () => {
    it('should set navigation mode and sync navigationModeActivated', () => {
      const { setCurrentMode } = useMetaStore.getState();

      setCurrentMode('navigation');

      const state = useMetaStore.getState();
      expect(state.currentMode).toBe('navigation');
      expect(state.navigationModeActivated).toBe(true);
    });

    it('should set playground mode and sync navigationModeActivated', () => {
      const { setCurrentMode } = useMetaStore.getState();

      setCurrentMode('playground');

      const state = useMetaStore.getState();
      expect(state.currentMode).toBe('playground');
      expect(state.navigationModeActivated).toBe(false);
    });

    it('should set chat mode and sync navigationModeActivated', () => {
      const { setCurrentMode } = useMetaStore.getState();

      setCurrentMode('chat');

      const state = useMetaStore.getState();
      expect(state.currentMode).toBe('chat');
      expect(state.navigationModeActivated).toBe(false);
    });
  });

  describe('setNavigationModeActivated (backward compatibility)', () => {
    it('should set navigation mode when activated is true', () => {
      const { setNavigationModeActivated } = useMetaStore.getState();

      setNavigationModeActivated(true);

      const state = useMetaStore.getState();
      expect(state.navigationModeActivated).toBe(true);
      expect(state.currentMode).toBe('navigation');
    });

    it('should set playground mode when activated is false', () => {
      const { setNavigationModeActivated } = useMetaStore.getState();

      setNavigationModeActivated(false);

      const state = useMetaStore.getState();
      expect(state.navigationModeActivated).toBe(false);
      expect(state.currentMode).toBe('playground');
    });
  });

  describe('mode synchronization', () => {
    it('should maintain sync when switching between setCurrentMode and setNavigationModeActivated', () => {
      const { setCurrentMode, setNavigationModeActivated } = useMetaStore.getState();

      // Start with chat mode
      setCurrentMode('chat');
      expect(useMetaStore.getState().currentMode).toBe('chat');
      expect(useMetaStore.getState().navigationModeActivated).toBe(false);

      // Switch to navigation using old method
      setNavigationModeActivated(true);
      expect(useMetaStore.getState().currentMode).toBe('navigation');
      expect(useMetaStore.getState().navigationModeActivated).toBe(true);

      // Switch back to playground using old method
      setNavigationModeActivated(false);
      expect(useMetaStore.getState().currentMode).toBe('playground');
      expect(useMetaStore.getState().navigationModeActivated).toBe(false);

      // Switch to chat using new method
      setCurrentMode('chat');
      expect(useMetaStore.getState().currentMode).toBe('chat');
      expect(useMetaStore.getState().navigationModeActivated).toBe(false);
    });
  });

  describe('other actions', () => {
    it('should set config panel open state', () => {
      const { setConfigPanelOpen } = useMetaStore.getState();

      setConfigPanelOpen(true);
      expect(useMetaStore.getState().configPanelOpen).toBe(true);

      setConfigPanelOpen(false);
      expect(useMetaStore.getState().configPanelOpen).toBe(false);
    });

    it('should set alert threshold', () => {
      const { setAlertThreshold } = useMetaStore.getState();

      setAlertThreshold(0.5);
      expect(useMetaStore.getState().alertThreshold).toBe(0.5);
    });

    it('should set quality', () => {
      const { setQuality } = useMetaStore.getState();

      setQuality(75);
      expect(useMetaStore.getState().quality).toBe(75);
    });

    it('should set voice control enabled', () => {
      const { setVoiceControlEnabled } = useMetaStore.getState();

      setVoiceControlEnabled(true);
      expect(useMetaStore.getState().voiceControlEnabled).toBe(true);
    });

    it('should set show modal', () => {
      const { setShowModal } = useMetaStore.getState();

      setShowModal(false);
      expect(useMetaStore.getState().showModal).toBe(false);
    });
  });

  describe('resetAll', () => {
    it('should reset all state to initial values', () => {
      const { setCurrentMode, setConfigPanelOpen, setAlertThreshold, resetAll } = useMetaStore.getState();

      // Change some state
      setCurrentMode('navigation');
      setConfigPanelOpen(true);
      setAlertThreshold(0.5);

      // Reset
      resetAll();

      const state = useMetaStore.getState();
      expect(state.navigationModeActivated).toBe(false);
      expect(state.currentMode).toBe('playground');
      expect(state.configPanelOpen).toBe(false);
      expect(state.alertThreshold).toBe(0.8);
    });
  });
});