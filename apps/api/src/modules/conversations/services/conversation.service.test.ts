import { describe, expect, it, vi } from 'vitest';
import type { SearchChunksService } from '../../chunks/services/search-chunks.service.js';
import type { ChunkSearchResult } from '../../chunks/types/chunk.js';
import type { DocumentRepository } from '../../documents/interfaces/document.repository.js';
import type { Document } from '../../documents/types/document.js';
import type { LlmProvider } from '../../llm/interfaces/llm-provider.js';
import type { ConversationRepository } from '../interfaces/conversation.repository.js';
import type { Conversation, Message, NewConversation } from '../types/conversation.js';
import { NO_CHUNKS_FOUND_MESSAGE, createConversationService } from './conversation.service.js';

function createMockDependencies() {
  const storedDocuments = new Map<string, Document>([
    [
      'doc-user1-1',
      {
        id: 'doc-user1-1',
        userId: 'user-1',
        title: 'doc-1',
        storageKey: 'user-1/doc-1.pdf',
        pages: 2,
        status: 'ready',
        error: null,
        createdAt: new Date('2026-09-01T00:00:00Z'),
      },
    ],
    [
      'doc-user1-2',
      {
        id: 'doc-user1-2',
        userId: 'user-1',
        title: 'doc-2',
        storageKey: 'user-1/doc-2.pdf',
        pages: 5,
        status: 'ready',
        error: null,
        createdAt: new Date('2026-09-02T00:00:00Z'),
      },
    ],
    [
      'doc-user2-1',
      {
        id: 'doc-user2-1',
        userId: 'user-2',
        title: 'doc-3',
        storageKey: 'user-2/doc-3.pdf',
        pages: 3,
        status: 'ready',
        error: null,
        createdAt: new Date('2026-09-03T00:00:00Z'),
      },
    ],
  ]);

  const storedConversations = new Map<string, Conversation>([
    [
      'conv-user1-1',
      {
        id: 'conv-user1-1',
        userId: 'user-1',
        documentIds: ['doc-user1-1'],
        messages: [],
        createdAt: new Date('2026-09-10T00:00:00Z'),
      },
    ],
    [
      'conv-user2-1',
      {
        id: 'conv-user2-1',
        userId: 'user-2',
        documentIds: ['doc-user2-1'],
        messages: [],
        createdAt: new Date('2026-09-10T00:00:00Z'),
      },
    ],
  ]);

  const documents: DocumentRepository = {
    insert: vi.fn(),
    findById: vi.fn((id: string, userId: string): Promise<Document | null> => {
      const doc = storedDocuments.get(id);
      if (!doc || doc.userId !== userId) {
        return Promise.resolve(null);
      }
      return Promise.resolve(doc);
    }),
    findAllByUser: vi.fn((userId: string): Promise<Document[]> => {
      return Promise.resolve(
        Array.from(storedDocuments.values()).filter((d) => d.userId === userId),
      );
    }),
    deleteById: vi.fn((): Promise<boolean> => Promise.resolve(false)),
  };

  const conversations: ConversationRepository = {
    insert: vi.fn((conv: NewConversation): Promise<Conversation> => {
      const stored: Conversation = {
        id: `conv-${storedConversations.size + 1}`,
        ...conv,
      };
      storedConversations.set(stored.id, stored);
      return Promise.resolve(stored);
    }),
    findById: vi.fn((id: string, userId: string): Promise<Conversation | null> => {
      const conv = storedConversations.get(id);
      if (!conv || conv.userId !== userId) {
        return Promise.resolve(null);
      }
      return Promise.resolve(conv);
    }),
    appendMessages: vi.fn((id: string, userId: string, messages: Message[]): Promise<Conversation | null> => {
      const conv = storedConversations.get(id);
      if (!conv || conv.userId !== userId) {
        return Promise.resolve(null);
      }
      const updated: Conversation = {
        ...conv,
        messages: [...conv.messages, ...messages],
      };
      storedConversations.set(id, updated);
      return Promise.resolve(updated);
    }),
  };

  const searchChunks: SearchChunksService = {
    searchChunks: vi.fn((): Promise<ChunkSearchResult[]> => Promise.resolve([])),
  };

  const llmProvider: LlmProvider = {
    generate: vi.fn((): Promise<string> => Promise.resolve('LLM generated response')),
  };

  return {
    documents,
    conversations,
    searchChunks,
    llmProvider,
    storedDocuments,
    storedConversations,
  };
}

describe('ConversationService', () => {
  describe('create', () => {
    it('creates a conversation with empty documentIds and empty messages', async () => {
      const deps = createMockDependencies();
      const fixedDate = new Date('2026-09-22T10:00:00Z');
      const service = createConversationService({ ...deps, now: () => fixedDate });

      const result = await service.create('user-1', []);

      expect(result.id).toBe('conv-3');
      expect(result.userId).toBe('user-1');
      expect(result.documentIds).toEqual([]);
      expect(result.messages).toEqual([]);
      expect(result.createdAt).toEqual(fixedDate);
      expect(deps.conversations.insert).toHaveBeenCalledTimes(1);
    });

    it('creates a conversation with valid documentIds belonging to the user', async () => {
      const deps = createMockDependencies();
      const service = createConversationService(deps);

      const result = await service.create('user-1', ['doc-user1-1', 'doc-user1-2']);

      expect(result.documentIds).toEqual(['doc-user1-1', 'doc-user1-2']);
      expect(deps.conversations.insert).toHaveBeenCalledTimes(1);
    });

    it('deduplicates duplicate documentIds when creating conversation', async () => {
      const deps = createMockDependencies();
      const service = createConversationService(deps);

      const result = await service.create('user-1', ['doc-user1-1', 'doc-user1-1', 'doc-user1-2']);

      expect(result.documentIds).toEqual(['doc-user1-1', 'doc-user1-2']);
      expect(deps.conversations.insert).toHaveBeenCalledTimes(1);
      expect(deps.conversations.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: ['doc-user1-1', 'doc-user1-2'],
        }),
      );
    });

    it('throws CONVERSATION_DOCUMENT_NOT_FOUND (404) if a document does not exist and does not insert', async () => {
      const deps = createMockDependencies();
      const service = createConversationService(deps);

      await expect(service.create('user-1', ['non-existent-id'])).rejects.toMatchObject({
        code: 'CONVERSATION_DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });

      expect(deps.conversations.insert).not.toHaveBeenCalled();
    });

    it('RNF-01: throws 404 if a document exists but belongs to another user and does not insert', async () => {
      const deps = createMockDependencies();
      const service = createConversationService(deps);

      await expect(service.create('user-1', ['doc-user2-1'])).rejects.toMatchObject({
        code: 'CONVERSATION_DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });

      expect(deps.conversations.insert).not.toHaveBeenCalled();
    });

    it('fails entirely when mixing valid user documents with an invalid or alien document', async () => {
      const deps = createMockDependencies();
      const service = createConversationService(deps);

      await expect(
        service.create('user-1', ['doc-user1-1', 'doc-user2-1']),
      ).rejects.toMatchObject({
        code: 'CONVERSATION_DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });

      expect(deps.conversations.insert).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('successfully answers a question, cites all retrieved chunks, and persists user and assistant messages', async () => {
      const deps = createMockDependencies();
      const fixedDate = new Date('2026-09-22T10:30:00Z');
      const service = createConversationService({ ...deps, now: () => fixedDate });

      const retrievedChunks: ChunkSearchResult[] = [
        {
          id: 'chunk-1',
          documentId: 'doc-user1-1',
          userId: 'user-1',
          page: 1,
          index: 0,
          text: 'Fragment text on page 1.',
          score: 0.92,
        },
        {
          id: 'chunk-2',
          documentId: 'doc-user1-1',
          userId: 'user-1',
          page: 2,
          index: 1,
          text: 'Fragment text on page 2.',
          score: 0.88,
        },
      ];

      vi.mocked(deps.searchChunks.searchChunks).mockResolvedValue(retrievedChunks);
      vi.mocked(deps.llmProvider.generate).mockResolvedValue('The answer based on fragments.');

      const result = await service.sendMessage('user-1', 'conv-user1-1', 'What is on page 1 and 2?');

      expect(result).toEqual({
        role: 'assistant',
        content: 'The answer based on fragments.',
        citations: [
          { chunkId: 'chunk-1', documentId: 'doc-user1-1', page: 1 },
          { chunkId: 'chunk-2', documentId: 'doc-user1-1', page: 2 },
        ],
        createdAt: fixedDate,
      });

      expect(deps.searchChunks.searchChunks).toHaveBeenCalledWith({
        userId: 'user-1',
        question: 'What is on page 1 and 2?',
        documentIds: ['doc-user1-1'],
      });

      expect(deps.llmProvider.generate).toHaveBeenCalledTimes(1);
      expect(deps.llmProvider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('ONLY the provided document fragments') as string,
          user: expect.stringContaining('What is on page 1 and 2?') as string,
        }),
      );

      expect(deps.conversations.appendMessages).toHaveBeenCalledWith('conv-user1-1', 'user-1', [
        {
          role: 'user',
          content: 'What is on page 1 and 2?',
          citations: [],
          createdAt: fixedDate,
        },
        {
          role: 'assistant',
          content: 'The answer based on fragments.',
          citations: [
            { chunkId: 'chunk-1', documentId: 'doc-user1-1', page: 1 },
            { chunkId: 'chunk-2', documentId: 'doc-user1-1', page: 2 },
          ],
          createdAt: fixedDate,
        },
      ]);
    });

    it('returns fixed response with empty citations and does NOT invoke LLM when 0 chunks are found', async () => {
      const deps = createMockDependencies();
      const fixedDate = new Date('2026-09-22T10:30:00Z');
      const service = createConversationService({ ...deps, now: () => fixedDate });

      vi.mocked(deps.searchChunks.searchChunks).mockResolvedValue([]);

      const result = await service.sendMessage('user-1', 'conv-user1-1', 'Question with no matches');

      expect(result).toEqual({
        role: 'assistant',
        content: NO_CHUNKS_FOUND_MESSAGE,
        citations: [],
        createdAt: fixedDate,
      });

      expect(deps.llmProvider.generate).not.toHaveBeenCalled();

      expect(deps.conversations.appendMessages).toHaveBeenCalledWith('conv-user1-1', 'user-1', [
        {
          role: 'user',
          content: 'Question with no matches',
          citations: [],
          createdAt: fixedDate,
        },
        {
          role: 'assistant',
          content: NO_CHUNKS_FOUND_MESSAGE,
          citations: [],
          createdAt: fixedDate,
        },
      ]);
    });

    it('throws CONVERSATION_NOT_FOUND (404) when conversation does not exist', async () => {
      const deps = createMockDependencies();
      const service = createConversationService(deps);

      await expect(
        service.sendMessage('user-1', 'non-existent-conv', 'Question?'),
      ).rejects.toMatchObject({
        code: 'CONVERSATION_NOT_FOUND',
        statusCode: 404,
      });

      expect(deps.searchChunks.searchChunks).not.toHaveBeenCalled();
      expect(deps.llmProvider.generate).not.toHaveBeenCalled();
      expect(deps.conversations.appendMessages).not.toHaveBeenCalled();
    });

    it('RNF-01: throws CONVERSATION_NOT_FOUND (404) when conversation belongs to another user', async () => {
      const deps = createMockDependencies();
      const service = createConversationService(deps);

      await expect(
        service.sendMessage('user-1', 'conv-user2-1', 'Question?'),
      ).rejects.toMatchObject({
        code: 'CONVERSATION_NOT_FOUND',
        statusCode: 404,
      });

      expect(deps.searchChunks.searchChunks).not.toHaveBeenCalled();
      expect(deps.llmProvider.generate).not.toHaveBeenCalled();
      expect(deps.conversations.appendMessages).not.toHaveBeenCalled();
    });
  });
});
