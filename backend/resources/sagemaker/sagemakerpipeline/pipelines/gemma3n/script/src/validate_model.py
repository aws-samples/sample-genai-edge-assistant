import base64
from functools import partial
import json
import os
import pathlib
import tarfile
import tempfile
from pathlib import Path
from pprint import pprint

from inference import model_fn, predict_fn, input_fn, output_fn

HERE = pathlib.Path(__file__).parent.absolute()

def get_base64_from_image(image_path: str) -> str:
    """Convert image file to base64 data URI format."""
    with open(image_path, 'rb') as img_file:
        b64_bytes = base64.b64encode(img_file.read())
        b64_str = b64_bytes.decode('utf-8')
        data_uri = f"data:image/jpeg;base64,{b64_str}"
    return data_uri

def get_base64_from_audio(audio_path: str) -> str:
    """Convert audio file to base64 data URI format."""
    with open(audio_path, 'rb') as audio_file:
        b64_bytes = base64.b64encode(audio_file.read())
        b64_str = b64_bytes.decode('utf-8')
        data_uri = f"data:audio/mp3;base64,{b64_str}"
    return data_uri

def untar_model_artifacts():
    """
    Extract model artifacts from tar.gz file.
    Returns the path to the extracted model directory.
    """
    
    # Check if running in SageMaker processing job environment
    input_dir = Path(os.environ.get("SM_PROCESSING_INPUT_DIR", "/opt/ml/processing/input"))
    model_input_dir = input_dir / "model"
    
    if model_input_dir.exists():
        # SageMaker processing job - extract model.tar.gz
        print("Running in SageMaker processing job environment")
        model_tar_path = model_input_dir / "model.tar.gz"
        if not model_tar_path.exists():
            # Look for any .tar.gz file
            tar_files = list(model_input_dir.glob("*.tar.gz"))
            if tar_files:
                model_tar_path = tar_files[0]
            else:
                raise RuntimeError(f"No model.tar.gz file found in {model_input_dir}")
        
        # Extract to temporary directory
        extract_dir = Path(tempfile.mkdtemp()) / "extracted_model"
        extract_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"Extracting model from {model_tar_path} to {extract_dir}")
        with tarfile.open(model_tar_path, 'r:gz') as tar:
            tar.extractall(path=extract_dir)
        
        return extract_dir
    else:
        # Local testing
        print("Running in local environment")
        artifacts_dir = HERE / "ARTIFACTS" / "model"
        if not artifacts_dir.exists():
            raise RuntimeError("ARTIFACTS directory does not exist. Please run the prepare_model_files.py script first.")
        return artifacts_dir

def validate_navigation_output_format(result):
    """Validate that the output matches the expected format for navigation."""
    # Expected format: {'response': 'string with navigation guidance'}
    if not isinstance(result, dict):
        raise ValueError(f"Expected dict output, got {type(result)}")
    
    if 'response' not in result:
        raise ValueError("Output dict must contain 'response' key")
    
    response = result['response']
    if not isinstance(response, str):
        raise ValueError(f"Response must be string, got {type(response)}")
    
    if len(response.strip()) == 0:
        raise ValueError("Response cannot be empty")
    
    # Check for navigation guidance keywords
    response_lower = response.lower()
    navigation_keywords = ['right', 'left', 'forward', 'no_action']
    found_keywords = [kw for kw in navigation_keywords if kw in response_lower]
    
    if not found_keywords:
        print("Warning: Response may not contain expected navigation guidance (no keywords detected)")
    else:
        print(f"✓ Found navigation keywords: {found_keywords}")
    
    print("✓ Navigation output format validation passed")
    return True


def validate_chat_output_format(result, descriptive_keywords):
    """Validate that the output matches the expected format for chat."""
    # Expected format: {'response': 'string with chat response'}
    if not isinstance(result, dict):
        raise ValueError(f"Expected dict output, got {type(result)}")
    
    if 'response' not in result:
        raise ValueError("Output dict must contain 'response' key")
    
    response = result['response']
    if not isinstance(response, str):
        raise ValueError(f"Response must be string, got {type(response)}")
    
    if len(response.strip()) == 0:
        raise ValueError("Response cannot be empty")
    
    # Check for descriptive content (chat responses should be descriptive)
    response_lower = response.lower()
    found_keywords = [kw for kw in descriptive_keywords if kw in response_lower]
    
    if not found_keywords:
        print("Warning: Response may not contain expected descriptive content (no keywords detected)")
    else:
        print(f"✓ Found descriptive keywords: {found_keywords}")
    
    print("✓ Chat output format validation passed")
    return True

def run_test(pipeline, input_data, validator_fn):
    """Run a single test through the full pipeline."""
    json_input = json.dumps(input_data)
    parsed_input = input_fn(json_input, "application/json")
    prediction = predict_fn(parsed_input, pipeline)
    final_output = output_fn(prediction, "application/json")
    result = json.loads(final_output)
    validator_fn(result)
    return result

def test_navigation_use_case(pipeline):
    """Test navigation use case with different scenarios."""
    print("\n" + "="*60)
    print("TESTING NAVIGATION USE CASE")
    print("="*60)
    
    # Test 1: Basic navigation
    print("1. Testing basic navigation...")
    input_data = {
        "task": "navigation",
        "payload": {
            "image": get_base64_from_image(HERE / "data" / "samples" / "sidewalk.jpg"),
            "goal": "sidewalk"
        }
    }
    
    result = run_test(pipeline, input_data, validate_navigation_output_format)
    print("✓ Navigation test passed")
    
    print("\nNAVIGATION RESULT:")
    pprint(result)
    # {'response': 'The image shows a street scene with a sidewalk running along the '
    #          "right side of the frame. On the left side, there's a set of "
    #          'outdoor stairs leading up to a building with a black iron '
    #          'railing and a stone facade. The stairs have a decorative black '
    #          'iron railing with geometric patterns. \n'
    #          '\n'
    #          'The sidewalk is made of concrete and is relatively wide. There '
    #          'are two parked cars along the right side of the sidewalk. One is '
    #          'a silver station wagon and the other is a gray sedan. A tree '
    #          'with a thick trunk is growing in the middle of the sidewalk, '
    #          "slightly to the right of the center. There's a small stone "
    #          'pathway around the base of the tree. \n'
    #          '\n'
    #          'The overall scene appears to be a typical urban environment. \n'
    #          '\n'
    #          'To reach the sidewalk, you should go **forward**. The stairs on '
    #          'the left lead to a higher level, so you need to proceed forward '
    #          'to access the sidewalk.'}
    

def test_chat_use_case(pipeline):
    """Test chat use case with different scenarios."""
    print("\n" + "="*60)
    print("TESTING CHAT USE CASE")
    print("="*60)
    
    results = []
    
    # Test 1: Text and image
    print("1. Testing chat with text and image...")
    input_data = {
        "task": "chat",
        "payload": {
            "content": [
                {
                    "type": "image",
                    "value": get_base64_from_image(HERE / "data" / "samples" / "sidewalk.jpg")
                },
                {
                    "type": "text",
                    "value": "What do you see in this image? Describe it in detail."
                }
            ]
        }
    }
    
    result = run_test(pipeline, input_data, partial(validate_chat_output_format, descriptive_keywords=['see', 'image', 'shows', 'appears', 'visible', 'contains', 'depicts']))
    print("✓ Chat text+image test passed")
    print("RESULT:")
    pprint(result)
    # {'response': 'The image shows a street scene on a sunny day. The main focus is '
    #          'on a sidewalk next to a building with a staircase leading up to '
    #          'it. \n'
    #          '\n'
    #          "On the left side of the image, there's a light-colored building "
    #          'with a dark metal railing and a black metal staircase with '
    #          'decorative geometric patterns on the railings. The staircase has '
    #          'a few steps visible, and the railing is attached to the side of '
    #          'the building. \n'
    #          '\n'
    #          "To the right of the staircase, there's a narrow sidewalk made of "
    #          'concrete. A large tree trunk is growing in the middle of the '
    #          'sidewalk, with its roots visible near the base. \n'
    #          '\n'
    #          'Parked along the right side of the sidewalk are two silver cars. '
    #          'The car closer to the viewer is a station wagon, and the one '
    #          'behind it is also a station wagon. \n'
    #          '\n'
    #          'In the background, there are more trees and some people walking '
    #          'on the sidewalk. The overall scene is typical of a residential '
    #          'street in an urban area.'}
    
    # Test 2: Audio only
    print("\n2. Testing chat with audio only...")
    input_data = {
        "task": "chat",
        "payload": {
            "content": [
                {
                    "type": "audio",
                    "value": get_base64_from_audio(HERE / "data" / "samples" / "project_description.mp3")
                }
            ]
        }
    }
    
    result = run_test(pipeline, input_data, partial(validate_chat_output_format, descriptive_keywords=['prototype', 'showcases', 'foundation', 'models', 'revolutionize', 'care', 'assist', 'visually', 'impaired']))
    print("✓ Chat audio-only test passed")
    print("RESULT:")
    pprint(result)
    # {'response': 'This is a fascinating concept! It sounds like a really '
    #          'innovative approach to helping visually impaired people. \n'
    #          '\n'
    #          "Here's what I gather from the description:\n"
    #          '\n'
    #          '* **Foundation Models for Revolutionizing Care:** The core idea '
    #          'is to use powerful AI models (foundation models) to improve care '
    #          'for visually impaired individuals.\n'
    #          '* **Alerting to Dangerous Situations:** The system specifically '
    #          'focuses on detecting and alerting users to potentially hazardous '
    #          'situations. This is incredibly valuable for safety and '
    #          'independence.\n'
    #          '* **Edge and Cloud Computing:**  The system utilizes both '
    #          'on-device processing (at the "edge") and cloud-based processing '
    #          '(on Amazon SageMaker). This offers flexibility and potentially '
    #          'faster response times for critical alerts while also allowing '
    #          'for more complex analysis and data storage.\n'
    #          '\n'
    #          '**Overall, it sounds like a very promising application of AI!**  '
    #          'The ability to proactively identify dangers and provide timely '
    #          'alerts could significantly enhance the quality of life for '
    #          'visually impaired individuals. \n'
    #          '\n'
    #          "It's great to see technology being used in such a meaningful way "
    #          'to support accessibility and safety.\n'
    #          '\n'
    #          '\n'
    #          '\n'
    #          'Do you have any specific questions about this prototype that I '
    #          "can try to help you with? Perhaps you'd like me to elaborate on "
    #          "any of the points, or you have a particular aspect you'd like to "
    #          'discuss?\n'
    #          '\n'
    #          '\n'
    #          '\n'}
    
    # Test 3: Audio and image
    print("\n3. Testing chat with audio and image...")
    input_data = {
        "task": "chat",
        "payload": {
            "content": [
                {
                    "type": "audio",
                    "value": get_base64_from_audio(HERE / "data" / "samples" / "goal_house.mp3")
                },
                {
                    "type": "image",
                    "value": get_base64_from_image(HERE / "data" / "samples" / "sidewalk.jpg")
                }
            ]
        }
    }
    
    result = run_test(pipeline, input_data, partial(validate_chat_output_format, descriptive_keywords=['house', 'left', 'tree', 'stairs']))
    print("✓ Chat audio+image test passed")
    print("RESULT:")
    pprint(result)
    # {'response': 'The house is on the left. There are stairs leading up to the '
    #          'entrance. There is a tree growing next to the stairs on the '
    #          'right side. There is a black railing along the side of the '
    #          'stairs. There are parked cars on the street.'}
    
    # Test 4: Text, audio and image
    print("\n4. Testing chat with text, audio and image...")
    input_data = {
        "task": "chat",
        "payload": {
            "content": [
                {
                    "type": "text",
                    "value": "First transcribe the audio within <transcript> tags. Then do what the audio is telling you."
                },
                {
                    "type": "audio",
                    "value": get_base64_from_audio(HERE / "data" / "samples" / "goal_house.mp3")
                },
                {
                    "type": "image",
                    "value": get_base64_from_image(HERE / "data" / "samples" / "sidewalk.jpg")
                }
            ]
        }
    }
    
    result = run_test(pipeline, input_data, partial(validate_chat_output_format, descriptive_keywords=['house', 'left', 'tree', 'stairs']))
    print("✓ Chat multimodal test passed")
    print("RESULT:")
    pprint(result)
    # {'response': '<transcript>I think my house is on the left. How can I enter it? '
    #          'Are there any obstacles?</transcript>\n'
    #          'The image shows a street scene with a house on the left. The '
    #          'house has a set of stairs leading up to the entrance. There is a '
    #          'tree growing next to the sidewalk, and a parked car is on the '
    #          'street. There are some metal railings along the side of the '
    #          'stairs. The sidewalk is made of concrete and there are some '
    #          'cobblestones near the base of the tree.'}
    
    # Test 5: Audio transcription with explicit text prompt
    print("\n5. Testing audio transcription...")
    input_data = {
        "task": "chat",
        "payload": {
            "content": [
                {
                    "type": "audio",
                    "value": get_base64_from_audio(HERE / "data" / "samples" / "project_description.mp3")
                },
                {
                    "type": "text",
                    "value": "Transcribe this audio"
                }
            ]
        }
    }
    
    result = run_test(pipeline, input_data, partial(validate_chat_output_format, descriptive_keywords=['prototype', 'showcases', 'foundation', 'models', 'revolutionize', 'care', 'assist', 'visually', 'impaired']))
    print("✓ Audio transcription test passed")
    print("\nTRANSCRIPTION RESULT:")
    pprint(result)
    # {'response': 'This prototype showcases how foundation models can revolutionize '
    #          'care and assist the visually impaired by alerting dangerous '
    #          'situations. It runs machine learning models both at the edge and '
    #          'in Amazon SageMaker, giving both options. What do you think '
    #          'about it?'}
    

def create_sample_payload(navigation_input_data, chat_input_data):
    """
    Create a single sample payload archive for SageMaker Inference Recommender.
    This payload will contain both navigation and chat examples and be used during 
    model registration to enable inference recommendations.
    """
    # Get output directory (SageMaker processing job or local)
    output_dir = Path(os.environ.get("SM_PROCESSING_OUTPUT_DIR", "/opt/ml/processing/output"))
    
    # Get sample payload filename from environment variable (set by SageMaker pipeline)
    sample_payload_filename = os.environ.get("SAMPLE_PAYLOAD_FILENAME", "gemma3n_sample_payload.tar.gz")
    
    # Create sample payload directory
    payload_dir = output_dir / "sample-payload"
    payload_dir.mkdir(parents=True, exist_ok=True)
    
    # Create navigation sample input file
    navigation_input_file = payload_dir / "sample_input_navigation.json"
    with open(navigation_input_file, 'w') as f:
        json.dump(navigation_input_data, f, indent=2)
    
    # Create chat sample input file
    chat_input_file = payload_dir / "sample_input_chat.json"
    with open(chat_input_file, 'w') as f:
        json.dump(chat_input_data, f, indent=2)
    
    # Create the payload archive with both samples
    payload_archive_path = output_dir / sample_payload_filename
    
    with tarfile.open(payload_archive_path, 'w:gz') as tar:
        tar.add(navigation_input_file, arcname="sample_input_navigation.json")
        tar.add(chat_input_file, arcname="sample_input_chat.json")
    
    print(f"Sample payload archive created at: {payload_archive_path}")
    print("  - Contains: sample_input_navigation.json")
    print("  - Contains: sample_input_chat.json")
    
    # Create comprehensive metadata file with both pipeline types
    payload_metadata = {
        "payload_archive": sample_payload_filename,
        "content_type": "application/json",
        "model_type": "gemma3n_foundation_model",
        "supported_pipelines": ["navigation", "chat"],
        "sample_description": "Gemma3n foundation model sample inputs for both navigation and chat use cases",
        "samples": {
            "navigation": {
                "file": "sample_input_navigation.json",
                "description": "Navigation model sample input with base64 image and navigation goal",
                "input_format": {
                    "pipeline_type": "navigation",
                    "image": "base64 encoded image data URI",
                    "nav_goal": "string describing navigation target (e.g., 'sidewalk')"
                }
            },
            "chat": {
                "file": "sample_input_chat.json", 
                "description": "Chat model sample input with multimodal messages",
                "input_format": {
                    "pipeline_type": "chat",
                    "messages": "array of message objects with role and content (text, image, audio)"
                }
            }
        }
    }
    
    metadata_file = output_dir / "payload_metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(payload_metadata, f, indent=2)
    
    print(f"Payload metadata saved at: {metadata_file}")
    return str(payload_archive_path)


def run_full_pipeline_test(artifacts_dir: str, create_payload: bool = True):
    """
    Run the full pipeline test for navigation and chat use cases.
    
    Args:
        artifacts_dir: Path to the model artifacts directory
        create_payload: Whether to create sample payload (default True for SageMaker, False for local testing)
    
    Returns:
        tuple: (navigation_results, chat_results)
    """
    print("Testing full inference pipeline...")
    
    # Load model
    print("Loading model...")
    pipeline = model_fn(artifacts_dir)
    print("✓ Model loaded successfully")
    
    # Test navigation use case
    navigation_results = test_navigation_use_case(pipeline)
    
    # Test chat use case  
    chat_results = test_chat_use_case(pipeline)
    
    print("\n" + "="*60)
    print("✓ All tests passed! Navigation and chat use cases working correctly.")
    print("="*60)
    
    # Create sample payload if requested
    if create_payload:
        print("\nCreating sample payload for inference recommendations...")
        navigation_sample = {
            "task": "navigation",
            "payload": {
                "image": get_base64_from_image(HERE / "data" / "samples" / "sidewalk.jpg"),
                "goal": "sidewalk"
            }
        }
        chat_sample = {
            "task": "chat",
            "payload": {
                "content": [
                    {
                        "type": "image",
                        "value": get_base64_from_image(HERE / "data" / "samples" / "sidewalk.jpg")
                    },
                    {
                        "type": "text",
                        "value": "What do you see in this image? Describe it in detail."
                    }
                ]
            }
        }
        create_sample_payload(navigation_sample, chat_sample)
        print("✓ Sample payload created successfully")


# Requirements:
# - You have the local artifacts for the model (have ran 'python prepare_model_files.py')
# - Make sure you've installed the dependencies in requirements.txt with 'pip install -r src/requirements.txt'

if __name__ == "__main__":
    HERE = pathlib.Path(__file__).parent.absolute()
    
    # Always untar model artifacts first
    ARTIFACTS_DIR = untar_model_artifacts()
    
    # Run the full pipeline test with payload creation (includes all audio tests)
    run_full_pipeline_test(str(ARTIFACTS_DIR), create_payload=True)
