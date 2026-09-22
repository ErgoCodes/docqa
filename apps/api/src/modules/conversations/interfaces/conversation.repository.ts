import type { Conversation, NewConversation } from '../types/conversation.js';

export interface ConversationRepository {
  insert: (conversation: NewConversation) => Promise<Conversation>;
}
