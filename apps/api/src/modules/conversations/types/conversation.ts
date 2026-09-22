export interface Citation {
  chunkId: string;
  documentId: string;
  page: number;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
  citations: Citation[];
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  documentIds: string[];
  messages: Message[];
  createdAt: Date;
}

export interface NewConversation {
  userId: string;
  documentIds: string[];
  messages: Message[];
  createdAt: Date;
}
