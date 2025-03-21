// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Save the original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

const DEBUG = {
  depth: process.env.NEXT_PUBLIC_DEBUG_DEPTH === 'true',
  audio: process.env.NEXT_PUBLIC_DEBUG_AUDIO === 'true',
  detection: process.env.NEXT_PUBLIC_DEBUG_DETECTION === 'true',
  imageCaptioning: process.env.NEXT_PUBLIC_DEBUG_IMAGE_CAPTIONING === 'true',
};

// Define a function to setup worker logging
export const setupWorkerLogging = (worker, self) => {
  if (!DEBUG[worker]) {
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    return;
  }

  // Define a function to send logs
  const sendLog = (type, ...args) => {
    // Convert all arguments to strings, stringify objects
    const log = args
      .map((arg) =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
      )
      .join(' ');

    // Send a message with log details
    self.postMessage({
      status: 'log',
      type,
      message: log,
      timestamp: new Date().toISOString(),
    });

    // Call the original console method
    originalConsole[type](...args);
  };

  // Override console methods with our custom function
  console.log = (...args) => sendLog('log', ...args);
  console.warn = (...args) => sendLog('warn', ...args);
  console.error = (...args) => sendLog('error', ...args);
};
