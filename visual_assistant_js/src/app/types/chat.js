// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * @typedef {Object} ChatMessageContent
 * @property {string} [text] - Text content of the message
 * @property {Object} [image] - Image content
 * @property {string} image.url - URL for displaying the image
 * @property {File} [image.file] - Original file object
 * @property {ArrayBuffer} [image.buffer] - Processed buffer for SageMaker
 * @property {Object} [audio] - Audio content
 * @property {string} audio.url - URL for playing the audio
 * @property {Blob} [audio.blob] - Original audio blob
 * @property {ArrayBuffer} [audio.buffer] - Processed buffer for SageMaker
 * @property {number} [audio.duration] - Duration in seconds
 */

/**
 * @typedef {Object} ChatMessageMetadata
 * @property {string} [model] - Model used for generation
 * @property {number} [processingTime] - Processing time in milliseconds
 * @property {number} [tokens] - Number of tokens used
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id - Unique identifier for the message
 * @property {'user'|'assistant'} type - Type of message sender
 * @property {ChatMessageContent} content - Message content
 * @property {Date} timestamp - When the message was created
 * @property {'sending'|'sent'|'error'|'retry'} status - Current status of the message
 * @property {string} [error] - Error message if status is 'error'
 * @property {ChatMessageMetadata} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} SageMakerChatRequest
 * @property {Array<{role: 'user'|'assistant', content: Array<{type: 'text'|'image'|'audio', text?: string}>}>} messages - Chat messages in HuggingFace format
 * @property {string} prompt - Generated prompt from chat template
 * @property {ArrayBuffer|null} image_buffer - Raw image buffer for RawImage.read
 * @property {ArrayBuffer|null} audio_buffer - Raw audio buffer for wavefile.WaveFile
 * @property {Object} options - Generation options
 * @property {boolean} options.add_special_tokens - Whether to add special tokens
 * @property {number} [options.max_new_tokens] - Maximum new tokens to generate
 * @property {boolean} [options.do_sample] - Whether to use sampling
 * @property {number} [options.temperature] - Sampling temperature
 */

/**
 * @typedef {Object} SageMakerChatResponse
 * @property {string} generated_text - Generated response text
 * @property {number} processing_time_ms - Processing time in milliseconds
 * @property {string} model - Model identifier
 * @property {Object} [usage] - Token usage information
 * @property {number} usage.input_tokens - Input tokens used
 * @property {number} usage.output_tokens - Output tokens generated
 * @property {number} usage.total_tokens - Total tokens used
 */

/**
 * @typedef {Object} UserFriendlyError
 * @property {string} message - User-friendly error message
 * @property {'retry'|'redirect_to_auth'|'none'} action - Suggested action
 * @property {boolean} retryable - Whether the error is retryable
 */

// Export empty object to make this a module
export {};