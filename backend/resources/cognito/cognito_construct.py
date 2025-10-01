# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import shared_variables as shared_variables
from aws_cdk import CfnOutput, Duration, RemovalPolicy
from aws_cdk import aws_cognito as cognito
from aws_cdk.aws_cognito_identitypool import IdentityPool, UserPoolAuthenticationProvider, IdentityPoolAuthenticationProviders
from cdk_nag import NagPackSuppression, NagSuppressions
from constructs import Construct


class CognitoConstruct(Construct):

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        region: str,
        **kwargs,
    ):
        super().__init__(scope, construct_id, **kwargs)

        self.user_pool = cognito.UserPool(
            self,
            "UserPool",
            self_sign_up_enabled=False,
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            sign_in_case_sensitive=False,
            auto_verify=cognito.AutoVerifiedAttrs(
                email=True,
            ),
            sign_in_aliases=cognito.SignInAliases(
                username=False,
                email=True,
            ),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(
                    required=True,
                    mutable=True,
                ),
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True,
                temp_password_validity=Duration.days(1),
            ),
            removal_policy=RemovalPolicy.DESTROY,
        )
        self.user_pool.node.default_child.user_pool_add_ons = (
            cognito.CfnUserPool.UserPoolAddOnsProperty(
                advanced_security_mode="ENFORCED",
            )
        )
        NagSuppressions.add_resource_suppressions(
            construct=self.user_pool,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-COG2",
                    reason="MFA not required for Cognito in aws samples",
                ),
            ],
        )
        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_COGNITO_USER_POOL_ID,
            value=self.user_pool.user_pool_id,
            export_name=shared_variables.CDK_OUT_EXPORT_COGNITO_USER_POOL_ID,
        )

        self.user_pool_client = cognito.UserPoolClient(
            self,
            "UserPoolClient",
            user_pool=self.user_pool,
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
                admin_user_password=True,
                custom=True,
            ),
        )
        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_COGNITO_USER_POOL_CLIENT_ID,
            value=self.user_pool_client.user_pool_client_id,
            export_name=shared_variables.CDK_OUT_EXPORT_COGNITO_USER_POOL_CLIENT_ID,
        )

        # TODO: temporary Identity Pool for SageMaker access (to be implemented: WSS API GW -> Lambda -> SM Stream)
        self.identity_pool = IdentityPool(
            self,
            "IdentityPool",
            authentication_providers=IdentityPoolAuthenticationProviders(
                user_pools=[UserPoolAuthenticationProvider(
                    user_pool=self.user_pool,
                    user_pool_client=self.user_pool_client
                )]
            ),
            allow_unauthenticated_identities=False,
        )
        
        CfnOutput(
            self,
            shared_variables.CDK_OUT_KEY_COGNITO_IDENTITY_POOL_ID,
            value=self.identity_pool.identity_pool_id,
            export_name=shared_variables.CDK_OUT_EXPORT_COGNITO_IDENTITY_POOL_ID,
        )

    def getUserPool(self):
        return self.user_pool

    def getUserPoolClient(self):
        return self.user_pool_client

    def getIdentityPool(self):
        return self.identity_pool
