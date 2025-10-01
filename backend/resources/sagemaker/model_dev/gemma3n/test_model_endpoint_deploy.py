import os
import pathlib
import sys
import boto3
import sagemaker
from sagemaker.pytorch.model import PyTorchModel

def deploy_model(
    role: str,
    artifacts_file: str,
    code_dir: str,
    entry_point="inference.py",
    endpoint_name: str = "gemma3n-test-endpoint",
    pytorch_version: str = "2.6.0",
    py_version: str = "py312",
    local: bool = False
):
    """Deploy the Gemma3n model to SageMaker endpoint"""
    
    if local:
        print("Deploying locally...")
        model_data = f"file://{artifacts_file}"
        instance_type = "local_gpu"
        sagemaker_session = sagemaker.LocalSession()
        sagemaker_session.config = {'local': {'local_code': True}}
    else:
        print("Deploying to SageMaker...")
        instance_type = "ml.g6.xlarge"
        sagemaker_session = sagemaker.Session()
        print("Uploading model artifact...")
        model_data = sagemaker_session.upload_data(
            path=artifacts_file, 
            bucket=sagemaker_session.default_bucket(), 
            key_prefix=f"endpoints/{endpoint_name}"
        )
        print(f"Uploaded to: {model_data}")

    print("Creating PyTorch model...")
    model = PyTorchModel(
        source_dir=code_dir,
        entry_point=entry_point,
        model_data=model_data,
        role=role,
        framework_version=pytorch_version,
        py_version=py_version,
        sagemaker_session=sagemaker_session
    )

    print(f"Deploying endpoint '{endpoint_name}'...")
    predictor = model.deploy(
        endpoint_name=endpoint_name,
        initial_instance_count=1,
        instance_type=instance_type,
        wait=True
    )
    
    print(f"✓ Endpoint '{endpoint_name}' deployed successfully!")
    return predictor

if __name__ == "__main__":
    HERE = pathlib.Path(__file__).parent
    
    # Use production code directory
    PRODUCTION_CODE_DIR = HERE.parent.parent.parent / "sagemakerpipeline" / "pipelines" / "gemma3n" / "script" / "src"
    
    # Check if model artifacts exist
    artifacts_file = HERE / "ARTIFACTS" / "package" / "model.tar.gz"
    if not artifacts_file.exists():
        print("❌ Model artifacts not found. Run 'python prepare_model_files.py' first.")
        exit(1)

    # Get IAM role
    try:
        role = sagemaker.get_execution_role()
        print(f"Using SageMaker execution role: {role}")
    except Exception:
        print("❌ Could not get SageMaker execution role. Make sure you're running in SageMaker environment.")
        exit(1)

    try:
        deploy_model(
            artifacts_file=str(artifacts_file),
            code_dir=str(PRODUCTION_CODE_DIR),
            role=role,
            local=False  # Set to True for local deployment
        )
        print("Next: Run 'python test_model_endpoint_predict.py' to test the endpoint")
        
    except Exception as e:
        print(f"❌ Deployment failed: {str(e)}")