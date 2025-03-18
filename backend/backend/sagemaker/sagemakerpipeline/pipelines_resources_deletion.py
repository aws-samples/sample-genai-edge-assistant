# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import shared_variables as shared_variables

# ANSI escape codes
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RESET = "\033[0m"  # Used to reset color back to default


def delete_sagemaker_pipeline(client, pipeline_name):
    try:
        client.delete_pipeline(PipelineName=pipeline_name)
        print(f"{GREEN}Deleted SageMaker pipeline: {pipeline_name}{RESET}")
    except client.exceptions.ResourceNotFound:
        print(f"{YELLOW}SageMaker pipeline not found: {pipeline_name}{RESET}")
    except Exception as e:
        print(f"{RED}An error occurred: {str(e)}{RESET}")


def delete_sagemaker_models_in_group(client, model_package_group_name):
    try:
        # List all model packages in the group using pagination
        paginator = client.get_paginator("list_model_packages")
        page_iterator = paginator.paginate(
            ModelPackageGroupName=model_package_group_name
        )

        for page in page_iterator:
            for model in page["ModelPackageSummaryList"]:
                try:
                    # Delete each model package
                    client.delete_model_package(
                        ModelPackageName=model["ModelPackageArn"]
                    )
                    print(
                        f"{GREEN}Deleted model package: {model['ModelPackageArn']}{RESET}"
                    )
                except client.exceptions.ResourceNotFound:
                    print(
                        f"{YELLOW}Model package not found: {model['ModelPackageArn']}{RESET}"
                    )
                except Exception as e:
                    print(
                        f"{RED}Error deleting model package {model['ModelPackageArn']}: {str(e)}{RESET}"
                    )

    except client.exceptions.ResourceNotFound:
        print(
            f"{YELLOW}Model package group not found: {model_package_group_name}{RESET}"
        )
    except Exception as e:
        print(f"{RED}An error occurred: {str(e)}{RESET}")


def main():
    # Initialize boto3 clients
    sagemaker_client = boto3.client("sagemaker")

    # List of resource names to delete
    sagemaker_pipelines_to_delete = [
        shared_variables.BOTO3_DEPTH_PIPELINE_NAME,
        shared_variables.BOTO3_IMAGE_CAPTIONING_PIPELINE_NAME,
        shared_variables.BOTO3_OBJECT_DETECTION_PIPELINE_NAME,
        shared_variables.BOTO3_TTS_PIPELINE_NAME,
        shared_variables.BOTO3_VOCODER_PIPELINE_NAME,
    ]

    sagemaker_models_to_delete_groups = [
        shared_variables.CDK_OUT_KEY_SAGEMAKER_DEPTH_MODEL_PACKAGE_GROUP_NAME,
        shared_variables.CDK_OUT_KEY_SAGEMAKER_IMAGE_CAPTIONING_MODEL_PACKAGE_GROUP_NAME,
        shared_variables.CDK_OUT_KEY_SAGEMAKER_OBJECT_DETECTION_MODEL_PACKAGE_GROUP_NAME,
        shared_variables.CDK_OUT_KEY_SAGEMAKER_TTS_MODEL_PACKAGE_GROUP_NAME,
        shared_variables.CDK_OUT_KEY_SAGEMAKER_VOCODER_MODEL_PACKAGE_GROUP_NAME,
    ]

    # Delete specific SageMaker pipelines
    for pipeline_name in sagemaker_pipelines_to_delete:
        delete_sagemaker_pipeline(sagemaker_client, pipeline_name)

    # Delete SageMaker models of these groups
    for model_package_group_name in sagemaker_models_to_delete_groups:
        delete_sagemaker_models_in_group(sagemaker_client, model_package_group_name)

    print("\n")
    print("Resource deletion completed.")


if __name__ == "__main__":
    main()
