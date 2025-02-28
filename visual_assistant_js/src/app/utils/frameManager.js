// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Constant for frames per second rate
 */
const FPS = 30;

/**
 * Time interval between frames in milliseconds
 */
const FRAME_INTERVAL = 1000 / FPS;

/**
 * Singleton class to manage frame capture and throttling
 * Now instead of recurrently capturing the frame and copying
 * individually to all the worker handlers, we just capture it
 * once and only on demand. This is more efficient and also
 * allows us to throttle the capture rate based on FPS setting
 */
class FrameManager {
  /**
   * Singleton instance
   */
  static instance = null;

  /**
   * Callback function to capture frames
   */
  captureFrameCallback = null;

  /**
   * Currently captured frame
   */
  currentFrame = null;

  /**
   * Timestamp of last frame capture
   */
  lastCaptureTime = 0;

  /**
   * Get singleton instance of FrameManager
   * @returns {FrameManager} Singleton instance
   */
  static getInstance() {
    if (!FrameManager.instance) {
      FrameManager.instance = new FrameManager();
    }
    return FrameManager.instance;
  }

  /**
   * Register a callback function to capture frames
   * @param {Function} callback Function to capture frames
   */
  registerCallback(callback) {
    this.captureFrameCallback = callback;
  }

  /**
   * Unregister the capture callback and reset state
   */
  unregisterCallback() {
    this.captureFrameCallback = null;
    this.currentFrame = null;
    this.lastCaptureTime = 0;
  }

  /**
   * Get the current frame, capturing a new one if needed
   * Throttles capture rate based on FPS setting
   * @returns {*} Current frame or null if no callback registered
   */
  getCurrentFrame() {
    const now = performance.now();

    if (!this.captureFrameCallback) {
      return null;
    }

    //console.log('Current demand FPS: ', 1000 / (now - this.lastCaptureTime));

    // Throttle when FPS reached
    if (this.currentFrame && now - this.lastCaptureTime < FRAME_INTERVAL) {
      return this.currentFrame;
    }

    // Otherwise, capture a new frame
    this.currentFrame = this.captureFrameCallback();
    this.lastCaptureTime = performance.now();

    return this.currentFrame;
  }
}

export default FrameManager;
