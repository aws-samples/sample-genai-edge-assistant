# Gemma3n Model Development

Local development environment for the Gemma3n foundation model. Uses production code from `../../sagemakerpipeline/pipelines/gemma3n/`.

## Setup & Usage

1. **Install dependencies**: `pip install -r ../../sagemakerpipeline/pipelines/gemma3n/script/src/requirements.txt`
2. **Add HF token**: Create `.env` with `HF_TOKEN=your_token` under `model_dev/.env`
3. **Prepare model**: `python prepare_model_files.py`
4. **Test locally**: `python test_model.py`
5. **Deploy test endpoint**: `python test_model_endpoint_deploy.py`
6. **Predict with Test endpoint**: `python test_model_endpoint_predict.py`

The model supports both navigation and chat use cases.