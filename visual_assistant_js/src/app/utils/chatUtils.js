// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Creates a new user message with text content
 * @param {string} text - The text content
 * @returns {import('../types/chat.js').ChatMessage} New user message
 */
export const createTextMessage = (text) => {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'user',
    content: { text },
    timestamp: new Date(),
    status: 'sending',
  };
};

/**
 * Creates a new user message with image content
 * @param {File} file - The image file
 * @param {string} [text] - Optional accompanying text
 * @returns {import('../types/chat.js').ChatMessage} New user message with image
 */
export const createImageMessage = (file, text = '') => {
  const url = URL.createObjectURL(file);

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'user',
    content: {
      text: text || undefined,
      image: {
        url,
        file,
      },
    },
    timestamp: new Date(),
    status: 'sending',
  };
};

/**
 * Creates a new user message with audio content
 * @param {Blob} blob - The audio blob
 * @param {number} duration - Duration in seconds
 * @param {string} [text] - Optional transcribed text
 * @returns {import('../types/chat.js').ChatMessage} New user message with audio
 */
export const createAudioMessage = (blob, duration, text = '') => {
  const url = URL.createObjectURL(blob);

  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'user',
    content: {
      text: text || undefined,
      audio: {
        url,
        blob,
        duration,
      },
    },
    timestamp: new Date(),
    status: 'sending',
  };
};

/**
 * Creates a new assistant message with text content
 * @param {string} text - The response text
 * @param {import('../types/chat.js').ChatMessageMetadata} [metadata] - Optional metadata
 * @returns {import('../types/chat.js').ChatMessage} New assistant message
 */
export const createAssistantMessage = (text, metadata = {}) => {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'assistant',
    content: { text },
    timestamp: new Date(),
    status: 'sent',
    metadata,
  };
};

/**
 * Checks if a message has text content
 * @param {import('../types/chat.js').ChatMessage} message - Message to check
 * @returns {boolean} True if message has text content
 */
export const hasTextContent = (message) => {
  return Boolean(message.content.text && message.content.text.trim());
};

/**
 * Checks if a message has image content
 * @param {import('../types/chat.js').ChatMessage} message - Message to check
 * @returns {boolean} True if message has image content
 */
export const hasImageContent = (message) => {
  return Boolean(message.content.image);
};

/**
 * Checks if a message has audio content
 * @param {import('../types/chat.js').ChatMessage} message - Message to check
 * @returns {boolean} True if message has audio content
 */
export const hasAudioContent = (message) => {
  return Boolean(message.content.audio);
};

/**
 * Checks if a message is multimodal (has multiple content types)
 * @param {import('../types/chat.js').ChatMessage} message - Message to check
 * @returns {boolean} True if message has multiple content types
 */
export const isMultimodalMessage = (message) => {
  const contentTypes = [
    hasTextContent(message),
    hasImageContent(message),
    hasAudioContent(message),
  ];

  return contentTypes.filter(Boolean).length > 1;
};

/**
 * Gets a display-friendly content summary for a message
 * @param {import('../types/chat.js').ChatMessage} message - Message to summarize
 * @returns {string} Content summary
 */
export const getContentSummary = (message) => {
  const parts = [];

  if (hasTextContent(message)) {
    const text = message.content.text.trim();
    parts.push(text.length > 50 ? `${text.substring(0, 50)}...` : text);
  }

  if (hasImageContent(message)) {
    parts.push('[Image]');
  }

  if (hasAudioContent(message)) {
    const duration = message.content.audio.duration;
    const durationText = duration ? ` (${Math.round(duration)}s)` : '';
    parts.push(`[Audio${durationText}]`);
  }

  return parts.join(' ');
};

/**
 * Cleans up blob URLs to prevent memory leaks
 * @param {import('../types/chat.js').ChatMessage} message - Message to clean up
 */
export const cleanupMessageResources = (message) => {
  if (message.content.image?.url && message.content.image.url.startsWith('blob:')) {
    URL.revokeObjectURL(message.content.image.url);
  }

  if (message.content.audio?.url && message.content.audio.url.startsWith('blob:')) {
    URL.revokeObjectURL(message.content.audio.url);
  }
};

/**
 * Validates message content before sending
 * @param {import('../types/chat.js').ChatMessage} message - Message to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export const validateMessage = (message) => {
  // Check if message has any content
  if (!hasTextContent(message) && !hasImageContent(message) && !hasAudioContent(message)) {
    return { valid: false, error: 'Message must have at least one type of content' };
  }

  // Validate text content
  if (hasTextContent(message)) {
    const text = message.content.text.trim();
    if (text.length > 10000) { // Reasonable limit for text messages
      return { valid: false, error: 'Text message is too long (max 10,000 characters)' };
    }
  }

  // Validate image content
  if (hasImageContent(message)) {
    const image = message.content.image;
    if (!image.file && !image.buffer) {
      return { valid: false, error: 'Image message must have file or buffer data' };
    }

    if (image.file && image.file.size > 10 * 1024 * 1024) { // 10MB limit
      return { valid: false, error: 'Image file is too large (max 10MB)' };
    }
  }

  // Validate audio content
  if (hasAudioContent(message)) {
    const audio = message.content.audio;
    if (!audio.blob && !audio.buffer) {
      return { valid: false, error: 'Audio message must have blob or buffer data' };
    }

    if (audio.duration && audio.duration > 300) { // 5 minute limit
      return { valid: false, error: 'Audio message is too long (max 5 minutes)' };
    }
  }

  return { valid: true };
};