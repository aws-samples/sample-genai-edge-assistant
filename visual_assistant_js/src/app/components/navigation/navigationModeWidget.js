// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import {
  Box,
  Container,
  ExpandableSection,
  Grid,
  Header,
  SpaceBetween,
  Toggle,
  Button,
} from '@cloudscape-design/components';
import { fetchAuthSession } from 'aws-amplify/auth';
import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

import NavigationCamera from 'src/app/components/navigation/navigationCamera';
import EditableTextArea from 'src/app/components/editableTextArea';
import {
  initialEdges,
  initialNodes,
  initialPrompt_1,
  initialPrompt_2,
  initialPrompt_3,
  initialPrompt_4,
} from 'src/app/globals';
import FrameManager from 'src/app/utils/frameManager';
import { rawImageToBase64, getImageHash } from 'src/app/utils/navigationUtils';
import TopBar from 'src/app/components/topBar';

const CAPTURE_INTERVAL = 500; // 500ms between captures
const REQUEST_TIMEOUT = 1000; // 1s timeout for requests

const NavigationMode = () => {
  // Voiceover
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const aggregateResponse = (responseData) => {
    if (!responseData) {return '';}

    const isObject = responseData.first_prompt_answer === 'yes';
    if (!isObject) {return 'No object detected';}

    const action =
      responseData.second_prompt_answer === 'yes' ? 'reach' : 'follow';
    const direction = responseData.third_prompt_answer;

    return `${action} the object by going ${direction}`;
  };

  const speakMessage = useCallback(
    (message) => {
      if (
        !isSpeechEnabled ||
        !message ||
        speaking ||
        message === lastSpokenMessage
      )
      {return;}

      const utterance = new SpeechSynthesisUtterance(message);
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        setLastSpokenMessage(message);
      };

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [isSpeechEnabled, speaking, lastSpokenMessage]
  );

  // Core state
  const [imageData, setImageData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalOutput, setFinalOutput] = useState(null);
  const [error, setError] = useState(null);
  const [useCameraFlux, setUseCameraFlux] = useState(true);
  const [imageHash, setImageHash] = useState(null);
  const [returnCode, setReturnCode] = useState(null);
  const [responseData, setResponseData] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);

  // Statistics state
  const [stats, setStats] = useState({
    meanTimeNoCarpet: 0,
    meanTimeYesCarpet: 0,
    numRequestNoCarpet: 0,
    numRequestYesCarpet: 0,
  });

  // Prompts state
  const [prompt1, setPrompt1] = useState(
    initialPrompt_1
      .map((segment) => segment.static + (segment.editable || ''))
      .join('')
  );
  const [prompt2, setPrompt2] = useState(
    initialPrompt_2
      .map((segment) => segment.static + (segment.editable || ''))
      .join('')
  );
  const [prompt3, setPrompt3] = useState(
    initialPrompt_3
      .map((segment) => segment.static + (segment.editable || ''))
      .join('')
  );
  const [prompt4, setPrompt4] = useState(
    initialPrompt_4
      .map((segment) => segment.static + (segment.editable || ''))
      .join('')
  );

  // Handle manual image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageData(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle frame capture
  const captureFrame = useCallback(async () => {
    try {
      const frame = await rawImageToBase64(
        FrameManager.getInstance().getCurrentFrame()
      );
      if (frame) {
        setImageData(frame);
        setImageHash(getImageHash(frame));
        setError(null); // Clear error on success
        return frame;
      }
      return null;
    } catch (err) {
      setError('Failed to capture frame: ' + err.message);
      return null;
    }
  }, []);

  // Handle API request
  const processImage = useCallback(
    async (imageBase64) => {
      if (!imageBase64 || isProcessing) {
        return;
      }

      setIsProcessing(true);
      const startTime = performance.now();

      try {
        const currentSession = await fetchAuthSession();
        const token = currentSession.tokens.idToken.toString();

        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_GATEWAY_ENDPOINT}/invokesagemakerinference`,
          {
            prompt_1: prompt1,
            prompt_2: prompt2,
            prompt_3: prompt3,
            prompt_4: prompt4,
            image_data: imageBase64,
          },
          {
            headers: {
              Authorization: token,
              'Content-Type': 'application/json',
            },
            timeout: REQUEST_TIMEOUT,
          }
        );

        // Clear error on successful processing
        setError(null);

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        // Update response data
        setResponseData(response.data);
        setReturnCode(response.status);
        setElapsedTime(
          `Function execution took ${executionTime.toFixed(1)} milliseconds.`
        );

        // Update stats
        setStats((prevStats) => {
          const hasCarpet = response.data.first_prompt_answer === 'yes';
          return {
            ...prevStats,
            [hasCarpet ? 'numRequestYesCarpet' : 'numRequestNoCarpet']:
              prevStats[
                hasCarpet ? 'numRequestYesCarpet' : 'numRequestNoCarpet'
              ] + 1,
            [hasCarpet ? 'meanTimeYesCarpet' : 'meanTimeNoCarpet']:
              (prevStats[hasCarpet ? 'meanTimeYesCarpet' : 'meanTimeNoCarpet'] *
                prevStats[
                  hasCarpet ? 'numRequestYesCarpet' : 'numRequestNoCarpet'
                ] +
                executionTime) /
              (prevStats[
                hasCarpet ? 'numRequestYesCarpet' : 'numRequestNoCarpet'
              ] +
                1),
          };
        });

        // Update output message
        if (response.data.first_prompt_answer === 'yes') {
          setFinalOutput(
            `To ${response.data.second_prompt_answer === 'yes' ? 'REACH' : 'FOLLOW'} the object, you should go ${response.data.third_prompt_answer}`
          );
        } else {
          setFinalOutput('There is no object in the frame.');
        }

        const message = aggregateResponse(response.data);
        speakMessage(message);
      } catch (err) {
        setError('Request failed: ' + err.message);
        setReturnCode(err.response?.status || 500);
      } finally {
        setIsProcessing(false);
      }
    },
    [prompt1, prompt2, prompt3, prompt4, isProcessing, speakMessage]
  );

  // Manual capture and process
  const handleManualCapture = async () => {
    const frame = await captureFrame();
    if (frame) {
      processImage(frame);
    }
  };

  // Automatic capture and process loop
  useEffect(() => {
    if (!useCameraFlux) {
      return;
    }

    let intervalId = null;

    const captureAndProcess = async () => {
      const frame = await captureFrame();
      if (frame) {
        processImage(frame);
      }
    };

    intervalId = setInterval(captureAndProcess, CAPTURE_INTERVAL);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [useCameraFlux, captureFrame, processImage]);

  // Image data debug logging
  useEffect(() => {
    if (imageData) {
      console.log('imageData updated:', getImageHash(imageData));
    }
  }, [imageData]);

  const buttonStyle = {
    backgroundColor: 'blue',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  };

  return (
    <div>
      <div
        style={{
          backgroundColor: '#000000',
        }}
        id="top-bar"
      >
        <TopBar />
      </div>
      <NavigationCamera />

      <div className="p-3 rounded max-h-48 overflow-auto font-mono text-sm flex justify-center items-center">
        <div className="text-center">
          <strong>{finalOutput}</strong>
        </div>
      </div>

      <ExpandableSection headerText="Customize prompts" defaultExpanded={true}>
        <SpaceBetween direction="vertical" size="s">
          <Container header={<Header variant="h3">Prompt logic</Header>}>
            <div style={{ height: '500px', width: '100%' }}>
              <ReactFlow nodes={initialNodes} edges={initialEdges} fitView>
                <Background />
                <Controls />
              </ReactFlow>
            </div>
          </Container>

          {[
            {
              header: 'Prompt 1',
              value: prompt1,
              setter: setPrompt1,
              initial: initialPrompt_1,
            },
            {
              header: 'Prompt 2',
              value: prompt2,
              setter: setPrompt2,
              initial: initialPrompt_2,
            },
            {
              header: 'Prompt 3',
              value: prompt3,
              setter: setPrompt3,
              initial: initialPrompt_3,
            },
            {
              header: 'Prompt 4',
              value: prompt4,
              setter: setPrompt4,
              initial: initialPrompt_4,
            },
          ].map((prompt, index) => (
            <Container
              key={index}
              header={
                <Header
                  variant="h3"
                  description="Click on highlighted words to edit them"
                >
                  {prompt.header}
                </Header>
              }
            >
              <Container>
                <EditableTextArea
                  initialText={prompt.initial}
                  onTextChange={prompt.setter}
                />
              </Container>
            </Container>
          ))}
        </SpaceBetween>
      </ExpandableSection>

      {/* Logs Section */}
      <ExpandableSection headerText="Endpoint Logs" defaultExpanded={true}>
        <Container>
          <Grid
            gridDefinition={[
              { colspan: { default: 12, xs: 4 } },
              { colspan: { default: 12, xs: 6 } },
              { colspan: { default: 12, xs: 2 } },
            ]}
          >
            {/* Image Control Panel */}
            <div className="bg-gray-100 p-3 rounded-lg overflow-auto font-mono text-sm h-full">
              <strong>Image</strong>
              <br />
              <hr />
              <br />

              <SpaceBetween
                direction="horizontal"
                size="xs"
                alignItems="center"
              >
                <Box
                  color={
                    useCameraFlux ? 'text-body-secondary' : 'text-body-default'
                  }
                >
                  Use camera flux
                </Box>
                <Toggle
                  checked={useCameraFlux}
                  onChange={({ detail }) => setUseCameraFlux(detail.checked)}
                />
                <Button
                  iconName={isSpeechEnabled ? 'audio-on' : 'audio-off'}
                  onClick={() => setIsSpeechEnabled(!isSpeechEnabled)}
                  variant={isSpeechEnabled ? 'primary' : 'normal'}
                >
                  {isSpeechEnabled ? 'Disable Voice' : 'Enable Voice'}
                </Button>
              </SpaceBetween>

              {!useCameraFlux && (
                <div className="mt-3">
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      id="image-upload"
                    />
                    <label htmlFor="image-upload">
                      <button
                        style={buttonStyle}
                        onClick={() =>
                          document.getElementById('image-upload').click()
                        }
                      >
                        Upload Image
                      </button>
                    </label>
                    <button style={buttonStyle} onClick={handleManualCapture}>
                      Get current frame
                    </button>
                  </div>
                  <button
                    style={buttonStyle}
                    onClick={() => processImage(imageData)}
                    disabled={isProcessing || !imageData}
                  >
                    {isProcessing ? 'Processing...' : 'Send Request'}
                  </button>
                </div>
              )}

              <br />
              <hr />
              <br />

              {imageData && (
                <div>
                  <img
                    src={imageData}
                    alt="Captured"
                    style={{ maxWidth: '100%' }}
                  />
                  <br />
                  <p>Hash: {imageHash}</p>
                </div>
              )}
            </div>

            {/* Response Logs */}
            <div className="bg-gray-100 p-3 rounded-lg overflow-auto font-mono text-sm h-full">
              <strong>Logs</strong>
              <br />
              <hr />
              <br />

              <p>
                <strong>Hash of image sent:</strong> {imageHash}
              </p>
              <p>
                <strong>Elapsed time:</strong> {elapsedTime}
              </p>
              <p>
                <strong>Return code:</strong> {returnCode}
              </p>

              {error && (
                <div>
                  <p style={{ color: 'red' }}>
                    <strong>Error:</strong> {error}
                  </p>
                </div>
              )}

              <br />
              <pre>
                <strong>Content:</strong>{' '}
                {JSON.stringify(responseData, null, 2)}
              </pre>
            </div>

            {/* Statistics */}
            <div className="bg-gray-100 p-3 rounded-lg overflow-auto font-mono text-sm h-full">
              <strong>Statistics:</strong>
              <br />
              <br />
              Mean exec time (ms):
              <p>- no: {stats.meanTimeNoCarpet.toFixed(1)}</p>
              <p>- yes: {stats.meanTimeYesCarpet.toFixed(1)}</p>
              Num of request/result:
              <p>- no: {stats.numRequestNoCarpet}</p>
              <p>- yes: {stats.numRequestYesCarpet}</p>
              <br />
              <br />
              <strong>Current prompts:</strong>
              <br />
              <br />
              {prompt1}
              <br />
              <br />
              {prompt2}
              <br />
              <br />
              {prompt3}
              <br />
              <br />
              {prompt4}
              <br />
              <br />
            </div>
          </Grid>
        </Container>
      </ExpandableSection>
    </div>
  );
};

export default NavigationMode;
