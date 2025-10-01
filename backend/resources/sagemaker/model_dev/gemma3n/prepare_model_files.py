import os 
import pathlib
import sys
import tarfile
from dotenv import load_dotenv
from huggingface_hub import login

# Import production code
PRODUCTION_PATH = pathlib.Path(__file__).parent.parent.parent / "sagemakerpipeline" / "pipelines" / "gemma3n" / "script" / "src"
sys.path.insert(0, str(PRODUCTION_PATH))

from inference import GemmaModelManager

def create_model_archive(source_dir, output_file_path):
    """Create a tar.gz archive from the source directory."""
    source_dir = pathlib.Path(source_dir).absolute()
    output_file_path = pathlib.Path(output_file_path).absolute()
    output_file_path.parent.mkdir(parents=True, exist_ok=True)

    if not source_dir.is_dir():
        raise ValueError(f"Source directory {source_dir} does not exist")
    
    with tarfile.open(output_file_path, "w:gz") as tar:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = pathlib.Path(root) / file
                arc_name = file_path.relative_to(source_dir)
                tar.add(file_path, arcname=arc_name)
                print(f"Added {arc_name} to archive")

if __name__ == "__main__":
    load_dotenv()
    login(os.getenv("HF_TOKEN"))

    HERE = pathlib.Path(__file__).parent.absolute()
    dst_dir = HERE / "ARTIFACTS"
    dst_content_dir = HERE / "ARTIFACTS" / "model"
    dst_content_dir.mkdir(parents=True, exist_ok=True)

    model_id = "google/gemma-3n-e2b-it"
    
    print("Downloading Gemma3n foundation model...")
    model_manager = GemmaModelManager(model_id)
    model_manager.processor.save_pretrained(dst_content_dir)
    model_manager.model.save_pretrained(dst_content_dir)
    
    print(f"Creating model.tar.gz archive...")
    create_model_archive(dst_content_dir, dst_dir / "package" / "model.tar.gz")
    
    archive_size = pathlib.Path(dst_dir / "package" / "model.tar.gz").stat().st_size / (1024 * 1024)
    print(f"✓ Archive created: {archive_size:.2f} MB")
    print("Next: Run 'python test_model.py' to test locally")