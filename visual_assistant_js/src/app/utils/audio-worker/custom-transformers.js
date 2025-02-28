// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Custom transformers.js model based on transformers.js's src/models.js

import { PreTrainedModel, ModelOutput } from '@huggingface/transformers';

//////////////////////////////////////////////////
// MeloTTS models
export class MeloTTSPreTrainedModel extends PreTrainedModel {}

/**
 * The complete MeloTTS model, for text-to-speech synthesis.
 *
 * **Example:** Generate speech from text with `MeloTTSModel`.
 * ```javascript
 *  TODO
 * ```
 */
export default class MeloTTSModel extends MeloTTSPreTrainedModel {
  /**
   * Calls the model on new inputs.
   * @param {Object} model_inputs The inputs to the model.
   * @returns {Promise<MeloTTSModelOutput>} The outputs for the MeloTTS model.
   */
  async _call(model_inputs) {
    return new MeloTTSModelOutput(await super._call(model_inputs));
  }
}
//////////////////////////////////////////////////

/**
 * Describes the outputs for the MeloTTS model.
 */
export class MeloTTSModelOutput extends ModelOutput {
  /**
   * @param {Object} output The output of the model.
   * @param {Tensor} output.y The final audio waveform predicted by the model
   */
  constructor({ y }) {
    super();
    this.y = y;
  }
}
