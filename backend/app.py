import os

import cdk_nag
from aws_cdk import App, Aspects, Environment

import shared.shared_variables as shared_variables
from backend.main import MyStack

# for development, use account/region from cdk cli
dev_env = Environment(
    account=os.getenv("CDK_DEFAULT_ACCOUNT"), region=os.getenv("CDK_DEFAULT_REGION")
)

app = App()

# Change the stack name variable directly in the shared_variables.py file
MyStack(app, shared_variables.STACK_NAME, env=dev_env)
# MyStack(app, shared_variables.STACK_NAME, env=prod_env)

# Aspects.of(app).add(cdk_nag.AwsSolutionsChecks(verbose=False))


app.synth()
