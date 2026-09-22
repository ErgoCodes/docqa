import type { Conversation, Message, NewConversation } from '../types/conversation.js';

export interface ConversationRepository {
  insert: (conversation: NewConversation) => Promise<Conversation>;
  findById: (id: string, userId: string) => Promise<Conversation | null>;
  appendMessages: (id: string, userId: string, messages: Message[]) => Promise<Conversation | null>;
}
