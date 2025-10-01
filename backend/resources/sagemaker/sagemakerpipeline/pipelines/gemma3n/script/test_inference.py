import base64
import os
import tarfile
import pathlib
import pytest
from unittest.mock import patch, MagicMock
from pprint import pprint

from src.inference import model_fn, predict_fn, input_fn, output_fn, InferenceInput, InferenceResponse

# Make sure you installed the required dependencies (src/requirements.txt)

def test_input_fn_valid_navigation_json():
    """Test input function with valid navigation JSON."""
    test_data = {
        "pipeline_type": "navigation",
        "image": "data:image/jpeg;base64,test_data",
        "nav_goal": "sidewalk"
    }
    json_data = InferenceInput(**test_data).model_dump_json()
    
    result = input_fn(json_data, "application/json")
    
    # Check that required fields are present and correct
    assert result["pipeline_type"] == "navigation"
    assert result["image"] == "data:image/jpeg;base64,test_data"
    assert result["nav_goal"] == "sidewalk"
    assert result["messages"] is None


def test_input_fn_valid_chat_json():
    """Test input function with valid chat JSON."""
    test_data = {
        "pipeline_type": "chat",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Hello, can you help me?"}
                ]
            }
        ]
    }
    json_data = InferenceInput(**test_data).model_dump_json()
    
    result = input_fn(json_data, "application/json")
    
    # Check that required fields are present and correct
    assert result["pipeline_type"] == "chat"
    assert result["messages"] == test_data["messages"]
    assert result["image"] is None
    assert result["nav_goal"] is None


def test_input_fn_invalid_content_type():
    """Test input function with invalid content type."""
    test_data = '{"pipeline_type": "navigation", "image": "test", "nav_goal": "sidewalk"}'
    
    with pytest.raises(ValueError) as exc_info:
        input_fn(test_data, "text/plain")
    
    assert "Content type must be application/json" in str(exc_info.value)


def test_input_fn_missing_navigation_fields():
    """Test input function with missing navigation fields."""
    invalid_data = {
        "pipeline_type": "navigation",
        "image": "test"
        # Missing nav_goal
    }
    json_data = InferenceInput(**invalid_data).model_dump_json()
    
    with pytest.raises(ValueError) as exc_info:
        input_fn(json_data, "application/json")
    
    assert "Navigation pipeline requires 'image' and 'nav_goal' fields" in str(exc_info.value)


def test_input_fn_missing_chat_fields():
    """Test input function with missing chat fields."""
    invalid_data = {
        "pipeline_type": "chat"
        # Missing messages
    }
    json_data = InferenceInput(**invalid_data).model_dump_json()
    
    with pytest.raises(ValueError) as exc_info:
        input_fn(json_data, "application/json")
    
    assert "Chat pipeline requires 'messages' field" in str(exc_info.value)


def test_input_fn_invalid_pipeline_type():
    """Test input function with invalid pipeline type."""
    invalid_data = {
        "pipeline_type": "invalid_type",
        "image": "test",
        "nav_goal": "sidewalk"
    }
    json_data = InferenceInput(**invalid_data).model_dump_json()
    
    with pytest.raises(ValueError) as exc_info:
        input_fn(json_data, "application/json")
    
    assert "Unknown pipeline_type: invalid_type" in str(exc_info.value)


def test_output_fn_valid():
    """Test output function with valid prediction."""
    prediction = "Go right to reach the sidewalk"
    
    result = output_fn(prediction, "application/json")
    
    expected = InferenceResponse(response=prediction).model_dump_json()
    assert result == expected


def test_output_fn_invalid_accept():
    """Test output function with invalid accept type."""
    prediction = "Go right to reach the sidewalk"
    
    with pytest.raises(ValueError) as exc_info:
        output_fn(prediction, "text/plain")
    
    assert "Accept type must be application/json" in str(exc_info.value)


@patch('src.inference.UnifiedPipeline')
def test_model_fn(mock_pipeline_class):
    """Test model_fn creates UnifiedPipeline correctly."""
    mock_pipeline = MagicMock()
    mock_pipeline_class.return_value = mock_pipeline
    
    result = model_fn("/path/to/model")
    
    mock_pipeline_class.assert_called_once_with("/path/to/model")
    assert result == mock_pipeline


@patch('src.inference.UnifiedPipeline')
def test_predict_fn_navigation(mock_pipeline_class):
    """Test predict_fn calls pipeline predict method for navigation."""
    mock_pipeline = MagicMock()
    mock_pipeline.predict.return_value = "Go right to reach the sidewalk"
    
    payload = {
        "pipeline_type": "navigation",
        "image": "data:image/jpeg;base64,test_data",
        "nav_goal": "sidewalk"
    }
    
    result = predict_fn(payload, mock_pipeline)
    
    mock_pipeline.predict.assert_called_once_with("navigation", image="data:image/jpeg;base64,test_data", nav_goal="sidewalk")
    assert result == "Go right to reach the sidewalk"


@patch('src.inference.UnifiedPipeline')
def test_predict_fn_chat(mock_pipeline_class):
    """Test predict_fn calls pipeline predict method for chat."""
    mock_pipeline = MagicMock()
    mock_pipeline.predict.return_value = "Hello! I'm here to help you."
    
    payload = {
        "pipeline_type": "chat",
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": "Hello"}]
            }
        ]
    }
    
    result = predict_fn(payload, mock_pipeline)
    
    expected_messages = [
        {
            "role": "user",
            "content": [{"type": "text", "text": "Hello"}]
        }
    ]
    mock_pipeline.predict.assert_called_once_with("chat", messages=expected_messages)
    assert result == "Hello! I'm here to help you."


def test_inference_input_validation_navigation():
    """Test InferenceInput validation for navigation."""
    # Valid navigation input
    valid_data = {
        "pipeline_type": "navigation",
        "image": "data:image/jpeg;base64,test_data",
        "nav_goal": "sidewalk"
    }
    input_obj = InferenceInput(**valid_data)
    assert input_obj.pipeline_type == "navigation"
    assert input_obj.image == valid_data["image"]
    assert input_obj.nav_goal == valid_data["nav_goal"]
    assert input_obj.messages is None


def test_inference_input_validation_chat():
    """Test InferenceInput validation for chat."""
    # Valid chat input
    valid_data = {
        "pipeline_type": "chat",
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": "Hello"}]
            }
        ]
    }
    input_obj = InferenceInput(**valid_data)
    assert input_obj.pipeline_type == "chat"
    assert input_obj.messages == valid_data["messages"]
    assert input_obj.image is None
    assert input_obj.nav_goal is None


def test_inference_response_validation():
    """Test InferenceResponse validation."""
    response_obj = InferenceResponse(response="Go right")
    assert response_obj.response == "Go right"
    
    # Test JSON serialization
    json_str = response_obj.model_dump_json()
    assert '"response":"Go right"' in json_str


def test_chat_multimodal_input_validation():
    """Test chat input with multiple modalities."""
    multimodal_data = {
        "pipeline_type": "chat",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Look at this image and tell me what you see."},
                    {"type": "image", "image": "data:image/jpeg;base64,test_image_data"},
                    {"type": "audio", "audio": "data:audio/wav;base64,test_audio_data"}
                ]
            },
            {
                "role": "assistant",
                "content": [
                    {"type": "text", "text": "I can see an image with various objects."}
                ]
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Can you describe it in more detail?"}
                ]
            }
        ]
    }
    
    input_obj = InferenceInput(**multimodal_data)
    assert input_obj.pipeline_type == "chat"
    assert len(input_obj.messages) == 3
    assert input_obj.messages[0]["role"] == "user"
    assert len(input_obj.messages[0]["content"]) == 3  # text, image, audio
    assert input_obj.image is None
    assert input_obj.nav_goal is None


def test_chat_simple_text_input():
    """Test chat input with simple text format."""
    simple_text_data = {
        "pipeline_type": "chat",
        "messages": [
            {
                "role": "user",
                "content": "Hello, how are you?"
            }
        ]
    }
    
    input_obj = InferenceInput(**simple_text_data)
    assert input_obj.pipeline_type == "chat"
    assert len(input_obj.messages) == 1
    assert input_obj.messages[0]["content"] == "Hello, how are you?"


def test_chat_legacy_format_input():
    """Test chat input with legacy format (separate fields)."""
    legacy_data = {
        "pipeline_type": "chat",
        "messages": [
            {
                "role": "user",
                "text": "What's in this image?",
                "images": ["data:image/jpeg;base64,test_data"],
                "audio": ["data:audio/wav;base64,audio_data"]
            }
        ]
    }
    
    input_obj = InferenceInput(**legacy_data)
    assert input_obj.pipeline_type == "chat"
    assert len(input_obj.messages) == 1
    assert "text" in input_obj.messages[0]
    assert "images" in input_obj.messages[0]