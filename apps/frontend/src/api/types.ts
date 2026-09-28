export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_REFRESH_TOKEN'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_PAGES'
  | 'CONVERSATION_DOCUMENT_NOT_FOUND'
  | 'CONVERSATION_NOT_FOUND'
  | 'CHUNK_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorPayload {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
  requestId: string;
}

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export type DocumentStatus = 'processing' | 'ready' | 'error';

export interface DocumentItem {
  id: string;
  title: string;
  status: DocumentStatus;
  pages: number;
  error: string | null;
  createdAt: string;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  page: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  documentIds: string[];
  messages: Message[];
  createdAt: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  page: number;
  index: number;
  text: string;
}
