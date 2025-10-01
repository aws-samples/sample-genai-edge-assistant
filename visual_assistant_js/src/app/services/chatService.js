// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { processMultimodalContent } from 'src/app/utils/multimodalProcessing.js';

/**
 * Service type enumeration for chat backends
 */
export const ChatServiceType = {
  SAGEMAKER: 'sagemaker',
  LOCAL_BROWSER: 'local_browser',
};

/**
 * Base class for chat service implementations with shared multimodal processing
 */
export class IChatService {
  /**
   * Send a message to the chat service and get a response
   * @param {import('../types/chat.js').ChatMessage} message - The message to send
   * @param {boolean} streaming - Whether to use streaming response
   * @returns {Promise<import('../types/chat.js').ChatMessage>} - The response message
   */
  async sendMessage(message, streaming = false) {
    throw new Error('sendMessage method must be implemented by subclass');
  }

  /**
   * Get the service type
   * @returns {string} - The service type from ChatServiceType enum
   */
  getServiceType() {
    throw new Error('getServiceType method must be implemented by subclass');
  }

  /**
   * Process multimodal content for backend consumption
   * Shared utility that all services can use
   * @param {Object} messageContent - Message content with text, images, audios
   * @returns {Promise<Array>} Processed content array
   */
  async processContent(messageContent) {
    return await processMultimodalContent(messageContent);
  }
}