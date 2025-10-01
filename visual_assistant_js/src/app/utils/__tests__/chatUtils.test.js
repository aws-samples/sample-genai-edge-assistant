// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Tests for chatUtils.js
 * Run with: npm test
 */

import {
  createTextMessage,
  createImageMessage,
  createAudioMessage,
  createAssistantMessage,
  hasTextContent,
  hasImageContent,
  hasAudioContent,
  isMultimodalMessage,
  getContentSummary,
  validateMessage,
} from 'src/app/utils/chatUtils.js';

describe('ChatUtils', () => {
  describe('Message Creation Functions', () => {
    describe('createTextMessage', () => {
      test('should create a text message with correct structure', () => {
        const message = createTextMessage('Hello world');

        expect(message.type).toBe('user');
        expect(message.content.text).toBe('Hello world');
        expect(message.status).toBe('sending');
        expect(message.id).toBeDefined();
        expect(message.timestamp).toBeInstanceOf(Date);
      });

      test('should generate unique IDs for different messages', () => {
        const message1 = createTextMessage('Message 1');
        const message2 = createTextMessage('Message 2');

        expect(message1.id).not.toBe(message2.id);
      });
    });

    describe('createImageMessage', () => {
      test('should create an image message with file', () => {
        const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
        const message = createImageMessage(mockFile, 'Describe this image');

        expect(message.type).toBe('user');
        expect(message.content.text).toBe('Describe this image');
        expect(message.content.image.file).toBe(mockFile);
        expect(message.content.image.url).toBe('blob:mock-url');
        expect(message.status).toBe('sending');
      });

      test('should create image message without text', () => {
        const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
        const message = createImageMessage(mockFile);

        expect(message.content.text).toBeUndefined();
        expect(message.content.image.file).toBe(mockFile);
      });
    });

    describe('createAudioMessage', () => {
      test('should create an audio message with blob', () => {
        const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
        const message = createAudioMessage(mockBlob, 30, 'Transcribed text');

        expect(message.type).toBe('user');
        expect(message.content.text).toBe('Transcribed text');
        expect(message.content.audio.blob).toBe(mockBlob);
        expect(message.content.audio.duration).toBe(30);
        expect(message.content.audio.url).toBe('blob:mock-url');
      });

      test('should create audio message without text', () => {
        const mockBlob = new Blob(['audio data'], { type: 'audio/wav' });
        const message = createAudioMessage(mockBlob, 15);

        expect(message.content.text).toBeUndefined();
        expect(message.content.audio.duration).toBe(15);
      });
    });

    describe('createAssistantMessage', () => {
      test('should create assistant message with metadata', () => {
        const metadata = { model: 'gpt-4', processingTime: 1500 };
        const message = createAssistantMessage('Hello user!', metadata);

        expect(message.type).toBe('assistant');
        expect(message.content.text).toBe('Hello user!');
        expect(message.status).toBe('sent');
        expect(message.metadata).toEqual(metadata);
      });

      test('should create assistant message without metadata', () => {
        const message = createAssistantMessage('Hello user!');

        expect(message.type).toBe('assistant');
        expect(message.metadata).toEqual({});
      });
    });
  });

  describe('Content Detection Functions', () => {
    test('hasTextContent should detect text content', () => {
      const textMessage = createTextMessage('Hello');
      const emptyTextMessage = { content: { text: '' } };
      const noTextMessage = { content: {} };

      expect(hasTextContent(textMessage)).toBe(true);
      expect(hasTextContent(emptyTextMessage)).toBe(false);
      expect(hasTextContent(noTextMessage)).toBe(false);
    });

    test('hasImageContent should detect image content', () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const imageMessage = createImageMessage(mockFile);
      const textMessage = createTextMessage('Hello');

      expect(hasImageContent(imageMessage)).toBe(true);
      expect(hasImageContent(textMessage)).toBe(false);
    });

    test('hasAudioContent should detect audio content', () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/wav' });
      const audioMessage = createAudioMessage(mockBlob, 10);
      const textMessage = createTextMessage('Hello');

      expect(hasAudioContent(audioMessage)).toBe(true);
      expect(hasAudioContent(textMessage)).toBe(false);
    });

    test('isMultimodalMessage should detect multimodal content', () => {
      const textMessage = createTextMessage('Hello');
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const imageWithTextMessage = createImageMessage(mockFile, 'Describe this');

      expect(isMultimodalMessage(textMessage)).toBe(false);
      expect(isMultimodalMessage(imageWithTextMessage)).toBe(true);
    });
  });

  describe('Content Summary Function', () => {
    test('should summarize text content', () => {
      const message = createTextMessage('Hello world');
      expect(getContentSummary(message)).toBe('Hello world');
    });

    test('should truncate long text', () => {
      const longText = 'a'.repeat(60);
      const message = createTextMessage(longText);
      const summary = getContentSummary(message);

      expect(summary).toHaveLength(53); // 50 chars + '...'
      expect(summary.endsWith('...')).toBe(true);
    });

    test('should summarize multimodal content', () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const message = createImageMessage(mockFile, 'Describe this image');

      const summary = getContentSummary(message);
      expect(summary).toBe('Describe this image [Image]');
    });

    test('should summarize audio with duration', () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/wav' });
      const message = createAudioMessage(mockBlob, 45.7, 'Transcribed text');

      const summary = getContentSummary(message);
      expect(summary).toBe('Transcribed text [Audio (46s)]');
    });
  });

  describe('Message Validation Function', () => {
    test('should validate text message', () => {
      const message = createTextMessage('Hello world');
      const result = validateMessage(message);

      expect(result.valid).toBe(true);
    });

    test('should reject empty message', () => {
      const message = { content: {} };
      const result = validateMessage(message);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least one type of content');
    });

    test('should reject overly long text', () => {
      const longText = 'a'.repeat(10001);
      const message = createTextMessage(longText);
      const result = validateMessage(message);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    test('should validate image message', () => {
      const mockFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
      const message = createImageMessage(mockFile);
      const result = validateMessage(message);

      expect(result.valid).toBe(true);
    });

    test('should reject oversized image', () => {
      // Mock a large file
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg');
      const message = createImageMessage(largeFile);
      const result = validateMessage(message);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    test('should validate audio message', () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/wav' });
      const message = createAudioMessage(mockBlob, 30);
      const result = validateMessage(message);

      expect(result.valid).toBe(true);
    });

    test('should reject overly long audio', () => {
      const mockBlob = new Blob(['audio'], { type: 'audio/wav' });
      const message = createAudioMessage(mockBlob, 400); // Over 5 minutes
      const result = validateMessage(message);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });
});