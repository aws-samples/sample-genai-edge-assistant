# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import subprocess
import sys

# Install the Hugging Face Hub library
subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])

import os
import zipfile

from huggingface_hub import snapshot_download

# Parameters
repo_id = "onnx-community/depth-anything-v2-small"
output_dir = "/opt/ml/processing/output"
download_dir = "/opt/ml/processing/model"  # Temp directory to store the model

# Step 1: Download the model
os.makedirs(download_dir, exist_ok=True)
snapshot_download(repo_id, local_dir=download_dir)

print(f"Model downloaded to {download_dir}")

# Step 2: Remove unwanted files from /onnx directory
onnx_dir = os.path.join(download_dir, "onnx")
if os.path.exists(onnx_dir):
    for file in os.listdir(onnx_dir):
        if file not in [
            "model_quantized.onnx",
        ]:
            file_path = os.path.join(onnx_dir, file)
            if os.path.isfile(file_path):
                os.remove(file_path)
    print("Removed unwanted files from /onnx directory")

# Step 3: Zip the model
zip_file_path = os.path.join(output_dir, "model.zip")
os.makedirs(output_dir, exist_ok=True)

with zipfile.ZipFile(zip_file_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(download_dir):
        for file in files:
            file_path = os.path.join(root, file)
            zipf.write(file_path, os.path.relpath(file_path, download_dir))

print(f"Model zipped to {zip_file_path}")
