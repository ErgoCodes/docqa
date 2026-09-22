import { describe, expect, it } from 'vitest';
import {
  conversationIdParamsSchema,
  conversationResponseSchema,
  createConversationBodySchema,
  messageResponseSchema,
  sendMessageBodySchema,
} from './conversation.schemas.js';

describe('createConversationBodySchema', () => {
  it('defaults documentIds to empty array when omitted', () => {
    const parsed = createConversationBodySchema.parse({});
    expect(parsed).toEqual({ documentIds: [] });
  });

  it('accepts explicit empty array for documentIds', () => {
    const parsed = createConversationBodySchema.parse({ documentIds: [] });
    expect(parsed).toEqual({ documentIds: [] });
  });

  it('accepts valid non-empty documentIds array', () => {
    const parsed = createConversationBodySchema.parse({ documentIds: ['a', 'b'] });
    expect(parsed).toEqual({ documentIds: ['a', 'b'] });
  });

  it('rejects documentIds containing an empty string', () => {
    expect(() => createConversationBodySchema.parse({ documentIds: [''] })).toThrow();
    expect(() => createConversationBodySchema.parse({ documentIds: ['doc-1', ''] })).toThrow();
  });

  it('rejects undeclared extra fields due to strict mode', () => {
    expect(() =>
      createConversationBodySchema.parse({
        documentIds: ['a'],
        extraField: 'not-allowed',
      }),
    ).toThrow();
  });
});

describe('conversationIdParamsSchema', () => {
  it('parses valid id parameter', () => {
    const parsed = conversationIdParamsSchema.parse({ id: 'conv-123' });
    expect(parsed).toEqual({ id: 'conv-123' });
  });

  it('rejects empty string id', () => {
    expect(() => conversationIdParamsSchema.parse({ id: '' })).toThrow();
  });

  it('rejects undeclared extra fields', () => {
    expect(() => conversationIdParamsSchema.parse({ id: 'conv-123', extra: 'foo' })).toThrow();
  });
});

describe('sendMessageBodySchema', () => {
  it('parses valid question string and trims whitespace', () => {
    const parsed = sendMessageBodySchema.parse({ question: '  What is RAG?  ' });
    expect(parsed).toEqual({ question: 'What is RAG?' });
  });

  it('rejects empty or whitespace-only question', () => {
    expect(() => sendMessageBodySchema.parse({ question: '' })).toThrow();
    expect(() => sendMessageBodySchema.parse({ question: '   ' })).toThrow();
  });

  it('rejects question exceeding 2000 characters', () => {
    expect(() => sendMessageBodySchema.parse({ question: 'a'.repeat(2001) })).toThrow();
    expect(sendMessageBodySchema.parse({ question: 'a'.repeat(2000) })).toEqual({
      question: 'a'.repeat(2000),
    });
  });

  it('rejects undeclared extra fields', () => {
    expect(() =>
      sendMessageBodySchema.parse({
        question: 'Valid question',
        extraField: 'disallowed',
      }),
    ).toThrow();
  });
});

describe('messageResponseSchema', () => {
  it('parses valid message response object', () => {
    const now = new Date();
    const parsed = messageResponseSchema.parse({
      role: 'assistant',
      content: 'This is the answer.',
      citations: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          page: 2,
        },
      ],
      createdAt: now,
    });

    expect(parsed).toEqual({
      role: 'assistant',
      content: 'This is the answer.',
      citations: [{ chunkId: 'chunk-1', documentId: 'doc-1', page: 2 }],
      createdAt: now,
    });
  });

  it('rejects non-positive page number in citation', () => {
    expect(() =>
      messageResponseSchema.parse({
        role: 'assistant',
        content: 'Answer',
        citations: [{ chunkId: 'chunk-1', documentId: 'doc-1', page: 0 }],
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});

describe('conversationResponseSchema', () => {
  it('parses valid complete object and strips undeclared fields', () => {
    const rawConversation = {
      id: 'conv-123',
      userId: 'user-secret',
      documentIds: ['doc-1', 'doc-2'],
      messages: [
        {
          role: 'user',
          content: 'Hello',
          citations: [
            {
              chunkId: 'chunk-1',
              documentId: 'doc-1',
              page: 1,
            },
          ],
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
      extraField: 'should-be-stripped',
    };

    const parsed = conversationResponseSchema.parse(rawConversation);

    expect(parsed).toEqual({
      id: 'conv-123',
      documentIds: ['doc-1', 'doc-2'],
      messages: rawConversation.messages,
      createdAt: rawConversation.createdAt,
    });
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('extraField');
  });

  it('validates empty messages array', () => {
    const rawConversation = {
      id: 'conv-123',
      documentIds: [],
      messages: [],
      createdAt: new Date(),
    };

    const parsed = conversationResponseSchema.parse(rawConversation);
    expect(parsed.messages).toEqual([]);
  });

  it('rejects invalid role in message', () => {
    const invalidConversation = {
      id: 'conv-123',
      documentIds: [],
      messages: [
        {
          role: 'system',
          content: 'You are an assistant',
          citations: [],
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
    };

    expect(() => conversationResponseSchema.parse(invalidConversation)).toThrow();
  });
});
