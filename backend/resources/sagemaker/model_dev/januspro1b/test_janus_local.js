import { AutoProcessor, MultiModalityCausalLM } from "@huggingface/transformers";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// First download artifacts to ARTIFACTS dir in janus-pro-1b dir: hf download onnx-community/Janus-Pro-1B-ONNX --local-dir ARTIFACTS
// Then move the necessary files for the desired quantization (look at the sample-genai-edge-assistant/backend/resources/sagemaker/sagemakerpipeline/pipelines/chat/script/chat_script.py): 
// e.g. cp ARTIFACTS/onnx/prepare_inputs_embeds_q4.onnx ARTIFACTS_UINT8/onnx/

async function testJanusLocal() {
    try {
        console.log("Loading Janus-Pro-1B model with WebGPU configuration...");

        // Path to the WebGPU-optimized model directory
        const modelPath = join(__dirname, "ARTIFACTS_WEBGPU");

        console.log("Model path:", modelPath);

        // Load processor and model from local path
        const processor = await AutoProcessor.from_pretrained(modelPath, {
            local_files_only: true
        });

        // Test WebGPU configuration
        const fp16_supported = true; // Feature check for fp16 support

        const model = await MultiModalityCausalLM.from_pretrained(modelPath, {
            local_files_only: true,
            // Use the exact configuration from GitHub issue (fp16_supported=false)
            dtype: {
                prepare_inputs_embeds: "q4",
                language_model: "q4f16",
                lm_head: "fp16",
                gen_head: "fp16",
                gen_img_embeds: "fp16",
                image_decode: "fp32",
            },
            // Use CPU for Node.js testing (browser will use WebGPU/WASM mix)
            device: "cpu"
        });

        console.log("Model loaded successfully with WebGPU configuration!");

        // Test with local sidewalk image
        const imagePath = join(__dirname, "../data/samples/sidewalk.jpg");
        console.log("Using image:", imagePath);

        const conversation = [
            {
                role: "<|User|>",
                content: "<image_placeholder>\nDescribe what you see in this image. What potential hazards or navigation challenges might exist?",
                images: [imagePath],
            },
        ];

        console.log("Processing inputs...");
        const inputs = await processor(conversation);

        console.log("Generating response...");
        const outputs = await model.generate({
            ...inputs,
            max_new_tokens: 1000,
            do_sample: false,
        });

        // Decode output
        const new_tokens = outputs.slice(null, [inputs.input_ids.dims.at(-1), null]);
        const decoded = processor.batch_decode(new_tokens, { skip_special_tokens: true });

        console.log("Generated response:", decoded[0]);
        // Generated response: In the image, there is a sidewalk on the right side, which appears to be obstructed by a tree. The tree is partially blocking the sidewalk, creating a potential hazard for pedestrians, especially those with disabilities, strollers, or those using wheelchairs. Additionally, there is a black metal railing that is positioned to the right of the tree, which could be a hazard if it is not properly positioned or if it is not used correctly. The parked cars on the right also pose a navigation challenge, as they could obstruct the sidewalk and make it difficult for pedestrians to walk freely. The overall layout of the sidewalk and the parked cars could make it challenging for individuals with visual impairments to navigate the area safely.

    } catch (error) {
        console.error("Error testing Janus model:", error);
    }
}

// Run the test
testJanusLocal();