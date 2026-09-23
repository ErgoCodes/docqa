import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '@/api/types';
import { MessageBubble } from './MessageBubble';

describe('MessageBubble', () => {
  it('renders plain text for user messages without markdown interpretation', () => {
    const userMessage: Message = {
      role: 'user',
      content: '**Bold text** and _italic_',
      citations: [],
      createdAt: new Date().toISOString(),
    };

    render(<MessageBubble message={userMessage} />);

    expect(screen.getByText('**Bold text** and _italic_')).toBeInTheDocument();
  });

  it('renders markdown for assistant messages safely', () => {
    const assistantMessage: Message = {
      role: 'assistant',
      content: '**Texto en negrita** y un [enlace](https://example.com)',
      citations: [],
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<MessageBubble message={assistantMessage} />);

    const strongEl = container.querySelector('strong');
    expect(strongEl).toHaveTextContent('Texto en negrita');

    const anchorEl = container.querySelector('a');
    expect(anchorEl).toHaveAttribute('href', 'https://example.com');
  });

  it('neutralizes malicious javascript: links in assistant markdown', () => {
    const maliciousMessage: Message = {
      role: 'assistant',
      content: '[Click me](javascript:alert(1))',
      citations: [],
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<MessageBubble message={maliciousMessage} />);

    const anchorEl = container.querySelector('a');
    // Default react-markdown urlTransform removes or neutralizes javascript: protocols
    if (anchorEl) {
      expect(anchorEl.getAttribute('href')).not.toBe('javascript:alert(1)');
    }
  });

  it('does not execute raw HTML tags injected in assistant content', () => {
    const xssMessage: Message = {
      role: 'assistant',
      content: '<img src=x onerror="alert(1)"> <script>alert(1)</script>',
      citations: [],
      createdAt: new Date().toISOString(),
    };

    const { container } = render(<MessageBubble message={xssMessage} />);

    // No actual script or img element should be created from raw HTML
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
