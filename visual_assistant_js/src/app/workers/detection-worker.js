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
setupWorkerLogging('detection', self);

// Use the Singleton pattern to enable lazy construction of the pipeline.
class DetectionPipelineSingleton {
  static model = 'object-detection';
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

    this.objectDetectionModel = await AutoModel.from_pretrained(this.model, {
      device: this.device,
      // Use fp16 if available, otherwise use fp32
      dtype: 'q8',
      quantized: true,
      progress_callback,
    });

    this.objectDetectionProcessor = await AutoProcessor.from_pretrained(
      this.model,
    );

    const size = 64;
    this.objectDetectionProcessor.feature_extractor.size = {
      shortest_edge: size,
    };
    this.threshold = 0.1;

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

    console.log('Detection worker is processing !');

    img = new RawImage(event.data.frame.data, 640, 480, 4);

    detector.objectDetectionProcessor.feature_extractor.size = {
      shortest_edge: event.data.objectDetSize,
    };

    // Actually perform the depth estimation
    const inputs = await detector.objectDetectionProcessor(img);
    const { outputs } = await detector.objectDetectionModel(inputs);

    // Function to calculate IoU of two bounding boxes
    const calculateIoU = (box1, box2) => {
      const [x1min, y1min, x1max, y1max] = box1;
      const [x2min, y2min, x2max, y2max] = box2;

      const intersectionX1 = Math.max(x1min, x2min);
      const intersectionY1 = Math.max(y1min, y2min);
      const intersectionX2 = Math.min(x1max, x2max);
      const intersectionY2 = Math.min(y1max, y2max);

      // 0 when w or h is negative
      if (intersectionX2 < intersectionX1 || intersectionY2 < intersectionY1) {
        return 0;
      }

      const intersection =
        (intersectionX2 - intersectionX1) * (intersectionY2 - intersectionY1);
      const box1Area = (x1max - x1min) * (y1max - y1min);
      const box2Area = (x2max - x2min) * (y2max - y2min);

      return intersection / (box1Area + box2Area - intersection);
    };

    // Merge nearby detections of the same class
    const mergeDetections = (detections) => {
      const merged = [];
      const evaluatedAsDuplicateByIOU = new Set();

      for (let i = 0; i < detections.length; i++) {
        if (evaluatedAsDuplicateByIOU.has(i)) {
          continue;
        }

        const current = detections[i];
        let [xmin, ymin, xmax, ymax, score, label] = current;

        for (let j = i + 1; j < detections.length; j++) {
          if (evaluatedAsDuplicateByIOU.has(j)) {
            continue;
          }

          const other = detections[j];
          const [oxmin, oymin, oxmax, oymax, oscore, olabel] = other;

          // Check if same label and IoU over threshold
          if (
            label === olabel &&
            calculateIoU(
              [xmin, ymin, xmax, ymax],
              [oxmin, oymin, oxmax, oymax],
            ) > 0.5
          ) {
            evaluatedAsDuplicateByIOU.add(j);

            // Weighted average based on confidence scores for more stable coordinates
            const total_score = score + oscore;
            const w1 = score / total_score;
            const w2 = oscore / total_score;

            xmin = xmin * w1 + oxmin * w2;
            ymin = ymin * w1 + oymin * w2;
            xmax = xmax * w1 + oxmax * w2;
            ymax = ymax * w1 + oymax * w2;

            // Take the highest confidence
            score = Math.max(score, oscore);
          }
        }

        merged.push([xmin, ymin, xmax, ymax, score, label]);
      }

      return merged;
    };

    const rawOutputs = outputs.tolist();
    const mergedOutputs = mergeDetections(rawOutputs);

    const sizes = inputs.reshaped_input_sizes[0].reverse();

    fps = 1000 / (performance.now() - startTime);

    // Send the output back to the main thread
    self.postMessage({
      status: 'complete',
      sizes: sizes,
      outputs: mergedOutputs,
      id2label: detector.objectDetectionModel.config.id2label,
      fps: fps,
    });

    console.log('Detection worker finished processing !');
  }
});
