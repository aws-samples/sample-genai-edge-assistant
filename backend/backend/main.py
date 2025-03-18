#
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# Permission is hereby granted, free of charge, to any person obtaining a copy of
# this software and associated documentation files (the "Software"), to deal in
# the Software without restriction, including without limitation the rights to
# use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
# the Software, and to permit persons to whom the Software is furnished to do so.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
# FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
# COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
# IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
# CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import json

import shared_variables as shared_variables
from aws_cdk import Aws, CfnOutput, Duration, RemovalPolicy, Stack
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_events as events
from aws_cdk import aws_events_targets as targets
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from aws_cdk import aws_s3 as s3
from aws_cdk import aws_sagemaker as sagemaker
from aws_cdk import custom_resources as cr
from cdk_nag import NagSuppressions
from constructs import Construct

import backend.apigateway.apigateway_construct as apigateway_construct
import backend.cognito.cognito_construct as cognito_construct
import backend.sagemaker.sagemakerdomain as sagemakerdomain
from backend.sagemaker.sagemakerendpoint.paligemma_endpoint_construct import \
    PaLiGemmaEndpointConstruct


class MyStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        suffix_S3_str = Aws.ACCOUNT_ID

        CUSTOM_ALLOWED_RESOURCES = ["*"]

        NagSuppressions.add_stack_suppressions(
            self,
            [
                {
                    "id": "AwsSolutions-IAM4",
                    "reason": "The LogRetention construct requires the AWSLambdaBasicExecutionRole managed policy",
                    "appliesTo": [
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
                    ],
                }
            ],
        )

        NagSuppressions.add_stack_suppressions(
            self,
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "IAM wildcards are needed for SageMaker and other services to function properly",
                    "appliesTo": [
                        "Resource::*",
                        "Action::s3:*",
                        "Action::s3:GetObject*",
                        "Action::s3:GetBucket*",
                        "Action::s3:List*",
                        "Action::s3:DeleteObject*",
                        "Action::s3:Abort*",
                    ],
                }
            ],
        )
        """ "Resource::<BucketSagemakerInputCB350773.Arn>/*" """
        ######### HANDLE FLAGS ###########

        amplify_install = False
        import_existing_s3_buckets = False

        amplify_app_id = self.node.try_get_context("amplify_app_id")
        no_amplify = str(self.node.try_get_context("no_amplify"))
        import_existing_s3_buckets_cli = str(self.node.try_get_context("import_s3"))

        if import_existing_s3_buckets_cli == "y":
            print("🪣 Importing existing S3 buckets")
            import_existing_s3_buckets = True

        if no_amplify == "y":
            if amplify_app_id:
                raise ValueError(
                    "an amplify_app_id cannot be provided while no_amplify is true"
                )

        else:
            if not amplify_app_id:
                raise ValueError(
                    "amplify_app_id must be provided when no_amplify is not set to 'y'"
                )
            amplify_app_id = str(amplify_app_id)
            amplify_install = True

        ####### METADATA ########

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_REGION,
            value=self.region,
            description="Region of the stack.",
            export_name=shared_variables.CDK_OUT_EXPORT_REGION,
        )

        ########## VPC ############

        # No NAT gateway to limit the costs of the VPC
        stack_vpc = ec2.Vpc(
            self,
            "StackVPC",
            max_azs=1,
            nat_gateways=0,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="Public", subnet_type=ec2.SubnetType.PUBLIC, cidr_mask=24
                ),
            ],
        )

        vpc_security_group = ec2.SecurityGroup(
            self,
            "StackVPCSecurityGroup",
            vpc=stack_vpc,
            allow_all_outbound=True,
            description="Security group for the stack VPC",
        )

        #! AwsSolutions-VPC7: The VPC does not have an associated Flow Log.
        # Create a log group for VPC Flow Logs
        log_group = logs.LogGroup(
            self,
            "VPCFlowLogsGroup",
            log_group_name="/aws/vpc/vis-assis-flow-logs",
            retention=logs.RetentionDays.ONE_MONTH,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Create a role for VPC Flow Logs
        flow_logs_role = iam.Role(
            self,
            "VPCFlowLogsRole",
            assumed_by=iam.ServicePrincipal("vpc-flow-logs.amazonaws.com"),
        )

        # Add necessary permissions to the role
        flow_logs_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources=[log_group.log_group_arn, f"{log_group.log_group_arn}:*"],
            )
        )

        # Add Flow Logs to the VPC
        stack_vpc.add_flow_log(
            "FlowLog",
            destination=ec2.FlowLogDestination.to_cloud_watch_logs(
                log_group, flow_logs_role
            ),
            traffic_type=ec2.FlowLogTrafficType.ALL,
        )

        NagSuppressions.add_resource_suppressions_by_path(
            Stack.of(self),
            f"{self.node.path}/VPCFlowLogsRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "VPC Flow Logs needs permissions to write to all log streams in the log group",
                    "appliesTo": [
                        f"Resource::<{Stack.of(self).get_logical_id(log_group.node.default_child)}.Arn>:*"
                    ],
                }
            ],
        )
        # Sagemaker domain creates custom security groups which rises issues when destroying the stack.
        # We create a custom resource to delete them ensuring no remaining resources or failed state after destruction.

        delete_sg_lambda = lambda_.Function(
            self,
            "DeleteSGLambda",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="lambda.handler",
            code=lambda_.Code.from_asset("functions/cleanup/delete_sm_sgs/src"),
            timeout=Duration.minutes(15),
        )

        delete_sg_lambda.add_to_role_policy(
            iam.PolicyStatement(
                actions=["ec2:DescribeSecurityGroups"],
                resources=["*"],  # does not support resource based policy
            )
        )

        NagSuppressions.add_resource_suppressions_by_path(
            Stack.of(self),
            f"{self.node.path}/DeleteSGLambda/ServiceRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "DescribeSecurityGroups API does not support resource-level permissions and requires a wildcard",
                    "appliesTo": [
                        f"Resource::arn:aws:ec2:<AWS::Region>:<AWS::AccountId>:security-group/*"
                    ],
                }
            ],
        )

        delete_sg_lambda.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "ec2:RevokeSecurityGroupIngress",
                    "ec2:RevokeSecurityGroupEgress",
                    "ec2:DeleteSecurityGroup",
                ],
                resources=[
                    f"arn:aws:ec2:{self.region}:{self.account}:security-group/*"
                ],
                conditions={"ArnEquals": {"ec2:Vpc": f"{stack_vpc.vpc_arn}"}},
            )
        )

        NagSuppressions.add_resource_suppressions_by_path(
            Stack.of(self),
            f"{self.node.path}/DeleteSGLambda/ServiceRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Lambda needs to manage security groups within the specific VPC. Access is restricted to specific VPC using conditions.",
                    "appliesTo": [
                        f"Resource::arn:aws:ec2:{self.region}:{self.account}:security-group/*"
                    ],
                }
            ],
        )

        # Create a custom resource that will invoke the Lambda
        delete_sg_custom_resource = cr.AwsCustomResource(
            self,
            "DeleteSGCustomResource",
            timeout=Duration.minutes(15),
            on_delete=cr.AwsSdkCall(
                service="Lambda",
                action="invoke",
                parameters={
                    "FunctionName": delete_sg_lambda.function_name,
                    "Payload": json.dumps({"vpc_id": stack_vpc.vpc_id}),
                },
                physical_resource_id=cr.PhysicalResourceId.of(stack_vpc.vpc_id),
            ),
            policy=cr.AwsCustomResourcePolicy.from_statements(
                [
                    iam.PolicyStatement(
                        actions=["lambda:InvokeFunction"],
                        resources=[delete_sg_lambda.function_arn],
                    )
                ]
            ),
        )

        ########## S3 BUCKETS #############

        #!AwsSolutions-S1: The S3 Bucket has server access logs disabled.
        logs_bucket = s3.Bucket(
            self,
            "BucketServerAccessLogs",
            bucket_name=f"vis-assis-server-access-logs-{suffix_S3_str}",
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # Create the S3 bucket for storing Sagemaker input resources (training data, etc.)
        if import_existing_s3_buckets:
            sagemaker_input_bucket = s3.Bucket.from_bucket_name(
                self,
                "BucketSagemakerInput",
                "vis-assis-sagemaker-input-" + suffix_S3_str,
            )
        else:
            sagemaker_input_bucket = s3.Bucket(
                self,
                "BucketSagemakerInput",
                block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
                encryption=s3.BucketEncryption.S3_MANAGED,
                bucket_name="vis-assis-sagemaker-input-" + suffix_S3_str,
                removal_policy=RemovalPolicy.DESTROY,
                auto_delete_objects=True,
                server_access_logs_bucket=logs_bucket,
                server_access_logs_prefix="sagemaker-input-logs/",
                enforce_ssl=True,
            )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_S3_BUCKET_SAGEMAKER_INPUT_NAME,
            value=sagemaker_input_bucket.bucket_name,
            description="The S3 bucket containing the input resources needed for Sagemaker such as training data, etc.",
            export_name=shared_variables.CDK_OUT_EXPORT_S3_BUCKET_SAGEMAKER_INPUT_NAME,
        )

        # Create the S3 bucket for storing Sagemaker output artifacts. These artifacts are optimised and in the .onnx format
        if import_existing_s3_buckets:
            sagemaker_output_bucket = s3.Bucket.from_bucket_name(
                self,
                "BucketSagemakerOutput",
                "vis-assis-sagemaker-output-" + suffix_S3_str,
            )
        else:
            sagemaker_output_bucket = s3.Bucket(
                self,
                "BucketSagemakerOutput",
                block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
                encryption=s3.BucketEncryption.S3_MANAGED,
                bucket_name="vis-assis-sagemaker-output-" + suffix_S3_str,
                removal_policy=RemovalPolicy.DESTROY,
                auto_delete_objects=True,
                server_access_logs_bucket=logs_bucket,
                server_access_logs_prefix="sagemaker-output-logs/",
                enforce_ssl=True,
                public_read_access=False,
            )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
            value=sagemaker_output_bucket.bucket_name,
            description="The S3 bucket containing the output job results of Sagemaker",
            export_name=shared_variables.CDK_OUT_EXPORT_S3_BUCKET_SAGEMAKER_OUTPUT_NAME,
        )

        # Create the S3 bucket for storing production model artifacts.
        if import_existing_s3_buckets:
            prod_model_artifacts_bucket = s3.Bucket.from_bucket_name(
                self,
                "BucketProductionModelArtifacts",
                "vis-assis-model-artifacts-production-" + suffix_S3_str,
            )
        else:
            prod_model_artifacts_bucket = s3.Bucket(
                self,
                "BucketProductionModelArtifacts",
                block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
                encryption=s3.BucketEncryption.S3_MANAGED,
                bucket_name="vis-assis-model-artifacts-production-" + suffix_S3_str,
                server_access_logs_bucket=logs_bucket,
                server_access_logs_prefix="model-artifacts-logs/",
                enforce_ssl=True,
                cors=[
                    s3.CorsRule(
                        allowed_methods=[s3.HttpMethods.GET, s3.HttpMethods.POST],
                        exposed_headers=["ETag"],
                        allowed_origins=(
                            [
                                f"https://main.{amplify_app_id}.amplifyapp.com",
                                f"https://dev-newest.{amplify_app_id}.amplifyapp.com",
                                f"https://test.{amplify_app_id}.amplifyapp.com",
                                f"https://open-source.{amplify_app_id}.amplifyapp.com",
                                "http://localhost:3000",
                            ]
                            if amplify_install
                            else CUSTOM_ALLOWED_RESOURCES
                        ),
                        allowed_headers=[
                            "Authorization",
                            "Content-Type",
                            "If-None-Match",
                        ],
                        max_age=60 * 60,
                    )
                ],
                removal_policy=RemovalPolicy.DESTROY,
                auto_delete_objects=True,
            )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_S3_BUCKET_PRODUCTION_MODELS_NAME,
            value=prod_model_artifacts_bucket.bucket_name,
            description="The S3 bucket containing the model artifacts ready for production",
            export_name=shared_variables.CDK_OUT_EXPORT_S3_BUCKET_PRODUCTION_MODELS_NAME,
        )

        ########## SAGEMAKER INIT #############

        # Create the SageMaker domain, Studio users and model groups
        self.sagemaker_domain_name = "vis-assis-sagemaker-studio-domain"
        self.public_subnet_ids = [
            public_subnet.subnet_id for public_subnet in stack_vpc.public_subnets
        ]
        self.sagemaker_domain_users_models_construct = (
            sagemakerdomain.SagemakerDomainUsersModelGroupsConstruct(
                self,
                "SagemakerDomainUsersModelGroupsConstruct",
                sagemaker_domain_name="vis-assis-sagemaker-domain",
                vpc_id=stack_vpc.vpc_id,
                subnet_ids=self.public_subnet_ids,
            )
        )

        # Create the PaLiGemma endpoint construct
        paligemma_endpoint = PaLiGemmaEndpointConstruct(
            self,
            "PaLiGemmaEndpoint",
            logs_bucket=logs_bucket,
            sagemaker_domain_arn=self.sagemaker_domain_users_models_construct.sagemaker_domain.attr_domain_arn,
            instance_type="ml.g5.xlarge",
            import_existing_s3_bucket=import_existing_s3_buckets,
        )

        self.endpoint_name = paligemma_endpoint.endpoint_name

        # SageMaker execution role

        sagemaker_execution_role = iam.Role(
            self,
            "SageMakerExecutionRole",
            assumed_by=iam.ServicePrincipal("sagemaker.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AmazonSageMakerFullAccess"
                )
            ],
        )

        #! Add NagSuppressions to suppress AwsSolutions-IAM4 warning for SageMaker execution role
        NagSuppressions.add_resource_suppressions(
            sagemaker_execution_role,
            [
                {
                    "id": "AwsSolutions-IAM4",
                    "reason": "SageMaker execution role requires full access to SageMaker services",
                    "appliesTo": [
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/AmazonSageMakerFullAccess"
                    ],
                }
            ],
        )

        sagemaker_input_bucket.grant_read_write(sagemaker_execution_role)
        sagemaker_output_bucket.grant_read_write(sagemaker_execution_role)

        # Add Nag suppression for S3 bucket wildcard permissions
        NagSuppressions.add_resource_suppressions_by_path(
            Stack.of(self),
            f"{self.node.path}/SageMakerExecutionRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "SageMaker execution role needs full access to input/output S3 buckets",
                    "appliesTo": [
                        f"Resource::<{Stack.of(self).get_logical_id(sagemaker_input_bucket.node.default_child)}.Arn>/*",
                        f"Resource::<{Stack.of(self).get_logical_id(sagemaker_output_bucket.node.default_child)}.Arn>/*",
                    ],
                }
            ],
        )

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_SAGEMAKER_EXECUTION_ROLE_ARN,
            value=sagemaker_execution_role.role_arn,
            description="The sagemaker execution role ARN",
            export_name=shared_variables.CDK_OUT_EXPORT_SAGEMAKER_EXECUTION_ROLE_ARN,
        )

        ########## COGNITO ############

        cognito_construct_output = cognito_construct.CognitoConstruct(
            self,
            "Cognito",
            region=Aws.REGION,
        )

        cognito_user_pool = cognito_construct_output.getUserPool()
        cognito_user_pool_client = cognito_construct_output.getUserPoolClient()

        ########## LAMBDA FUNCTIONS ############

        # Add log group
        copy_model_log_group = logs.LogGroup(
            self,
            "CopyModelLogGroup",
            log_group_name=f"/aws/lambda/vis-assis-copy-model-from-sagemaker-s3-to-production-s3",
            retention=logs.RetentionDays.ONE_WEEK,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Create custom role for the copy model function
        copy_model_role = iam.Role(
            self,
            "LambdaFunctionCopyModelRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )

        # Add CloudWatch Logs permissions
        copy_model_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources=[
                    f"{copy_model_log_group.log_group_arn}",
                    f"{copy_model_log_group.log_group_arn}:*",  # For streams within the group
                ],
            )
        )

        # Add Nag suppression for CloudWatch Logs wildcard permissions
        NagSuppressions.add_resource_suppressions_by_path(
            Stack.of(self),
            f"{self.node.path}/LambdaFunctionCopyModelRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Lambda function needs permissions to write to all log streams within its log group",
                    "appliesTo": [
                        f"Resource::<{Stack.of(self).get_logical_id(copy_model_log_group.node.default_child)}.Arn>:*"
                    ],
                }
            ],
        )

        function_copy_model_from_s3_to_s3 = lambda_.Function(
            self,
            "LambdaFunctionCopyModelFromSagemakerS3ToProductionS3",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="lambda.handler",
            code=lambda_.Code.from_asset(
                "functions/setup/copy_from_sm_s3_to_prod_s3/src"
            ),
            function_name="vis-assis-copy_model_from_sagemaker_s3_to_production_s3",
            timeout=Duration.minutes(14),
            environment={
                "DESTINATION_BUCKET_NAME": prod_model_artifacts_bucket.bucket_name  # Set bucket name as environment variable
            },
            log_group=copy_model_log_group,
            role=copy_model_role,
        )

        sagemaker_output_bucket.grant_read(function_copy_model_from_s3_to_s3)
        prod_model_artifacts_bucket.grant_read_write(function_copy_model_from_s3_to_s3)

        # Add Nag suppression for S3 bucket wildcard permissions
        NagSuppressions.add_resource_suppressions_by_path(
            Stack.of(self),
            f"{self.node.path}/LambdaFunctionCopyModelRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Lambda function needs full access to S3 buckets to copy model files",
                    "appliesTo": [
                        f"Resource::<{Stack.of(self).get_logical_id(sagemaker_output_bucket.node.default_child)}.Arn>/*",
                        f"Resource::<{Stack.of(self).get_logical_id(prod_model_artifacts_bucket.node.default_child)}.Arn>/*",
                    ],
                }
            ],
        )

        """ """  #! AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole]
        invoke_sagemaker_role = iam.Role(
            self,
            "LambdaFunctionInvokeSagemakerRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )

        # Add log group
        invoke_log_group = logs.LogGroup(
            self,
            "LogGroup",
            log_group_name=f"/aws/lambda/vis-assis-invoke-sagemaker-endpoint",
            retention=logs.RetentionDays.ONE_WEEK,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Add CloudWatch Logs permissions
        invoke_sagemaker_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources=[
                    f"{invoke_log_group.log_group_arn}",
                    f"{invoke_log_group.log_group_arn}:*",  # For streams within the group
                ],
            )
        )

        # Add Nag suppression for CloudWatch Logs wildcard permissions
        NagSuppressions.add_resource_suppressions_by_path(
            Stack.of(self),
            f"{self.node.path}/LambdaFunctionInvokeSagemakerRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Lambda function needs permissions to write to all log streams within its log group",
                    "appliesTo": [
                        f"Resource::<{Stack.of(self).get_logical_id(invoke_log_group.node.default_child)}.Arn>:*"
                    ],
                }
            ],
        )

        # Add SageMaker InvokeEndpoint permission
        invoke_sagemaker_role.add_to_policy(
            iam.PolicyStatement(
                actions=["sagemaker:InvokeEndpoint"],
                resources=[
                    f"arn:aws:sagemaker:{self.region}:{self.account}:endpoint/{self.endpoint_name}"
                ],
            )
        )

        # Create the Lambda function with the custom role
        function_invoke_sagemaker = lambda_.Function(
            self,
            "LambdaFunctionInvokeSagemaker",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="lambda.handler",
            code=lambda_.Code.from_asset("functions/core/invoke_sagemaker/src"),
            function_name="vis-assis-invoke_sagemaker_endpoint",
            log_retention=logs.RetentionDays.ONE_WEEK,
            role=invoke_sagemaker_role,
            environment={
                "ENDPOINT_NAME": self.endpoint_name,
            },
            timeout=Duration.seconds(30)
        )

        """         function_invoke_sagemaker.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["sagemaker:InvokeEndpoint"],
                resources=[
                    f"arn:aws:sagemaker:{Aws.REGION}:{Aws.ACCOUNT_ID}:endpoint/{self.endpoint_name}"
                ],
            )
        ) """

        function_get_model_url = lambda_.Function(
            self,
            "LambdaFunctionModelUrl",
            runtime=lambda_.Runtime.PYTHON_3_13,
            handler="lambda.handler",
            code=lambda_.Code.from_asset("functions/core/model_presigned_url/src"),
            function_name="vis-assis-model_artifact_presigned_url",
            log_retention=logs.RetentionDays.ONE_WEEK,
            environment={
                "MODELS_ARTIFACTS_BUCKET": prod_model_artifacts_bucket.bucket_name,
            },
            timeout=Duration.seconds(30)
        )

        prod_model_artifacts_bucket.grant_read(function_get_model_url)

        NagSuppressions.add_resource_suppressions_by_path(
            Stack.of(self),
            f"{self.node.path}/LambdaFunctionModelUrl/ServiceRole/DefaultPolicy/Resource",
            [
                {
                    "id": "AwsSolutions-IAM5",
                    "reason": "Lambda function needs read access to all objects in the model artifacts bucket to generate presigned URLs",
                    "appliesTo": [
                        f"Resource::<{Stack.of(self).get_logical_id(prod_model_artifacts_bucket.node.default_child)}.Arn>/*"
                    ],
                }
            ],
        )
        ########## API GATEWAY #############

        apigw_construct = apigateway_construct.API(
            self,
            "ApiGwConstruct",
            lambda_invoke_sagemaker=function_invoke_sagemaker,
            lambda_models_url=function_get_model_url,
            vpc_invoke_sagemaker=stack_vpc,
            cognito_user_pool=cognito_user_pool,
            cognito_user_pool_client=cognito_user_pool_client,
            trusted_origins=(
                [
                    f"https://main.{amplify_app_id}.amplifyapp.com",
                    f"https://dev-newest.{amplify_app_id}.amplifyapp.com",
                    f"https://test.{amplify_app_id}.amplifyapp.com",
                    f"https://open-source.{amplify_app_id}.amplifyapp.com",
                    "http://localhost:3000",
                ]
                if amplify_install
                else CUSTOM_ALLOWED_RESOURCES
            ),
        )

        ########## EVENTBRIDGE #############

        # Rule for copying from Sagemaker output to production when an approval is done in the model registry

        package_group_names = [
            self.sagemaker_domain_users_models_construct.depth_model_package_group.model_package_group_name,
            self.sagemaker_domain_users_models_construct.tts_model_package_group.model_package_group_name,
            self.sagemaker_domain_users_models_construct.vocoder_model_package_group.model_package_group_name,
            self.sagemaker_domain_users_models_construct.image_captioning_model_package_group.model_package_group_name,
            self.sagemaker_domain_users_models_construct.object_detection_model_package_group.model_package_group_name,
        ]
        rule = events.Rule(
            self,
            "SageMakerModelStateChangeRule",
            rule_name="copy-model-from-sagemaker-s3-to-production-s3",
            description=f"Copies the new model from ({sagemaker_output_bucket.bucket_name}) to ({prod_model_artifacts_bucket.bucket_name}) of package group [{package_group_names}] when its state is set to approved state",
            event_pattern=events.EventPattern(
                source=["aws.sagemaker"],
                detail_type=["SageMaker Model Package State Change"],
                detail={
                    "ModelPackageGroupName": package_group_names,
                    "ModelApprovalStatus": ["Approved"],
                },
            ),
        )

        rule.add_target(targets.LambdaFunction(function_copy_model_from_s3_to_s3))

        ####### AMPLIFY #######

        if amplify_install:
            print("Amplify environment variables will be updated 🚧")

            # Create Amplify app with environment variables
            amplify_env_vars = {
                "NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID": cognito_user_pool_client.user_pool_client_id,
                "NEXT_PUBLIC_COGNITO_USER_POOL_ID": cognito_user_pool.user_pool_id,
                "NEXT_PUBLIC_API_GATEWAY_ENDPOINT": apigw_construct.get_url(),
                "NEXT_PUBLIC_DEBUG_AUDIO": "true",
                "NEXT_PUBLIC_DEBUG_DEPTH": "true",
                "NEXT_PUBLIC_DEBUG_DETECTION": "true",
                "NEXT_PUBLIC_DEBUG_IMAGE_CAPTIONING": "true",
                "AMPLIFY_MONOREPO_APP_ROOT": "visual_assistant_js",
            }

            # Update the existing Amplify App
            update_env_vars = cr.AwsCustomResource(
                self,
                "UpdateEnvVars",
                timeout=Duration.minutes(15),
                on_update=cr.AwsSdkCall(
                    service="Amplify",
                    action="updateApp",
                    parameters={
                        "appId": amplify_app_id,
                        "environmentVariables": amplify_env_vars,
                    },
                    physical_resource_id=cr.PhysicalResourceId.of("UpdateEnvVars"),
                ),
                policy=cr.AwsCustomResourcePolicy.from_sdk_calls(
                    resources=[f"arn:aws:amplify:*:*:apps/{amplify_app_id}"]
                ),
            )
