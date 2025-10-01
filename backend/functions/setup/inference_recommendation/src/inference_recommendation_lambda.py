import json
import boto3
import logging
from datetime import datetime

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    """
    Lambda function to create SageMaker Inference Recommender jobs.
    
    This function is designed to be used as a Lambda step in SageMaker pipelines.
    It creates an inference recommendation job for a registered model package.
    
    Expected event structure:
    {
        "model_package_arn": "arn:aws:sagemaker:region:account:model-package/...",
        "job_name": "navigation-inference-recommendation-job",
        "results_s3_bucket": "bucket-name",
        "results_s3_prefix": "navigation/inference-recommendations",
        "execution_role_arn": "arn:aws:iam::account:role/SageMakerExecutionRole"
    }
    """
    logger.info(f"Received event: {json.dumps(event, default=str)}")
    
    # Extract parameters from event
    model_package_arn = event.get('model_package_arn')
    job_name = event.get('job_name', f"navigation-inference-rec-{int(datetime.now().timestamp())}")
    results_s3_bucket = event.get('results_s3_bucket')
    results_s3_prefix = event.get('results_s3_prefix', 'navigation/inference-recommendations')
    execution_role_arn = event.get('execution_role_arn')
    
    # Debug logging
    logger.info(f"Parameters extracted:")
    logger.info(f"  model_package_arn: {model_package_arn}")
    logger.info(f"  job_name: {job_name}")
    logger.info(f"  results_s3_bucket: {results_s3_bucket}")
    logger.info(f"  results_s3_prefix: {results_s3_prefix}")
    logger.info(f"  execution_role_arn: {execution_role_arn}")
    
    # Validate required parameters
    if not model_package_arn:
        raise ValueError("model_package_arn is required")
    if not results_s3_bucket:
        raise ValueError("results_s3_bucket is required")
    if not execution_role_arn:
        raise ValueError("execution_role_arn is required")
    
    # Create inference recommendation job
    sagemaker_client = boto3.client('sagemaker')
    
    job_config = {
        'JobName': job_name,
        'JobType': 'Default',  # Use Default job type for automatic recommendations
        'RoleArn': execution_role_arn,
        'InputConfig': {
            'ModelPackageVersionArn': model_package_arn,
        },
        'OutputConfig': {
            'CompiledOutputConfig': {
                'S3OutputUri': f"s3://{results_s3_bucket}/{results_s3_prefix}/{job_name}"
            }
        }
    }
    
    response = sagemaker_client.create_inference_recommendations_job(**job_config)
    
    logger.info(f"Successfully created inference recommendation job: {job_name} (ARN: {response['JobArn']})")
    
    return {
        'statusCode': 200,
        'body': {
            'job_name': job_name,
            'job_arn': response.get('JobArn'),
            'status': 'CREATED',
            'results_s3_uri': f"s3://{results_s3_bucket}/{results_s3_prefix}/{job_name}",
            'message': f'Inference recommendation job {job_name} created successfully'
        }
    }
