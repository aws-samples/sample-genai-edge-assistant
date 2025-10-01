# Testing Guide

This project is configured with Jest as the testing framework. Tests are set up for the chat functionality and can be run using the npm scripts.

## Test Files

- `src/app/stores/__tests__/chatStore.test.js` - Tests for the Zustand chat store
- `src/app/utils/__tests__/chatUtils.test.js` - Tests for chat utility functions

## Current Testing Setup

The project is configured with:

- **Jest** - Testing framework
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - Additional Jest matchers
- **Babel** - For ES6+ module transformation

### Configuration Files

- `babel.config.js` - Babel configuration for Jest
- `src/setupTests.js` - Jest setup file with global mocks
- `package.json` - Jest configuration and test scripts

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Results

Current test coverage for chat functionality:
- **chatStore.js**: 100% statement coverage, 87.5% branch coverage
- **chatUtils.js**: 89.28% statement coverage, 75% branch coverage
- **Total**: 40 tests passing

## Test Coverage Goals

The current test files aim to cover:

### Chat Store (`chatStore.test.js`)
- ✅ Initial state verification
- ✅ Message management (add, update, remove)
- ✅ Loading and error state management
- ✅ Chat clearing and conversation management
- ✅ Helper methods and utilities
- ✅ Message retry functionality

### Chat Utils (`chatUtils.test.js`)
- ✅ Message creation functions
- ✅ Content type detection
- ✅ Content summarization
- ✅ Message validation
- ✅ Multimodal message handling

## Mocking Strategy

The tests use several mocking strategies:

1. **URL.createObjectURL**: Mocked to return predictable blob URLs
2. **File/Blob objects**: Created with minimal data for testing
3. **Zustand store**: Reset before each test to ensure isolation

## Future Test Additions

When implementing additional chat features, consider adding tests for:

- API integration with SageMaker
- Authentication and error handling
- Real-time message updates
- File upload and processing
- Audio recording and playback
- Component integration tests
- End-to-end user flows

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on others
2. **Descriptive Names**: Test names should clearly describe what is being tested
3. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
4. **Mock External Dependencies**: Mock APIs, file systems, and browser APIs
5. **Test Edge Cases**: Include tests for error conditions and boundary cases