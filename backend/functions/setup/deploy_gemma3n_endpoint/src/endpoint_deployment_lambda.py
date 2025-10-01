import json
import time
import boto3
from botocore.exceptions import ClientError


def handler(event, context):
    """Deploy or update SageMaker endpoint."""
    model_package_arn = event.get("model_package_arn")
    endpoint_name = event.get("endpoint_name")
    instance_type = event.get("instance_type", "ml.g5.xlarge")
    initial_instance_count = event.get("initial_instance_count", 1)
    
    if not model_package_arn or not endpoint_name:
        raise ValueError("Missing required parameters")
    
    sagemaker = boto3.client("sagemaker")
    
    # Get model name from package
    response = sagemaker.describe_model_package(ModelPackageName=model_package_arn)
    model_name = response["CustomerMetadataProperties"]["model_name"]
    
    # Create endpoint config
    timestamp = str(int(time.time()))
    config_name = f"{endpoint_name}-config-{timestamp}"
    
    sagemaker.create_endpoint_config(
        EndpointConfigName=config_name,
        ProductionVariants=[{
            "VariantName": "AllTraffic",
            "ModelName": model_name,
            "InitialInstanceCount": initial_instance_count,
            "InstanceType": instance_type,
            "InitialVariantWeight": 1.0,
        }],
    )
    
    # Create or update endpoint
    try:
        sagemaker.create_endpoint(
            EndpointName=endpoint_name,
            EndpointConfigName=config_name,
        )
        print(f"Created endpoint {endpoint_name}")
    except ClientError as e:
        if (e.response["Error"]["Code"] == "ValidationException" and 
            "Cannot create already existing endpoint" in e.response["Error"]["Message"]):
            sagemaker.update_endpoint(
                EndpointName=endpoint_name,
                EndpointConfigName=config_name,
            )
            print(f"Updated endpoint {endpoint_name}")
        else:
            raise
    
    # Wait for endpoint to be ready
    wait_for_endpoint(sagemaker, endpoint_name, context)


def wait_for_endpoint(sagemaker, endpoint_name, context):
    """Wait for endpoint to be InService or handle other states."""
    # Leave 30 seconds buffer before lambda timeout
    timeout_buffer = 30000  # 30 seconds in milliseconds
    
    while True:
        # Check remaining time
        remaining_time = context.get_remaining_time_in_millis()
        if remaining_time <= timeout_buffer:
            print(f"Lambda timeout approaching, endpoint {endpoint_name} may still be deploying")
            return
        
        # Check endpoint status
        response = sagemaker.describe_endpoint(EndpointName=endpoint_name)
        status = response["EndpointStatus"]
        
        if status == "InService":
            print(f"Endpoint {endpoint_name} is InService")
            return
        elif status == "Failed":
            failure_reason = response.get("FailureReason", "Unknown failure")
            raise RuntimeError(f"Endpoint {endpoint_name} failed: {failure_reason}")
        else:
            print(f"Endpoint {endpoint_name} status: {status}, waiting...")
            time.sleep(30)