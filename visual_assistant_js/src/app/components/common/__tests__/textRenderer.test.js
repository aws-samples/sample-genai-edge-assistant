// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';
import { render, screen } from '@testing-library/react';
import TextRenderer, { useHasMarkdown } from 'src/app/components/common/textRenderer';

// Mock react-markdown
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }) {
    return <div data-testid="markdown-content">{children}</div>;
  };
});

// Mock remark-gfm
jest.mock('remark-gfm', () => ({}));

describe('TextRenderer', () => {
  test('renders plain text correctly', () => {
    render(<TextRenderer text="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  test('renders markdown text using react-markdown', () => {
    const markdownText = '**Bold text** and *italic text*';
    render(<TextRenderer text={markdownText} />);

    // Should use react-markdown for text with markdown patterns
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-content')).toHaveTextContent(markdownText);
  });

  test('forces markdown rendering when forceMarkdown is true', () => {
    const plainText = 'Just plain text';
    render(<TextRenderer text={plainText} forceMarkdown={true} />);

    // Should use react-markdown even for plain text when forced
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
  });

  test('handles empty text', () => {
    const { container } = render(<TextRenderer text="" />);
    expect(container.firstChild).toBeNull();
  });

  test('handles null text', () => {
    const { container } = render(<TextRenderer text={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('preserves line breaks in plain text', () => {
    const multilineText = 'Line 1\nLine 2\nLine 3';
    render(<TextRenderer text={multilineText} />);

    // Should render with line breaks preserved
    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
    expect(screen.getByText('Line 3')).toBeInTheDocument();
  });
});

describe('useHasMarkdown', () => {
  test('detects markdown patterns', () => {
    const TestComponent = ({ text }) => {
      const hasMarkdown = useHasMarkdown(text);
      return <div data-testid="has-markdown">{hasMarkdown.toString()}</div>;
    };

    render(<TestComponent text="# Header" />);
    expect(screen.getByTestId('has-markdown')).toHaveTextContent('true');
  });

  test('detects plain text', () => {
    const TestComponent = ({ text }) => {
      const hasMarkdown = useHasMarkdown(text);
      return <div data-testid="has-markdown">{hasMarkdown.toString()}</div>;
    };

    render(<TestComponent text="Just plain text" />);
    expect(screen.getByTestId('has-markdown')).toHaveTextContent('false');
  });

  test('detects various markdown patterns', () => {
    const patterns = [
      '# Header',
      '**bold**',
      '*italic*',
      '`code`',
      '```code block```',
      '- list item',
      '1. numbered item',
      '> blockquote',
      '[link](url)',
      '| table | header |',
    ];

    patterns.forEach((pattern) => {
      const TestComponent = () => {
        const hasMarkdown = useHasMarkdown(pattern);
        return <div data-testid={`pattern-${pattern.charAt(0)}`}>{hasMarkdown.toString()}</div>;
      };

      const { unmount } = render(<TestComponent />);
      expect(screen.getByTestId(`pattern-${pattern.charAt(0)}`)).toHaveTextContent('true');
      unmount();
    });
  });
});