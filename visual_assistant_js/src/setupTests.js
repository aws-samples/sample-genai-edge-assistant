// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Jest setup file for testing configuration
require('@testing-library/jest-dom');

// Mock URL.createObjectURL and revokeObjectURL for tests
global.URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn(),
};

// Mock File constructor for tests
global.File = class MockFile {
  constructor(bits, name, options = {}) {
    this.bits = bits;
    this.name = name;
    this.type = options.type || '';
    this.size = bits.reduce((acc, bit) => acc + (bit.length || 0), 0);
    this.lastModified = Date.now();
  }
};

// Mock Blob constructor for tests
global.Blob = class MockBlob {
  constructor(bits = [], options = {}) {
    this.bits = bits;
    this.type = options.type || '';
    this.size = bits.reduce((acc, bit) => acc + (bit.length || 0), 0);
  }
};

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    // Only show errors that aren't React testing warnings
    if (
      typeof args[0] === 'string' &&
      !args[0].includes('Warning: ReactDOM.render is deprecated') &&
      !args[0].includes('Warning: An invalid form control')
    ) {
      originalError.call(console, ...args);
    }
  };

  console.warn = (...args) => {
    // Only show warnings that aren't React testing warnings
    if (
      typeof args[0] === 'string' &&
      !args[0].includes('componentWillReceiveProps') &&
      !args[0].includes('componentWillMount')
    ) {
      originalWarn.call(console, ...args);
    }
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});