// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { create } from 'zustand';

/**
 * Generates a unique ID for chat messages
 * @returns {string} Unique identifier
 */
const generateMessageId = () => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generates a unique conversation ID
 * @returns {string} Unique conversation identifier
 */
const generateConversationId = () => {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const initialState = {
  messages: [],
  isLoading: false,
  error: null,
  currentConversationId: generateConversationId(),
};

export const useChatStore = create((set, get) => ({
  ...initialState,

  /**
   * Adds a new message to the chat
   * @param {import('../types/chat.js').ChatMessage} message - Message to add
   */
  addMessage: (message) => {
    const messageWithId = {
      ...message,
      id: message.id || generateMessageId(),
      timestamp: message.timestamp || new Date(),
      status: message.status || 'sent',
    };

    set((state) => ({
      messages: [...state.messages, messageWithId],
      error: null, // Clear any existing errors when adding new messages
    }));
  },

  /**
   * Updates an existing message
   * @param {string} id - Message ID to update
   * @param {Partial<import('../types/chat.js').ChatMessage>} updates - Updates to apply
   */
  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  },

  /**
   * Removes a message from the chat
   * @param {string} id - Message ID to remove
   */
  removeMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== id),
    }));
  },

  /**
   * Clears all messages and starts a new conversation
   */
  clearChat: () => {
    set({
      messages: [],
      error: null,
      currentConversationId: generateConversationId(),
    });
  },

  /**
   * Sets the loading state
   * @param {boolean} loading - Whether the chat is loading
   */
  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  /**
   * Sets an error message
   * @param {string|null} error - Error message or null to clear
   */
  setError: (error) => {
    set({ error, isLoading: false }); // Clear loading when setting error
  },

  /**
   * Retries sending a failed message
   * @param {string} messageId - ID of the message to retry
   */
  retryMessage: (messageId) => {
    const state = get();
    const message = state.messages.find((msg) => msg.id === messageId);

    if (message && message.status === 'error') {
      // Update message status to retry
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === messageId
            ? { ...msg, status: 'retry', error: undefined }
            : msg
        ),
        error: null,
      }));
    }
  },

  /**
   * Gets the last user message for context
   * @returns {import('../types/chat.js').ChatMessage|null} Last user message or null
   */
  getLastUserMessage: () => {
    const state = get();
    const userMessages = state.messages.filter((msg) => msg.type === 'user');
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  },

  /**
   * Gets all messages in the current conversation
   * @returns {import('../types/chat.js').ChatMessage[]} Array of messages
   */
  getMessages: () => {
    return get().messages;
  },

  /**
   * Checks if there are any messages in the current conversation
   * @returns {boolean} True if conversation has messages
   */
  hasMessages: () => {
    return get().messages.length > 0;
  },

  /**
   * Gets the current conversation ID
   * @returns {string} Current conversation ID
   */
  getCurrentConversationId: () => {
    return get().currentConversationId;
  },

  /**
   * Resets the store to initial state
   */
  resetAll: () => {
    set({
      ...initialState,
      currentConversationId: generateConversationId(),
    });
  },
}));