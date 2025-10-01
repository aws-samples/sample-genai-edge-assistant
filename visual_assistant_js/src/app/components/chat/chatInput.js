// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  SpaceBetween,
  PromptInput,
  FileTokenGroup,
  FileDropzone,
  Link,
  Icon,
  Button,
  Modal,
  Header,
  ButtonGroup,
} from '@cloudscape-design/components';
import { useFilesDragging } from '@cloudscape-design/components/file-dropzone';
import { processImageForBackend } from 'src/app/utils/imageProcessing';
import { processAudioBlobForBackend } from 'src/app/utils/audioProcessing';
import AudioRecorderPreview from './audioRecorderPreview';

/**
 * File token group i18n strings
 */
const fileTokenGroupI18nStrings = {
  removeFileAriaLabel: (index) => `Remove file ${index + 1}`,
  limitShowFewer: 'Show fewer files',
  limitShowMore: 'Show more files',
  errorIconAriaLabel: 'Error',
  warningIconAriaLabel: 'Warning',
};

/**
 * Chat input component using CloudScape PromptInput
 */
export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Ask a question',
}) {
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const promptInputRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const { areFilesDragging } = useFilesDragging();

  // Initialize camera when modal opens
  useEffect(() => {
    if (showCameraModal) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => console.error('Camera error:', err));
    }
    return () => {
      // Cleanup camera when modal closes
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCameraModal]);

  // Handle audio recording completion
  const handleAudioRecorded = async (audioBlob, duration) => {
    const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: audioBlob.type });
    // Store duration as a property on the file object
    Object.defineProperty(audioFile, 'duration', {
      value: duration,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    setFiles((prev) => [...prev, audioFile]);
    setShowAudioModal(false);
    // Return focus to text input after audio recording
    setTimeout(() => promptInputRef.current?.focus(), 100);
  };

  // Handle audio recording cancel
  const handleAudioCancel = () => {
    setShowAudioModal(false);
    // Return focus to text input after canceling audio recording
    setTimeout(() => promptInputRef.current?.focus(), 100);
  };

  // Handle prompt send
  const onPromptSend = async ({ detail: { value } }) => {
    // Allow sending if there's either text or files
    if ((!value || value.trim().length === 0) && files.length === 0) {
      return;
    }

    if (disabled) {
      return;
    }

    // Process files to create URLs for display and prepare for backend
    const processedFiles = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const processedFile = {
        file,
        url,
        name: file.name,
        type: file.type,
        size: file.size,
        duration: file.duration || null, // Include duration from recorded audio
      };

      // For image files, process for backend
      if (file.type.startsWith('image/')) {
        try {
          const backendData = await processImageForBackend(file);
          processedFile.buffer = backendData.buffer;
          processedFile.metadata = backendData.metadata;

        } catch (error) {
          console.error('Failed to process image for backend:', error);
          // Continue without backend data - file will still be shown in UI
          processedFile.processingError = error.message;
        }
      }

      // For audio files, process for backend
      if (file.type.startsWith('audio/')) {
        try {
          const backendData = await processAudioBlobForBackend(file, file.duration);
          processedFile.buffer = backendData.buffer;
          processedFile.metadata = backendData.metadata;
        } catch (error) {
          console.error('Failed to process audio:', error);
          // Continue without backend data - file will still be shown in UI
          processedFile.processingError = error.message;
        }
      }

      processedFiles.push(processedFile);
    }

    // Create message content
    const content = {};

    // Only add text if it's not empty
    if (value && value.trim().length > 0) {
      content.text = value.trim();
    }

    // Add image content if there are image files
    const imageFiles = processedFiles.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      content.images = imageFiles.map((f) => ({
        url: f.url,
        file: f.file,
        name: f.name,
        buffer: f.buffer, // ArrayBuffer for backend processing
        metadata: f.metadata,
      }));


    }

    // Add audio content if there are audio files
    const audioFiles = processedFiles.filter((f) => f.type.startsWith('audio/'));
    if (audioFiles.length > 0) {
      content.audios = audioFiles.map((f) => ({
        url: f.url,
        file: f.file,
        name: f.name,
        duration: f.duration,
        buffer: f.buffer,
      }));
    }

    // Create message object
    const chatMessage = {
      type: 'user',
      content,
      timestamp: new Date(),
      status: 'sending',
      files: processedFiles.length > 0 ? processedFiles : undefined,
    };

    // Send message
    if (onSendMessage) {
      onSendMessage(chatMessage);
    }

    // Clear input
    setPrompt('');
    setFiles([]);
  };

  return (
    <>
      {/* During loading, action button looks enabled but functionality is disabled. */}
      {/* This will be fixed once prompt input receives an update where the action button can receive focus while being disabled. */}
      {/* In the meantime, changing aria labels of prompt input and action button to reflect this. */}
      <PromptInput
        ref={promptInputRef}
        onChange={({ detail }) => setPrompt(detail.value)}
        onAction={onPromptSend}
        value={prompt}
        actionButtonAriaLabel={disabled ? 'Send message button - suppressed' : 'Send message'}
        actionButtonIconName="send"
        ariaLabel={disabled ? 'Prompt input - suppressed' : 'Prompt input'}
        ariaRequired
        placeholder={placeholder}
        autoFocus
        disableSecondaryActionsPaddings
        spellcheck
        secondaryActions={
          <Box padding={{ left: 'xxs', top: 'xs' }}>
            <ButtonGroup
              ariaLabel="Chat actions"
              items={[
                {
                  type: 'icon-button',
                  id: 'upload',
                  iconName: 'upload',
                  text: 'Upload files',
                },
                {
                  type: 'icon-button',
                  id: 'camera',
                  iconName: 'video-camera-on',
                  text: 'Take picture',
                },
                {
                  type: 'icon-button',
                  id: 'microphone',
                  iconName: 'microphone',
                  text: 'Record audio',
                },
              ]}
              variant="icon"
              onItemClick={({ detail }) => {
                switch (detail.id) {
                case 'upload':
                  // Trigger file input click using ref
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                  break;
                case 'camera':
                  setShowCameraModal(true);
                  break;
                case 'microphone':
                  setShowAudioModal(true);
                  break;
                default:
                  break;
                }
              }}
            />
            {/* Hidden file input for upload functionality */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.mp3,.wav,.m4a"
              style={{ display: 'none' }}
              onChange={(e) => {
                const selectedFiles = Array.from(e.target.files || []);

                // Filter files to only allow JPEG, PNG, MP3, WAV, M4A
                const allowedFiles = selectedFiles.filter((file) => {
                  const type = file.type.toLowerCase();
                  const name = file.name.toLowerCase();

                  return type === 'image/jpeg' ||
                    type === 'image/png' ||
                    type === 'audio/mpeg' ||
                    type === 'audio/mp3' ||
                    type === 'audio/wav' ||
                    type === 'audio/m4a' ||
                    name.match(/\.(jpg|jpeg|png|mp3|wav|m4a)$/);
                });

                if (allowedFiles.length !== selectedFiles.length) {
                  console.warn('Some files were filtered out. Only JPEG, PNG, MP3, WAV, and M4A files are allowed.');
                }

                setFiles((prev) => [...prev, ...allowedFiles]);
                // Clear the input value so the same file can be selected again
                e.target.value = '';
                // Return focus to text input after file selection
                setTimeout(() => promptInputRef.current?.focus(), 100);
              }}
            />
          </Box>
        }
        secondaryContent={
          areFilesDragging ? (
            <FileDropzone
              accept=".jpg,.jpeg,.png,.mp3,.wav,.m4a"
              onChange={({ detail }) => {
                // Filter files to only allow JPEG, PNG, MP3, WAV, M4A
                const allowedFiles = detail.value.filter((file) => {
                  const type = file.type.toLowerCase();
                  const name = file.name.toLowerCase();

                  return type === 'image/jpeg' ||
                    type === 'image/png' ||
                    type === 'audio/mpeg' ||
                    type === 'audio/mp3' ||
                    type === 'audio/wav' ||
                    type === 'audio/m4a' ||
                    name.match(/\.(jpg|jpeg|png|mp3|wav|m4a)$/);
                });

                if (allowedFiles.length !== detail.value.length) {
                  console.warn('Some files were filtered out. Only JPEG, PNG, MP3, WAV, and M4A files are allowed.');
                }

                setFiles((prev) => [...prev, ...allowedFiles]);
                // Return focus to text input after drag & drop
                setTimeout(() => promptInputRef.current?.focus(), 100);
              }}
            >
              <SpaceBetween size="xs" alignItems="center">
                <Icon name="upload" />
                <Box>Drop JPEG, PNG, MP3, WAV, or M4A files here</Box>
              </SpaceBetween>
            </FileDropzone>
          ) : (
            files.length > 0 && (
              <FileTokenGroup
                items={files.map((file, index) => ({
                  file,
                  key: `input-file-${index}-${file.name}`,
                }))}
                onDismiss={({ detail }) => {
                  setFiles((files) => files.filter((_, index) => index !== detail.fileIndex));
                  if (files.length === 1) {
                    promptInputRef.current?.focus();
                  }
                }}
                limit={3}
                alignment="horizontal"
                showFileThumbnail={false} // Disable thumbnails to avoid empty src issues
                i18nStrings={fileTokenGroupI18nStrings}
              />
            )
          )
        }
      />

      {/* Camera Modal */}
      <Modal
        visible={showCameraModal}
        onDismiss={() => setShowCameraModal(false)}
        header={<Header variant="h2">Camera</Header>}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowCameraModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => {
                // Capture image from video
                const video = videoRef.current;
                if (video) {
                  const canvas = document.createElement('canvas');
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(video, 0, 0);

                  canvas.toBlob((blob) => {
                    if (blob) {
                      const file = new File([blob], `camera-${Date.now()}.png`, { type: 'image/png' });
                      setFiles((prev) => [...prev, file]);
                    }
                  });
                }
                setShowCameraModal(false);
                // Return focus to text input after camera capture
                setTimeout(() => promptInputRef.current?.focus(), 100);
              }}>
                Capture
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Box textAlign="center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', maxWidth: '400px', backgroundColor: '#000' }}
          />
        </Box>
      </Modal>

      {/* Audio Recording Modal */}
      <Modal
        visible={showAudioModal}
        onDismiss={() => setShowAudioModal(false)}
        header={<Header variant="h2">Record Audio Message</Header>}
        size="medium"
      >
        <AudioRecorderPreview
          onAudioConfirmed={handleAudioRecorded}
          onCancel={handleAudioCancel}
        />
      </Modal>

      <Box color="text-body-secondary" margin={{ top: 'xs' }} fontSize="body-s">
        Use of this prototype is subject to the{' '}
        <Link href="https://aws.amazon.com/ai/responsible-ai/policy/" external variant="primary" fontSize="inherit">
          AWS Responsible AI Policy
        </Link>
        .
      </Box>
    </>
  );
}