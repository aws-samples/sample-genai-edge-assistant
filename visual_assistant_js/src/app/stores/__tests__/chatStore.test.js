// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Tests for chatStore.js
 * Run with: npm test
 */

import { useChatStore } from 'src/app/stores/chatStore.js';
import { createTextMessage, createAssistantMessage } from 'src/app/utils/chatUtils.js';

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useChatStore.getState().resetAll();
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const store = useChatStore.getState();
      expect(store.messages).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBe(null);
      expect(store.currentConversationId).toBeDefined();
      expect(typeof store.currentConversationId).toBe('string');
    });
  });

  describe('addMessage', () => {
    test('should add a message to the store', () => {
      const message = createTextMessage('Hello, world!');

      useChatStore.getState().addMessage(message);

      const store = useChatStore.getState();
      expect(store.getMessages()).toHaveLength(1);
      expect(store.getMessages()[0].content.text).toBe('Hello, world!');
      expect(store.getMessages()[0].type).toBe('user');
    });

    test('should generate ID and timestamp if not provided', () => {
      const message = {
        type: 'user',
        content: { text: 'Test message' },
      };

      useChatStore.getState().addMessage(message);

      const store = useChatStore.getState();
      const addedMessage = store.getMessages()[0];
      expect(addedMessage.id).toBeDefined();
      expect(addedMessage.timestamp).toBeInstanceOf(Date);
      expect(addedMessage.status).toBe('sent');
    });

    test('should clear error when adding message', () => {
      useChatStore.getState().setError('Test error');
      expect(useChatStore.getState().error).toBe('Test error');

      const message = createTextMessage('Hello');
      useChatStore.getState().addMessage(message);

      expect(useChatStore.getState().error).toBe(null);
    });
  });

  describe('updateMessage', () => {
    test('should update existing message', () => {
      const message = createTextMessage('Original text');
      useChatStore.getState().addMessage(message);

      useChatStore.getState().updateMessage(message.id, {
        status: 'sent',
        content: { text: 'Updated text' },
      });

      const store = useChatStore.getState();
      const updatedMessage = store.getMessages()[0];
      expect(updatedMessage.content.text).toBe('Updated text');
      expect(updatedMessage.status).toBe('sent');
    });

    test('should not affect other messages', () => {
      const message1 = createTextMessage('Message 1');
      const message2 = createTextMessage('Message 2');

      useChatStore.getState().addMessage(message1);
      useChatStore.getState().addMessage(message2);

      useChatStore.getState().updateMessage(message1.id, { status: 'error' });

      const store = useChatStore.getState();
      expect(store.getMessages()[0].status).toBe('error');
      expect(store.getMessages()[1].status).toBe('sending');
    });
  });

  describe('removeMessage', () => {
    test('should remove message by ID', () => {
      const message1 = createTextMessage('Message 1');
      const message2 = createTextMessage('Message 2');

      useChatStore.getState().addMessage(message1);
      useChatStore.getState().addMessage(message2);

      useChatStore.getState().removeMessage(message1.id);

      const store = useChatStore.getState();
      expect(store.getMessages()).toHaveLength(1);
      expect(store.getMessages()[0].content.text).toBe('Message 2');
    });
  });

  describe('clearChat', () => {
    test('should clear all messages and error', () => {
      const message = createTextMessage('Test message');
      useChatStore.getState().addMessage(message);
      useChatStore.getState().setError('Test error');

      const oldConversationId = useChatStore.getState().getCurrentConversationId();

      useChatStore.getState().clearChat();

      const store = useChatStore.getState();
      expect(store.getMessages()).toHaveLength(0);
      expect(store.error).toBe(null);
      expect(store.getCurrentConversationId()).not.toBe(oldConversationId);
    });
  });

  describe('setLoading', () => {
    test('should set loading state', () => {
      useChatStore.getState().setLoading(true);
      expect(useChatStore.getState().isLoading).toBe(true);

      useChatStore.getState().setLoading(false);
      expect(useChatStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    test('should set error and clear loading', () => {
      useChatStore.getState().setLoading(true);
      useChatStore.getState().setError('Test error');

      const store = useChatStore.getState();
      expect(store.error).toBe('Test error');
      expect(store.isLoading).toBe(false);
    });

    test('should clear error when set to null', () => {
      useChatStore.getState().setError('Test error');
      useChatStore.getState().setError(null);

      expect(useChatStore.getState().error).toBe(null);
    });
  });

  describe('retryMessage', () => {
    test('should update failed message status to retry', () => {
      const message = createTextMessage('Test message');
      message.status = 'error';
      message.error = 'Network error';

      useChatStore.getState().addMessage(message);
      useChatStore.getState().retryMessage(message.id);

      const store = useChatStore.getState();
      const updatedMessage = store.getMessages()[0];
      expect(updatedMessage.status).toBe('retry');
      expect(updatedMessage.error).toBeUndefined();
      expect(store.error).toBe(null);
    });

    test('should not affect messages that are not in error state', () => {
      const message = createTextMessage('Test message');
      message.status = 'sent';

      useChatStore.getState().addMessage(message);
      useChatStore.getState().retryMessage(message.id);

      const store = useChatStore.getState();
      const updatedMessage = store.getMessages()[0];
      expect(updatedMessage.status).toBe('sent');
    });
  });

  describe('Helper methods', () => {
    test('getLastUserMessage should return last user message', () => {
      const userMessage1 = createTextMessage('User message 1');
      const assistantMessage = createAssistantMessage('Assistant response');
      const userMessage2 = createTextMessage('User message 2');

      useChatStore.getState().addMessage(userMessage1);
      useChatStore.getState().addMessage(assistantMessage);
      useChatStore.getState().addMessage(userMessage2);

      const lastUserMessage = useChatStore.getState().getLastUserMessage();
      expect(lastUserMessage.content.text).toBe('User message 2');
    });

    test('hasMessages should return correct boolean', () => {
      expect(useChatStore.getState().hasMessages()).toBe(false);

      useChatStore.getState().addMessage(createTextMessage('Test'));
      expect(useChatStore.getState().hasMessages()).toBe(true);
    });

    test('getCurrentConversationId should return conversation ID', () => {
      const conversationId = useChatStore.getState().getCurrentConversationId();
      expect(typeof conversationId).toBe('string');
      expect(conversationId.startsWith('conv_')).toBe(true);
    });
  });

  describe('resetAll', () => {
    test('should reset store to initial state', () => {
      useChatStore.getState().addMessage(createTextMessage('Test'));
      useChatStore.getState().setLoading(true);
      useChatStore.getState().setError('Test error');

      const oldConversationId = useChatStore.getState().getCurrentConversationId();

      useChatStore.getState().resetAll();

      const store = useChatStore.getState();
      expect(store.getMessages()).toHaveLength(0);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBe(null);
      expect(store.getCurrentConversationId()).not.toBe(oldConversationId);
    });
  });
});