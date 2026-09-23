import { AppError } from '../../../errors.js';
import type { ResponseCache } from '../../cache/interfaces/response-cache.js';
import { buildCacheKey } from '../../cache/utils/cache-key.js';
import type { SearchChunksService } from '../../chunks/services/search-chunks.service.js';
import type { DocumentRepository } from '../../documents/interfaces/document.repository.js';
import type { LlmProvider } from '../../llm/interfaces/llm-provider.js';
import { buildPrompt as defaultBuildPrompt } from '../../llm/utils/prompt-builder.js';
import type { ConversationRepository } from '../interfaces/conversation.repository.js';
import type { Citation, Conversation, Message } from '../types/conversation.js';
import { ConversationErrors } from '../types/conversation-errors.js';

export const NO_CHUNKS_FOUND_MESSAGE =
  'No se encontró información suficiente en los documentos para responder a la pregunta.';

export interface ConversationServiceDependencies {
  conversations: ConversationRepository;
  documents: DocumentRepository;
  searchChunks: SearchChunksService;
  llmProvider: LlmProvider;
  responseCache: ResponseCache;
  buildPrompt?: typeof defaultBuildPrompt;
  now?: () => Date;
}

export interface ConversationService {
  getById: (id: string, userId: string) => Promise<Conversation>;
  create: (userId: string, documentIds: string[]) => Promise<Conversation>;
  sendMessage: (
    userId: string,
    conversationId: string,
    question: string,
  ) => Promise<{ message: Message; cacheHit: boolean }>;
}

export function createConversationService(deps: ConversationServiceDependencies): ConversationService {
  const { conversations, documents, searchChunks, llmProvider, responseCache } = deps;
  const buildPrompt = deps.buildPrompt ?? defaultBuildPrompt;
  const now = deps.now ?? ((): Date => new Date());

  return {
    getById: async (id: string, userId: string): Promise<Conversation> => {
      const conversation = await conversations.findById(id, userId);
      if (!conversation) {
        throw new AppError(ConversationErrors.NOT_FOUND);
      }
      return conversation;
    },

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

    sendMessage: async (
      userId: string,
      conversationId: string,
      question: string,
    ): Promise<{ message: Message; cacheHit: boolean }> => {
      const conversation = await conversations.findById(conversationId, userId);
      if (!conversation) {
        throw new AppError(ConversationErrors.NOT_FOUND);
      }

      const generation = await responseCache.getUserGeneration(userId);
      const key = buildCacheKey({ userId, documentIds: conversation.documentIds, question, generation });
      const cached = await responseCache.get(key);

      let answer: string;
      let citations: Citation[];
      let cacheHit: boolean;

      if (cached !== null) {
        answer = cached.content;
        citations = cached.citations;
        cacheHit = true;
      } else {
        cacheHit = false;
        const chunks = await searchChunks.searchChunks({
          userId,
          question,
          documentIds: conversation.documentIds,
        });

        if (chunks.length === 0) {
          answer = NO_CHUNKS_FOUND_MESSAGE;
          citations = [];
        } else {
          const prompt = buildPrompt({ question, chunks });
          answer = await llmProvider.generate(prompt);
          citations = chunks.map((chunk) => ({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            page: chunk.page,
          }));
        }

        await responseCache.set(key, { content: answer, citations });
      }

      const userMessage: Message = {
        role: 'user',
        content: question,
        citations: [],
        createdAt: now(),
      };

      const assistantMessage: Message = {
        role: 'assistant',
        content: answer,
        citations,
        createdAt: now(),
      };

      await conversations.appendMessages(conversationId, userId, [userMessage, assistantMessage]);

      return { message: assistantMessage, cacheHit };
    },
  };
}
