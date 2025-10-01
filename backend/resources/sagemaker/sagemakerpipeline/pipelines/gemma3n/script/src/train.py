import os 
import pathlib
import shutil
import boto3
import logging
from pathlib import Path

from huggingface_hub import login

from inference import GemmaModelManager

# Configure logging for SageMaker training job
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_hf_token_from_secrets(secret_name: str = "huggingface-token") -> str:
    """
    Retrieve Hugging Face token from AWS Secrets Manager.
    
    Args:
        secret_name: Name of the secret in AWS Secrets Manager
        
    Returns:
        str: The Hugging Face token
        
    Raises:
        RuntimeError: If token retrieval fails
    """
    try:
        logger.info(f"Retrieving Hugging Face token from Secrets Manager: {secret_name}")
        # Get region from environment variable (SageMaker sets AWS_DEFAULT_REGION)
        region = os.environ.get('AWS_DEFAULT_REGION', 'us-east-1')
        secrets_client = boto3.client('secretsmanager', region_name=region)
        
        response = secrets_client.get_secret_value(SecretId=secret_name)
        secret_string = response['SecretString']
        
        # Handle both JSON format and plain string format
        try:
            import json
            secret_data = json.loads(secret_string)
            token = secret_data.get('token', secret_string)
        except json.JSONDecodeError:
            # If it's not JSON, treat as plain string
            token = secret_string
        
        if not token or not token.strip():
            raise ValueError("Empty Hugging Face token")
            
        logger.info("Successfully retrieved Hugging Face token")
        return token
        
    except Exception as e:
        logger.error(f"Failed to retrieve Hugging Face token: {str(e)}")
        raise RuntimeError("Failed to retrieve Hugging Face token from Secrets Manager")

if __name__ == "__main__":
    try:
        logger.info("Starting navigation model preparation training job")
        
        # Get Hugging Face token from Secrets Manager
        secret_name = os.environ.get("HF_TOKEN_SECRET_NAME", "huggingface-token")
        hf_token = get_hf_token_from_secrets(secret_name)
        login(hf_token)

        # Use SageMaker training job environment variables
        # SageMaker automatically handles model archiving, so we just save to SM_MODEL_DIR
        model_dir = Path(os.environ.get("SM_MODEL_DIR", "/opt/ml/model"))
        src_dir = pathlib.Path(__file__).parent.absolute()
        
        model_id = "google/gemma-3n-e2b-it"

        logger.info(f"Downloading and saving model {model_id} to {model_dir}...")
        model_manager = GemmaModelManager(model_id)
        model_manager.processor.save_pretrained(model_dir)
        model_manager.model.save_pretrained(model_dir)
        
        # Copy inference code to model directory so it's included in the model package
        code_dir = model_dir / "code"
        shutil.copytree(src_dir, code_dir, dirs_exist_ok=True)
        logger.info(f"Copied inference code to {code_dir}")
        
        # Log model directory contents for debugging
        logger.info(f"Model directory contents: {list(code_dir.rglob('*'))}")
        
        logger.info("Navigation model preparation training job completed successfully")
        logger.info("SageMaker will automatically create model.tar.gz from SM_MODEL_DIR")
        
    except Exception as e:
        logger.error(f"Training job failed: {str(e)}")
        raise