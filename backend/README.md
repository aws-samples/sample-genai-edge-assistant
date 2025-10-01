# Backend deployment 

To deploy the backend you have 2 options: 

1. Deploy using the Amplify build system (recommended).
2. Deploy the stack manually.

> If you followed the instructions from the main [README.md](../README.md), you already deployed using option 1. and you can skip this whole README.

## 1. Deploy using the Amplify build system (recommended)

When you configured Amplify with the instructions from the main [README.md](../README.md), the Amplify build system run the commands from [amplify.yml](../amplify.yml), hence the CDK template was deployed automatically and the SageMaker Pipelines too. 

If you want to understand more in details what happens and run the commands manually for testing CDK, deploying the models manually, or other reason, check out section 2. below.

## 2. Deploying the stack manually

### If you are using AWS Amplify to deploy the frontend

**You need to deploy the backend after frontend is deployed as an Amplify application.** This is due to the fact that pushing environment variable to Amplify is automated but only available after app creation.

To manually deploy, execute the commands in [amplify.yml](../amplify.yml) for the "backend" section.

Install the [requirements](./requirements.txt) in a virtual environment:

```
cd resources
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

To launch the CDK deployment from this directory:
```
PYTHONPATH=./shared/ cdk deploy --context amplify_app_id=YOUR!AMPLIFY!APP!ID
```

It will populate the infrastructure. Modifications will be applied to the Amplify application: new environment variables will be added. 

SageMaker pipelines for on the edge models are created by a boto3 script after CDK deployment. 
To launch resources creation **after** having deployed the CDK stack:
```
PYTHONPATH=./shared/ python ./backend/sagemaker/sagemakerpipeline/pipelines_resources_creation.py
```

### If you run your frontend locally or deploy it without using AWS Amplify

You are not hosting the frontend on Amplify or are running it locally, you can deploy the infrastructure and skip Amplify related operations:
```
PYTHONPATH=./shared/ cdk deploy --context no_amplify=y
```

**In this mode, by default, it does not restrict the API Gateway or S3 buckets CORS Allow-Origin policy. You need to modify by yourself the allowed resources by editing the `CUSTOM_ALLOWED_RESOURCES` variable in the file [main.py](./backend/main.py).**
You will need to manually edit your frontend environment variables as explained in the README.md of the frontend repository. 

SageMaker pipelines for on the edge models are created by a boto3 script **after** CDK deployment. 
To launch resources creation after having deployed the CDK stack:
```
PYTHONPATH=./shared/ python ./backend/sagemakerpipeline/pipelines_resources_creation.py
```

## Deploying edge machine learning models 

This application uses machine learning models running on the edge to power core features. As per now, 5 models are in use by the frontend. These 5 models are `depth`, `tts`, `vocoder`, `image-captioning` and `object-detection`. They are stored in a S3 bucket created by the CDK stack: `vis-assis-model-artifacts-production-{AWS_ACCOUNT_ID}`. The bucket needs to have this structure to integrate with the frontend: 

```
/
├─ depth/
│  ├─ modelxxxx-....
├─ tts/
│  ├─ modelxxxx-....
├─ vocoder/
│  ├─ modelxxxx-....
├─ image-captioning/
│  ├─ modelxxxx-....
├─ object-detection/
│  ├─ modelxxxx-....
```

Let's deploy the models using SageMaker pipelines.

### Deploy models using SageMaker pipelines

> **Warning**: Before deploying the models, please ensure you have checked the [license file](../MODELS.md) for each model to comply with the terms and conditions of use.

The pipeline creation scripts creates one pipeline per model. These pipelines contains all the steps along EventBridge rules to download, pack and push the models to the S3 bucket ready for use. Here is the workflow you need to handle: 
- Connect to the SageMaker studio console
- Navigate on the right menu to the `Pipelines` section
- Choose the `depth` pipeline
- Click on the `Execute` button
- Fill the job name -- do not modify other parameters unless you know what you do

Once the pipeline is fully executed, the model will be registered in the associated model registry. Model is also stored in another S3 bucket holding all SageMaker outputs `vis-assis-model-sagemaker-output-{AWS_ACCOUNT_ID}`. **If you launch multiple executions, storage costs can increase as each model version is saved and registered**.  
- Navigate on the right menu to the `Models` section 
- There you can see all the model package groups and the model version they contain. Choose the depth model package group
- The model version resulting of pipeline execution is "Pending approval". Once you change its state to "Approved" it will trigger an EventBridge rule which will push model to the `vis-assis-model-artifacts-production-{AWS_ACCOUNT_ID}` bucket under right prefix and right name. Frontend is designed to use only the latest model version for each category. 

Here you go your model is deployed! Now you can repeat these steps for each of the 4 remaining pipelines or automate them the way you want. 

The idea behind SageMaker pipelines is to make it easy for you to change the models, add training on custom data, etc. You can change the pipeline steps in the [sagemakerpipeline](./backend/sagemaker/sagemakerpipeline/) subdirectories and files. 

### Deploy models manually

If you do not want to use the pipelines - for cost concerns or other related issues - you can manually download, pack and upload models to the `vis-assis-model-artifacts-production-{AWS_ACCOUNT_ID}` bucket. Models are downloaded from Huggingface. 

```
huggingface-cli download onnx-community/depth-anything-v2-small 
huggingface-cli download xenova/vit-gpt2-image-captioning 
huggingface-cli download xenova/speecht5_tts 
huggingface-cli download xenova/yolov9-c_all 
huggingface-cli download xenova/speecht5_hifigan 
```

You will need to pack each model to a .zip file and upload each file to the bucket, respecting the aforementioned structure. Model files names do not matter (i.e. under `depth` prefix, you can name your file `depth_model.zip` or `helloworld.zip`). 

## Deploying SageMaker real-time inference endpoint for navigation mode 

The application takes advantage of a real-time inference endpoint for the navigation use case. **This endpoint can be costly.** If you want to reduce costs, you can scale down the instance type hosting the endpoint. 
The model in use for the project is [Google's PaliGemma](https://ai.google.dev/gemma/docs/paligemma). 

The PaLiGemma endpoint is automatically created or updated when you upload a model file to the S3 bucket `vis-assis-sagemaker-endpoint-model-{AWS_ACCOUNT_ID}`. The process works as follows:

1. Follow the instructions in the [python notebook](./backend/sagemaker/sagemakerendpoint/prepare_model/prepare_paligemma.ipynb) 
2. Upload your compressed model file to `s3://vis-assis-sagemaker-endpoint-model-{account-id}/paligemma/model.tar.gz`
3. This triggers a Lambda function that will:
    - Create a new SageMaker model using the uploaded file
    - Create a new endpoint configuration with data capture enabled
    - Create the endpoint if it doesn't exist, or update it if it already exists
    - Set up auto-scaling (1-2 instances) if the endpoint is newly created

Additionally, the following Lambda functions are used:

- **Update model Lambda function**: This function is responsible for updating the SageMaker model and endpoint. It requires permissions to create and update SageMaker models and endpoints, as well as permissions to read from the S3 bucket where the model file is stored.

- **Setup autoscaling Lambda function**: This function is responsible for setting up auto-scaling for the SageMaker endpoint. It requires permissions to register scalable targets, put scaling policies, and create CloudWatch alarms.

## 3. Backend resources destruction

**By default, NO resources are kept after backend destruction. This is to avoid remains conflicts and unforecasted costs. If you want to keep S3 buckets files, SageMaker models,... you shall make saves by yourself or adapt the CDK stack and deletion script retention policies.**

First, you need to delete the SageMaker pipelines and models which are not part of the CDK stack. Destroying the stack without deleting these resources first will result in a FAILED_STATE.
Start by running: 

```
PYTHONPATH=./shared/ python ./resources/sagemaker/sagemakerpipeline/pipelines_resources_deletion.py
```

Once this is done and the output does not raise any exception, you can delete the CDK stack:

```
PYTHONPATH=./shared/ cdk deploy --context amplify_app_id=YOUR!AMPLIFY!APP!ID
```

OR (for non-Amplify deployments)
```
PYTHONPATH=./shared/ cdk deploy --context no_amplify=y
```