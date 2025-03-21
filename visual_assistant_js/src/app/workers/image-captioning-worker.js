"use client";

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  AutoModelForVision2Seq,
  AutoProcessor,
  AutoTokenizer,
  env,
  RawImage,
} from '@huggingface/transformers';
import { setupWorkerLogging } from 'src/app/utils/workerLogging.js';

// Skip local model check
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';

env.backends.onnx.wasm.wasmPaths = {
  // A
  mjs: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.wasm'
}

let captioning = null;
let isInitialized = false;

// Setup worker logging by overriding default console methods
setupWorkerLogging('imageCaptioning', self);

// Use the Singleton pattern to enable lazy construction of the pipeline.
class ImageCaptioningPipelineSingleton {
  static model = 'image-captioning';
  static device = 'wasm';

  static async getInstance(progress_callback = null) {
    // Check if mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isMobile) {
      console.warn('Mobile device detected. Using web assembly.');
      this.device = 'wasm';
    } else if (!navigator.gpu) {
      console.warn(
        'WebGPU is not supported in this browser. Falling back to web assembly.',
      );
      this.device = 'wasm';
    } else {
      console.log('WebGPU is supported.');
      //this.device = 'webgpu';
      this.device = 'wasm';
    }

    try {
      this.imageCaptioningModel = await AutoModelForVision2Seq.from_pretrained(
        this.model,
        {
          device: this.device,
          // Use fp16 if available, otherwise use fp32
          dtype: 'q8',
          quantized: true,
          progress_callback,
        },
      );
    } catch (e) {
      console.log('issue with model image captioning');
      console.log(e);
    }

    this.imageCaptioningProcessor = await AutoProcessor.from_pretrained(
      this.model,
    );
    this.tokenizer = await AutoTokenizer.from_pretrained(this.model);

    return this;
  }
}

let fps = 0;
let startTime = null;

// Initialize the model when the worker starts
async function initialize() {
  try {
    captioning = await ImageCaptioningPipelineSingleton.getInstance(
      (progress) => {
        self.postMessage({
          status: 'loading',
          progress,
        });
      },
    );

    isInitialized = true;

    console.warn('worker is initialized !');

    self.postMessage({
      status: 'ready',
      device: ImageCaptioningPipelineSingleton.device,
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

  if (event.data.type === 'process') {
    // Send back a ready message if event.data.frame is null, but send back with a delay of 500ms, skip the rest
    if (event.data.frame === null) {
      setTimeout(() => {
        self.postMessage({
          status: 'ready',
          device: ImageCaptioningPipelineSingleton.device,
        });
        console.warn('Ready posted retry!');
      }, 500);
      return;
    }

    // Preprocess image
    const rgbData = new Uint8ClampedArray(
      event.data.frame.width * event.data.frame.height * 3,
    );
    const pixels = event.data.frame.data;
    let rgbIndex = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      rgbData[rgbIndex++] = pixels[i]; // Red
      rgbData[rgbIndex++] = pixels[i + 1]; // Green
      rgbData[rgbIndex++] = pixels[i + 2]; // Blue
    }

    const img = new RawImage(
      rgbData,
      event.data.frame.width,
      event.data.frame.height,
      3,
    );

    // Actually perform the classification
    const image_inputs = await captioning.imageCaptioningProcessor(img);
    const output = await captioning.imageCaptioningModel.generate(
      image_inputs,
      {
        max_length: 20,
      },
    );
    const decoded = captioning.tokenizer.batch_decode(output)[0];

    // Postprocess description
    const description = decoded
      .replaceAll(
        '<|endoftext|>a blurry photo of a dark room with a red and white background <|endoftext|>',
        '',
      )
      .replaceAll('<|endoftext|>', '')
      .replaceAll(' woman ', ' person ')
      .replaceAll(' man ', ' person ');
    fps = 1000 / (performance.now() - startTime);
    // Send the output back to the main thread
    self.postMessage({
      status: 'complete',
      output: description,
      fps: fps,
    });
  }
});
