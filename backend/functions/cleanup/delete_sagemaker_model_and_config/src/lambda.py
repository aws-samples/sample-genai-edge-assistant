import boto3


def handler(event, context):
    sagemaker = boto3.client("sagemaker", region_name=event["region"])
    action = event["action"]
    prefix = event["prefix"]

    if action == "DELETE_ENDPOINT_CONFIGS":
        paginator = sagemaker.get_paginator("list_endpoint_configs")
        for page in paginator.paginate(NameContains=prefix):
            for config in page["EndpointConfigs"]:
                try:
                    sagemaker.delete_endpoint_config(
                        EndpointConfigName=config["EndpointConfigName"]
                    )
                    print(f"Deleted endpoint config: {config['EndpointConfigName']}")
                except Exception as e:
                    print(
                        f"Error deleting endpoint config {config['EndpointConfigName']}: {str(e)}"
                    )

    elif action == "DELETE_MODELS":
        paginator = sagemaker.get_paginator("list_models")
        for page in paginator.paginate(NameContains=prefix):
            for model in page["Models"]:
                try:
                    sagemaker.delete_model(ModelName=model["ModelName"])
                    print(f"Deleted model: {model['ModelName']}")
                except Exception as e:
                    print(f"Error deleting model {model['ModelName']}: {str(e)}")

    return {"statusCode": 200}
