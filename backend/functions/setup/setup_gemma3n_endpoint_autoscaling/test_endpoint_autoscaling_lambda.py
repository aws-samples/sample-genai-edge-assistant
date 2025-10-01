import json
import pytest
from unittest.mock import Mock, patch
from botocore.exceptions import ClientError
from moto import mock_aws
import boto3

from src.endpoint_autoscaling_lambda import handler, setup_auto_scaling

@patch('src.endpoint_autoscaling_lambda.validate_endpoint_exists')
@patch('src.endpoint_autoscaling_lambda.setup_auto_scaling')
def test_handler_success(mock_setup, mock_validate):
    """Test successful autoscaling configuration"""
    # Arrange
    event = {
        "endpoint_name": "test-navigation-endpoint",
        "min_capacity": 1,
        "max_capacity": 2,
        "target_value": 10.0
    }
    context = Mock()
    
    mock_validate.return_value = None  # No exception raised
    mock_setup.return_value = None
    
    # Act
    result = handler(event, context)
    
    # Assert - handler now returns None on success
    assert result is None
    mock_validate.assert_called_once_with("test-navigation-endpoint")
    mock_setup.assert_called_once_with("test-navigation-endpoint", 1, 2, 10.0)


@patch('src.endpoint_autoscaling_lambda.validate_endpoint_exists')
@patch('src.endpoint_autoscaling_lambda.setup_auto_scaling')
def test_handler_with_default_values(mock_setup, mock_validate):
    """Test handler with default autoscaling values"""
    # Arrange
    event = {
        "endpoint_name": "test-navigation-endpoint"
    }
    context = Mock()
    
    mock_validate.return_value = None  # No exception raised
    mock_setup.return_value = None
    
    # Act
    result = handler(event, context)
    
    # Assert - handler returns None, check default values were used
    assert result is None
    mock_setup.assert_called_once_with("test-navigation-endpoint", 1, 2, 10.0)


def test_handler_missing_endpoint_name():
    """Test handler with missing endpoint name"""
    # Arrange
    event = {}
    context = Mock()
    
    # Act
    result = handler(event, context)
    
    # Assert
    assert result["statusCode"] == 400
    assert result["success"] is False
    assert "Missing 'endpoint_name'" in result["error"]


@patch('src.endpoint_autoscaling_lambda.validate_endpoint_exists')
def test_handler_endpoint_not_ready(mock_validate):
    """Test handler when endpoint is not ready"""
    # Arrange
    event = {
        "endpoint_name": "test-navigation-endpoint"
    }
    context = Mock()
    
    mock_validate.side_effect = RuntimeError("Endpoint test-navigation-endpoint is in an invalid state: Failed")
    
    # Act & Assert - should raise the exception
    with pytest.raises(RuntimeError, match="invalid state: Failed"):
        handler(event, context)


@patch('src.endpoint_autoscaling_lambda.validate_endpoint_exists')
@patch('src.endpoint_autoscaling_lambda.setup_auto_scaling')
def test_handler_already_configured(mock_setup, mock_validate):
    """Test handler when autoscaling is already configured"""
    # Arrange
    event = {
        "endpoint_name": "test-navigation-endpoint"
    }
    context = Mock()
    
    mock_validate.return_value = None
    mock_setup.side_effect = ClientError(
        error_response={'Error': {'Code': 'ValidationException', 'Message': 'Already exists'}},
        operation_name='RegisterScalableTarget'
    )
    
    # Act & Assert - should raise the ClientError
    with pytest.raises(ClientError):
        handler(event, context)


@patch('src.endpoint_autoscaling_lambda.validate_endpoint_exists')
@patch('src.endpoint_autoscaling_lambda.setup_auto_scaling')
def test_handler_client_error(mock_setup, mock_validate):
    """Test handler with AWS ClientError"""
    # Arrange
    event = {
        "endpoint_name": "test-navigation-endpoint"
    }
    context = Mock()
    
    mock_validate.return_value = None
    mock_setup.side_effect = ClientError(
        error_response={'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}},
        operation_name='RegisterScalableTarget'
    )
    
    # Act & Assert - should raise the ClientError
    with pytest.raises(ClientError):
        handler(event, context)


@patch('src.endpoint_autoscaling_lambda.validate_endpoint_exists')
@patch('src.endpoint_autoscaling_lambda.setup_auto_scaling')
def test_handler_unexpected_error(mock_setup, mock_validate):
    """Test handler with unexpected error"""
    # Arrange
    event = {
        "endpoint_name": "test-navigation-endpoint"
    }
    context = Mock()
    
    mock_validate.return_value = None
    mock_setup.side_effect = Exception("Unexpected error")
    
    # Act & Assert - should raise the Exception
    with pytest.raises(Exception, match="Unexpected error"):
        handler(event, context)


@mock_aws
def test_setup_auto_scaling_default_parameters():
    """Test setup_auto_scaling with default parameters using moto"""
    # Arrange
    endpoint_name = "test-navigation-endpoint"
    
    # Mock the boto3 client calls to verify they're made with correct parameters
    with patch('boto3.client') as mock_client_factory:
        mock_client = Mock()
        mock_client_factory.return_value = mock_client
        
        # Act
        setup_auto_scaling(endpoint_name)
        
        # Assert - verify the correct AWS calls were made
        expected_resource_id = f"endpoint/{endpoint_name}/variant/AllTraffic"
        
        mock_client.register_scalable_target.assert_called_once_with(
            ServiceNamespace="sagemaker",
            ResourceId=expected_resource_id,
            ScalableDimension="sagemaker:variant:DesiredInstanceCount",
            MinCapacity=1,
            MaxCapacity=2,
        )
        
        mock_client.put_scaling_policy.assert_called_once_with(
            PolicyName=f"NavigationEndpointScalingPolicy-{endpoint_name}",
            ServiceNamespace="sagemaker",
            ResourceId=expected_resource_id,
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


@mock_aws
def test_setup_auto_scaling_custom_parameters():
    """Test setup_auto_scaling with custom parameters"""
    # Arrange
    endpoint_name = "test-navigation-endpoint"
    min_capacity = 2
    max_capacity = 5
    target_value = 15.0
    
    # Mock the boto3 client calls to verify they're made with correct parameters
    with patch('boto3.client') as mock_client_factory:
        mock_client = Mock()
        mock_client_factory.return_value = mock_client
        
        # Act
        setup_auto_scaling(endpoint_name, min_capacity, max_capacity, target_value)
        
        # Assert - verify the correct AWS calls were made with custom parameters
        expected_resource_id = f"endpoint/{endpoint_name}/variant/AllTraffic"
        
        mock_client.register_scalable_target.assert_called_once_with(
            ServiceNamespace="sagemaker",
            ResourceId=expected_resource_id,
            ScalableDimension="sagemaker:variant:DesiredInstanceCount",
            MinCapacity=min_capacity,
            MaxCapacity=max_capacity,
        )
        
        scaling_policy_call = mock_client.put_scaling_policy.call_args
        assert scaling_policy_call[1]["TargetTrackingScalingPolicyConfiguration"]["TargetValue"] == target_value


@mock_aws
def test_setup_auto_scaling_resource_id_format():
    """Test that resource ID is formatted correctly"""
    # Arrange
    endpoint_name = "my-test-endpoint-123"
    
    # Mock the boto3 client calls to verify resource ID format
    with patch('boto3.client') as mock_client_factory:
        mock_client = Mock()
        mock_client_factory.return_value = mock_client
        
        # Act
        setup_auto_scaling(endpoint_name)
        
        # Assert
        expected_resource_id = "endpoint/my-test-endpoint-123/variant/AllTraffic"
        
        register_call = mock_client.register_scalable_target.call_args
        assert register_call[1]["ResourceId"] == expected_resource_id
        
        policy_call = mock_client.put_scaling_policy.call_args
        assert policy_call[1]["ResourceId"] == expected_resource_id


@mock_aws
def test_setup_auto_scaling_policy_name_format():
    """Test that scaling policy name is formatted correctly"""
    # Arrange
    endpoint_name = "navigation-endpoint-v1"
    
    # Mock the boto3 client calls to verify policy name format
    with patch('boto3.client') as mock_client_factory:
        mock_client = Mock()
        mock_client_factory.return_value = mock_client
        
        # Act
        setup_auto_scaling(endpoint_name)
        
        # Assert
        expected_policy_name = "NavigationEndpointScalingPolicy-navigation-endpoint-v1"
        
        policy_call = mock_client.put_scaling_policy.call_args
        assert policy_call[1]["PolicyName"] == expected_policy_name


@mock_aws
def test_setup_auto_scaling_cooldown_periods():
    """Test that cooldown periods are set correctly"""
    # Arrange
    endpoint_name = "test-endpoint"
    
    # Mock the boto3 client calls to verify cooldown periods
    with patch('boto3.client') as mock_client_factory:
        mock_client = Mock()
        mock_client_factory.return_value = mock_client
        
        # Act
        setup_auto_scaling(endpoint_name)
        
        # Assert
        policy_call = mock_client.put_scaling_policy.call_args
        config = policy_call[1]["TargetTrackingScalingPolicyConfiguration"]
        
        assert config["ScaleInCooldown"] == 300
        assert config["ScaleOutCooldown"] == 300


@mock_aws
def test_setup_auto_scaling_predefined_metric():
    """Test that predefined metric specification is correct"""
    # Arrange
    endpoint_name = "test-endpoint"
    
    # Mock the boto3 client calls to verify metric specification
    with patch('boto3.client') as mock_client_factory:
        mock_client = Mock()
        mock_client_factory.return_value = mock_client
        
        # Act
        setup_auto_scaling(endpoint_name)
        
        # Assert
        policy_call = mock_client.put_scaling_policy.call_args
        config = policy_call[1]["TargetTrackingScalingPolicyConfiguration"]
        metric_spec = config["PredefinedMetricSpecification"]
        
        assert metric_spec["PredefinedMetricType"] == "SageMakerVariantInvocationsPerInstance"