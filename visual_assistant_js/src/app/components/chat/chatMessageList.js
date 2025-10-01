// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { useEffect } from 'react';
import {
  Box,
  SpaceBetween,
  Button,
  StatusIndicator,
  TextContent,
  FileTokenGroup,
  LiveRegion,
} from '@cloudscape-design/components';
import Avatar from '@cloudscape-design/chat-components/avatar';
import ChatBubble from '@cloudscape-design/chat-components/chat-bubble';
import LoadingBar from '@cloudscape-design/chat-components/loading-bar';
import ChatAudioPlayer from './chatAudioPlayer';
import TextRenderer from 'src/app/components/common/textRenderer';

/**
 * Individual chat message component using Cloudscape Chat Components
 */
function ChatMessage({ message, onRetry }) {
  const isUser = message.type === 'user';
  const hasError = message.status === 'error';
  const isRetrying = message.status === 'retry';
  const isSending = message.status === 'sending';

  // Format timestamp for aria label
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Create avatar for the message
  const avatar = isUser ? (
    <Avatar
      ariaLabel="You"
      tooltipText="You"
    />
  ) : (
    <Avatar
      ariaLabel="Generative AI assistant"
      color="gen-ai"
      iconName="gen-ai"
      tooltipText="Generative AI assistant"
      initials={isSending || isRetrying ? '⏳' : undefined}
    />
  );

  // Render message content
  const renderContent = () => {
    const { content } = message;

    // Show loading state for assistant messages that are generating
    if (isSending || isRetrying) {
      if (!isUser) {
        // Assistant message generating response
        return (
          <LiveRegion>
            <Box
              margin={{ bottom: 'xs' }}
              color="text-body-secondary"
            >
              {isRetrying ? 'Retrying...' : 'Generating response'}
            </Box>
            <LoadingBar variant="gen-ai" />
          </LiveRegion>
        );
      } else {
        // User message sending (should be brief)
        return (
          <Box color="text-status-inactive">
            {isRetrying ? 'Retrying...' : 'Sending...'}
          </Box>
        );
      }
    }

    return (
      <SpaceBetween direction="vertical" size="xs">
        {/* Text content with smart formatting */}
        {content.text && (
          <TextRenderer
            text={content.text}
            style={{
              maxWidth: '100%',
              wordWrap: 'break-word',
            }}
          />
        )}

        {/* Image content - support multiple images */}
        {content.images && content.images.length > 0 && (
          <SpaceBetween direction="vertical" size="xs">
            {content.images.map((image, index) => (
              <Box key={`image-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`Shared image ${index + 1}${image.name ? ` - ${image.name}` : ''}`}
                  style={{
                    maxWidth: '300px',
                    maxHeight: '200px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    console.error('Image failed to load:', image.url);
                    e.target.style.display = 'none';
                  }}
                />
                {image.name && (
                  <Box variant="small" color="text-body-secondary" padding={{ top: 'xxs' }}>
                    {image.name}
                  </Box>
                )}
              </Box>
            ))}
          </SpaceBetween>
        )}

        {/* Legacy single image support */}
        {content.image && content.image.url && !content.images && (
          <Box>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.image.url}
              alt="Shared image"
              style={{
                maxWidth: '300px',
                maxHeight: '200px',
                borderRadius: '8px',
                objectFit: 'cover',
              }}
              onError={(e) => {
                console.error('Image failed to load:', content.image.url);
                e.target.style.display = 'none';
              }}
            />
          </Box>
        )}

        {/* Audio content - support multiple audio files */}
        {content.audios && content.audios.length > 0 && (
          <SpaceBetween direction="vertical" size="xs">
            {content.audios.map((audio, index) => (
              <ChatAudioPlayer
                key={`audio-${index}`}
                audioUrl={audio.url}
                duration={audio.duration}
                name={audio.name}
              />
            ))}
          </SpaceBetween>
        )}

        {/* Legacy single audio support */}
        {content.audio && content.audio.url && !content.audios && (
          <Box>
            <audio
              controls
              style={{ maxWidth: '300px' }}
              preload="metadata"
            >
              <source src={content.audio.url} type="audio/wav" />
              <source src={content.audio.url} type="audio/mp3" />
              Your browser does not support the audio element.
            </audio>
            {content.audio.duration && (
              <Box variant="small" color="text-body-secondary" padding={{ top: 'xxs' }}>
                Duration: {Math.round(content.audio.duration)}s
              </Box>
            )}
          </Box>
        )}

        {/* Files if any */}
        {content.files && content.files.length > 0 && (
          <Box>
            <Box variant="small" color="text-body-secondary" padding={{ bottom: 'xs' }}>
              Attached files:
            </Box>
            <FileTokenGroup
              readOnly
              items={content.files.map((fileData, index) => ({
                file: fileData.file || fileData,
                key: `file-${index}-${fileData.name || 'unknown'}`,
              }))}
              limit={3}
              onDismiss={() => {/* read only */ }}
              alignment="horizontal"
              showFileThumbnail={false} // Disable thumbnails to avoid empty src issues
              i18nStrings={{
                removeFileAriaLabel: (index) => `Remove file ${index + 1}`,
                limitShowFewer: 'Show fewer files',
                limitShowMore: 'Show more files',
                errorIconAriaLabel: 'Error',
                warningIconAriaLabel: 'Warning',
              }}
            />
          </Box>
        )}

        {/* Status indicator for user messages */}
        {isUser && message.status === 'sent' && (
          <Box display="flex" justifyContent="flex-end">
            <Box variant="small" color="text-body-secondary">
              Sent
            </Box>
          </Box>
        )}

        {/* Error message */}
        {hasError && message.error && (
          <StatusIndicator type="error">
            {message.error}
          </StatusIndicator>
        )}

        {/* Actions */}
        {hasError && (
          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="link"
              iconName="refresh"
              onClick={() => onRetry(message.id)}
              ariaLabel={`Retry message ${message.id}`}
            >
              Retry
            </Button>
          </Box>
        )}

        {/* Metadata for assistant messages */}
        {!isUser && message.metadata && (
          <Box variant="small" color="text-body-secondary">
            {message.metadata.model && (
              <span>{message.metadata.model}</span>
            )}
            {message.metadata.tokensPerSecond && (
              <span> • {message.metadata.tokensPerSecond} tokens/sec</span>
            )}
            {message.metadata.tokenCount && (
              <span> • {message.metadata.tokenCount} tokens</span>
            )}
            {message.metadata.elapsedTime && (
              <span> • {message.metadata.elapsedTime}s</span>
            )}
            {message.metadata.processingTime && (
              <span> • Processing: {message.metadata.processingTime}ms</span>
            )}
            {message.metadata.tokens && (
              <span> • Tokens: {message.metadata.tokens}</span>
            )}
          </Box>
        )}
      </SpaceBetween>
    );
  };

  return (
    <ChatBubble
      ariaLabel={`${isUser ? 'You' : 'AI Assistant'} at ${formatTime(message.timestamp)}`}
      type={isUser ? 'outgoing' : 'incoming'}
      avatar={avatar}
    >
      {renderContent()}
    </ChatBubble>
  );
}

/**
 * Chat message list component using CloudScape demo pattern
 */
export default function ChatMessageList({ messages = [], isLoading = false, onRetry, messagesContainerRef }) {
  const latestMessage = messages[messages.length - 1];

  // Auto-scroll to latest messages - using the ref passed from parent
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesContainerRef?.current) {
        const container = messagesContainerRef.current;
        container.scrollTop = container.scrollHeight;
      }
    };

    // Use requestAnimationFrame for smoother scrolling
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(scrollToBottom);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [messages, isLoading, messagesContainerRef]);

  // Handle retry function
  const handleRetry = (messageId) => {
    if (onRetry) {
      onRetry(messageId);
    }
  };

  return (
    <div className="messages" role="region" aria-label="Chat">

      {/* Live region for screen readers */}
      <LiveRegion hidden={true} assertive={latestMessage?.type === 'alert'}>
        {latestMessage?.type === 'alert' && latestMessage.header}
        {latestMessage?.content?.text}
      </LiveRegion>

      {/* Empty state */}
      {messages.length === 0 && !isLoading ? (
        <Box textAlign="center" padding="xl">
          <TextContent>
            <h3>No messages yet</h3>
            <p>Start a conversation by sending a message below.</p>
          </TextContent>
        </Box>
      ) : (
        <SpaceBetween size="xs">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onRetry={handleRetry}
            />
          ))}

          {/* Loading indicator for new messages */}
          {isLoading && (
            <LiveRegion>
              <Box
                margin={{ bottom: 'xs', left: 'l' }}
                color="text-body-secondary"
              >
                Generating a response
              </Box>
              <LoadingBar variant="gen-ai" />
            </LiveRegion>
          )}
        </SpaceBetween>
      )}
    </div>
  );
}