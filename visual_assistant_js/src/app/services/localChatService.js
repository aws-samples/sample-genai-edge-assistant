// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { IChatService, ChatServiceType } from './chatService.js';

export class LocalChatService extends IChatService {
  constructor() {
    super();
    this.worker = null;
    this.isInitializing = false;
    this.isReady = false;
  }

  /**
   * Initialize the chat worker
   */
  async initializeWorker() {
    if (this.worker && this.isReady) {
      console.log('Worker already ready, skipping initialization');
      return; // Already initialized and ready
    }

    if (this.isInitializing) {
      console.log('Worker already initializing, waiting...');
      // Wait for the current initialization to complete
      return new Promise((resolve, reject) => {
        const checkReady = () => {
          if (this.isReady) {
            resolve();
          } else if (!this.isInitializing) {
            reject(new Error('Initialization failed'));
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }

    this.isInitializing = true;

    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(
          new URL('../workers/chat-worker.js', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event) => {
          const { status } = event.data;

          if (status === 'loading') {
            // Just log progress occasionally, not every message
            if (event.data.progress?.status === 'done') {
              console.log('Loaded:', event.data.progress.file);
            }
          } else if (status === 'ready') {
            this.isReady = true;
            this.isInitializing = false;
            console.log('Chat worker is ready');
            resolve();
          } else if (status === 'error') {
            this.isInitializing = false;
            console.error('Chat worker initialization error:', event.data.error);
            reject(new Error(event.data.error || 'Unknown worker error'));
          }
        };

        // Send initialize message to start loading
        this.worker.postMessage({ type: 'initialize' });

        this.worker.onerror = (error) => {
          this.isInitializing = false;
          console.error('Chat worker error:', error);
          reject(error);
        };

      } catch (error) {
        this.isInitializing = false;
        reject(error);
      }
    });
  }

  /**
   * Convert chat message to Janus conversation format
   */
  formatConversation(message) {
    const conversation = [];

    // Add system prompt for visual assistant context
    conversation.push({
      role: '<|System|>',
      content: 'You are a helpful visual assistant for visually impaired people.',
    });

    // Handle multimodal content
    if (message.content.images && message.content.images.length > 0) {
      // For image + text conversation
      conversation.push({
        role: '<|User|>',
        content: `<image_placeholder>\n${message.content.text || 'Describe this image.'}`,
        images: message.content.images,
      });
    } else {
      // Text-only conversation
      conversation.push({
        role: '<|User|>',
        content: message.content.text || '',
      });
    }

    return conversation;
  }

  async sendMessage(message) {
    try {
      // Initialize worker if not already done
      if (!this.isReady) {
        console.log('Initializing chat worker...');
        await this.initializeWorker();
        console.log('Chat worker initialized successfully');
      }

      // Format the message for Janus
      const conversation = this.formatConversation(message);

      // Send to worker and wait for response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Chat request timed out'));
        }, 30000); // 30 second timeout

        this.worker.onmessage = (event) => {
          const { status, response, error, tokensPerSecond, tokenCount, elapsedTime } = event.data;

          clearTimeout(timeout);

          if (status === 'complete') {
            resolve({
              id: `msg_${Date.now()}`,
              type: 'assistant',
              content: { text: response },
              timestamp: new Date(),
              status: 'sent',
              metadata: {
                model: 'Janus Pro 1B (Local)',
                tokensPerSecond: tokensPerSecond,
                tokenCount: tokenCount,
                elapsedTime: elapsedTime,
              },
            });
          } else if (status === 'error') {
            reject(new Error(error));
          }
        };

        // Send the chat request to worker
        this.worker.postMessage({
          type: 'chat',
          conversation,
          maxTokens: 1000,
        });
      });

    } catch (error) {
      throw new Error(`Local chat service error: ${error.message}`);
    }
  }

  getServiceType() {
    return ChatServiceType.LOCAL_BROWSER;
  }

  /**
   * Clean up worker resources
   */
  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}