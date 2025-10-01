// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Polyfill TextEncoder for Node.js test environment
global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
global.TextDecoder = global.TextDecoder || require('util').TextDecoder;

// Mock AWS SDK
const mockSend = jest.fn();
const mockInvokeEndpointCommand = jest.fn();
const mockInvokeEndpointWithResponseStreamCommand = jest.fn();

jest.mock('@aws-sdk/client-sagemaker-runtime', () => ({
  SageMakerRuntimeClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  InvokeEndpointCommand: mockInvokeEndpointCommand,
  InvokeEndpointWithResponseStreamCommand: mockInvokeEndpointWithResponseStreamCommand,
}));

jest.mock('@aws-sdk/credential-providers', () => ({
  fromCognitoIdentityPool: jest.fn(() => 'mock-credentials'),
}));

describe('SageMakerChatService', () => {
  let SageMakerChatService;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Set up environment variables
    process.env.NEXT_PUBLIC_SAGEMAKER_ENDPOINT_NAME = 'test-endpoint';
    process.env.NEXT_PUBLIC_AWS_REGION = 'us-east-1';
    process.env.NEXT_PUBLIC_IDENTITY_POOL_ID = 'test-pool';

    // Import after setting up mocks and env vars
    SageMakerChatService = require('../sageMakerChatService').SageMakerChatService;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NEXT_PUBLIC_SAGEMAKER_ENDPOINT_NAME;
    delete process.env.NEXT_PUBLIC_AWS_REGION;
    delete process.env.NEXT_PUBLIC_IDENTITY_POOL_ID;
  });

  test('creates service instance with correct service type', () => {
    const service = new SageMakerChatService();
    expect(service.getServiceType()).toBe('sagemaker');
  });

  test('initializes with correct endpoint name from environment', () => {
    const service = new SageMakerChatService();
    expect(service.endpointName).toBe('test-endpoint');
  });

  test('throws error when endpoint not configured', async () => {
    delete process.env.NEXT_PUBLIC_SAGEMAKER_ENDPOINT_NAME;

    // Re-import to get fresh instance without endpoint
    jest.resetModules();
    const { SageMakerChatService: ServiceWithoutEndpoint } = require('../sageMakerChatService');

    const service = new ServiceWithoutEndpoint();
    const message = { content: { text: 'Hello' } };

    await expect(service.sendMessage(message)).rejects.toThrow('SageMaker endpoint name not configured, make sure you have a working deployed model');
  });

  test('sends message with correct payload format', async () => {
    const mockResponse = {
      Body: new TextEncoder().encode(JSON.stringify({ generated_text: 'Hello back!' })),
    };
    mockSend.mockResolvedValue(mockResponse);

    const service = new SageMakerChatService();
    const message = { content: { text: 'Hello' } };

    const result = await service.sendMessage(message);

    expect(mockInvokeEndpointCommand).toHaveBeenCalledWith({
      EndpointName: 'test-endpoint',
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: new TextEncoder().encode(JSON.stringify({
        inputs: 'Hello',
        parameters: {
          max_new_tokens: 512,
          temperature: 0.7,
        },
      })),
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result.content.text).toBe('Hello back!');
    expect(result.type).toBe('assistant');
  });

  test('handles multimodal message with image', async () => {
    const mockResponse = {
      Body: new TextEncoder().encode(JSON.stringify({ generated_text: 'I see an image!' })),
    };
    mockSend.mockResolvedValue(mockResponse);

    const service = new SageMakerChatService();
    const message = {
      content: {
        text: 'What do you see?',
        image: new ArrayBuffer(8), // Mock image data
      },
    };

    const result = await service.sendMessage(message);

    expect(mockInvokeEndpointCommand).toHaveBeenCalledWith({
      EndpointName: 'test-endpoint',
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: new TextEncoder().encode(JSON.stringify({
        inputs: 'What do you see?',
        parameters: {
          max_new_tokens: 512,
          temperature: 0.7,
        },
      })),
    });
    expect(result.content.text).toBe('I see an image!');
  });

  test('handles service errors gracefully', async () => {
    const error = new Error('Service unavailable');
    mockSend.mockRejectedValue(error);

    const service = new SageMakerChatService();
    const message = { content: { text: 'Hello' } };

    await expect(service.sendMessage(message)).rejects.toThrow('Service unavailable');
  });

  test('supports streaming mode', async () => {
    const service = new SageMakerChatService();
    const message = { content: { text: 'Hello' } };

    // Mock streaming response with async iterator
    const mockStreamingResponse = {
      Body: {
        async *[Symbol.asyncIterator]() {
          yield {
            PayloadPart: {
              Bytes: new TextEncoder().encode(JSON.stringify({ token: { text: 'Hello' } })),
            },
          };
          yield {
            PayloadPart: {
              Bytes: new TextEncoder().encode(JSON.stringify({ token: { text: ' back!' } })),
            },
          };
        },
      },
    };
    mockSend.mockResolvedValue(mockStreamingResponse);

    const result = await service.sendMessage(message, true);

    expect(mockInvokeEndpointWithResponseStreamCommand).toHaveBeenCalledWith({
      EndpointName: 'test-endpoint',
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: new TextEncoder().encode(JSON.stringify({
        inputs: 'Hello',
        parameters: {
          max_new_tokens: 512,
          temperature: 0.7,
        },
      })),
    });
    expect(result.content.text).toBe('Hello back!');
    expect(result.metadata.model).toBe('sagemaker-streaming');
  });
});