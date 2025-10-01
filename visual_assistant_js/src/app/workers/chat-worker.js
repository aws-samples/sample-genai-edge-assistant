'use client';

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  AutoProcessor,
  MultiModalityCausalLM,
  env,
} from '@huggingface/transformers';
import { setupWorkerLogging } from 'src/app/utils/workerLogging.js';

// Skip local model check
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';

let chatModel = null;
let isInitialized = false;

// Setup worker logging by overriding default console methods
setupWorkerLogging('chat', self);

// Use the Singleton pattern to enable lazy construction of the pipeline.
class ChatPipelineSingleton {
  static model = 'chat';
  static device = 'wasm';

  static async getInstance(progressCallback = null) {
    // Check if mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isMobile) {
      console.warn('Mobile device detected. Using web assembly.');
      this.device = 'wasm';
      env.backends.onnx.wasm.wasmPaths = {
        mjs: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.mjs',
        wasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.wasm',
      };
    } else if (!navigator.gpu) {
      console.warn(
        'WebGPU is not supported in this browser. Falling back to web assembly.',
      );
      this.device = 'wasm';
    } else {
      console.log('WebGPU is supported.');
      this.device = 'webgpu';
    }

    try {
      console.log('Loading chat model from:', this.model);
      console.log('Using device:', this.device);

      // Load processor and model
      console.log('Loading processor...');
      try {
        this.processor = await AutoProcessor.from_pretrained(this.model, {
          local_files_only: true, // Ensure it only uses cached files
          progress_callback: progressCallback,
        });
        console.log('Processor loaded successfully');
      } catch (processorError) {
        console.error('Failed to load processor:', processorError);
        throw new Error(`Processor loading failed: ${processorError.message}`);
      }

      console.log('Loading chat model...');
      try {
        // Use the exact same approach as successful Transformers.js examples
        console.log('Loading model with device:', this.device);

        // Configure model with mixed device setup for WebGPU compatibility

        const modelConfig = {
          local_files_only: true,
          progress_callback: progressCallback,
          // Use the exact configuration from GitHub issue (fp16_supported=false)
          dtype: {
            prepare_inputs_embeds: 'q4',
            language_model: 'q4f16',
            lm_head: 'fp16',
            gen_head: 'fp16',
            gen_img_embeds: 'fp16',
            image_decode: 'fp32',
          },
          // dtype: {
          //   prepare_inputs_embeds: 'fp32',
          //   language_model: 'q4',
          //   lm_head: 'fp32',
          //   gen_head: 'fp32',
          //   gen_img_embeds: 'fp32',
          //   image_decode: 'fp32',
          // },
          // Mixed device configuration - keep problematic ops on WASM
          device: this.device === 'webgpu' ? {
            prepare_inputs_embeds: 'wasm', // Keep on WASM to avoid WebGPU JSEP issues
            language_model: 'webgpu',
            lm_head: 'webgpu',
            gen_head: 'webgpu',
            gen_img_embeds: 'webgpu',
            image_decode: 'webgpu',
          } : this.device,
        };

        console.log('Loading model with configuration:', {
          device: this.device,
          dtype: modelConfig.dtype,
          deviceConfig: modelConfig.device,
        });

        this.chatModel = await MultiModalityCausalLM.from_pretrained(this.model, modelConfig);
        console.log('Janus chat model loaded successfully');
      } catch (modelError) {
        console.error('Failed to load chat model:', modelError);
        console.error('Model error type:', typeof modelError);
        console.error('Model error details:', modelError);
        console.error('Model error stack:', modelError?.stack);
        console.error('Model error code:', modelError?.code);
        console.error('Model error name:', modelError?.name);

        // Check if it's a memory error
        if (modelError?.message?.includes('memory') || modelError?.message?.includes('allocation')) {
          throw new Error('Model loading failed: Out of memory - model too large for browser');
        }

        throw new Error(`Model loading failed: ${modelError?.message || modelError?.toString() || modelError || 'Unknown model error'}`);
      }

    } catch (e) {
      console.error('Issue loading Janus chat model:', e);
      console.error('Model path:', this.model);
      console.error('Error details:', e.message, e.stack);
      throw e;
    }

    return this;
  }
}

let tokensPerSecond = 0;
let startTime = null;

// Initialize the model when the worker starts
async function initialize() {
  try {
    chatModel = await ChatPipelineSingleton.getInstance((progress) => {
      self.postMessage({
        status: 'loading',
        progress,
      });
    });

    isInitialized = true;

    console.warn('Chat worker is initialized!');

    self.postMessage({
      status: 'ready',
      device: ChatPipelineSingleton.device,
    });
    console.warn('Ready posted first!');
  } catch (error) {
    self.postMessage({
      status: 'error',
      error: error.message,
    });
  }
}

// Start initialization immediately
initialize();

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  // If we receive a message before initialization is complete, respond with busy status
  if (!isInitialized) {
    self.postMessage({
      status: 'busy',
      message: 'Model is still initializing',
    });
    console.warn('busy posted!');
    return;
  }

  startTime = performance.now();

  if (event.data.type === 'chat') {
    try {
      const { conversation, maxTokens = 150 } = event.data;

      console.log('Processing chat request:', JSON.stringify(conversation, null, 2));

      // Process the conversation with the model
      console.log('Processing conversation with processor...');

      // Convert image objects to URLs for the processor
      const processedConversation = conversation.map((msg) => {
        if (msg.images && Array.isArray(msg.images)) {
          return {
            ...msg,
            images: msg.images.map((img) => {
              // If it's an object with a url property, extract the URL
              if (typeof img === 'object' && img.url) {
                return img.url;
              }
              // If it's already a string URL, use it as is
              return img;
            }),
          };
        }
        return msg;
      });

      console.log('Processed conversation for processor:', JSON.stringify(processedConversation, null, 2));
      const inputs = await chatModel.processor(processedConversation);
      console.log('Processor inputs generated, input_ids shape:', inputs.input_ids?.dims);

      // Generate response - let model stop naturally
      const outputs = await chatModel.chatModel.generate({
        ...inputs,
        max_new_tokens: Math.max(maxTokens, 1000), // Use higher limit to allow natural stopping
        do_sample: false,
        // Model will stop when it generates end-of-sequence token
      });

      // Decode the response
      const new_tokens = outputs.slice(null, [inputs.input_ids.dims.at(-1), null]);
      const decoded = chatModel.processor.batch_decode(new_tokens, {
        skip_special_tokens: true,
      });

      // Calculate tokens per second
      const elapsedTime = (performance.now() - startTime) / 1000; // Convert to seconds
      const tokenCount = new_tokens.dims[1]; // Number of generated tokens
      tokensPerSecond = tokenCount / elapsedTime;

      // Send the response back to the main thread
      self.postMessage({
        status: 'complete',
        response: decoded[0],
        tokensPerSecond: Math.round(tokensPerSecond * 100) / 100, // Round to 2 decimal places
        tokenCount: tokenCount,
        elapsedTime: Math.round(elapsedTime * 1000) / 1000, // Round to 3 decimal places
      });

    } catch (error) {
      console.error('Chat processing error:', error);
      self.postMessage({
        status: 'error',
        error: error.message,
      });
    }
  }

  if (event.data.type === 'ready_check') {
    self.postMessage({
      status: 'ready',
      device: ChatPipelineSingleton.device,
    });
  }
});