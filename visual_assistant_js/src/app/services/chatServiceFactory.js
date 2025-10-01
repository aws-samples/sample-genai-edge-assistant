// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ChatServiceType } from './chatService.js';
import { LocalChatService } from './localChatService.js';

export class ChatServiceFactory {
  static async createService(model) {
    if (model.type === 'sagemaker') {
      // Dynamic import to avoid bundling AWS SDK on client side
      const { SageMakerChatService } = await import('./sageMakerChatService.js');
      return new SageMakerChatService();
    } else {
      return new LocalChatService();
    }
  }
}