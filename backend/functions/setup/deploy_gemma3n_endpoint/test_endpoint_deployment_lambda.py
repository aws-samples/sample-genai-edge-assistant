import pytest
from unittest.mock import Mock, patch
import sys
import os
from botocore.exceptions import ClientError

# Add src directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from endpoint_deployment_lambda import handler


def test_handler_missing_parameters():
    """Test handler with missing required parameters"""
    event = {"endpoint_name": "test-endpoint"}
    context = Mock()
    
    with pytest.raises(ValueError, match="Missing required parameters"):
        handler(event, context)


@patch('endpoint_deployment_lambda.boto3.client')
def test_handler_creates_new_endpoint(mock_boto_client):
    """Test successful new endpoint creation"""
    mock_sagemaker = Mock()
    mock_boto_client.return_value = mock_sagemaker
    
    # Mock responses
    mock_sagemaker.describe_model_package.return_value = {
        "CustomerMetadataProperties": {"model_name": "test-model"}
    }
    mock_sagemaker.create_endpoint_config.return_value = None
    mock_sagemaker.create_endpoint.return_value = None
    mock_sagemaker.describe_endpoint.return_value = {
        "EndpointStatus": "InService"
    }
    
    event = {
        "model_package_arn": "arn:aws:sagemaker:us-east-1:123456789012:model-package/test-package",
        "endpoint_name": "test-endpoint"
    }
    context = Mock()
    context.get_remaining_time_in_millis.return_value = 60000  # 60 seconds remaining
    
    handler(event, context)
    
    mock_sagemaker.describe_model_package.assert_called_once()
    mock_sagemaker.create_endpoint_config.assert_called_once()
    mock_sagemaker.create_endpoint.assert_called_once()
    mock_sagemaker.describe_endpoint.assert_called_once()
    mock_sagemaker.update_endpoint.assert_not_called()


@patch('endpoint_deployment_lambda.boto3.client')
def test_handler_updates_existing_endpoint(mock_boto_client):
    """Test endpoint update when endpoint already exists"""
    mock_sagemaker = Mock()
    mock_boto_client.return_value = mock_sagemaker
    
    # Mock responses
    mock_sagemaker.describe_model_package.return_value = {
        "CustomerMetadataProperties": {"model_name": "test-model"}
    }
    mock_sagemaker.create_endpoint_config.return_value = None
    mock_sagemaker.create_endpoint.side_effect = ClientError(
        error_response={"Error": {"Code": "ValidationException", "Message": "Cannot create already existing endpoint"}},
        operation_name="CreateEndpoint"
    )
    mock_sagemaker.update_endpoint.return_value = None
    mock_sagemaker.describe_endpoint.return_value = {
        "EndpointStatus": "InService"
    }
    
    event = {
        "model_package_arn": "arn:aws:sagemaker:us-east-1:123456789012:model-package/test-package",
        "endpoint_name": "test-endpoint"
    }
    context = Mock()
    context.get_remaining_time_in_millis.return_value = 60000  # 60 seconds remaining
    
    handler(event, context)
    
    mock_sagemaker.create_endpoint_config.assert_called_once()
    mock_sagemaker.create_endpoint.assert_called_once()
    mock_sagemaker.update_endpoint.assert_called_once()
    mock_sagemaker.describe_endpoint.assert_called_once()


@patch('endpoint_deployment_lambda.boto3.client')
def test_handler_with_custom_parameters(mock_boto_client):
    """Test handler with custom instance type and count"""
    mock_sagemaker = Mock()
    mock_boto_client.return_value = mock_sagemaker
    
    mock_sagemaker.describe_model_package.return_value = {
        "CustomerMetadataProperties": {"model_name": "test-model"}
    }
    mock_sagemaker.create_endpoint_config.return_value = None
    mock_sagemaker.create_endpoint.return_value = None
    mock_sagemaker.describe_endpoint.return_value = {
        "EndpointStatus": "InService"
    }
    
    event = {
        "model_package_arn": "arn:aws:sagemaker:us-east-1:123456789012:model-package/test-package",
        "endpoint_name": "test-endpoint",
        "instance_type": "ml.g5.2xlarge",
        "initial_instance_count": 2
    }
    context = Mock()
    context.get_remaining_time_in_millis.return_value = 60000  # 60 seconds remaining
    
    handler(event, context)
    
    # Verify custom parameters were used
    create_config_call = mock_sagemaker.create_endpoint_config.call_args
    production_variants = create_config_call[1]["ProductionVariants"]
    assert production_variants[0]["InstanceType"] == "ml.g5.2xlarge"
    assert production_variants[0]["InitialInstanceCount"] == 2


@patch('endpoint_deployment_lambda.boto3.client')
def test_handler_timeout_scenario(mock_boto_client):
    """Test handler when lambda is about to timeout"""
    mock_sagemaker = Mock()
    mock_boto_client.return_value = mock_sagemaker
    
    mock_sagemaker.describe_model_package.return_value = {
        "CustomerMetadataProperties": {"model_name": "test-model"}
    }
    mock_sagemaker.create_endpoint_config.return_value = None
    mock_sagemaker.create_endpoint.return_value = None
    
    event = {
        "model_package_arn": "arn:aws:sagemaker:us-east-1:123456789012:model-package/test-package",
        "endpoint_name": "test-endpoint"
    }
    context = Mock()
    context.get_remaining_time_in_millis.return_value = 20000  # 20 seconds remaining (less than buffer)
    
    handler(event, context)
    
    # Should not call describe_endpoint due to timeout
    mock_sagemaker.describe_endpoint.assert_not_called()


@patch('endpoint_deployment_lambda.boto3.client')
def test_handler_failed_endpoint(mock_boto_client):
    """Test handler when endpoint fails"""
    mock_sagemaker = Mock()
    mock_boto_client.return_value = mock_sagemaker
    
    mock_sagemaker.describe_model_package.return_value = {
        "CustomerMetadataProperties": {"model_name": "test-model"}
    }
    mock_sagemaker.create_endpoint_config.return_value = None
    mock_sagemaker.create_endpoint.return_value = None
    mock_sagemaker.describe_endpoint.return_value = {
        "EndpointStatus": "Failed",
        "FailureReason": "Instance launch failed"
    }
    
    event = {
        "model_package_arn": "arn:aws:sagemaker:us-east-1:123456789012:model-package/test-package",
        "endpoint_name": "test-endpoint"
    }
    context = Mock()
    context.get_remaining_time_in_millis.return_value = 60000  # 60 seconds remaining
    
    with pytest.raises(RuntimeError, match="Endpoint test-endpoint failed: Instance launch failed"):
        handler(event, context)


@patch('endpoint_deployment_lambda.time.sleep')
@patch('endpoint_deployment_lambda.boto3.client')
def test_handler_waiting_then_success(mock_boto_client, mock_sleep):
    """Test handler when endpoint is creating then becomes InService"""
    mock_sagemaker = Mock()
    mock_boto_client.return_value = mock_sagemaker
    
    mock_sagemaker.describe_model_package.return_value = {
        "CustomerMetadataProperties": {"model_name": "test-model"}
    }
    mock_sagemaker.create_endpoint_config.return_value = None
    mock_sagemaker.create_endpoint.return_value = None
    
    # First call returns "Creating", second call returns "InService"
    mock_sagemaker.describe_endpoint.side_effect = [
        {"EndpointStatus": "Creating"},
        {"EndpointStatus": "InService"}
    ]
    
    event = {
        "model_package_arn": "arn:aws:sagemaker:us-east-1:123456789012:model-package/test-package",
        "endpoint_name": "test-endpoint"
    }
    context = Mock()
    context.get_remaining_time_in_millis.return_value = 60000  # 60 seconds remaining
    
    handler(event, context)
    
    # Should have called describe_endpoint twice
    assert mock_sagemaker.describe_endpoint.call_count == 2
    # Should have slept once between checks
    mock_sleep.assert_called_once_with(30)