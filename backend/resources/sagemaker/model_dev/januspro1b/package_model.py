#!/usr/bin/env python3
"""
Script to package the Janus model files into a ZIP for the web interface.
This creates a ZIP file that can be served by the model URL API.
"""

import os
import zipfile
from pathlib import Path

def package_janus_model():
    """Package the Janus model files into a ZIP file."""
    
    # Paths
    artifacts_dir = Path(__file__).parent / "ARTIFACTS_WEBGPU"  # Use WebGPU optimized artifacts
    output_dir = Path(__file__).parent / "ARTIFACTS_OUT"
    output_zip = output_dir / "janus-pro-1b-webgpu.zip"
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(exist_ok=True)
    
    if not artifacts_dir.exists():
        print(f"Error: ARTIFACTS_WEBGPU directory not found at {artifacts_dir}")
        return False
    
    print(f"Packaging WebGPU-optimized model from: {artifacts_dir}")
    print(f"Output ZIP: {output_zip}")
    
    # Create ZIP file
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add all files from ARTIFACTS_WEBGPU directory
        for root, dirs, files in os.walk(artifacts_dir):
            for file in files:
                file_path = Path(root) / file
                # Calculate relative path from ARTIFACTS_WEBGPU directory
                relative_path = file_path.relative_to(artifacts_dir)
                
                print(f"Adding: {relative_path}")
                zipf.write(file_path, str(relative_path))
    
    print(f"WebGPU-optimized model packaged successfully: {output_zip}")
    print(f"ZIP file size: {output_zip.stat().st_size / (1024*1024):.1f} MB")
    
    return True

if __name__ == "__main__":
    success = package_janus_model()
    if not success:
        exit(1)