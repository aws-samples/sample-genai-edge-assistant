import pathlib
import sys

# Import production code
PRODUCTION_PATH = pathlib.Path(__file__).parent.parent.parent / "sagemakerpipeline" / "pipelines" / "gemma3n" / "script" / "src"
sys.path.insert(0, str(PRODUCTION_PATH))

from validate_model import run_full_pipeline_test

if __name__ == "__main__":
    HERE = pathlib.Path(__file__).parent.absolute()
    ARTIFACTS_DIR = HERE / "ARTIFACTS" / "model"

    if not ARTIFACTS_DIR.exists():
        print("❌ ARTIFACTS directory not found. Run 'python prepare_model_files.py' first.")
        exit(1)

    # Run the full pipeline test without payload creation (local testing)
    run_full_pipeline_test(str(ARTIFACTS_DIR), create_payload=False)
    
    print("Next: Run 'python test_model_endpoint_deploy.py' to deploy to SageMaker")