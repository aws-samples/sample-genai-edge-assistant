'use client';

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  AutoModel,
  AutoProcessor,
  env,
  RawImage,
} from '@huggingface/transformers';
import { setupWorkerLogging } from 'src/app/utils/workerLogging.js';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';

let detector = null;
let isInitialized = false;

// Setup worker logging by overriding default console methods
setupWorkerLogging('detection', self);

// Use the Singleton pattern to enable lazy construction of the pipeline.
class DetectionPipelineSingleton {
  static model = 'object-detection';
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
        // A
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

    // Load YOLOv9 model and processor (same as working test page)
    console.log('Loading object detection model...');

    this.objectDetectionModel = await AutoModel.from_pretrained(this.model, {
      dtype: 'q8',
      quantized: true,
      progress_callback: progressCallback,
    });

    this.objectDetectionProcessor = await AutoProcessor.from_pretrained(
      this.model,
    );

    console.log('Model loaded successfully');
    this.threshold = 70; // from 0 to 100

    return this;
  }
}

let fps = 0;
let startTime = null;
let img = null;

// Initialize the model when the worker starts
async function initialize() {
  try {
    detector = await DetectionPipelineSingleton.getInstance((progress) => {
      self.postMessage({
        status: 'loading',
        progress,
      });
    });

    isInitialized = true;

    console.warn('worker is initialized !');

    self.postMessage({
      status: 'ready',
      device: DetectionPipelineSingleton.device,
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
          device: DetectionPipelineSingleton.device,
        });
        console.warn('Ready posted retry!');
      }, 500);
      return;
    }

    img = new RawImage(event.data.frame.data, 640, 480, 4);

    // Apply dynamic feature extractor size if provided
    if (event.data.objectDetSize) {
      detector.objectDetectionProcessor.feature_extractor.size = {
        shortest_edge: event.data.objectDetSize,
      };
    }

    // Run YOLOv9 detection
    const inputs = await detector.objectDetectionProcessor(img);
    const { outputs } = await detector.objectDetectionModel(inputs);
    const rawDetections = outputs.tolist();

    // Parse YOLOv9 output format: [xmin, ymin, xmax, ymax, confidence, classId]
    // Send ALL detections to UI - filtering will be done there based on user threshold
    const parsedDetections = rawDetections.map((det) => {
      const [xmin, ymin, xmax, ymax, confidence, classId] = det;
      const roundedClassId = Math.round(classId);
      return [xmin, ymin, xmax, ymax, confidence, roundedClassId];
    });

    // Get sizes for UI
    const sizes = inputs.reshaped_input_sizes[0].reverse(); // [width, height]

    fps = 1000 / (performance.now() - startTime);

    // Send the output back to the main thread
    self.postMessage({
      status: 'complete',
      sizes: sizes,
      outputs: parsedDetections,
      id2label: detector.objectDetectionModel.config.id2label,
      fps: fps,
    });
  }
});