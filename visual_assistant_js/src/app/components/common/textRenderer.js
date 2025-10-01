// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
'use client';

import React from 'react';
import { Box, TextContent } from '@cloudscape-design/components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './textRenderer.module.css';

/**
 * Detects if text contains markdown patterns
 * @param {string} text - The text to analyze
 * @returns {boolean} - Whether the text appears to contain markdown
 */
function hasMarkdownPatterns(text) {
  if (!text || typeof text !== 'string') {return false;}

  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers
    /\*\*.*?\*\*/,           // Bold
    /\*.*?\*/,               // Italic (but not bold)
    /`.*?`/,                 // Inline code
    /```[\s\S]*?```/,        // Code blocks
    /^\s*[-*+]\s+/m,         // Unordered lists
    /^\s*\d+\.\s+/m,         // Ordered lists
    /^\s*>\s+/m,             // Blockquotes
    /\[.*?\]\(.*?\)/,        // Links
    /^\s*\|.*\|/m,           // Tables
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}

/**
 * Custom components for react-markdown to match Cloudscape design
 */
const markdownComponents = {
  // Headers
  h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
  h4: ({ children }) => <h4 className={styles.h4}>{children}</h4>,
  h5: ({ children }) => <h5 className={styles.h5}>{children}</h5>,
  h6: ({ children }) => <h6 className={styles.h6}>{children}</h6>,

  // Code
  code: ({ inline, children }) =>
    inline ? (
      <code className={styles.inlineCode}>{children}</code>
    ) : (
      <code className={styles.blockCode}>{children}</code>
    ),

  pre: ({ children }) => <pre className={styles.pre}>{children}</pre>,

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.link}
    >
      {children}
    </a>
  ),

  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className={styles.blockquote}>{children}</blockquote>
  ),

  // Lists
  ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
  ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
  li: ({ children }) => <li className={styles.li}>{children}</li>,

  // Paragraphs
  p: ({ children }) => <p className={styles.p}>{children}</p>,
};

/**
 * Renders text content with appropriate formatting
 * @param {Object} props
 * @param {string} props.text - The text content to render
 * @param {boolean} props.forceMarkdown - Force markdown rendering even if no patterns detected
 * @param {Object} props.style - Additional CSS styles
 * @param {string} props.className - Additional CSS classes
 */
export default function TextRenderer({
  text,
  forceMarkdown = false,
  style = {},
  className = '',
  ...props
}) {
  if (!text) {return null;}

  // Determine if we should render as markdown
  const shouldRenderMarkdown = forceMarkdown || hasMarkdownPatterns(text);

  if (shouldRenderMarkdown) {
    return (
      <Box
        className={`${styles.textRenderer} ${className}`}
        style={style}
        {...props}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {text}
        </ReactMarkdown>
      </Box>
    );
  }

  // Render as plain text with line breaks preserved
  const lines = text.split('\n');

  return (
    <Box
      className={`${styles.textRenderer} ${className}`}
      style={style}
      {...props}
    >
      <TextContent>
        {lines.map((line, index) => (
          <React.Fragment key={index}>
            {line}
            {index < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </TextContent>
    </Box>
  );
}

/**
 * Hook to detect if text has markdown patterns
 * @param {string} text - The text to analyze
 * @returns {boolean} - Whether markdown patterns were detected
 */
export function useHasMarkdown(text) {
  return React.useMemo(() => hasMarkdownPatterns(text), [text]);
}