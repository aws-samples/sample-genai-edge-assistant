# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import boto3
import shared_variables as shared_variables
from pipelines.generic_download_pack_pipeline_definition import \
    GenericDownloadAndPackPipeline
from sagemaker import Session
from sagemaker.workflow.pipeline_context import PipelineSession

# ANSI escape code for green text
GREEN = "\033[92m"
# ANSI escape code to reset color
RESET = "\033[0m"


def get_output_value(json_output_cdk_data, requested_export_name):
    for item in json_output_cdk_data:
        if item.get("ExportName") == requested_export_name:
            return item.get("OutputValue")

    raise Exception(
        f"Export name {requested_export_name} not found in CDK stack outputs. Exiting."
    )


#################
##### INIT ######
#################

# Retrieve all the parameters from the CDK creation
stack_name = shared_variables.STACK_NAME

cfn = boto3.client("cloudformation", region_name=shared_variables.CDK_OUT_KEY_REGION)
response = cfn.describe_stacks(StackName=stack_name)
outputs = response["Stacks"][0]["Outputs"]

REGION = get_output_value(outputs, shared_variables.CDK_OUT_EXPORT_REGION)
S3_BUCKET_SAGEMAKER_INPUT_NAME = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_S3_BUCKET_SAGEMAKER_INPUT_NAME
)
S3_BUCKET_SAGEMAKER_OUTPUT_NAME = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_S3_BUCKET_SAGEMAKER_OUTPUT_NAME
)
SAGEMAKER_DEPTH_PACKAGE_GROUP_NAME = get_output_value(
    outputs,
    shared_variables.CDK_OUT_EXPORT_SAGEMAKER_DEPTH_MODEL_PACKAGE_GROUP_NAME,
)
SAGEMAKER_TTS_MODEL_PACKAGE_GROUP_NAME = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_SAGEMAKER_TTS_MODEL_PACKAGE_GROUP_NAME
)
SAGEMAKER_VOCODER_MODEL_PACKAGE_GROUP_NAME = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_SAGEMAKER_VOCODER_MODEL_PACKAGE_GROUP_NAME
)
SAGEMAKER_IMAGE_CAPTIONING_MODEL_PACKAGE_GROUP_NAME = get_output_value(
    outputs,
    shared_variables.CDK_OUT_EXPORT_SAGEMAKER_IMAGE_CAPTIONING_MODEL_PACKAGE_GROUP_NAME,
)
SAGEMAKER_OBJECT_DETECTION_MODEL_PACKAGE_GROUP_NAME = get_output_value(
    outputs,
    shared_variables.CDK_OUT_EXPORT_SAGEMAKER_OBJECT_DETECTION_MODEL_PACKAGE_GROUP_NAME,
)
USER_SAGEMAKER_TEAM = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_USER_SAGEMAKER_TEAM
)
SAGEMAKER_DOMAIN_ID = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_SAGEMAKER_DOMAIN_ID
)
SAGEMAKER_DOMAIN_ARN = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_SAGEMAKER_DOMAIN_ARN
)
EXECUTION_ROLE = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_SAGEMAKER_EXECUTION_ROLE_ARN
)

print("\n\n")
print("#########################")
print("Retrieved CDK variables ")
print("#########################")
print(S3_BUCKET_SAGEMAKER_INPUT_NAME)
print(S3_BUCKET_SAGEMAKER_OUTPUT_NAME)
print(USER_SAGEMAKER_TEAM)
print(SAGEMAKER_DOMAIN_ID)
print(SAGEMAKER_DEPTH_PACKAGE_GROUP_NAME)
print(SAGEMAKER_TTS_MODEL_PACKAGE_GROUP_NAME)
print(SAGEMAKER_IMAGE_CAPTIONING_MODEL_PACKAGE_GROUP_NAME)
print(SAGEMAKER_OBJECT_DETECTION_MODEL_PACKAGE_GROUP_NAME)
print(EXECUTION_ROLE)
print("********\n\n")


# Initialize AWS session and client
boto_session = boto3.Session(region_name=REGION)
sagemaker_client = boto_session.client("sagemaker", region_name=REGION)
sagemaker_session = Session(
    boto_session=boto_session, sagemaker_client=sagemaker_client
)

# Define SageMaker Pipeline session
pipeline_session = PipelineSession(boto_session=boto_session, sagemaker_client=sagemaker_client)


#################################
##### PIPELINE DEFINITIONS ######
#################################

domain_tag = {"Key": "sagemaker:domain-arn", "Value": SAGEMAKER_DOMAIN_ARN}

# Deploy the depth model pipeline
depth_pipeline = GenericDownloadAndPackPipeline(
    pipeline_name=shared_variables.BOTO3_DEPTH_PIPELINE_NAME,
    input_bucket_name=S3_BUCKET_SAGEMAKER_INPUT_NAME,
    output_bucket_name=S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
    prefix_bucket_path="depth",
    pipeline_session=pipeline_session,
    package_group_name_p=SAGEMAKER_DEPTH_PACKAGE_GROUP_NAME,
    execution_role=EXECUTION_ROLE,
    region=REGION,
    script_path="./backend/sagemaker/sagemakerpipeline/pipelines/depth/script/depth_script.py",
    script_name="depth_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = depth_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
depth_train_pipeline_arn = pipeline_response["PipelineArn"]

print(
    f"{GREEN}Depth pipeline created or updated with ARN: {depth_train_pipeline_arn}{RESET}"
)
print("\n\n")


# Deploy the image captioning model pipeline
image_captioning_pipeline = GenericDownloadAndPackPipeline(
    pipeline_name=shared_variables.BOTO3_IMAGE_CAPTIONING_PIPELINE_NAME,
    input_bucket_name=S3_BUCKET_SAGEMAKER_INPUT_NAME,
    output_bucket_name=S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
    prefix_bucket_path="image-captioning",
    pipeline_session=pipeline_session,
    package_group_name_p=SAGEMAKER_IMAGE_CAPTIONING_MODEL_PACKAGE_GROUP_NAME,
    execution_role=EXECUTION_ROLE,
    region=REGION,
    script_path="./backend/sagemaker/sagemakerpipeline/pipelines/image_captioning/script/ic_script.py",
    script_name="ic_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = image_captioning_pipeline.upsert(
    role_arn=EXECUTION_ROLE, tags=[domain_tag]
)
image_captioning_pipeline_arn = pipeline_response["PipelineArn"]

print(
    f"{GREEN}Image captioning pipeline created or updated with ARN: {image_captioning_pipeline_arn}{RESET}"
)
print("\n\n")


# Deploy the object detection model pipeline
object_detection_pipeline = GenericDownloadAndPackPipeline(
    pipeline_name=shared_variables.BOTO3_OBJECT_DETECTION_PIPELINE_NAME,
    input_bucket_name=S3_BUCKET_SAGEMAKER_INPUT_NAME,
    output_bucket_name=S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
    prefix_bucket_path="object-detection",
    pipeline_session=pipeline_session,
    package_group_name_p=SAGEMAKER_OBJECT_DETECTION_MODEL_PACKAGE_GROUP_NAME,
    execution_role=EXECUTION_ROLE,
    region=REGION,
    script_path="./backend/sagemaker/sagemakerpipeline/pipelines/object_detection/script/od_script.py",
    script_name="od_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = object_detection_pipeline.upsert(
    role_arn=EXECUTION_ROLE, tags=[domain_tag]
)
object_detection_pipeline_arn = pipeline_response["PipelineArn"]

print(
    f"{GREEN}Object detection pipeline created or updated with ARN: {object_detection_pipeline_arn}{RESET}"
)
print("\n\n")


# Deploy the TTS model pipeline
tts_pipeline = GenericDownloadAndPackPipeline(
    pipeline_name=shared_variables.BOTO3_TTS_PIPELINE_NAME,
    input_bucket_name=S3_BUCKET_SAGEMAKER_INPUT_NAME,
    output_bucket_name=S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
    prefix_bucket_path="tts",
    pipeline_session=pipeline_session,
    package_group_name_p=SAGEMAKER_TTS_MODEL_PACKAGE_GROUP_NAME,
    execution_role=EXECUTION_ROLE,
    region=REGION,
    script_path="./backend/sagemaker/sagemakerpipeline/pipelines/tts/script/tts_script.py",
    script_name="tts_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = tts_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
tts_pipeline_arn = pipeline_response["PipelineArn"]

print(f"{GREEN}TTS pipeline created or updated with ARN: {tts_pipeline_arn}{RESET}")
print("\n\n")


# Deploy the vocoder model pipeline
vocoder_pipeline = GenericDownloadAndPackPipeline(
    pipeline_name=shared_variables.BOTO3_VOCODER_PIPELINE_NAME,
    input_bucket_name=S3_BUCKET_SAGEMAKER_INPUT_NAME,
    output_bucket_name=S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
    prefix_bucket_path="vocoder",
    pipeline_session=pipeline_session,
    package_group_name_p=SAGEMAKER_VOCODER_MODEL_PACKAGE_GROUP_NAME,
    execution_role=EXECUTION_ROLE,
    region=REGION,
    script_path="./backend/sagemaker/sagemakerpipeline/pipelines/vocoder/script/vocoder_script.py",
    script_name="vocoder_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = vocoder_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
vocoder_pipeline_arn = pipeline_response["PipelineArn"]

print(
    f"{GREEN}Vocoder pipeline created or updated with ARN: {vocoder_pipeline_arn}{RESET}"
)
print("\n\n")
