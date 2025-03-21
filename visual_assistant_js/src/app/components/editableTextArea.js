// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  Button,
  Input,
  SpaceBetween,
  Textarea,
  Alert,
} from '@cloudscape-design/components';
import React, { useState, useCallback, useEffect } from 'react';
import DOMPurify from 'dompurify';

const VALIDATION_RULES = {
  maxLength: 1000,
  minLength: 1,
  allowedPattern: /^[a-zA-Z0-9\s.,!?'"\-_():]+src/,
  blockedWords: ['script', 'onclick', 'javascript', '<', '>', '{', '}'],
};

const EditableText = ({ initialText = [], onTextChange }) => {
  // State for the editable content
  const [text, setText] = useState(initialText);
  const [editingKey, setEditingKey] = useState(null); // Tracks which word is being edited
  const [isFullEditMode, setIsFullEditMode] = useState(false); // Full edit mode flag
  const [fullText, setFullText] = useState(''); // Text for full edit
  const [isReplaceableMode, setIsReplaceableMode] = useState(true); // Toggle replaceable mode
  const [validationError, setValidationError] = useState(null);

  // Sanitize input text
  const sanitizeInput = useCallback((input) => {
    let sanitized = DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [], // No attributes allowed
    });

    // Remove any blocked words
    VALIDATION_RULES.blockedWords.forEach((word) => {
      sanitized = sanitized.replace(new RegExp(word, 'gi'), '');
    });

    return sanitized.trim();
  }, []);

  // Validate input text
  const validateInput = useCallback((input) => {
    if (!input || input.length < VALIDATION_RULES.minLength) {
      return 'Input text cannot be empty';
    }

    if (input.length > VALIDATION_RULES.maxLength) {
      return `Input text cannot exceed ${VALIDATION_RULES.maxLength} characters`;
    }

    if (!VALIDATION_RULES.allowedPattern.test(input)) {
      return 'Input contains invalid characters';
    }

    // Check for blocked words
    const containsBlockedWord = VALIDATION_RULES.blockedWords.some((word) =>
      input.toLowerCase().includes(word.toLowerCase())
    );
    if (containsBlockedWord) {
      return 'Input contains prohibited words or characters';
    }

    return null;
  }, []);

  // Helper function to get the full text value
  const getFullTextValue = useCallback(() => {
    return text.map((segment) =>
      segment.static + (segment.editable || '')).join('');
  }, [text]);

  // Call onTextChange whenever text is updated
  const notifyTextChange = useCallback((newText) => {
    if (onTextChange) {
      const sanitizedText = sanitizeInput(newText);
      const validationError = validateInput(sanitizedText);

      if (!validationError) {
        onTextChange(sanitizedText);
        setValidationError(null);
      } else {
        setValidationError(validationError);
      }
    }
  }, [onTextChange, sanitizeInput, validateInput]);

  useEffect(() => {
    if (!isFullEditMode) {
      notifyTextChange(getFullTextValue());
    }
  }, [text, isFullEditMode, notifyTextChange, getFullTextValue]);

  // Reset to initial state
  const resetText = useCallback(() => {
    const sanitizedInitialText = initialText.map((segment) => ({
      ...segment,
      static: sanitizeInput(segment.static),
      editable: segment.editable ? sanitizeInput(segment.editable) : null,
    }));
    setText(sanitizedInitialText);
    setIsFullEditMode(false);
    setEditingKey(null);
    setIsReplaceableMode(true);
    setValidationError(null);
  }, [initialText, sanitizeInput]);

  // Enter full edit mode
  const startFullEdit = useCallback(() => {
    setIsFullEditMode(true);
    setFullText(getFullTextValue());
  }, [getFullTextValue]);

  // Handle inline editing finish
  const finishEditing = useCallback(() => {
    setEditingKey(null);
  }, []);

  // Handle word change during inline editing
  const handleChange = useCallback((key, value) => {
    const sanitizedValue = sanitizeInput(value);
    const error = validateInput(sanitizedValue);

    if (error) {
      setValidationError(error);
      return;
    }

    setText((prevText) =>
      prevText.map((segment) =>
        segment.key === key ? { ...segment, editable: sanitizedValue } : segment,
      ),
    );
    setValidationError(null);
  }, [sanitizeInput, validateInput]);

  // Handle full text edit
  const handleFullTextChange = useCallback(({ detail }) => {
    const sanitizedValue = sanitizeInput(detail.value);
    const error = validateInput(sanitizedValue);

    if (error) {
      setValidationError(error);
      return;
    }

    setFullText(sanitizedValue);
    setValidationError(null);
  }, [sanitizeInput, validateInput]);

  // Save changes from full edit
  const saveFullEdit = useCallback(() => {
    const sanitizedText = sanitizeInput(fullText);
    const error = validateInput(sanitizedText);

    if (error) {
      setValidationError(error);
      return;
    }

    setText([{ static: sanitizedText, editable: null, key: 'full-text' }]);
    setIsFullEditMode(false);
    setIsReplaceableMode(false);
    notifyTextChange(sanitizedText);
  }, [fullText, sanitizeInput, validateInput, notifyTextChange]);

  return (
    <div>
      {validationError && (
        <Alert type="error" header="Validation Error">
          {validationError}
        </Alert>
      )}

      {isFullEditMode ? (
        <div>
          <Textarea
            value={fullText}
            onChange={handleFullTextChange}
            ariaLabel="Edit full text"
          />
          <div style={{ marginTop: '10px' }}>
            <Button onClick={saveFullEdit} variant="primary">
              Save
            </Button>
            <Button onClick={() => setIsFullEditMode(false)} variant="normal">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'inline-block', lineHeight: '1.5em' }}>
            {text.map((segment) => (
              <span key={segment.key}>
                {segment.static}
                {isReplaceableMode && segment.editable !== null && (
                  <>
                    {editingKey === segment.key ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Input
                          value={segment.editable}
                          onChange={({ detail }) =>
                            handleChange(segment.key, detail.value)
                          }
                          onBlur={finishEditing}
                          ariaLabel={`Edit ${segment.key}`}
                          autoFocus
                          style={{
                            width: `${segment.editable.length + 2}ch`,
                            fontSize: 'inherit',
                            padding: '2px',
                          }}
                        />
                      </span>
                    ) : (
                      <strong
                        style={{ cursor: 'pointer' }}
                        onClick={() => setEditingKey(segment.key)}
                      >
                        {segment.editable}
                      </strong>
                    )}
                  </>
                )}
              </span>
            ))}
          </div>
          <div style={{ marginTop: '10px' }}>
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={resetText} variant="normal" formAction="none">
                Reset to default prompt
              </Button>
              <Button
                onClick={startFullEdit}
                variant="normal"
                formAction="none"
              >
                Edit full text
              </Button>
            </SpaceBetween>
          </div>
          <div className="input-metadata" style={{ marginTop: '5px' }}>
            <small>
              Characters: {getFullTextValue().length} / {VALIDATION_RULES.maxLength}
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableText;
