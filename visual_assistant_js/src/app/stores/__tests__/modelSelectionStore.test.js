// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

describe('modelSelectionStore', () => {
  let useModelSelectionStore;

  beforeEach(() => {
    // Clear module cache to get fresh store instance
    jest.resetModules();
    // Import the store after clearing cache
    useModelSelectionStore = require('../modelSelectionStore').useModelSelectionStore;
  });

  test('has default models with correct structure', () => {
    const state = useModelSelectionStore.getState();

    expect(state.availableModels).toHaveLength(2);
    expect(state.availableModels[0]).toEqual({
      id: 'sagemaker-gemma',
      name: 'Gemma 3n',
      type: 'sagemaker',
      status: 'ready',
    });
    expect(state.availableModels[1]).toEqual({
      id: 'local-llm',
      name: 'Local LLM',
      type: 'local',
      status: 'unavailable',
    });
  });

  test('sets first model as default current model', () => {
    const state = useModelSelectionStore.getState();

    expect(state.currentModel).toEqual({
      id: 'sagemaker-gemma',
      name: 'Gemma 3n',
      type: 'sagemaker',
      status: 'ready',
    });
  });

  test('can set current model', () => {
    const store = useModelSelectionStore.getState();
    const newModel = { id: 'test', name: 'Test Model', type: 'local', status: 'ready' };

    store.setCurrentModel(newModel);

    const updatedState = useModelSelectionStore.getState();
    expect(updatedState.currentModel).toEqual(newModel);
  });

  test('getReadyModels returns only ready models', () => {
    const store = useModelSelectionStore.getState();
    const readyModels = store.getReadyModels();

    expect(readyModels).toHaveLength(1);
    expect(readyModels[0].status).toBe('ready');
    expect(readyModels[0].name).toBe('Gemma 3n');
  });

  test('getReadyModels filters out unavailable models', () => {
    const store = useModelSelectionStore.getState();
    const readyModels = store.getReadyModels();

    const unavailableModels = readyModels.filter((m) => m.status === 'unavailable');
    expect(unavailableModels).toHaveLength(0);
  });
});