import sys
import os
from unittest.mock import patch, MagicMock
import pytest

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from inference_recommendation_lambda import handler, create_inference_recommendation_job, get_execution_role, get_job_status


def test_handler_success():
    """Test successful execution of the Lambda handler."""
    event = {
        'model_package_arn': 'arn:aws:sagemaker:us-east-1:123456789012:model-package/navigation-model-package/1',
        'job_name': 'test-inference-recommendation-job',
        'results_s3_bucket': 'test-bucket',
        'results_s3_prefix': 'navigation/inference-recommendations'
    }
    
    context = MagicMock()
    
    with patch('inference_recommendation_lambda.create_inference_recommendation_job') as mock_create_job:
        mock_create_job.return_value = {
            'JobArn': 'arn:aws:sagemaker:us-east-1:123456789012:inference-recommendations-job/test-job'
        }
        
        result = handler(event, context)
        
        assert result['statusCode'] == 200
        assert result['body']['status'] == 'CREATED'
        assert result['body']['job_name'] == 'test-inference-recommendation-job'
        assert 'job_arn' in result['body']
        assert 'results_s3_uri' in result['body']


def test_handler_missing_model_package_arn():
    """Test handler with missing model_package_arn parameter."""
    event = {
        'job_name': 'test-job',
        'results_s3_bucket': 'test-bucket',
        'results_s3_prefix': 'test-prefix'
    }
    
    context = MagicMock()
    result = handler(event, context)
    
    assert result['statusCode'] == 200
    assert result['body']['status'] == 'FAILED'
    assert 'model_package_arn is required' in result['body']['error']


def test_handler_missing_results_s3_bucket():
    """Test handler with missing results_s3_bucket parameter."""
    event = {
        'model_package_arn': 'arn:aws:sagemaker:us-east-1:123456789012:model-package/test/1',
        'job_name': 'test-job',
        'results_s3_prefix': 'test-prefix'
    }
    
    context = MagicMock()
    result = handler(event, context)
    
    assert result['statusCode'] == 200
    assert result['body']['status'] == 'FAILED'
    assert 'results_s3_bucket is required' in result['body']['error']


def test_handler_with_default_job_name():
    """Test handler generates default job name when not provided."""
    event = {
        'model_package_arn': 'arn:aws:sagemaker:us-east-1:123456789012:model-package/test/1',
        'results_s3_bucket': 'test-bucket',
        'results_s3_prefix': 'test-prefix'
    }
    
    context = MagicMock()
    
    with patch('inference_recommendation_lambda.create_inference_recommendation_job') as mock_create_job:
        mock_create_job.return_value = {'JobArn': 'test-arn'}
        
        result = handler(event, context)
        
        assert result['statusCode'] == 200
        assert result['body']['status'] == 'CREATED'
        assert result['body']['job_name'].startswith('navigation-inference-rec-')


def test_handler_exception_handling():
    """Test handler properly handles exceptions (non-blocking)."""
    event = {
        'model_package_arn': 'arn:aws:sagemaker:us-east-1:123456789012:model-package/test/1',
        'job_name': 'test-job',
        'results_s3_bucket': 'test-bucket',
        'results_s3_prefix': 'test-prefix'
    }
    
    context = MagicMock()
    
    with patch('inference_recommendation_lambda.create_inference_recommendation_job') as mock_create_job:
        mock_create_job.side_effect = Exception("Test exception")
        
        result = handler(event, context)
        
        # Should return success (non-blocking) but with error status
        assert result['statusCode'] == 200
        assert result['body']['status'] == 'FAILED'
        assert 'Test exception' in result['body']['error']
        assert 'pipeline will continue' in result['body']['message']


def test_create_inference_recommendation_job_success():
    """Test successful creation of inference recommendation job."""
    with patch('inference_recommendation_lambda.get_execution_role') as mock_get_role:
        mock_get_role.return_value = "arn:aws:iam::123456789012:role/SageMakerExecutionRole"
        
        with patch('inference_recommendation_lambda.get_sagemaker_client') as mock_get_client:
            mock_client = MagicMock()
            mock_client.create_inference_recommendations_job.return_value = {
                'JobArn': 'arn:aws:sagemaker:us-east-1:123456789012:inference-recommendations-job/test-job'
            }
            mock_get_client.return_value = mock_client
            
            result = create_inference_recommendation_job(
                job_name='test-job',
                model_package_arn='arn:aws:sagemaker:us-east-1:123456789012:model-package/test/1',
                results_s3_bucket='test-bucket',
                results_s3_prefix='test-prefix'
            )
            
            assert 'JobArn' in result
            mock_client.create_inference_recommendations_job.assert_called_once()


def test_create_inference_recommendation_job_error():
    """Test that boto3 errors are passed through unchanged."""
    from botocore.exceptions import ClientError
    
    with patch('inference_recommendation_lambda.get_execution_role') as mock_get_role:
        mock_get_role.return_value = "arn:aws:iam::123456789012:role/SageMakerExecutionRole"
        
        with patch('inference_recommendation_lambda.get_sagemaker_client') as mock_get_client:
            mock_client = MagicMock()
            mock_client.create_inference_recommendations_job.side_effect = ClientError(
                error_response={
                    'Error': {
                        'Code': 'ValidationException',
                        'Message': 'Invalid model package ARN'
                    }
                },
                operation_name='CreateInferenceRecommendationsJob'
            )
            mock_get_client.return_value = mock_client
            
            # Should raise the original ClientError, not a wrapped exception
            with pytest.raises(ClientError) as exc_info:
                create_inference_recommendation_job(
                    job_name='test-job',
                    model_package_arn='invalid-arn',
                    results_s3_bucket='test-bucket',
                    results_s3_prefix='test-prefix'
                )
            
            assert exc_info.value.response['Error']['Code'] == 'ValidationException'
            assert 'Invalid model package ARN' in exc_info.value.response['Error']['Message']


def test_get_execution_role_from_environment():
    """Test getting execution role from environment variable."""
    test_role = "arn:aws:iam::123456789012:role/TestRole"
    
    with patch.dict('os.environ', {'SAGEMAKER_EXECUTION_ROLE': test_role}):
        result = get_execution_role()
        assert result == test_role


def test_get_execution_role_constructed():
    """Test constructing execution role when not in environment."""
    with patch.dict('os.environ', {}, clear=True):
        with patch('boto3.client') as mock_boto_client:
            mock_sts = MagicMock()
            mock_sts.get_caller_identity.return_value = {'Account': '123456789012'}
            mock_boto_client.return_value = mock_sts
            
            with patch('boto3.Session') as mock_session:
                mock_session.return_value.region_name = 'us-east-1'
                
                result = get_execution_role()
                
                expected_role = "arn:aws:iam::123456789012:role/SageMakerExecutionRole"
                assert result == expected_role


def test_get_job_status_success():
    """Test successful retrieval of job status."""
    with patch('inference_recommendation_lambda.get_sagemaker_client') as mock_get_client:
        mock_client = MagicMock()
        mock_response = {
            'Status': 'COMPLETED',
            'CreationTime': '2024-01-01T00:00:00Z',
            'LastModifiedTime': '2024-01-01T01:00:00Z',
            'CompletionTime': '2024-01-01T01:00:00Z',
            'OutputConfig': {
                'CompiledOutputConfig': {
                    'S3OutputLocation': 's3://test-bucket/test-prefix/test-job'
                }
            }
        }
        mock_client.describe_inference_recommendations_job.return_value = mock_response
        mock_get_client.return_value = mock_client
        
        result = get_job_status('test-job')
        
        assert result['job_name'] == 'test-job'
        assert result['status'] == 'COMPLETED'
        assert 'creation_time' in result
        assert 'output_config' in result


def test_get_job_status_error():
    """Test error handling in job status retrieval."""
    from botocore.exceptions import ClientError
    
    with patch('inference_recommendation_lambda.get_sagemaker_client') as mock_get_client:
        mock_client = MagicMock()
        mock_client.describe_inference_recommendations_job.side_effect = ClientError(
            error_response={
                'Error': {
                    'Code': 'ResourceNotFound',
                    'Message': 'Job not found'
                }
            },
            operation_name='DescribeInferenceRecommendationsJob'
        )
        mock_get_client.return_value = mock_client
        
        with pytest.raises(ClientError):
            get_job_status('test-job')