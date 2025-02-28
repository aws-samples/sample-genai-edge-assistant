// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  AutoTokenizer,
  BertForMaskedLM,
  Tensor,
  env,
  stack,
} from '@huggingface/transformers';
import { setupWorkerLogging } from '@/app/utils/workerLogging.js';
import cmudict from '@stdlib/datasets-cmudict';
import MeloTTSModel from '@/app/utils/audio-worker/custom-transformers';
import symbols from '@/app/utils/audio-worker/utils';
import { WaveFile } from 'wavefile';

// Skip local model check
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.backends.onnx.wasm.proxy = true;
env.localModelPath = '/models/';

let bertPipeline = null;
let audioPipeline = null;
let isInitialized = false;

// Setup worker logging by overriding default console methods
setupWorkerLogging('audio', self);

// Use the Singleton pattern to enable lazy construction of the pipeline.
class AudioPipelineSingleton {
  static model = 'tts';
  static device = 'wasm';

  static async getInstance(progress_callback = null) {
    this.audioModel = await MeloTTSModel.from_pretrained(this.model, {
      device: this.device,
      dtype: 'fp32',
    });
    return this;
  }
}

class BertPipelineSingleton {
  static model = 'vocoder';
  static device = 'wasm';

  static async getInstance(progress_callback = null) {
    this.bertModel = await BertForMaskedLM.from_pretrained(this.model, {
      device: this.device,
      dtype: 'fp32',
    });
    this.tokenizer = await AutoTokenizer.from_pretrained(this.model, {
      device: this.device,
      dtype: 'fp32',
    });
    this.cmudict = cmudict();
    this.symbol_to_id = symbols.reduce((obj, symbol, index) => {
      obj[symbol] = index;
      return obj;
    }, {});
    return this;
  }
}

function refinePh(phn) {
  let tone = 0;
  const regex = /\d$/; // Regular expression to match a digit at the end of the string
  if (regex.test(phn)) {
    tone = parseInt(phn.slice(-1)) + 1;
    phn = phn.slice(0, -1);
  }
  return [phn.toLowerCase(), tone];
}

// refine_syllables function
function refineSyllables(syllables) {
  const tones = [];
  const phonemes = [];
  for (const phnList of syllables) {
    for (const phn of phnList) {
      const [refinedPhn, tone] = refinePh(phn);
      phonemes.push(refinedPhn);
      tones.push(tone);
    }
  }
  return [phonemes, tones];
}

function distributePhone(nPhone, nWord) {
  const phonesPerWord = new Array(nWord).fill(0);
  for (let task = 0; task < nPhone; task++) {
    const minIndex = phonesPerWord.indexOf(Math.min(...phonesPerWord));
    phonesPerWord[minIndex]++;
  }
  return phonesPerWord;
}

let fps = 0;
let startTime = null;

// Initialize the model when the worker starts
async function initialize() {
  try {
    // TODO: There are two progresses
    bertPipeline = await BertPipelineSingleton.getInstance((progress) => {
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
      const tokenized = await bertPipeline.tokenizer.tokenize(text);

      const phs = [];
      const ph_groups = [];
      for (const t of tokenized) {
        if (!t.startsWith('#')) {
          ph_groups.push([t]);
        } else {
          ph_groups[ph_groups.length - 1].push(t.replaceAll('#', ''));
        }
      }

      let phones = [];
      let tones = [];
      let word2ph = [];
      for (const group of ph_groups) {
        const w = group.join('');
        let phone_len = 0;
        const word_len = group.length;
        if (w.toUpperCase() in bertPipeline.cmudict.dict) {
          const [phns, tns] = refineSyllables([
            bertPipeline.cmudict.dict[w.toUpperCase()].split(' '),
          ]);
          phones = phones.concat(phns);
          tones = tones.concat(tns);
          phone_len += phns.length;
        } else {
          const phone_list = _g2p(w).filter((p) => p !== ' ');
          for (ph in phone_list) {
            if (ph in arpa) {
              ph, (tn = refinePh(ph));
              phones.append(ph);
              tones.append(tn);
            } else {
              phones.append(ph);
              tones.append(0);
            }
            phone_len += 1;
          }
        }
        const aaa = distributePhone(phone_len, word_len);
        word2ph = word2ph.concat(aaa);
      }

      let phone = ['_', ...phones, '_'];
      const tone = [0, ...tones, 0];
      word2ph = [1, ...word2ph, 1];
      phone = phone.map((symbol) => bertPipeline.symbol_to_id[symbol] || 0);
      const language = phone.map(() => 2); // Set the language ID (assuming 2 is the English language ID)

      // Intersperse phone, tone, and language with 0
      function intersperse(lst, item) {
        const result = new Array(lst.length * 2 + 1).fill(item);
        result.forEach((_, i) => {
          if (i % 2 !== 0) {
            result[i] = lst[(i - 1) / 2];
          }
        });
        return result;
      }

      phones = intersperse(phone, 0);
      tones = intersperse(tone, 0);
      let lang_ids = intersperse(language, 0);

      for (let i = 0; i < word2ph.length; i++) {
        word2ph[i] *= 2;
      }
      word2ph[0] += 1;

      const bert_input = await bertPipeline.tokenizer(text);
      let ja_bert = await bertPipeline.bertModel(bert_input);

      ja_bert = ja_bert.logits;

      const phone_level_feature = [];
      let i = 0;
      for (const sub_array of ja_bert.squeeze()) {
        for (let j = 0; j < word2ph[i]; j++) {
          phone_level_feature.push(sub_array);
        }
        i++;
      }

      ja_bert = stack(phone_level_feature, 1).unsqueeze(0);

      phones = phones.map((num) => BigInt(num));
      tones = tones.map((num) => BigInt(num));
      lang_ids = lang_ids.map((num) => BigInt(num));

      phones = new Tensor(new BigInt64Array(phones));
      tones = new Tensor(new BigInt64Array(tones));
      lang_ids = new Tensor(new BigInt64Array(lang_ids));

      phones = phones.unsqueeze(0);
      tones = tones.unsqueeze(0);
      lang_ids = lang_ids.unsqueeze(0);

      console.log('Running audio model inference');
      const melo_tts_output = await audioPipeline.audioModel({
        phones,
        tones,
        lang_ids,
        ja_bert,
      });

      console.log('Converting model output to WAV format');
      // Convert the Float32Array to a WAV file
      const wav = new WaveFile();
      wav.fromScratch(1, 44100, '32f', melo_tts_output.y.data);
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
