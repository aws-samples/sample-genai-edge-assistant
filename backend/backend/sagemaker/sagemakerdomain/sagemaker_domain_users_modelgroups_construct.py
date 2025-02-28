# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import typing

import aws_cdk as cdk
import shared_variables as shared_variables
from aws_cdk import Aws, CfnOutput, CfnTag, Duration, Stack
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_sagemaker as sagemaker
from aws_cdk import custom_resources as cr
from cdk_nag import NagSuppressions
from constructs import Construct


class SagemakerDomainUsersModelGroupsConstruct(Construct):

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        sagemaker_domain_name: str,
        vpc_id: str,
        subnet_ids: typing.List[str],
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id)

        self.region = Aws.REGION
        self.account = Aws.ACCOUNT_ID

        ## DOMAIN ##

        self.role_sagemaker_domain = iam.Role(
            self,
            "RoleForSagemakerStudioUsers",
            assumed_by=iam.ServicePrincipal("sagemaker.amazonaws.com"),
            role_name="VisAssisRoleSagemakerStudioUsers",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AmazonSageMakerFullAccess"  #! Demo usage, should/could be more restrictive
                )
            ],
        )

        NagSuppressions.add_resource_suppressions(
            self.role_sagemaker_domain,
            [
                {
                    "id": "AwsSolutions-IAM4",
                    "reason": "Suppressing as this is a demo, but we ackownledge that it should be more restrictive",
                    "appliesTo": [
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/AmazonSageMakerFullAccess"
                    ],
                }
            ],
        )

        self.sagemaker_domain = sagemaker.CfnDomain(
            self,
            "VisAssisSagemakerDomain",
            auth_mode="IAM",
            domain_name=sagemaker_domain_name,
            vpc_id=vpc_id,
            subnet_ids=subnet_ids,
            default_user_settings=sagemaker.CfnDomain.UserSettingsProperty(
                execution_role=self.role_sagemaker_domain.role_arn
            ),
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_SAGEMAKER_DOMAIN_ID,
            value=self.sagemaker_domain.attr_domain_id,
            description="The sagemaker domain ID",
            export_name=shared_variables.CDK_OUT_EXPORT_SAGEMAKER_DOMAIN_ID,
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_SAGEMAKER_DOMAIN_ARN,
            value=self.sagemaker_domain.attr_domain_arn,
            description="The sagemaker domain ARN",
            export_name=shared_variables.CDK_OUT_EXPORT_SAGEMAKER_DOMAIN_ARN,
        )

        # Suppressing AWS Solutions IAM4 finding for SageMaker execution role
        NagSuppressions.add_resource_suppressions(
            self.role_sagemaker_domain,
            [
                {
                    "id": "AwsSolutions-IAM4",
                    "reason": "SageMaker execution role requires full access to SageMaker services",
                    "appliesTo": [
                        "Policy::arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
                    ],
                }
            ],
        )

        ## DOMAIN DELETION RESOURCES ##
        # When domain is created, an EFS storage is automatically created and attached to it.
        # On stack deletion, the domain is deleted but not the EFS, leading to issues.
        # We create a custom resource delete to perform this action.

        self.delete_efs_lambda = lambda_.Function(
            self,
            "DeleteEFSLambda",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="lambda.handler",
            code=lambda_.Code.from_asset("functions/cleanup/delete_sm_efs/src"),
            timeout=Duration.minutes(15),
        )

        self.efs_arn = f"arn:aws:elasticfilesystem:{self.region}:{self.account}:file-system/{self.sagemaker_domain.attr_home_efs_file_system_id}"

        # Grant the Lambda function permissions to delete EFS
        self.delete_efs_lambda.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "elasticfilesystem:DescribeMountTargets",
                    "elasticfilesystem:DeleteMountTarget",
                    "elasticfilesystem:DeleteFileSystem",
                ],
                resources=[self.efs_arn],
            )
        )

        # Create a custom resource to delete the EFS
        self.delete_efs_custom_resource = cr.AwsCustomResource(
            self,
            "DeleteEFSCustomResource",
            function_name=self.delete_efs_lambda.function_name,
            timeout=Duration.minutes(15),
            on_delete=cr.AwsSdkCall(
                service="Lambda",
                action="invoke",
                parameters={
                    "FunctionName": self.delete_efs_lambda.function_name,
                    "Payload": json.dumps({"EfsId": self.efs_arn}),
                },
                physical_resource_id=cr.PhysicalResourceId.of(self.efs_arn),
            ),
            policy=cr.AwsCustomResourcePolicy.from_statements(
                [
                    iam.PolicyStatement(
                        actions=["lambda:InvokeFunction"],
                        resources=[self.delete_efs_lambda.function_arn],
                    )
                ]
            ),
        )

        self.delete_efs_custom_resource.node.add_dependency(self.sagemaker_domain)
        self.delete_efs_lambda.grant_invoke(
            self.delete_efs_custom_resource.grant_principal
        )

        ## STUDIO CONSOLE USERS ##

        self.sagemaker_studio_team = "vis-assis-datascientist-team"

        self.studio_user = sagemaker.CfnUserProfile(
            self,
            "VisAssisUserForSagemakerDomain",
            domain_id=self.sagemaker_domain.attr_domain_id,
            user_profile_name=self.sagemaker_studio_team,
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_USER_SAGEMAKER_TEAM,
            value=self.studio_user.attr_user_profile_arn,
            description="The User Arn team domain ID",
            export_name=shared_variables.CDK_OUT_EXPORT_USER_SAGEMAKER_TEAM,
        )

        ## MODEL PACKAGE GROUPS ##

        self.depth_model_package_group = sagemaker.CfnModelPackageGroup(
            self,
            "DepthTrainedModelPackageGroup",
            model_package_group_name=shared_variables.CDK_OUT_KEY_SAGEMAKER_DEPTH_MODEL_PACKAGE_GROUP_NAME,
            model_package_group_description="Package group for visual assistant TRAINED depth models.",
            tags=[
                CfnTag(
                    key="sagemaker:domain-arn",
                    value=self.sagemaker_domain.attr_domain_arn,
                )
            ],
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_SAGEMAKER_DEPTH_MODEL_PACKAGE_GROUP_NAME,
            value=self.depth_model_package_group.model_package_group_name,
            export_name=shared_variables.CDK_OUT_EXPORT_SAGEMAKER_DEPTH_MODEL_PACKAGE_GROUP_NAME,
        )

        # TTS
        self.tts_model_package_group = sagemaker.CfnModelPackageGroup(
            self,
            "TTSModelPackageGroup",
            model_package_group_name=shared_variables.CDK_OUT_KEY_SAGEMAKER_TTS_MODEL_PACKAGE_GROUP_NAME,
            model_package_group_description="Package group for visual assistant TTS models.",
            tags=[
                CfnTag(
                    key="sagemaker:domain-arn",
                    value=self.sagemaker_domain.attr_domain_arn,
                )
            ],
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_SAGEMAKER_TTS_MODEL_PACKAGE_GROUP_NAME,
            value=self.tts_model_package_group.model_package_group_name,
            export_name=shared_variables.CDK_OUT_EXPORT_SAGEMAKER_TTS_MODEL_PACKAGE_GROUP_NAME,
        )

        # Vocoder
        self.vocoder_model_package_group = sagemaker.CfnModelPackageGroup(
            self,
            "VocoderModelPackageGroup",
            model_package_group_name=shared_variables.CDK_OUT_KEY_SAGEMAKER_VOCODER_MODEL_PACKAGE_GROUP_NAME,
            model_package_group_description="Package group for visual assistant vocoder models.",
            tags=[
                CfnTag(
                    key="sagemaker:domain-arn",
                    value=self.sagemaker_domain.attr_domain_arn,
                )
            ],
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_SAGEMAKER_VOCODER_MODEL_PACKAGE_GROUP_NAME,
            value=self.vocoder_model_package_group.model_package_group_name,
            export_name=shared_variables.CDK_OUT_EXPORT_SAGEMAKER_VOCODER_MODEL_PACKAGE_GROUP_NAME,
        )

        # TTS - image captioning
        self.image_captioning_model_package_group = sagemaker.CfnModelPackageGroup(
            self,
            "ImageCaptioningModelPackageGroup",
            model_package_group_name=shared_variables.CDK_OUT_KEY_SAGEMAKER_IMAGE_CAPTIONING_MODEL_PACKAGE_GROUP_NAME,
            model_package_group_description="Package group for visual assistant image captioning models.",
            tags=[
                CfnTag(
                    key="sagemaker:domain-arn",
                    value=self.sagemaker_domain.attr_domain_arn,
                )
            ],
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_SAGEMAKER_IMAGE_CAPTIONING_MODEL_PACKAGE_GROUP_NAME,
            value=self.image_captioning_model_package_group.model_package_group_name,
            export_name=shared_variables.CDK_OUT_EXPORT_SAGEMAKER_IMAGE_CAPTIONING_MODEL_PACKAGE_GROUP_NAME,
        )

        # Object detection
        self.object_detection_model_package_group = sagemaker.CfnModelPackageGroup(
            self,
            "ObjectDetectionModelPackageGroup",
            model_package_group_name=shared_variables.CDK_OUT_KEY_SAGEMAKER_OBJECT_DETECTION_MODEL_PACKAGE_GROUP_NAME,
            model_package_group_description="Package group for visual assistant object detection models.",
            tags=[
                CfnTag(
                    key="sagemaker:domain-arn",
                    value=self.sagemaker_domain.attr_domain_arn,
                )
            ],
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_SAGEMAKER_OBJECT_DETECTION_MODEL_PACKAGE_GROUP_NAME,
            value=self.object_detection_model_package_group.model_package_group_name,
            export_name=shared_variables.CDK_OUT_EXPORT_SAGEMAKER_OBJECT_DETECTION_MODEL_PACKAGE_GROUP_NAME,
        )
