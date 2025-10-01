# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import subprocess
import sys

# Install the Hugging Face Hub library
subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])

import os
import zipfile
import shutil

from huggingface_hub import snapshot_download

# Parameters
repo_id = "onnx-community/Janus-Pro-1B-ONNX"
output_dir = "/opt/ml/processing/output"
download_dir = "/opt/ml/processing/model"  # Temp directory to store the model
webgpu_dir = "/opt/ml/processing/webgpu"  # Directory for WebGPU-optimized files

# Step 1: Download the model
os.makedirs(download_dir, exist_ok=True)
snapshot_download(repo_id, local_dir=download_dir)

print(f"Model downloaded to {download_dir}")

# Step 2: Create WebGPU-optimized directory structure
os.makedirs(webgpu_dir, exist_ok=True)
os.makedirs(os.path.join(webgpu_dir, "onnx"), exist_ok=True)

# Step 3: Copy configuration files (all JSON files from root)
config_files = [
    "config.json",
    "generation_config.json", 
    "preprocessor_config.json",
    "processor_config.json",
    "special_tokens_map.json",
    "tokenizer_config.json",
    "tokenizer.json"
]

for config_file in config_files:
    src_path = os.path.join(download_dir, config_file)
    if os.path.exists(src_path):
        shutil.copy2(src_path, os.path.join(webgpu_dir, config_file))
        print(f"Copied {config_file}")

# Step 4: Copy specific ONNX files based on WebGPU configuration
# Based on the dtype configuration from test_janus_local.js:
# prepare_inputs_embeds: "q4" -> prepare_inputs_embeds_q4.onnx
# language_model: "q4f16" -> language_model_q4f16.onnx  
# lm_head: "fp16" -> lm_head_fp16.onnx
# gen_head: "fp16" -> gen_head_fp16.onnx
# gen_img_embeds: "fp16" -> gen_img_embeds_fp16.onnx
# image_decode: "fp32" -> image_decode.onnx (no suffix for fp32)

onnx_files_mapping = {
    "prepare_inputs_embeds_q4.onnx": "prepare_inputs_embeds_q4.onnx",
    "language_model_q4f16.onnx": "language_model_q4f16.onnx",
    "lm_head_fp16.onnx": "lm_head_fp16.onnx", 
    "gen_head_fp16.onnx": "gen_head_fp16.onnx",
    "gen_img_embeds_fp16.onnx": "gen_img_embeds_fp16.onnx",
    "image_decode.onnx": "image_decode.onnx",
    "embed_tokens_fp16.onnx": "embed_tokens_fp16.onnx"
}

onnx_source_dir = os.path.join(download_dir, "onnx")
onnx_dest_dir = os.path.join(webgpu_dir, "onnx")

if os.path.exists(onnx_source_dir):
    for source_file, dest_file in onnx_files_mapping.items():
        src_path = os.path.join(onnx_source_dir, source_file)
        if os.path.exists(src_path):
            dest_path = os.path.join(onnx_dest_dir, dest_file)
            shutil.copy2(src_path, dest_path)
            print(f"Copied {source_file} -> {dest_file}")
        else:
            raise ValueError(f"Warning: {source_file} not found in source directory")

print("WebGPU-optimized model structure created")

# Step 5: Zip the WebGPU-optimized model
zip_file_path = os.path.join(output_dir, "model.zip")
os.makedirs(output_dir, exist_ok=True)

with zipfile.ZipFile(zip_file_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(webgpu_dir):
        for file in files:
            file_path = os.path.join(root, file)
            zipf.write(file_path, os.path.relpath(file_path, webgpu_dir))

print(f"WebGPU-optimized model zipped to {zip_file_path}")