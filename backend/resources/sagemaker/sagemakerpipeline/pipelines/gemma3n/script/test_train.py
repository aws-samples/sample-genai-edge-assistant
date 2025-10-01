#!/usr/bin/env python3
"""
Unit tests for prepare_model_files.py secrets retrieval functionality using pytest and moto.
"""

import pytest
import boto3
from moto import mock_aws
from botocore.exceptions import ClientError, NoCredentialsError
import pathlib
import tempfile
import os
from unittest.mock import patch, MagicMock
import sys

# Mock huggingface_hub before importing prepare_model_files
sys.modules['huggingface_hub'] = MagicMock()
sys.modules['inference'] = MagicMock()

from src.train import get_hf_token_from_secrets, create_model_archive


@pytest.fixture(scope="function")
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"


@pytest.fixture(scope="function")
def secretsmanager_client(aws_credentials):
    """Return a mocked Secrets Manager client."""
    with mock_aws():
        yield boto3.client("secretsmanager", region_name="us-east-1")


@pytest.fixture
def valid_token():
    """Valid Hugging Face token for testing."""
    return "hf_abcdefghijklmnopqrstuvwxyz1234567890"


@pytest.fixture
def secret_name():
    """Test secret name."""
    return "test-huggingface-token"


@pytest.fixture
def temp_directory():
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield pathlib.Path(temp_dir)


# Secrets Manager Tests

def test_successful_token_retrieval(secretsmanager_client, valid_token, secret_name):
    """Test successful token retrieval from Secrets Manager."""
    # Create secret
    secretsmanager_client.create_secret(Name=secret_name, SecretString=valid_token)
    
    # Call the function
    result = get_hf_token_from_secrets(secret_name)
    
    # Assertions
    assert result == valid_token


def test_default_secret_name(secretsmanager_client, valid_token):
    """Test that default secret name is used when not provided."""
    # Create secret with default name
    secretsmanager_client.create_secret(Name="huggingface-token", SecretString=valid_token)
    
    # Call the function without secret name
    result = get_hf_token_from_secrets()
    
    # Assertions
    assert result == valid_token


def test_secret_not_found(secretsmanager_client, secret_name):
    """Test handling when secret is not found."""
    # Don't create the secret, so it won't be found
    
    # Call the function and expect RuntimeError
    with pytest.raises(RuntimeError) as exc_info:
        get_hf_token_from_secrets(secret_name)
    
    # Check error message doesn't expose sensitive information
    assert "Failed to retrieve Hugging Face token from Secrets Manager" in str(exc_info.value)
    assert "hf_" not in str(exc_info.value)


def test_invalid_token_format_empty(secretsmanager_client, secret_name):
    """Test handling of empty token."""
    # Create secret with a space (minimum length 1) to simulate empty token
    secretsmanager_client.create_secret(Name=secret_name, SecretString=" ")
    
    # Call the function and expect RuntimeError
    with pytest.raises(RuntimeError) as exc_info:
        get_hf_token_from_secrets(secret_name)
    
    # Check error message
    assert "Failed to retrieve Hugging Face token from Secrets Manager" in str(exc_info.value)


def test_invalid_token_format_wrong_prefix(secretsmanager_client, secret_name):
    """Test handling of token with wrong prefix."""
    # Create secret with invalid token format
    secretsmanager_client.create_secret(Name=secret_name, SecretString="invalid_token_format")
    
    # Call the function and expect RuntimeError
    with pytest.raises(RuntimeError) as exc_info:
        get_hf_token_from_secrets(secret_name)
    
    # Check error message
    assert "Failed to retrieve Hugging Face token from Secrets Manager" in str(exc_info.value)


def test_no_credentials_error(secret_name):
    """Test handling when AWS credentials are not available."""
    # Mock NoCredentialsError by patching boto3.client
    with patch('src.train.boto3.client') as mock_client:
        mock_client.side_effect = NoCredentialsError()
        
        # Call the function and expect RuntimeError
        with pytest.raises(RuntimeError) as exc_info:
            get_hf_token_from_secrets(secret_name)
        
        # Check error message
        assert "Failed to retrieve Hugging Face token from Secrets Manager" in str(exc_info.value)


def test_unexpected_error(secret_name):
    """Test handling of unexpected errors."""
    # Mock unexpected exception by patching boto3.client
    with patch('src.train.boto3.client') as mock_client:
        mock_client.side_effect = Exception("Internal system failure")
        
        # Call the function and expect RuntimeError
        with pytest.raises(RuntimeError) as exc_info:
            get_hf_token_from_secrets(secret_name)
        
        # Check error message doesn't expose internal details
        assert "Failed to retrieve Hugging Face token from Secrets Manager" in str(exc_info.value)
        assert "Internal system failure" not in str(exc_info.value)  # Original error message should not be exposed


# Model Archive Tests

def test_create_model_archive_success(temp_directory):
    """Test successful model archive creation."""
    # Create test source directory with files
    source_dir = temp_directory / "source"
    source_dir.mkdir()
    
    # Create test files
    (source_dir / "file1.txt").write_text("content1")
    subdir = source_dir / "subdir"
    subdir.mkdir()
    (subdir / "file2.txt").write_text("content2")
    
    # Create output directory
    output_dir = temp_directory / "output"
    output_dir.mkdir()
    output_path = output_dir / "model.tar.gz"
    
    # Call function
    create_model_archive(source_dir, output_path)
    
    # Verify archive was created
    assert output_path.exists()
    assert output_path.stat().st_size > 0
    
    # Verify archive contents by extracting
    import tarfile
    with tarfile.open(output_path, "r:gz") as tar:
        names = tar.getnames()
        assert "file1.txt" in names
        assert "subdir/file2.txt" in names


def test_create_model_archive_invalid_source(temp_directory):
    """Test error handling for invalid source directory."""
    # Test with non-existent directory
    source_dir = temp_directory / "nonexistent"
    output_path = temp_directory / "output" / "model.tar.gz"
    
    with pytest.raises(ValueError) as exc_info:
        create_model_archive(source_dir, output_path)
    
    assert "does not exist or is not a directory" in str(exc_info.value)


def test_create_model_archive_creates_output_directory(temp_directory):
    """Test that output directory is created if it doesn't exist."""
    # Create test source directory with files
    source_dir = temp_directory / "source"
    source_dir.mkdir()
    (source_dir / "file1.txt").write_text("content1")
    
    # Output directory doesn't exist
    output_path = temp_directory / "nonexistent" / "model.tar.gz"
    
    # Call function
    create_model_archive(source_dir, output_path)
    
    # Verify archive was created and directory was created
    assert output_path.exists()
    assert output_path.parent.exists()