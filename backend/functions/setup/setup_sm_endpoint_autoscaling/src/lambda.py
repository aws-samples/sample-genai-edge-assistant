import os

import boto3
from botocore.exceptions import ClientError

# sagemaker_client = boto3.client("sagemaker")
application_autoscaling_client = boto3.client("application-autoscaling")


def handler(event, context):
    print(f"{event=}")
    # Extract endpoint name from the event
    if "detail" not in event or "EndpointName" not in event["detail"]:
        raise ValueError("Missing endpoint name in event")

    endpoint_name = event["detail"]["EndpointName"]
    endpoint_status = event["detail"]["EndpointStatus"]

    # Only proceed if endpoint is "IN_SERVICE"
    if endpoint_status != "IN_SERVICE":
        print(
            f"Endpoint {endpoint_name} is not in service (current status: {endpoint_status})"
        )
        return

    try:
        setup_auto_scaling(endpoint_name)
        return {
            "statusCode": 200,
            "body": f"Successfully set up auto-scaling for endpoint {endpoint_name}",
        }
    except ClientError as e:
        if e.response["Error"]["Code"] == "ValidationException":
            print(f"Auto-scaling already set up for endpoint {endpoint_name}")
            return {
                "statusCode": 200,
                "body": f"Auto-scaling already configured for endpoint {endpoint_name}",
            }
        raise


def setup_auto_scaling(endpoint_name):
    resource_id = f"endpoint/{endpoint_name}/variant/AllTraffic"

    application_autoscaling_client.register_scalable_target(
        ServiceNamespace="sagemaker",
        ResourceId=resource_id,
        ScalableDimension="sagemaker:variant:DesiredInstanceCount",
        MinCapacity=1,
        MaxCapacity=2,
    )

    application_autoscaling_client.put_scaling_policy(
        PolicyName="SageMakerScalingPolicy",
        ServiceNamespace="sagemaker",
        ResourceId=resource_id,
        ScalableDimension="sagemaker:variant:DesiredInstanceCount",
        PolicyType="TargetTrackingScaling",
        TargetTrackingScalingPolicyConfiguration={
            "TargetValue": 10.0,
            "PredefinedMetricSpecification": {
                "PredefinedMetricType": "SageMakerVariantInvocationsPerInstance"
            },
            "ScaleInCooldown": 300,
            "ScaleOutCooldown": 300,
        },
    )
