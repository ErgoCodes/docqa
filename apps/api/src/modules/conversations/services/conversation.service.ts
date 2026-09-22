import { AppError } from '../../../errors.js';
import type { DocumentRepository } from '../../documents/interfaces/document.repository.js';
import type { ConversationRepository } from '../interfaces/conversation.repository.js';
import type { Conversation } from '../types/conversation.js';
import { ConversationErrors } from '../types/conversation-errors.js';

export interface ConversationServiceDependencies {
  conversations: ConversationRepository;
  documents: DocumentRepository;
  now?: () => Date;
}

export interface ConversationService {
  create: (userId: string, documentIds: string[]) => Promise<Conversation>;
}

export function createConversationService(deps: ConversationServiceDependencies): ConversationService {
  const { conversations, documents } = deps;
  const now = deps.now ?? ((): Date => new Date());

  return {
    create: async (userId: string, documentIds: string[]): Promise<Conversation> => {
      const uniqueDocumentIds = Array.from(new Set(documentIds));

      await Promise.all(
        uniqueDocumentIds.map(async (documentId) => {
          const document = await documents.findById(documentId, userId);
          if (!document) {
            throw new AppError(ConversationErrors.DOCUMENT_NOT_FOUND);
          }
        }),
      );

      return conversations.insert({
        userId,
        // An empty array means "all of the user's documents", resolved dynamically
        // by the future vector search rather than snapshotted here, so documents
        // uploaded after this conversation is created are included automatically.
        documentIds: uniqueDocumentIds,
        messages: [],
        createdAt: now(),
      });
    },
  };
}
