// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import { Hub } from '@aws-amplify/core';
import { useMetaStore } from 'src/app/stores/metaStore';
import { useAudioStore } from 'src/app/stores/audioStore';
import { useDetectionStore } from 'src/app/stores/detectionStore';
import { useDepthStore } from 'src/app/stores/depthStore';
import { useImageCaptioningStore } from 'src/app/stores/imageCaptioningStore';
import { useLogsStore } from 'src/app/stores/logsStore';
import FrameManager from 'src/app/utils/frameManager';

export class SessionManager {
  static instance = null;

  constructor() {
    Hub.listen('auth', (data) => {
      const { payload } = data;
      //console.log('Auth event received:', payload.event);
      if (payload.event === 'tokenRefresh_failure' || payload.event === 'signedOut') {
        //console.log('Initiating cleanup due to auth event:', payload.event);
        this.cleanup();
      }
    });
  }

  static getInstance() {
    if (!SessionManager.instance) {
      //console.log('Creating new SessionManager instance');
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  cleanup = () => {
    //console.log('Starting cleanup process');

    // Stop frame capturing and release camera
    //console.log('Unregistering frame callback');
    FrameManager.getInstance().unregisterCallback();

    // Stop all workers
    if (window.audioWorker) {
      //console.log('Terminating audio worker');
      window.audioWorker.terminate();
      window.audioWorker = null;
    }
    if (window.detectionWorker) {
      //console.log('Terminating detection worker');
      window.detectionWorker.terminate();
      window.detectionWorker = null;
    }
    if (window.depthWorker) {
      //console.log('Terminating depth worker');
      window.depthWorker.terminate();
      window.depthWorker = null;
    }
    if (window.imageCaptioningWorker) {
      //console.log('Terminating image captioning worker');
      window.imageCaptioningWorker.terminate();
      window.imageCaptioningWorker = null;
    }

    // Stop media streams
    if (window.mediaStream) {
      //console.log('Stopping media stream tracks');
      window.mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      window.mediaStream = null;
    }

    // Reset all stores
    //console.log('Resetting all stores');
    useMetaStore.getState().resetAll();
    useAudioStore.getState().resetAll();
    useDetectionStore.getState().resetAll();
    useDepthStore.getState().resetAll();
    useImageCaptioningStore.getState().resetAll();
    useLogsStore.getState().clearAllLogs();

    //console.log('Cleanup process completed');
  };
}

export const sessionManager = SessionManager.getInstance();
