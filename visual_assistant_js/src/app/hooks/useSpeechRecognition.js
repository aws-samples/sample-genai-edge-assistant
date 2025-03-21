// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useEffect, useRef, useState } from 'react';
import { useMetaStore } from 'src/app/stores/metaStore';

export function useSpeechRecognition() {
  const recognition = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const currentModeRef = useRef(false);

  const voiceControlEnabled = useMetaStore(
    (state) => state.voiceControlEnabled,
  );
  const navigationModeActivated = useMetaStore(
    (state) => state.navigationModeActivated,
  );
  const setNavigationModeActivated = useMetaStore(
    (state) => state.setNavigationModeActivated,
  );

  useEffect(() => {
    currentModeRef.current = navigationModeActivated;
  }, [navigationModeActivated]);

  useEffect(() => {
    if (
      !('webkitSpeechRecognition' in window) ||
      !('speechSynthesis' in window)
    ) {
      console.log('This browser does not support the required speech APIs');
      return;
    }

    if (!recognition.current) {
      recognition.current = new webkitSpeechRecognition();
      recognition.current.lang = 'en-US';
      recognition.current.continuous = true;
      console.log('webkitSpeechRecognition is instantiated');

      recognition.current.onresult = function (event) {
        const command =
          event.results[event.results.length - 1][0].transcript.toLowerCase();
        if (
          command.includes('switch mode') ||
          command.includes('change mode')
        ) {
          const newMode = !currentModeRef.current;
          setNavigationModeActivated(newMode);
          currentModeRef.current = newMode;

          if ('vibrate' in navigator) {
            navigator.vibrate(200);
          }

          const modeText = newMode ? 'navigation mode' : 'playground mode';
          const utterance = new SpeechSynthesisUtterance(
            `Switched to ${modeText}`,
          );
          utterance.lang = 'en-US';
          window.speechSynthesis.speak(utterance);
        }
      };

      recognition.current.onend = () => {
        if (isListening) {
          recognition.current.start();
        }
      };
    }

    return () => {
      if (recognition.current) {
        recognition.current.stop();
        setIsListening(false);
      }
    };
  }, []);

  useEffect(() => {
    if (voiceControlEnabled && recognition.current && !isListening) {
      recognition.current.start();
      setIsListening(true);
      const modeText = navigationModeActivated
        ? 'navigation mode'
        : 'playground mode';
      const initialUtterance = new SpeechSynthesisUtterance(
        `Voice control enabled. Currently in ${modeText}. Say "switch mode" or "change mode" to toggle.`,
      );
      initialUtterance.lang = 'en-US';
      window.speechSynthesis.speak(initialUtterance);
    } else if (!voiceControlEnabled && recognition.current && isListening) {
      recognition.current.stop();
      setIsListening(false);
      const disabledUtterance = new SpeechSynthesisUtterance(
        'Voice control disabled.',
      );
      disabledUtterance.lang = 'en-US';
      window.speechSynthesis.speak(disabledUtterance);
    }
  }, [voiceControlEnabled, navigationModeActivated, isListening]);

  return;
}
