import { apiClient } from './client';
import type { Conversation, Message } from './types';

export const conversationsApi = {
  create(documentIds: string[] = []): Promise<Conversation> {
    return apiClient.post<Conversation>('/conversations', { documentIds });
  },

  getById(id: string): Promise<Conversation> {
    return apiClient.get<Conversation>(`/conversations/${id}`);
  },

  sendMessage(id: string, question: string): Promise<Message> {
    return apiClient.post<Message>(`/conversations/${id}/messages`, { question });
  },
};
