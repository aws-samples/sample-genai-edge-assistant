# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import aws_cdk.aws_apigatewayv2 as apigatewayv2
import shared_variables as shared_variables
from aws_cdk import CfnOutput, Duration, RemovalPolicy
from aws_cdk import aws_certificatemanager as acm
from aws_cdk import aws_cognito as cognito_
from aws_cdk import aws_ec2 as ec2
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from aws_cdk.aws_apigatewayv2_authorizers import HttpUserPoolAuthorizer
from aws_cdk.aws_apigatewayv2_integrations import HttpLambdaIntegration
from constructs import Construct
from typing import Optional


class API(Construct):
    def __init__(
        self,
        scope: Construct,
        id_: str,
        *,
        lambda_models_url: lambda_.Function,
        lambda_invoke_sagemaker: lambda_.Function,
        vpc_invoke_sagemaker: ec2.Vpc,
        cognito_user_pool: cognito_.CfnUserPool,
        cognito_user_pool_client: cognito_.CfnUserPoolClient,
        trusted_origins,
        custom_domain_name: Optional[str] = None,
        certificate_arn: Optional[str] = None,
    ):
        super().__init__(scope, id_)

        #########################################
        ########### Create the api gateway ######
        #########################################

        authorizer = HttpUserPoolAuthorizer(
            "vis-assis-authorizer",
            pool=cognito_user_pool,
            user_pool_clients=[cognito_user_pool_client],
        )

        self.api = apigatewayv2.HttpApi(
            self,
            "vis-assis-http-api",
            cors_preflight=apigatewayv2.CorsPreflightOptions(
                allow_headers=[
                    "Authorization",
                    "content-type",
                    "x-amz-date",
                    "x-api-key",
                ],
                allow_methods=[
                    apigatewayv2.CorsHttpMethod.GET,
                    apigatewayv2.CorsHttpMethod.HEAD,
                    apigatewayv2.CorsHttpMethod.OPTIONS,
                    apigatewayv2.CorsHttpMethod.POST,
                ],
                allow_origins=trusted_origins,
                max_age=Duration.days(10),
            ),
        )

        #########################################
        ########### Custom Domain (Optional) ####
        #########################################

        if custom_domain_name and certificate_arn:
            # Import existing certificate
            certificate = acm.Certificate.from_certificate_arn(
                self, "ApiCertificate", certificate_arn
            )
            
            # Create custom domain
            domain = apigatewayv2.DomainName(
                self,
                "ApiCustomDomain",
                domain_name=custom_domain_name,
                certificate=certificate,
            )
            
            # Map the domain to the API
            apigatewayv2.ApiMapping(
                self,
                "ApiMapping",
                api=self.api,
                domain_name=domain,
                stage=self.api.default_stage,
            )
            
            # Output the custom domain URL
            CfnOutput(
                self,
                "CustomDomainUrl",
                value=f"https://{custom_domain_name}",
                description="Custom domain URL for the API",
            )

        #########################################
        ########### Create the log group #######
        #########################################

        log_group = logs.LogGroup(
            self,
            "HttpApiLogGroup",
            log_group_name="/aws/vendedlogs/apigateway/vis-assis-http-api",
            retention=logs.RetentionDays.ONE_WEEK,
            removal_policy=RemovalPolicy.DESTROY,
        )

        cfn_stage = self.api.default_stage.node.default_child
        cfn_stage.access_log_settings = apigatewayv2.CfnStage.AccessLogSettingsProperty(
            destination_arn=log_group.log_group_arn,
            format='{"requestId":"$context.requestId", "ip": "$context.identity.sourceIp", "requestTime":"$context.requestTime", "httpMethod":"$context.httpMethod", "routeKey":"$context.routeKey", "status":"$context.status", "protocol":"$context.protocol", "responseLength":"$context.responseLength"}',
        )

        log_group.grant_write(iam.ServicePrincipal("apigateway.amazonaws.com"))

        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_API_GATEWAY_ENDPOINT,
            value=self.api.api_endpoint,
            description="API Gateway endpoint",
            export_name=shared_variables.CDK_OUT_EXPORT_API_GATEWAY_ENDPOINT,
        )

        #################################################################
        ####### Invoke SageMaker real-time inference endpoint ###########
        #################################################################

        self.api.add_routes(
            integration=HttpLambdaIntegration(
                "InvokeSageMakerEndpoint", lambda_invoke_sagemaker
            ),
            path="/invokesagemakerinference",
            methods=[apigatewayv2.HttpMethod.POST],
            authorizer=authorizer,
        )

        # Create VPC link as function is within the VPC
        # https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vpc-links.html
        # Only supports some AZs, it needs to be checked here before
        available_zones = shared_variables.AVAILABILITY_ZONES
        vpc_link = apigatewayv2.VpcLink(
            self,
            "VpcLink",
            vpc=vpc_invoke_sagemaker,
            subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                subnet_filters=[ec2.SubnetFilter.availability_zones(available_zones)],
            ),
        )

        ##################################################
        ####### Pre-signed URL model artifacts ###########
        ##################################################

        self.api.add_routes(
            integration=HttpLambdaIntegration(
                "GetModelArtifactIntegration", lambda_models_url
            ),
            path="/getmodelurl",
            methods=[apigatewayv2.HttpMethod.GET],
            authorizer=authorizer,
        )

    def get_url(self):
        return self.api.url
