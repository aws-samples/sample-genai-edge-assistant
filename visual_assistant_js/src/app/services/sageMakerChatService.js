// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { SageMakerRuntimeClient, InvokeEndpointCommand, InvokeEndpointWithResponseStreamCommand } from '@aws-sdk/client-sagemaker-runtime';
import { fetchAuthSession } from 'aws-amplify/auth';
import { IChatService, ChatServiceType } from './chatService.js';

export class SageMakerChatService extends IChatService {
  constructor() {
    super();
    this.endpointName = process.env.NEXT_PUBLIC_CHAT_ENDPOINT_NAME;
    this.region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
    this.client = null;
  }

  async getClient() {
    if (!this.client) {
      const session = await fetchAuthSession();

      if (!session.credentials) {
        throw new Error('No credentials found in auth session. Make sure you are signed in and the identity pool is configured correctly.');
      }

      this.client = new SageMakerRuntimeClient({
        region: this.region,
        credentials: session.credentials,
      });
    }
    return this.client;
  }

  async sendMessage(message, streaming = false) {
    if (!this.endpointName) {
      throw new Error('SageMaker endpoint name not configured, make sure you have a working deployed model');
    }

    // Process multimodal content using shared utility
    const content = await this.processContent(message.content);

    if (content.length === 0) {
      throw new Error('Message must contain either text or images');
    }

    const payload = {
      task: 'chat',
      payload: { content },
    };
    const body = JSON.stringify(payload);

    if (streaming) {
      return this.invokeEndpointStreaming(body);
    } else {
      return this.invokeEndpoint(body);
    }
  }

  sanitizeError(error) {
    // Extract only safe error information
    const statusCode = error.$metadata?.httpStatusCode || 500;

    // Log full error for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('SageMaker Error Details:', error);
    }

    // Return sanitized error message
    if (statusCode === 413) {
      return 'Request too large. Please try with shorter text.';
    } else if (statusCode === 429) {
      return 'Service is busy. Please try again in a moment.';
    } else if (statusCode >= 500) {
      return 'Service temporarily unavailable. Please try again later.';
    } else if (statusCode === 400) {
      return 'Invalid request format. Please try again.';
    } else {
      return 'Unable to process request. Please try again.';
    }
  }

  async invokeEndpoint(body) {
    try {
      const client = await this.getClient();
      const command = new InvokeEndpointCommand({
        EndpointName: this.endpointName,
        Body: new TextEncoder().encode(body),
        ContentType: 'application/json',
        Accept: 'application/json',
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.Body));

      // Handle Gemma3n response format: { "response": "text" }
      let generatedText = '';
      if (responseBody.response) {
        generatedText = responseBody.response;
      } else {
        generatedText = 'No response generated';
      }

      return {
        id: `response-${Date.now()}`,
        type: 'assistant',
        content: {
          text: generatedText,
        },
        timestamp: new Date(),
        status: 'sent',
        metadata: {
          model: 'gemma3n',
          processingTime: 0,
        },
      };
    } catch (error) {
      const sanitizedMessage = this.sanitizeError(error);
      throw new Error(sanitizedMessage);
    }
  }

  async invokeEndpointStreaming(body) {
    const client = await this.getClient();
    const command = new InvokeEndpointWithResponseStreamCommand({
      EndpointName: this.endpointName,
      Body: new TextEncoder().encode(body),
      ContentType: 'application/json',
      Accept: 'application/json',
    });

    const response = await client.send(command);
    let fullText = '';

    for await (const chunk of response.Body) {
      if (chunk.PayloadPart?.Bytes) {
        const chunkText = new TextDecoder().decode(chunk.PayloadPart.Bytes);
        try {
          const chunkData = JSON.parse(chunkText);
          if (chunkData.token?.text) {
            fullText += chunkData.token.text;
          }
        } catch (e) {
          fullText += chunkText;
        }
      }
    }

    return {
      id: `response-${Date.now()}`,
      type: 'assistant',
      content: {
        text: fullText || 'No response generated',
      },
      timestamp: new Date(),
      status: 'sent',
      metadata: {
        model: 'gemma3n-streaming',
        processingTime: 0,
      },
    };
  }

  getServiceType() {
    return ChatServiceType.SAGEMAKER;
  }
}