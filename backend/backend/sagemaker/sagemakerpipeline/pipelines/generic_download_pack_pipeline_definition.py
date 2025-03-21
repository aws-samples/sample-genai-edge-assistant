# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import shared_variables as shared_variables
from sagemaker import image_uris
from sagemaker.processing import ProcessingJob, ProcessingOutput
from sagemaker.sklearn.estimator import SKLearn
from sagemaker.sklearn.processing import SKLearnProcessor
from sagemaker.workflow.execution_variables import ExecutionVariables
from sagemaker.workflow.functions import Join
from sagemaker.workflow.parameters import ParameterString
from sagemaker.workflow.pipeline import Pipeline
from sagemaker.workflow.step_collections import RegisterModel
from sagemaker.workflow.steps import ProcessingStep


class GenericDownloadAndPackPipeline:

    def __init__(
        self,
        pipeline_name,
        input_bucket_name,  # use it for passing training data, etc.
        output_bucket_name,
        prefix_bucket_path,
        package_group_name_p,
        pipeline_session,
        execution_role,
        region,
        script_path,
        script_name,
        sagemaker_session,
    ):

        export_model_output_s3_uri = ParameterString(
            name="ModelOutputS3Uri",
            default_value=f"s3://{output_bucket_name}/{prefix_bucket_path}/output",
        )
        package_group_name = ParameterString(
            name="PackageGroupName", default_value=package_group_name_p
        )

        instance_type = ParameterString(
            name="TrainingInstanceType", default_value="ml.m5.large"
        )

        # Processor
        script_processor = SKLearnProcessor(
            framework_version="1.2-1",
            role=execution_role,
            instance_type=instance_type,
            instance_count=1,
            base_job_name="download-and-zip",
            sagemaker_session=pipeline_session,
        )

        final_model_output_s3_uri = Join(
            on="/",
            values=[
                export_model_output_s3_uri,
                ExecutionVariables.PIPELINE_EXECUTION_ID,
                ExecutionVariables.START_DATETIME,
            ],
        )

        # Processing/training Step
        processing_step = ProcessingStep(
            name="DownloadAndPackModel",
            display_name="Download and pack the model",
            description="This is a sample step. If you want to use or create your own model, you can change this step into a real ML pipeline with data processing, training, etc.",
            processor=script_processor,
            outputs=[
                ProcessingOutput(
                    source="/opt/ml/processing/output",
                    destination=final_model_output_s3_uri,
                )
            ],
            code=script_path,
        )

        # Model Artifacts S3 URI
        model_artifact_s3_uri = Join(
            on="/", values=[final_model_output_s3_uri, "model.zip"]
        )

        ##### Dummy estimator ######
        # An estimator is needed to register the model. We did not use one as we did not train the model ourselves.
        # We use a dummy one for the registration.
        dummy_estimator = SKLearn(
            sagemaker_session=pipeline_session,
            entry_point=script_name,
            source_dir=script_path,
            image_uri=image_uris.retrieve(
                framework="sklearn",
                region=region,
                version="0.20.0",
                py_version="py3",
                instance_type=instance_type,
                image_scope="inference",
            ),
            role=execution_role,
            instance_type=instance_type,
            instance_count=1,
        )

        register_model_step = RegisterModel(
            estimator=dummy_estimator,
            name="RegisterModelStep",
            display_name="Register the model into the registry",
            model_data=model_artifact_s3_uri,
            content_types=["text/csv"],
            response_types=["text/csv"],
            inference_instances=[instance_type],
            transform_instances=[instance_type],
            model_package_group_name=package_group_name,
            approval_status="PendingManualApproval",
            depends_on=[processing_step],
        )

        # Define the pipeline
        self.pipeline = Pipeline(
            name=pipeline_name,
            parameters=[
                export_model_output_s3_uri,
                instance_type,
                package_group_name,
            ],
            steps=[processing_step, register_model_step],
            sagemaker_session=sagemaker_session,
        )

    def get_pipeline(self):
        return self.pipeline
