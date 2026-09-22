import { describe, expect, it } from 'vitest';
import { conversationResponseSchema, createConversationBodySchema } from './conversation.schemas.js';

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
