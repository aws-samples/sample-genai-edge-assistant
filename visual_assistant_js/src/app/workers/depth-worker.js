"use client";

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  AutoModel,
  AutoProcessor,
  env,
  RawImage,
} from '@huggingface/transformers';
import { setupWorkerLogging } from 'src/app/utils/workerLogging.js';

// Skip local model check
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';

let detector = null;
let isInitialized = false;

// Setup worker logging by overriding default console methods
setupWorkerLogging('depth', self);

// Use the Singleton pattern to enable lazy construction of the pipeline.
class DepthPipelineSingleton {
  static model = 'depth';
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
      env.backends.onnx.wasm.wasmPaths = {
        // A
        mjs: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.mjs',
        wasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.wasm'
      }
    } else if (!navigator.gpu) {
      console.warn(
        'WebGPU is not supported in this browser. Falling back to web assembly.',
      );
      this.device = 'wasm';
    } else {
      console.log('WebGPU is supported.');
      //this.device = 'webgpu';
      this.device = 'webgpu';
    }

    this.objectDepthModel = await AutoModel.from_pretrained(this.model, {
      device: this.device,
      // Use fp16 if available, otherwise use fp32
      dtype: 'q8',
      quantized: true,
      progress_callback,
    });

    this.objectDepthProcessor = await AutoProcessor.from_pretrained(this.model);

    this.size = 128;
    this.objectDepthProcessor.image_processor.size = {
      width: this.size,
      height: this.size,
    };

    return this;
  }
}

let fps = 0;
let startTime = null;
let img = null;

// Initialize the model when the worker starts
async function initialize() {
  try {
    detector = await DepthPipelineSingleton.getInstance((progress) => {
      self.postMessage({
        status: 'loading',
        progress,
      });
    });

    isInitialized = true;

    console.warn('worker is initialized !');

    self.postMessage({
      status: 'ready',
      device: DepthPipelineSingleton.device,
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
          device: DepthPipelineSingleton.device,
        });
        console.warn('Ready posted retry!');
      }, 500);
      return;
    }

    img = new RawImage(event.data.frame.data, 640, 480, 4);

    detector.objectDepthProcessor.image_processor.size = {
      width: event.data.depthSize,
      height: event.data.depthSize,
    };

    // Actually perform the depth estimation
    const inputs = await detector.objectDepthProcessor(img);
    const { predicted_depth } = await detector.objectDepthModel(inputs);

    // Predict depth map
    const data = predicted_depth.data;
    const [bs, oh, ow] = predicted_depth.dims;

    // Normalize the depth map
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < data.length; ++i) {
      const v = data[i];
      if (v < min) {
        min = v;
      }
      if (v > max) {
        max = v;
      }
    }
    const range = max - min;

    const imageData = new Uint8ClampedArray(4 * data.length);
    for (let i = 0; i < data.length; ++i) {
      const offset = 4 * i;
      imageData[offset] = 255; // Set base color to red

      // Set alpha to normalized depth value
      imageData[offset + 3] = 255 * (1 - (data[i] - min) / range);
    }
    const outPixelDataDepth = new ImageData(imageData, ow, oh);

    fps = 1000 / (performance.now() - startTime);

    // Send the output back to the main thread
    self.postMessage({
      status: 'complete',
      outputs: outPixelDataDepth,
      fps: fps,
      actualDepth: data,
    });
  }
});
