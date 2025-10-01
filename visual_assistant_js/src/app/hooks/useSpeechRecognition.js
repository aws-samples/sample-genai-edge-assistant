// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useEffect, useRef, useState } from 'react';
import { useMetaStore } from 'src/app/stores/metaStore';

export function useSpeechRecognition() {
  const recognition = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const currentModeRef = useRef('playground');
  const restartTimeoutRef = useRef(null);

  const voiceControlEnabled = useMetaStore(
    (state) => state.voiceControlEnabled,
  );
  const currentMode = useMetaStore((state) => state.currentMode);
  const setCurrentMode = useMetaStore((state) => state.setCurrentMode);

  // Track voice control state changes (only log when voice control is enabled)
  useEffect(() => {
    if (voiceControlEnabled) {
      console.log(`Voice control: ${isListening ? 'listening' : 'ready'} in ${currentMode} mode`);
    }
  }, [voiceControlEnabled, currentMode, isListening]);

  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition || !('speechSynthesis' in window)) {
      console.log('This browser does not support the required speech APIs');
      return;
    }

    if (!recognition.current) {
      recognition.current = new SpeechRecognition();
      recognition.current.lang = 'en-US';
      recognition.current.continuous = true;
      recognition.current.interimResults = false;
      recognition.current.maxAlternatives = 1;

      recognition.current.onresult = function (event) {
        const command =
          event.results[event.results.length - 1][0].transcript.toLowerCase();

        console.log(`Voice command received: "${command}"`);

        let newMode = null;
        let modeText = '';

        // Handle specific mode commands
        if (command.includes('switch to playground') || command.includes('playground mode')) {
          newMode = 'playground';
          modeText = 'playground mode';
        } else if (command.includes('switch to navigation') || command.includes('navigation mode')) {
          newMode = 'navigation';
          modeText = 'navigation mode';
        } else if (command.includes('switch to chat') || command.includes('chat mode')) {
          newMode = 'chat';
          modeText = 'chat mode';
        } else if (command.includes('switch mode') || command.includes('change mode')) {
          // Cycle through modes: playground -> navigation -> chat -> playground
          const modes = ['playground', 'navigation', 'chat'];
          const currentIndex = modes.indexOf(currentModeRef.current);
          const nextIndex = (currentIndex + 1) % modes.length;
          newMode = modes[nextIndex];
          modeText = `${newMode} mode`;
        }

        if (newMode && newMode !== currentModeRef.current) {
          console.log(`Voice command: "${command}" → switching to ${newMode} mode`);
          setCurrentMode(newMode);
          currentModeRef.current = newMode;

          if ('vibrate' in navigator) {
            navigator.vibrate(200);
          }

          const utterance = new SpeechSynthesisUtterance(
            `Switched to ${modeText}`,
          );
          utterance.lang = 'en-US';
          window.speechSynthesis.speak(utterance);
        } else if (newMode && newMode === currentModeRef.current) {
          console.log(`Voice command: "${command}" but already in ${newMode} mode`);
          const utterance = new SpeechSynthesisUtterance(
            `Already in ${modeText}`,
          );
          utterance.lang = 'en-US';
          window.speechSynthesis.speak(utterance);
        }
      };

      recognition.current.onend = () => {
        // Only restart if we're still supposed to be listening
        if (isListening) {
          // Clear any existing restart timeout
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }

          // Add a small delay before restarting to avoid rapid restarts
          restartTimeoutRef.current = setTimeout(() => {
            if (isListening && recognition.current) {
              try {
                recognition.current.start();
              } catch (error) {
                console.error('Voice control restart failed:', error);
              }
            }
          }, 500);
        }
      };

      recognition.current.onerror = (event) => {
        // Only log significant errors, not normal timeouts
        if (event.error === 'audio-capture') {
          console.error('Voice control: Microphone access denied or not available');
        } else if (event.error === 'not-allowed') {
          console.error('Voice control: Microphone permission denied');
        } else if (event.error !== 'no-speech') {
          // Don't log 'no-speech' as it's normal behavior
          console.warn('Voice control error:', event.error);
        }
      };
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognition.current) {
        recognition.current.stop();
        setIsListening(false);
      }
    };
  }, []);

  useEffect(() => {
    if (voiceControlEnabled && recognition.current && !isListening) {
      try {
        recognition.current.start();
        setIsListening(true);
        const modeText = `${currentMode} mode`;
        const allModes = ['playground', 'navigation', 'chat'];
        const otherModes = allModes.filter((mode) => mode !== currentMode);
        const suggestions = otherModes.map((mode) => `"switch to ${mode}"`).join(', ');

        const initialUtterance = new SpeechSynthesisUtterance(
          `Voice control enabled. Currently in ${modeText}. Try saying ${suggestions}, or just "switch mode".`,
        );
        initialUtterance.lang = 'en-US';
        window.speechSynthesis.speak(initialUtterance);
      } catch (error) {
        console.error('Failed to start voice control:', error);
      }
    } else if (!voiceControlEnabled && recognition.current && isListening) {
      // Clear any pending restart timeout
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }

      recognition.current.stop();
      setIsListening(false);
      const disabledUtterance = new SpeechSynthesisUtterance(
        'Voice control disabled.',
      );
      disabledUtterance.lang = 'en-US';
      window.speechSynthesis.speak(disabledUtterance);
    }
  }, [voiceControlEnabled, currentMode]);

  return;
}
