# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os
import time

import boto3
from botocore.exceptions import ClientError

# Important: we have 4 directories to be looked into: depth, tts, image-captioning, object-detection
DIR_NAMES = ["depth", "tts", "vocoder", "image-captioning", "object-detection"]

model_artifacts_bucket = os.environ["MODELS_ARTIFACTS_BUCKET"]

s3_client = boto3.client("s3", config=boto3.session.Config(signature_version="s3v4"))


def get_latest_model(prefix: str) -> tuple[str, str]:
    get_last_modified = lambda obj: int(obj["LastModified"].strftime("%s"))

    list_models = s3_client.list_objects_v2(
        Bucket=model_artifacts_bucket, Prefix=f"{prefix}/"
    )

    print("type of list_models: ", type(list_models))
    print("keys of list_models: ", list_models.keys())
    print("list_models 1: ", list_models)

    if not list_models.get("Contents"):
        return None, None

    # Only zip files
    zip_models = [obj for obj in list_models["Contents"] if obj["Key"].endswith(".zip")]

    if not zip_models:
        return None, None

    last_added_model = sorted(zip_models, key=get_last_modified)[-1]

    print(f"List models {zip_models}")
    print(f"Last added model {last_added_model}")

    return (
        last_added_model["Key"],
        last_added_model["ETag"][1:-1],  # Strip excessive quote
    )


def create_presigned_get(bucket_name, object_name):
    params = {"Bucket": bucket_name, "Key": object_name}

    try:
        response = s3_client.generate_presigned_url(
            ClientMethod="get_object", HttpMethod="GET", Params=params, ExpiresIn=120
        )
    except ClientError as e:
        print(e)
        return None

    return response


def handler(event, context):
    print(event)
    print(context)

    # Important: we have 4 directories to be looked into: depth, tts, image-captioning, object-detection
    # Iterate over all the directories and grab the latest model in each one
    response = {}
    for directory_name in DIR_NAMES:
        latest_file_key, etag = get_latest_model(directory_name)
        print(latest_file_key)
        if latest_file_key:
            result = create_presigned_get(model_artifacts_bucket, latest_file_key)
            model_name = latest_file_key.split("/")[1]
            model_type = directory_name

            dictionary = {
                "download_url": result,
                "model_name": model_name,
                "ETag": etag,
            }

            response[directory_name] = dictionary

    print(json.dumps(response, indent=4))

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json; charset=UTF-8"},
        "body": json.dumps(response),
    }


if __name__ == "__main__":
    handler(None, None)
