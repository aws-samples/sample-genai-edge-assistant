// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Header,
  Box,
  AppLayout,
  ContentLayout,
  SpaceBetween,
  Alert,
  Spinner,
  Button,
  ButtonDropdown,
} from '@cloudscape-design/components';
import { getCurrentUser } from 'aws-amplify/auth';
import ConfigurationPanel from 'src/app/components/playground/configurationPanel';
import CustomHelpPanel from 'src/app/components/playground/helpPanel';
import { useMetaStore } from 'src/app/stores/metaStore';
import { useChatStore } from 'src/app/stores/chatStore';
import { useModelSelectionStore } from 'src/app/stores/modelSelectionStore';
import { useServiceSelectionStore } from 'src/app/stores/serviceSelectionStore';
import { ChatServiceFactory } from 'src/app/services/chatServiceFactory';
import TopBar from 'src/app/components/topBar';
import ChatMessageList from './chatMessageList';
import ChatInput from './chatInput';
import ChatModelModal from './chatModelModal';
import { getCachedManifest, validateCachedFiles } from 'src/app/utils/modelFetching';

/**
 * ChatMode component - Main container for the chat interface
 * Provides authentication checks, error boundaries, and layout structure
 */
export default function ChatMode() {
  const configPanelOpen = useMetaStore((state) => state.configPanelOpen);
  const setConfigPanelOpen = useMetaStore((state) => state.setConfigPanelOpen);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const [useStreaming, setUseStreaming] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [localModelReady, setLocalModelReady] = useState(false);
  const [modelLoadingStatus, setModelLoadingStatus] = useState('idle'); // idle, loading, ready, error
  const [chatService, setChatService] = useState(null); // Persistent chat service

  const { messages, error: chatError, isLoading: chatLoading, clearChat, addMessage, hasMessages } = useChatStore();
  const { currentModel, availableModels, setCurrentModel } = useModelSelectionStore();

  const messagesContainerRef = useRef(null);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        setIsCheckingAuth(true);
        await getCurrentUser();
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (error) {
        console.error('Authentication check failed:', error);
        setIsAuthenticated(false);
        setAuthError('Authentication required. Please sign in to use Chat Mode.');
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuthentication();
  }, []);

  // Check local model availability and updates
  useEffect(() => {
    const checkLocalModel = async () => {
      try {
        // First fetch remote model info to compare ETags
        const { fetchModelUrl } = await import('src/app/utils/modelFetching.js');
        const { updateRemoteModelInfo, validateAndUpdateModelStatus } = useServiceSelectionStore.getState();

        try {
          const modelUrlData = await fetchModelUrl();
          updateRemoteModelInfo(modelUrlData);
        } catch (error) {
          console.log('Could not fetch remote model info:', error);
        }

        // Then validate local model status
        await validateAndUpdateModelStatus();

        const manifest = await getCachedManifest('chat');
        if (manifest) {
          const isValid = await validateCachedFiles('chat', manifest);
          setLocalModelReady(isValid);
        } else {
          setLocalModelReady(false);
        }
      } catch (error) {
        console.error('Error checking local model:', error);
        setLocalModelReady(false);
      }
    };
    checkLocalModel();
  }, []);

  // Handle model selection - show modal if Local LLM needs download/update
  const handleModelSelection = async (model) => {
    if (model.type === 'local') {
      // Check if model needs download or update
      const { getModelDownloadStatus } = useServiceSelectionStore.getState();
      const status = getModelDownloadStatus('chat');

      if (['needsDownload', 'outdated', 'unavailable'].includes(status)) {
        // Show modal to download/update model
        setShowModelModal(true);
      } else if (status === 'upToDate') {
        // Model is up to date, set as current and start loading
        setCurrentModel(model);
        await initializeLocalModel();
      } else {
        // Model status unclear, show modal to be safe
        setShowModelModal(true);
      }
    } else {
      setCurrentModel(model);
    }
  };

  // Initialize the local model worker
  const initializeLocalModel = async () => {
    if (modelLoadingStatus === 'loading' || modelLoadingStatus === 'ready') {
      console.log('Model already loading or ready, skipping initialization');
      return;
    }

    setModelLoadingStatus('loading');
    try {
      // Create a persistent chat service
      const { LocalChatService } = await import('src/app/services/localChatService.js');
      const service = new LocalChatService();
      await service.initializeWorker();
      setChatService(service);
      setModelLoadingStatus('ready');
    } catch (error) {
      console.error('Failed to initialize local model:', error);
      setModelLoadingStatus('error');
    }
  };

  const handleModelReady = async () => {
    setLocalModelReady(true);
    setShowModelModal(false);
    // Set the local model as current and initialize it
    const localModel = availableModels.find((m) => m.type === 'local');
    if (localModel) {
      setCurrentModel(localModel);
      await initializeLocalModel();
    }
  };

  // Cleanup chat service when component unmounts or model changes
  useEffect(() => {
    return () => {
      if (chatService) {
        chatService.dispose();
      }
    };
  }, [chatService]);

  // Cleanup when switching away from local model
  useEffect(() => {
    if (currentModel?.type !== 'local' && chatService) {
      chatService.dispose();
      setChatService(null);
      setModelLoadingStatus('idle');
    }
  }, [currentModel, chatService]);


  const handleSendMessage = async (message) => {
    // Check if local model is selected but not ready
    if (currentModel?.type === 'local' && modelLoadingStatus !== 'ready') {
      if (modelLoadingStatus === 'loading') {
        // Show a temporary message that model is loading
        const tempMessage = {
          id: `temp_${Date.now()}`,
          type: 'assistant',
          content: { text: 'Please wait, the local model is still loading...' },
          timestamp: new Date(),
          status: 'sent',
        };
        addMessage(tempMessage);
        return;
      } else {
        // Model failed to load or not initialized
        const errorMessage = {
          id: `error_${Date.now()}`,
          type: 'assistant',
          content: { text: 'Local model is not ready. Please select the model again or try a different model.' },
          timestamp: new Date(),
          status: 'sent',
        };
        addMessage(errorMessage);
        return;
      }
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const userMessage = { ...message, id: messageId, status: 'sent' };
    addMessage(userMessage);

    // Add assistant loading message
    const assistantLoadingId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const assistantLoadingMessage = {
      id: assistantLoadingId,
      type: 'assistant',
      content: { text: '' },
      timestamp: new Date(),
      status: 'sending',
    };
    addMessage(assistantLoadingMessage);

    try {
      // Use persistent chat service for local models, or create new service for others
      let service;
      if (currentModel?.type === 'local' && chatService) {
        service = chatService; // Reuse the persistent service
      } else {
        service = await ChatServiceFactory.createService(currentModel);
      }

      const response = await service.sendMessage(message, useStreaming);

      // Update the loading message with the actual response
      const { updateMessage } = useChatStore.getState();
      updateMessage(assistantLoadingId, {
        content: response.content,
        status: 'sent',
        metadata: response.metadata,
      });
    } catch (error) {
      console.error('Failed to send message:', error);

      // Update the assistant loading message to show error
      const { updateMessage } = useChatStore.getState();
      updateMessage(assistantLoadingId, {
        content: { text: `Error: ${error.message}` },
        status: 'error',
        error: error.message,
      });
    }
  };


  // Loading state during authentication check
  if (isCheckingAuth) {
    return (
      <>
        <div
          style={{
            backgroundColor: '#000000',
          }}
          id="top-bar"
        >
          <TopBar />
        </div>
        <AppLayout
          navigation={
            <div style={{ padding: '16px' }}>
              <ConfigurationPanel />
            </div>
          }
          navigationWidth={350}
          navigationOpen={configPanelOpen}
          onNavigationChange={({ detail }) => setConfigPanelOpen(detail.open)}
          content={
            <ContentLayout>
              <Container>
                <Box textAlign="center" padding="xl">
                  <Spinner size="large" />
                  <Box variant="p" padding={{ top: 'm' }}>
                    Checking authentication...
                  </Box>
                </Box>
              </Container>
            </ContentLayout>
          }
          tools={<CustomHelpPanel />}
          toolsOpen={toolsOpen}
          onToolsChange={({ detail }) => setToolsOpen(detail.open)}
          contentType="default"
          toolsWidth={300}
        />
      </>
    );
  }

  // Authentication error state
  if (!isAuthenticated || authError) {
    return (
      <>
        <div
          style={{
            backgroundColor: '#000000',
          }}
          id="top-bar"
        >
          <TopBar />
        </div>
        <AppLayout
          navigation={
            <div style={{ padding: '16px' }}>
              <ConfigurationPanel />
            </div>
          }
          navigationWidth={350}
          navigationOpen={configPanelOpen}
          onNavigationChange={({ detail }) => setConfigPanelOpen(detail.open)}
          content={
            <ContentLayout>
              <Container>
                <Alert
                  type="error"
                  header="Authentication Required"
                  dismissible
                  onDismiss={() => setAuthError(null)}
                >
                  {authError || 'You must be signed in to access Chat Mode. Please authenticate and try again.'}
                </Alert>
              </Container>
            </ContentLayout>
          }
          tools={<CustomHelpPanel />}
          toolsOpen={toolsOpen}
          onToolsChange={({ detail }) => setToolsOpen(detail.open)}
          contentType="default"
          toolsWidth={300}
        />
      </>
    );
  }

  const content = (
    <SpaceBetween direction="vertical" size="l">
      {chatError && (
        <Alert
          type="error"
          header="Chat Error"
          dismissible
          onDismiss={() => useChatStore.getState().setError(null)}
        >
          {chatError}
        </Alert>
      )}

      <Container
        header={
          <Header
            variant="h2"
            description="Interact with AI using text, images, and audio"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <ButtonDropdown
                  items={availableModels.map((m) => ({
                    id: m.id,
                    text: m.name,
                    iconName: m.type === 'local' && localModelReady && modelLoadingStatus === 'ready' ? 'status-positive' :
                      m.type === 'local' && modelLoadingStatus === 'loading' ? 'status-pending' :
                        m.type === 'local' && modelLoadingStatus === 'error' ? 'status-negative' : undefined,
                  }))}
                  onItemClick={({ detail }) => {
                    const model = availableModels.find((m) => m.id === detail.id);
                    handleModelSelection(model);
                  }}
                  loading={modelLoadingStatus === 'loading'}
                >
                  {currentModel?.name || 'Select Model'}
                  {currentModel?.type === 'local' && modelLoadingStatus === 'loading' && ' (Loading...)'}
                </ButtonDropdown>

                <Button
                  variant={useStreaming ? 'primary' : 'normal'}
                  onClick={() => setUseStreaming(!useStreaming)}
                >
                  {useStreaming ? 'Streaming ON' : 'Streaming OFF'}
                </Button>

                {hasMessages() && (
                  <Button variant="normal" iconName="refresh" onClick={clearChat}>
                    New conversation
                  </Button>
                )}
                {chatLoading && <Spinner />}
              </SpaceBetween>
            }
          >
            Visual Assistant chat
          </Header>
        }
      >
        <SpaceBetween direction="vertical" size="m">
          {/* Model loading status */}
          {currentModel?.type === 'local' && modelLoadingStatus === 'loading' && (
            <Alert type="info" header="Loading Local Model">
              <SpaceBetween direction="vertical" size="xs">
                <Box>Initializing Janus Pro 1B model for local chat...</Box>
                <Spinner />
              </SpaceBetween>
            </Alert>
          )}

          {currentModel?.type === 'local' && modelLoadingStatus === 'error' && (
            <Alert type="error" header="Model Loading Failed">
              Failed to initialize the local chat model. Please try selecting the model again.
            </Alert>
          )}

          {/* Chat messages area with fixed height */}
          <div
            ref={messagesContainerRef}
            style={{
              height: '500px',
              border: '1px solid #e9ebed',
              borderRadius: '8px',
              padding: '16px',
              overflowY: 'auto',
              backgroundColor: '#fafbfc',
            }}
          >
            <ChatMessageList
              messages={messages}
              isLoading={chatLoading}
              onRetry={() => { }}
              messagesContainerRef={messagesContainerRef}
            />
          </div>

          {/* Chat input */}
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={chatLoading}
            placeholder="Ask me anything..."
          />
        </SpaceBetween>
      </Container>


    </SpaceBetween>
  );

  return (
    <>
      <div
        style={{
          backgroundColor: '#000000',
        }}
        id="top-bar"
      >
        <TopBar />
      </div>
      <AppLayout
        navigation={
          <div style={{ padding: '16px' }}>
            <ConfigurationPanel />
          </div>
        }
        navigationWidth={350}
        navigationOpen={configPanelOpen}
        onNavigationChange={({ detail }) => setConfigPanelOpen(detail.open)}
        content={<ContentLayout>{content}</ContentLayout>}
        tools={<CustomHelpPanel />}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        contentType="default"
        toolsWidth={300}
      />

      {/* Chat Model Download Modal */}
      <ChatModelModal
        visible={showModelModal}
        onDismiss={() => setShowModelModal(false)}
        onModelReady={handleModelReady}
      />
    </>
  );
}