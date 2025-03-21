"use client";

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  AutoProcessor,
  AutoTokenizer,
  SpeechT5ForTextToSpeech,
  SpeechT5HifiGan,
  Tensor,
  env,
  stack,
} from '@huggingface/transformers';
import { setupWorkerLogging } from 'src/app/utils/workerLogging.js';
import { WaveFile } from 'wavefile';

// Skip local model check
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';

env.backends.onnx.wasm.wasmPaths = {
  // A
  mjs: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort-wasm-simd-threaded.wasm'
}

let audioPipeline = null;
let vocoderPipeline = null;
let isInitialized = false;

// Setup worker logging by overriding default console methods
setupWorkerLogging('audio', self);

// Use the Singleton pattern to enable lazy construction of the pipeline.
class AudioPipelineSingleton {
  static model = 'tts';
  static device = 'wasm';

  static async getInstance(progress_callback = null) {
    this.tokenizer = await AutoTokenizer.from_pretrained(this.model, {
      device: this.device,
      dtype: 'q8',
    });
    this.processor = await AutoProcessor.from_pretrained(this.model, {
      device: this.device,
      dtype: 'q8',
    });
    this.audioModel = await SpeechT5ForTextToSpeech.from_pretrained(this.model, {
      device: this.device,
      dtype: 'q8',
    });
    return this;
  }
}

class VocoderPipelineSingleton {
  static model = 'vocoder';
  static device = 'wasm';

  static async getInstance(progress_callback = null) {
    this.vocoder = await SpeechT5HifiGan.from_pretrained(this.model, {
      device: this.device,
      dtype: 'q8',
      quantized: true,
    });

    this.speaker_embeddings_data = new Float32Array(
      await (await fetch('https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin')).arrayBuffer()
    );
    this.speaker_embeddings = new Tensor(
      'float32',
      this.speaker_embeddings_data,
      [1, this.speaker_embeddings_data.length]
    );

    return this;
  }
}


let fps = 0;
let startTime = null;

// Initialize the model when the worker starts
async function initialize() {
  try {
    // TODO: There are two progresses
    vocoderPipeline = await VocoderPipelineSingleton.getInstance((progress) => {
      self.postMessage({
        status: 'loading',
        progress,
      });
    });

    audioPipeline = await AudioPipelineSingleton.getInstance((progress) => {
      self.postMessage({
        status: 'loading',
        progress,
      });
    });

    isInitialized = true;

    console.log('Audio worker is initialized!');

    self.postMessage({
      status: 'ready',
      device: AudioPipelineSingleton.device,
    });

    console.log('Audio worker ready sent!');
  } catch (error) {
    self.postMessage({
      status: 'error',
      error: error.message,
    });
    console.error('Audio worker initialization error:', error);
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
    try {
      console.log('Received text for audio synthesis:', event.data.text);
      const text = event.data.text.toLowerCase();

      // Process the text through tokenizer
      console.log('Tokenizing text');

      const { input_ids } = await audioPipeline.tokenizer(text);
      const { waveform } = await audioPipeline.audioModel.generate_speech(input_ids, await vocoderPipeline.speaker_embeddings, { vocoder: vocoderPipeline.vocoder });

      // Convert the Float32Array to a WAV file
      const wav = new WaveFile();
      wav.fromScratch(
        1,
        16000,
        "32f",
        waveform.data
      );
      const wavBuffer = wav.toBuffer();

      // Create a Blob from the WAV buffer
      const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const endTime = performance.now();
      const elapsedTime = endTime - startTime;
      fps = 1000 / elapsedTime;

      console.log(
        `Audio synthesis completed in ${elapsedTime.toFixed(2)}ms (${fps.toFixed(2)} FPS)`,
      );

      // Send the output back to the main thread
      self.postMessage({
        status: 'complete',
        audioUrl: audioUrl,
        fps: fps,
      });
    } catch (error) {
      console.error('Audio synthesis error:', error);
      self.postMessage({
        status: 'error',
        error: error.message,
      });
    }
  }
});
