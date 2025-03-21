import json
import os

import boto3
from botocore.exceptions import ClientError

sagemaker_client = boto3.client("sagemaker")
s3_client = boto3.client("s3")
application_autoscaling_client = boto3.client("application-autoscaling")


def get_model_etag(bucket, key):
    try:
        response = s3_client.head_object(Bucket=bucket, Key=key)
        # Remove quotes from etag and remove any special characters
        return response["ETag"].strip('"').replace("-", "")
    except ClientError as e:
        print(f"Error getting model etag: {e}")
        raise


def handler(event, context):
    bucket = os.environ["BUCKET_NAME"]
    domain_arn = os.environ["DOMAIN_ARN"]
    endpoint_name = os.environ["ENDPOINT_NAME"]
    execution_role = os.environ["EXECUTION_ROLE_ARN"]
    image = os.environ["ECR_IMAGE"]
    instance_type = os.environ["INSTANCE_TYPE"]

    key = "paligemma/model.tar.gz"
    model_etag = get_model_etag(bucket, key)
    model_name = f"paligemma-model-{model_etag}"
    endpoint_config_name = f"paligemma-endpoint-config-{model_etag}"

    # Check if model exists
    model_exists = False
    try:
        sagemaker_client.describe_model(ModelName=model_name)
        model_exists = True
        print(f"Model {model_name} exists")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ValidationException":
            print(f"Error checking model existence: {e}")
            raise

    # Create model if it doesn't exist
    if not model_exists:
        sagemaker_client.create_model(
            ModelName=model_name,
            ExecutionRoleArn=execution_role,
            PrimaryContainer={
                "Image": image,
                "ModelDataUrl": f"s3://{bucket}/{key}",
                "Environment": {
                    "SAGEMAKER_PROGRAM": "inference.py",
                    "SAGEMAKER_SUBMIT_DIRECTORY": "/opt/ml/model/code",
                    "HF_TASK": "image-text-to-text",
                },
            },
            Tags=[{"Key": "domain-arn", "Value": domain_arn}],
        )
        print(f"Created new model: {model_name}")

    # Check if endpoint config exists
    endpoint_config_exists = False
    try:
        sagemaker_client.describe_endpoint_config(
            EndpointConfigName=endpoint_config_name
        )
        endpoint_config_exists = True
        print(f"Endpoint config {endpoint_config_name} exists")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ValidationException":
            print(f"Error checking endpoint config existence: {e}")
            raise

    # Create endpoint config if it doesn't exist
    if not endpoint_config_exists:
        sagemaker_client.create_endpoint_config(
            EndpointConfigName=endpoint_config_name,
            ProductionVariants=[
                {
                    "InstanceType": instance_type,
                    "InitialInstanceCount": 1,
                    "ModelName": model_name,
                    "VariantName": "AllTraffic",
                    "InitialVariantWeight": 1.0,
                }
            ],
            DataCaptureConfig={
                "EnableCapture": True,
                "InitialSamplingPercentage": 5,
                "DestinationS3Uri": f"s3://{bucket}/datacapture",
                "CaptureOptions": [{"CaptureMode": "Input"}],
                "CaptureContentTypeHeader": {"JsonContentTypes": ["application/json"]},
            },
            Tags=[{"Key": "domain-arn", "Value": domain_arn}],
        )
        print(f"Created new endpoint config: {endpoint_config_name}")

    # Check if endpoint exists and create/update as needed
    try:
        endpoint_info = sagemaker_client.describe_endpoint(EndpointName=endpoint_name)
        current_config = endpoint_info["EndpointConfigName"]

        # Update endpoint if it exists but has a different config
        if current_config != endpoint_config_name:
            sagemaker_client.update_endpoint(
                EndpointName=endpoint_name,
                EndpointConfigName=endpoint_config_name,
                DeploymentConfig={
                    "RollingUpdatePolicy": {
                        "MaximumBatchSize": {"Type": "CAPACITY_PERCENT", "Value": 50},
                        "WaitIntervalInSeconds": 660,
                        "MaximumExecutionTimeoutInSeconds": 1920,
                        "RollbackMaximumBatchSize": {
                            "Type": "CAPACITY_PERCENT",
                            "Value": 50,
                        },
                    }
                },
            )
            action = "Updated"
        else:
            action = "No update needed for"
    except ClientError as e:
        if e.response["Error"]["Code"] == "ValidationException":
            # Create endpoint if it doesn't exist
            sagemaker_client.create_endpoint(
                EndpointName=endpoint_name, EndpointConfigName=endpoint_config_name
            )
            action = "Created"
        else:
            print(f"Error checking endpoint existence: {e}")
            raise

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "message": f"Successfully {action} endpoint {endpoint_name}",
                "modelName": model_name,
                "endpointConfigName": endpoint_config_name,
            }
        ),
    }
