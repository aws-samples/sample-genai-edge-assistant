# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import os

import boto3
from sagemaker import Session
from sagemaker.workflow.pipeline_context import PipelineSession

import shared_variables as shared_variables
from pipelines.generic_download_pack_pipeline_definition import \
    GenericDownloadAndPackPipeline
from pipelines.gemma3n_pipeline_definition import \
    Gemma3nModelTrainingPipeline, Gemma3nModelDeploymentPipeline

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
SAGEMAKER_GEMMA3N_MODEL_PACKAGE_GROUP_NAME = get_output_value(
    outputs,
    shared_variables.CDK_OUT_EXPORT_SAGEMAKER_GEMMA3N_MODEL_PACKAGE_GROUP_NAME,
)
SAGEMAKER_CHAT_MODEL_PACKAGE_GROUP_NAME = get_output_value(
    outputs,
    shared_variables.CDK_OUT_EXPORT_SAGEMAKER_CHAT_MODEL_PACKAGE_GROUP_NAME,
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
LAMBDA_EXECUTION_ROLE = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_SAGEMAKER_PIPELINE_LAMBDA_ROLE_ARN
)
HF_TOKEN_SECRET_NAME = get_output_value(
    outputs, shared_variables.CDK_OUT_EXPORT_DEFAULT_HF_TOKEN_SECRET_NAME
)

# Add tags for all pipelines allowing only created Domain to visualize them
domain_tag = {"Key": "sagemaker:domain-arn", "Value": SAGEMAKER_DOMAIN_ARN}

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
print(SAGEMAKER_GEMMA3N_MODEL_PACKAGE_GROUP_NAME)
print(SAGEMAKER_CHAT_MODEL_PACKAGE_GROUP_NAME)
print(EXECUTION_ROLE)
print(LAMBDA_EXECUTION_ROLE)
print(HF_TOKEN_SECRET_NAME)
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
    script_path=f"{shared_variables.BACKEND_DIR}/resources/sagemaker/sagemakerpipeline/pipelines/depth/script/depth_script.py",
    script_name="depth_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = depth_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
depth_train_pipeline_arn = pipeline_response["PipelineArn"]
print(
    f"{GREEN}Depth pipeline created or updated with ARN: {depth_train_pipeline_arn}{RESET}"
)

if os.getenv("TRIGGER_PIPELINES", "false").lower() == "true":
    if os.getenv("AUTO_APPROVE_MODELS", "false").lower() == "true":
        pipeline_execution = depth_pipeline.start({"DefaultApprovalStatus": "Approved"})
    else:
        pipeline_execution = depth_pipeline.start()
    print(
        f"{GREEN}Depth pipeline triggered (execution: {pipeline_execution.arn} (AUTO_APPROVE_MODELS={os.getenv('AUTO_APPROVE_MODELS', 'false').lower()}){RESET}"
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
    script_path=f"{shared_variables.BACKEND_DIR}/resources/sagemaker/sagemakerpipeline/pipelines/image_captioning/script/ic_script.py",
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

if os.getenv("TRIGGER_PIPELINES", "false").lower() == "true":
    if os.getenv("AUTO_APPROVE_MODELS", "false").lower() == "true":
        pipeline_execution = image_captioning_pipeline.start({"DefaultApprovalStatus": "Approved"})
    else:
        pipeline_execution = image_captioning_pipeline.start()
    print(
        f"{GREEN}Image captioning pipeline triggered (execution: {pipeline_execution.arn} (AUTO_APPROVE_MODELS={os.getenv('AUTO_APPROVE_MODELS', 'false').lower()}){RESET}"
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
    script_path=f"{shared_variables.BACKEND_DIR}/resources/sagemaker/sagemakerpipeline/pipelines/object_detection/script/od_script.py",
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

if os.getenv("TRIGGER_PIPELINES", "false").lower() == "true":
    if os.getenv("AUTO_APPROVE_MODELS", "false").lower() == "true":
        pipeline_execution = object_detection_pipeline.start({"DefaultApprovalStatus": "Approved"})
    else:
        pipeline_execution = object_detection_pipeline.start()
    print(
        f"{GREEN}Object detection pipeline triggered (execution: {pipeline_execution.arn} (AUTO_APPROVE_MODELS={os.getenv('AUTO_APPROVE_MODELS', 'false').lower()}){RESET}"
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
    script_path=f"{shared_variables.BACKEND_DIR}/resources/sagemaker/sagemakerpipeline/pipelines/tts/script/tts_script.py",
    script_name="tts_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = tts_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
tts_pipeline_arn = pipeline_response["PipelineArn"]

print(f"{GREEN}TTS pipeline created or updated with ARN: {tts_pipeline_arn}{RESET}")

if os.getenv("TRIGGER_PIPELINES", "false").lower() == "true":
    if os.getenv("AUTO_APPROVE_MODELS", "false").lower() == "true":
        pipeline_execution = tts_pipeline.start({"DefaultApprovalStatus": "Approved"})
    else:
        pipeline_execution = tts_pipeline.start()
    print(
        f"{GREEN}TTS pipeline triggered (execution: {pipeline_execution.arn} (AUTO_APPROVE_MODELS={os.getenv('AUTO_APPROVE_MODELS', 'false').lower()}){RESET}"
    )
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
    script_path=f"{shared_variables.BACKEND_DIR}/resources/sagemaker/sagemakerpipeline/pipelines/vocoder/script/vocoder_script.py",
    script_name="vocoder_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = vocoder_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
vocoder_pipeline_arn = pipeline_response["PipelineArn"]

print(
    f"{GREEN}Vocoder pipeline created or updated with ARN: {vocoder_pipeline_arn}{RESET}"
)


if os.getenv("TRIGGER_PIPELINES", "false").lower() == "true":
    if os.getenv("AUTO_APPROVE_MODELS", "false").lower() == "true":
        pipeline_execution = vocoder_pipeline.start({"DefaultApprovalStatus": "Approved"})
    else:
        pipeline_execution = vocoder_pipeline.start()
    print(
        f"{GREEN}Vocoder pipeline triggered (execution: {pipeline_execution.arn} (AUTO_APPROVE_MODELS={os.getenv('AUTO_APPROVE_MODELS', 'false').lower()}){RESET}"
    )
print("\n\n")

# Deploy the chat model pipeline
chat_pipeline = GenericDownloadAndPackPipeline(
    pipeline_name=shared_variables.BOTO3_CHAT_PIPELINE_NAME,
    input_bucket_name=S3_BUCKET_SAGEMAKER_INPUT_NAME,
    output_bucket_name=S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
    prefix_bucket_path="chat",
    pipeline_session=pipeline_session,
    package_group_name_p=SAGEMAKER_CHAT_MODEL_PACKAGE_GROUP_NAME,
    execution_role=EXECUTION_ROLE,
    region=REGION,
    script_path=f"{shared_variables.BACKEND_DIR}/resources/sagemaker/sagemakerpipeline/pipelines/chat/script/chat_script.py",
    script_name="chat_script.py",
    sagemaker_session=sagemaker_session,
).get_pipeline()

pipeline_response = chat_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
chat_pipeline_arn = pipeline_response["PipelineArn"]
print(
    f"{GREEN}Chat pipeline created or updated with ARN: {chat_pipeline_arn}{RESET}"
)

if os.getenv("TRIGGER_PIPELINES", "false").lower() == "true":
    if os.getenv("AUTO_APPROVE_MODELS", "false").lower() == "true":
        pipeline_execution = chat_pipeline.start({"DefaultApprovalStatus": "Approved"})
    else:
        pipeline_execution = chat_pipeline.start()
    print(
        f"{GREEN}Chat pipeline triggered (execution: {pipeline_execution.arn} (AUTO_APPROVE_MODELS={os.getenv('AUTO_APPROVE_MODELS', 'false').lower()}){RESET}"
    )
print("\n\n")

# Deploy the Gemma3n model deployment pipeline FIRST
# This ensures the deployment pipeline exists when the preparation pipeline approves models
# This pipeline is triggered by EventBridge when Gemma3n models are approved, not manually
gemma3n_deployment_pipeline = Gemma3nModelDeploymentPipeline(
    pipeline_name=shared_variables.BOTO3_GEMMA3N_DEPLOYMENT_PIPELINE_NAME,
    output_bucket_name=S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
    prefix_bucket_path="gemma3n",
    pipeline_session=pipeline_session,
    execution_role=EXECUTION_ROLE,
    lambda_execution_role=LAMBDA_EXECUTION_ROLE,
    region=REGION,
    sagemaker_session=sagemaker_session,
    default_endpoint_name=shared_variables.GEMMA3N_ENDPOINT_NAME
).get_pipeline()

pipeline_response = gemma3n_deployment_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
gemma3n_deployment_pipeline_arn = pipeline_response["PipelineArn"]

print(
    f"{GREEN}Gemma3n deployment pipeline created or updated with ARN: {gemma3n_deployment_pipeline_arn}{RESET}"
)
# Note: Deployment pipeline is NOT triggered manually - it's triggered automatically by EventBridge when Gemma3n models are approved in the Model Registry
print(f"{GREEN}Gemma3n deployment pipeline will be triggered automatically by EventBridge when Gemma3n models are approved{RESET}")
print("\n\n")

# Deploy the Gemma3n model preparation pipeline
gemma3n_preparation_pipeline = Gemma3nModelTrainingPipeline(
    pipeline_name=shared_variables.BOTO3_GEMMA3N_PREPARATION_PIPELINE_NAME,
    input_bucket_name=S3_BUCKET_SAGEMAKER_INPUT_NAME,
    output_bucket_name=S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
    prefix_bucket_path="gemma3n",
    pipeline_session=pipeline_session,
    package_group_name_p=SAGEMAKER_GEMMA3N_MODEL_PACKAGE_GROUP_NAME,
    execution_role=EXECUTION_ROLE,
    lambda_execution_role=LAMBDA_EXECUTION_ROLE,
    region=REGION,
    script_path=f"{shared_variables.BACKEND_DIR}/resources/sagemaker/sagemakerpipeline/pipelines/gemma3n/script/src",
    sagemaker_session=sagemaker_session,
    default_hf_token_secret_name=HF_TOKEN_SECRET_NAME
).get_pipeline()

pipeline_response = gemma3n_preparation_pipeline.upsert(role_arn=EXECUTION_ROLE, tags=[domain_tag])
gemma3n_preparation_pipeline_arn = pipeline_response["PipelineArn"]

print(
    f"{GREEN}Gemma3n preparation pipeline created or updated with ARN: {gemma3n_preparation_pipeline_arn}{RESET}"
)

if os.getenv("TRIGGER_PIPELINES", "false").lower() == "true":
    print(
        f"{GREEN}Gemma3n training pipeline must be triggered manually (to avoid higher costs and ensure correct secrets usage)!"
    )
print("\n\n")