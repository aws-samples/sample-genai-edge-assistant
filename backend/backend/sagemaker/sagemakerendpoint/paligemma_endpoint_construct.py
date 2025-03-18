# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json

import aws_cdk as cdk
from aws_cdk import Duration, Fn, RemovalPolicy
from aws_cdk import aws_events as events
from aws_cdk import aws_events_targets as events_targets
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_s3_notifications as s3n
from aws_cdk import custom_resources as cr
from cdk_nag import NagSuppressions
from constructs import Construct

PUBLIC_IMAGE_ACCOUNT_ID = "763104351884" # https://github.com/aws/deep-learning-containers/blob/master/available_images.md

class PaLiGemmaEndpointConstruct(Construct):

    @property
    def endpoint_name(self) -> str:
        return self.__endpoint_name

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        sagemaker_domain_arn: str,
        logs_bucket: s3.Bucket,
        instance_type: str = "ml.g5.xlarge",
        import_existing_s3_bucket: bool = False,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.region = cdk.Aws.REGION
        self.account = cdk.Aws.ACCOUNT_ID

        self.__endpoint_name = f"paligemma-endpoint-" + self.account

        # Create a new S3 bucket for model storage
        if import_existing_s3_bucket:
            model_bucket = s3.Bucket.from_bucket_name(
                self,
                "PaLiGemmaModelBucket",
                "vis-assis-sagemaker-endpoint-model-" + self.account,
            )
        else:
            model_bucket = s3.Bucket(
                self,
                "PaLiGemmaModelBucket",
                bucket_name="vis-assis-sagemaker-endpoint-model-" + self.account,
                removal_policy=RemovalPolicy.DESTROY,
                auto_delete_objects=True,
                block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
                encryption=s3.BucketEncryption.S3_MANAGED,
                enforce_ssl=True,
                server_access_logs_bucket=logs_bucket,
                server_access_logs_prefix="paligemma-model-bucket-access-logs/",
            )

        # Create SageMaker execution role with minimal required permissions
        sagemaker_execution_role = iam.Role(
            self,
            "PaLiGemmaModelExecutionRole",
            assumed_by=iam.ServicePrincipal("sagemaker.amazonaws.com"),
        )

        #! AwsSolutions-IAM5[Action::s3:GetBucket*]
        # Add specific S3 permissions instead of using grant_read
        sagemaker_execution_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "s3:GetObject",
                    "s3:ListBucket",
                ],
                resources=[
                    f"{model_bucket.bucket_arn}/paligemma/*",
                    model_bucket.bucket_arn,
                ],
            )
        )

        # Add minimal required SageMaker permissions
        sagemaker_execution_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "sagemaker:AddTags",
                    "sagemaker:CreateModel",
                    "sagemaker:CreateEndpointConfig",
                    "sagemaker:CreateEndpoint",
                    "sagemaker:DescribeModel",
                    "sagemaker:DescribeEndpointConfig",
                    "sagemaker:DescribeEndpoint",
                ],
                resources=[
                    f"arn:aws:sagemaker:{self.region}:{self.account}:model/paligemma-model-*",
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint-config/paligemma-endpoint-config-*",
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint/paligemma-endpoint*",
                ],
            )
        )

        # Add specific ECR permissions for the image repository
        sagemaker_execution_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage",
                    "ecr:BatchCheckLayerAvailability",
                ],
                resources=[f"arn:aws:ecr:{self.region}:{PUBLIC_IMAGE_ACCOUNT_ID}:repository/*"],
            )
        )

        # Add ECR permissions for token to access
        sagemaker_execution_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "ecr:GetAuthorizationToken",
                ],
                resources=["*"],
            )
        )

        # Add CloudWatch Logs permissions
        sagemaker_execution_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources=[
                    f"arn:aws:logs:{self.region}:{self.account}:log-group:/aws/sagemaker/Endpoints/{self.__endpoint_name}*",
                    f"arn:aws:logs:{self.region}:{self.account}:log-group:/aws/sagemaker/Endpoints/{self.__endpoint_name}*:log-stream:*",
                ],
            )
        )

        #! Necessary suppressions for AwsSolutions-IAM5
        NagSuppressions.add_resource_suppressions_by_path(
            cdk.Stack.of(self),
            f"/{self.node.path}/PaLiGemmaModelExecutionRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "SageMaker requires wildcard for model names as they are dynamically created",
                    "appliesTo": [
                        f"Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:model/paligemma-model-*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "S3 wildcard is needed to access all objects in the paligemma prefix",
                    "appliesTo": [
                        f"Resource::<{cdk.Stack.of(self).get_logical_id(model_bucket.node.default_child)}.Arn>/paligemma/*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "SageMaker requires wildcard for endpoint config names as they are dynamically created",
                    "appliesTo": [
                        "Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:endpoint-config/paligemma-endpoint-config-*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "SageMaker requires wildcard for endpoint names as they are dynamically created",
                    "appliesTo": [
                        "Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:endpoint/paligemma-endpoint*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "ECR requires wildcard to access all repositories in the HuggingFace account",
                    "appliesTo": [
                        "Resource::arn:aws:ecr:<AWS::Region>:<AWS::AccountId>:repository/*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "ECR GetAuthorizationToken requires access to all resources",
                    "appliesTo": ["Resource::*"],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "CloudWatch Logs requires wildcard for dynamic log groups and streams",
                    "appliesTo": [
                        "Resource::arn:aws:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/sagemaker/Endpoints/paligemma-endpoint-<AWS::AccountId>*",
                        "Resource::arn:aws:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/sagemaker/Endpoints/paligemma-endpoint-<AWS::AccountId>*:log-stream:*",
                    ],
                },
            ],
        )

        image: str = (
            f"{PUBLIC_IMAGE_ACCOUNT_ID}.dkr.ecr.{self.region}.amazonaws.com/huggingface-pytorch-inference:2.1.0-transformers4.37.0-gpu-py310-cu118-ubuntu20.04"
        )

        ######## Lambda function to update the endpoint ########

        update_model_log_group = logs.LogGroup(
            self,
            "UpdateModelFunctionLogGroup",
            log_group_name="/aws/lambda/vis-assis-update-paligemma-endpoint",
            retention=logs.RetentionDays.ONE_WEEK,
            removal_policy=RemovalPolicy.DESTROY,
        )

        update_model_role = iam.Role(
            self,
            "UpdateModelFunctionRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )

        update_model_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources=[
                    update_model_log_group.log_group_arn,
                    f"{update_model_log_group.log_group_arn}:*",  # For streams within the group
                ],
            )
        )

        update_model_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "sagemaker:DescribeEndpoint",
                    "sagemaker:DescribeEndpointConfig",
                ],
                resources=[
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint/{self.__endpoint_name}",
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint-config/paligemma-endpoint-config-*",
                ],
            )
        )

        update_model_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "sagemaker:AddTags",
                    "sagemaker:CreateEndpoint",
                    "sagemaker:UpdateEndpoint",
                    "sagemaker:CreateModel",
                    "sagemaker:DeleteModel",
                    "sagemaker:DescribeModel",
                    "sagemaker:CreateEndpointConfig",
                    "sagemaker:DeleteEndpointConfig",
                ],
                resources=[
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint/{self.__endpoint_name}",
                    f"arn:aws:sagemaker:{self.region}:{self.account}:model/paligemma-model-*",
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint-config/paligemma-endpoint-config-*",
                ],
            )
        )

        # Add specific IAM pass role permission
        update_model_role.add_to_policy(
            iam.PolicyStatement(
                actions=["iam:PassRole"],
                resources=[sagemaker_execution_role.role_arn],
            )
        )

        # Create a Lambda function to handle model updates and endpoint creation/update
        update_model_function = lambda_.Function(
            self,
            "UpdateModelFunction",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="lambda.handler",
            code=lambda_.Code.from_asset(
                "functions/setup/update_sm_endpoint_model/src"
            ),
            timeout=cdk.Duration.minutes(15),
            log_group=update_model_log_group,
            memory_size=256,
            role=update_model_role,
            environment={
                "ENDPOINT_NAME": self.__endpoint_name,
                "EXECUTION_ROLE_ARN": sagemaker_execution_role.role_arn,
                "ECR_IMAGE": image,
                "INSTANCE_TYPE": instance_type,
                "BUCKET_NAME": model_bucket.bucket_name,
                "DOMAIN_ARN": sagemaker_domain_arn,
            },
        )

        #! Necessary suppressions for AwsSolutions-IAM5
        NagSuppressions.add_resource_suppressions_by_path(
            cdk.Stack.of(self),
            f"/{self.node.path}/UpdateModelFunctionRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "SageMaker endpoint configs are created with dynamic names for versioning",
                    "applies_to": [
                        "Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:endpoint-config/paligemma-endpoint-config-*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "SageMaker models are created with dynamic names for versioning",
                    "applies_to": [
                        "Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:model/paligemma-model-*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required S3 permissions to access model artifacts",
                    "applies_to": [
                        "Action::s3:GetObject*",
                        "Action::s3:GetBucket*",
                        "Action::s3:List*",
                        f"Resource::<{cdk.Stack.of(self).get_logical_id(model_bucket.node.default_child)}.Arn>/paligemma/*",
                    ],
                },
            ],
        )

        ######## Lambda function to setup autoscaling ########

        setup_autoscaling_log_group = logs.LogGroup(
            self,
            "SetupAutoscalingLogGroup",
            log_group_name="/aws/lambda/vis-assis-setup-paligemma-autoscaling",
            retention=logs.RetentionDays.ONE_WEEK,
            removal_policy=cdk.RemovalPolicy.DESTROY,
        )

        setup_autoscaling_role = iam.Role(
            self,
            "SetupAutoscalingRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            inline_policies={
                "CloudWatchLogsPolicy": iam.PolicyDocument(
                    statements=[
                        iam.PolicyStatement(
                            actions=[
                                "logs:CreateLogStream",
                                "logs:PutLogEvents",
                            ],
                            resources=[
                                setup_autoscaling_log_group.log_group_arn,
                                f"{setup_autoscaling_log_group.log_group_arn}:*",  # For streams within the group
                            ],
                        )
                    ]
                ),
            },
        )
        # Create autoscaling setup Lambda function
        setup_autoscaling_function = lambda_.Function(
            self,
            "SetupAutoscalingFunction",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="lambda.handler",
            code=lambda_.Code.from_asset(
                "functions/setup/setup_sm_endpoint_autoscaling/src"
            ),
            timeout=cdk.Duration.minutes(5),
            log_group=setup_autoscaling_log_group,
            memory_size=256,
            role=setup_autoscaling_role,
        )

        # Add service-linked role creation permission with condition
        setup_autoscaling_role.add_to_policy(
            iam.PolicyStatement(
                actions=["iam:CreateServiceLinkedRole"],
                resources=[
                    f"arn:aws:iam::{self.account}:role/aws-service-role/sagemaker.application-autoscaling.amazonaws.com/*"
                ],
                conditions={
                    "StringEquals": {
                        "iam:AWSServiceName": "sagemaker.application-autoscaling.amazonaws.com"
                    }
                },
            )
        )

        # Add autoscaling permissions
        setup_autoscaling_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "application-autoscaling:RegisterScalableTarget",
                    "application-autoscaling:PutScalingPolicy",
                ],
                resources=[
                    f"arn:aws:application-autoscaling:{self.region}:{self.account}:scalable-target/*"
                ],
            )
        )

        # Add sagemaker permissions for autoscaling
        setup_autoscaling_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "sagemaker:DescribeEndpointConfig",
                    "sagemaker:DescribeEndpoint",
                    "sagemaker:UpdateEndpointWeightsAndCapacities",
                ],
                resources=[
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint/{self.__endpoint_name}",
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint-config/*",
                ],
            )
        )

        # Add cloudwatch permissions for autoscaling
        setup_autoscaling_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "cloudwatch:PutMetricAlarm",
                    "cloudwatch:DeleteAlarms",
                    "cloudwatch:DescribeAlarms",
                ],
                resources=[f"arn:aws:cloudwatch:{self.region}:{self.account}:alarm:*"],
            )
        )

        NagSuppressions.add_resource_suppressions_by_path(
            cdk.Stack.of(self),
            f"/{self.node.path}/SetupAutoscalingRole/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required for CloudWatch Logs access to write logs from Lambda function",
                    "applies_to": [
                        f"Resource::<{cdk.Stack.of(setup_autoscaling_log_group).get_logical_id(setup_autoscaling_log_group.node.default_child)}.Arn>:*"
                    ],
                },
            ],
        )

        NagSuppressions.add_resource_suppressions_by_path(
            cdk.Stack.of(self),
            f"/{self.node.path}/SetupAutoscalingRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required for creating SageMaker autoscaling service-linked role",
                    "applies_to": [
                        "Resource::arn:aws:iam:<AWS::AccountId>:role/aws-service-role/sagemaker.application-autoscaling.amazonaws.com/*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required for registering autoscaling targets and policies",
                    "applies_to": [
                        "Resource::arn:aws:application-autoscaling:<AWS::Region>:<AWS::AccountId>:scalable-target/*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required for describing SageMaker endpoint configs",
                    "applies_to": [
                        "Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:endpoint-config/*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required for managing CloudWatch alarms for autoscaling",
                    "applies_to": [
                        "Resource::arn:aws:cloudwatch:<AWS::Region>:<AWS::AccountId>:alarm:*"
                    ],
                },
            ],
        )

        # Create EventBridge rule to monitor endpoint status changes
        events_rule = events.Rule(
            self,
            "EndpointStatusRule",
            event_pattern=events.EventPattern(
                source=["aws.sagemaker"],
                detail_type=["SageMaker Endpoint State Change"],
                detail={
                    "EndpointName": [self.__endpoint_name],
                    "EndpointStatus": ["IN_SERVICE"],
                },
            ),
        )
        events_rule.add_target(
            events_targets.LambdaFunction(setup_autoscaling_function)
        )

        # Grant Lambda function read access only to the specific prefix
        model_bucket.grant_read(
            update_model_function, objects_key_pattern="paligemma/*"
        )
        # Create an S3 notification for the model file
        model_bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED,
            s3n.LambdaDestination(update_model_function),
            s3.NotificationKeyFilter(prefix="paligemma/"),
        )

        ####### Cleanup on delete #######

        cleanup_function = lambda_.Function(
            self,
            "CleanupFunction",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="lambda.handler",
            timeout=Duration.minutes(15),
            code=lambda_.Code.from_asset(
                "functions/cleanup/delete_sagemaker_model_and_config/src"
            ),
        )

        cleanup_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "sagemaker:ListEndpointConfigs",
                    "sagemaker:ListModels",
                ],
                resources=[
                    "*"
                ],  # List operations don't support resource-level permissions
            )
        )

        cleanup_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["sagemaker:DeleteEndpointConfig", "sagemaker:DeleteModel"],
                resources=[
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint-config/paligemma-endpoint-config-*",
                    f"arn:aws:sagemaker:{self.region}:{self.account}:model/paligemma-model-*",
                ],
            )
        )

        NagSuppressions.add_resource_suppressions_by_path(
            cdk.Stack.of(self),
            f"{self.node.path}/CleanupFunction/ServiceRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Cleanup function needs to list and delete SageMaker resources. Resource wildcards are required as resource names are dynamic.",
                    "appliesTo": ["Resource::*"],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Cleanup function needs to delete any endpoint configs. Wildcard required as names are dynamic.",
                    "appliesTo": [
                        "Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:endpoint-config/*"
                    ],
                },
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Cleanup function needs to delete any models. Wildcard required as names are dynamic.",
                    "appliesTo": [
                        "Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:model/paligemma-model-*"
                    ],
                },
            ],
        )

        # Custom resource to delete the endpoint
        delete_endpoint_cr = cr.AwsCustomResource(
            self,
            "DeleteEndpointCustomResource",
            on_delete=cr.AwsSdkCall(
                service="SageMaker",
                action="deleteEndpoint",
                parameters={"EndpointName": self.__endpoint_name},
                ignore_error_codes_matching="ValidationException|ResourceNotFound",
            ),
            policy=cr.AwsCustomResourcePolicy.from_statements(
                [
                    iam.PolicyStatement(
                        actions=["sagemaker:DeleteEndpoint"],
                        resources=[
                            f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint/{self.__endpoint_name}"
                        ],
                    ),
                    iam.PolicyStatement(
                        actions=["application-autoscaling:DeregisterScalableTarget"],
                        resources=["*"],
                        conditions={
                            "StringLike": {
                                "application-autoscaling:service-namespace": "sagemaker",
                                "application-autoscaling:scalable-dimension": "sagemaker:variant:DesiredInstanceCount",
                            }
                        },
                    ),
                ]
            ),
        )

        # Update the suppression to reflect the new IAM policy
        NagSuppressions.add_resource_suppressions_by_path(
            cdk.Stack.of(self),
            f"{self.node.path}/DeleteEndpointCustomResource/CustomResourcePolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required for deregistering autoscaling target during endpoint deletion. Application Autoscaling requires * resource with conditions.",
                    "appliesTo": ["Resource::*"],
                }
            ],
        )

        # Custom resource to delete endpoint configs
        delete_endpoint_configs_cr = cr.AwsCustomResource(
            self,
            "DeleteEndpointConfigsCustomResource",
            on_delete=cr.AwsSdkCall(
                service="Lambda",
                action="invoke",
                physical_resource_id=cr.PhysicalResourceId.of("EndpointConfigDeletion"),
                parameters={
                    "FunctionName": cleanup_function.function_name,
                    "Payload": json.dumps(
                        {
                            "action": "DELETE_ENDPOINT_CONFIGS",
                            "prefix": "paligemma-endpoint-config-",
                            "region": self.region,
                        }
                    ),
                },
            ),
            policy=cr.AwsCustomResourcePolicy.from_statements(
                [
                    iam.PolicyStatement(
                        actions=["lambda:InvokeFunction"],
                        resources=[cleanup_function.function_arn],
                    ),
                ]
            ),
        )

        NagSuppressions.add_resource_suppressions_by_path(
            cdk.Stack.of(self),
            f"{self.node.path}/DeleteEndpointConfigsCustomResource/CustomResourcePolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required for cleanup of all endpoint configs matching the prefix 'paligemma-endpoint-config-'. Wildcard is needed as endpoint config names are dynamically generated.",
                    "appliesTo": [
                        f"Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:endpoint-config/paligemma-endpoint-config-*"
                    ],
                },
            ],
        )

        # Custom resource to delete models
        delete_models_cr = cr.AwsCustomResource(
            self,
            "DeleteModelsCustomResource",
            on_delete=cr.AwsSdkCall(
                service="Lambda",
                action="invoke",
                physical_resource_id=cr.PhysicalResourceId.of("ModelDeletion"),
                parameters={
                    "FunctionName": cleanup_function.function_name,
                    "Payload": json.dumps(
                        {
                            "action": "DELETE_MODELS",
                            "prefix": "paligemma-model-",
                            "region": self.region,
                        }
                    ),
                },
            ),
            policy=cr.AwsCustomResourcePolicy.from_statements(
                [
                    iam.PolicyStatement(
                        actions=["lambda:InvokeFunction"],
                        resources=[cleanup_function.function_arn],
                    ),
                ]
            ),
        )

        NagSuppressions.add_resource_suppressions_by_path(
            cdk.Stack.of(self),
            f"{self.node.path}/DeleteModelsCustomResource/CustomResourcePolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Required for cleanup of all SageMaker models matching the prefix 'paligemma-model-'. Wildcard is needed as model names are dynamically generated.",
                    "appliesTo": [
                        "Resource::arn:aws:sagemaker:<AWS::Region>:<AWS::AccountId>:model/paligemma-model-*"
                    ],
                }
            ],
        )
        # Add dependencies to ensure correct deletion order
        delete_endpoint_configs_cr.node.add_dependency(delete_endpoint_cr)
        delete_models_cr.node.add_dependency(delete_endpoint_configs_cr)

        cdk.CfnOutput(
            self,
            "EndpointName",
            value=self.__endpoint_name,
            description="SageMaker Endpoint Name for PaLiGemma Model",
        )
