import json
import os

import boto3
from botocore.exceptions import ClientError

s3_client = boto3.client("s3")


def handler(event, context):
    # Extract parameters from the event object
    source_s3_url = (
        event.get("detail", {})
        .get("InferenceSpecification", {})
        .get("Containers", {})[0]
        .get("ModelDataUrl", {})
    )
    model_version = event.get("detail", {}).get("ModelPackageVersion", {})
    destination_bucket = os.getenv("DESTINATION_BUCKET_NAME")

    if not (source_s3_url and model_version and destination_bucket):
        return {
            "statusCode": 400,
            "body": json.dumps("Error: Missing required parameters"),
        }

    source_s3_url = source_s3_url[5:]  # remove the "s3://"
    source_bucket, source_key = source_s3_url.split("/", 1)
    model_type = source_key.split("/", 1)[0]
    destination_key = f"{model_type}/model-version-{model_version}.zip"

    try:
        # Copy object
        copy_source = {"Bucket": source_bucket, "Key": source_key}
        s3_client.copy_object(
            CopySource=copy_source, Bucket=destination_bucket, Key=destination_key
        )

        return {
            "statusCode": 200,
            "body": json.dumps(
                f"File copied from {source_bucket}/{source_key} to {destination_bucket}/{destination_key}"
            ),
        }

    except ClientError as e:
        return {
            "statusCode": 500,
            "body": json.dumps(f"Error: {e.response['Error']['Message']}"),
        }
