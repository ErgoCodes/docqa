import { describe, expect, it, vi } from 'vitest';
import type { DocumentRepository } from '../../documents/interfaces/document.repository.js';
import type { Document } from '../../documents/types/document.js';
import type { ConversationRepository } from '../interfaces/conversation.repository.js';
import type { Conversation, NewConversation } from '../types/conversation.js';
import { createConversationService } from './conversation.service.js';

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

  const storedConversations = new Map<string, Conversation>();

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
  };

  return { documents, conversations, storedDocuments, storedConversations };
}

describe('ConversationService', () => {
  describe('create', () => {
    it('creates a conversation with empty documentIds and empty messages', async () => {
      const deps = createMockDependencies();
      const fixedDate = new Date('2026-09-22T10:00:00Z');
      const service = createConversationService({ ...deps, now: () => fixedDate });

      const result = await service.create('user-1', []);

      expect(result.id).toBe('conv-1');
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
      expect(deps.storedConversations.size).toBe(0);
    });
  });
});
