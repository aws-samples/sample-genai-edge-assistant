
import base64
import json
import os
import time

import boto3

def get_base64_from_image(image_path: str) -> str:
    with open(image_path, 'rb') as img_file:
        b64_bytes = base64.b64encode(img_file.read())
        b64_str = b64_bytes.decode('utf-8')
        data_uri = f"data:image/jpeg;base64,{b64_str}"
    return data_uri

def make_prompt_return_string(prompt_img, img_data):
    payload = {
        "prompt": prompt_img,
        "image": img_data,
    }
    payload = json.dumps(payload)

    response = client.invoke_endpoint(
        EndpointName=endpoint_name, ContentType=content_type, Body=payload
    )

    return response["Body"].read().decode("utf-8").split("\\n")[1].split('"}')[0]


# def get_base64_from_image(input_img_path):
#     with open(input_img_path, "rb") as f:
#         input_img_image_bytes = f.read()

#     return base64.b64encode(bytearray(input_img_image_bytes)).decode()



if __name__=="__main__":
    HERE = pathlib.Path(__file__).parent.absolute()

    payload = {
        "prompt_1":"Is there a massive and red carpet on the image?",
        "prompt_2":"If the taken picture was a human being vision, would he already be standing on the red carpet?",
        "prompt_3":"You have perfect vision and pay great attention to detail which makes you an expert at recognizing the direction in which objects are going in images.You are provided with pictures taken from a camera, all that is in the upper part of the image is further away. You do not need to perform text analysis on the image.You always want to move further away from your original location and follow the red carpet. What is the direction of the red carpet in the picture? Before providing the answer think step by step and analyze every part and object of the image.",
        "prompt_4":"Where do I need to move to reach the carpet:Left, Right, Forward?",
        "image_data": get_base64_from_image(HERE.parent / "test_data" / "sidewalk.jpg")
    }

    client = boto3.client("sagemaker-runtime")
    endpoint_name = os.environ["ENDPOINT_NAME"]
    content_type = "application/json"


    if not event or not event.get("body"):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid request body"}),
        }

    try:
        event = json.loads(event.get("body", {}))
    except json.JSONDecodeError:
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid JSON"})}

    # Validate required fields
    required_fields = ["image_data", "prompt_1", "prompt_2", "prompt_3", "prompt_4"]
    for field in required_fields:
        if field not in event:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": f"Missing required field: {field}"}),
            }

    image_data = event["image_data"].split("base64,")[1].replace('"}', "")
    prompt_1 = event["prompt_1"]
    prompt_2 = event["prompt_2"]
    prompt_3 = event["prompt_3"]
    prompt_4 = event["prompt_4"]

    start_time = time.time()

    response_to_prompt = make_prompt_return_string(prompt_1, image_data)
    response_to_prompt_2 = ""
    response_to_prompt_3 = ""

    if response_to_prompt == "yes":
        response_to_prompt_2 = make_prompt_return_string(prompt_2, image_data)

    if response_to_prompt_2 == "yes":
        response_to_prompt_3 = make_prompt_return_string(prompt_3, image_data)
    elif response_to_prompt_2 == "no":
        response_to_prompt_3 = make_prompt_return_string(prompt_4, image_data)

    end_time = time.time()
    elapsed_time = end_time - start_time
    print(
        f"{elapsed_time:<15.3f} {response_to_prompt:<20} {response_to_prompt_2:<20} {response_to_prompt_3:<20}"
    )
