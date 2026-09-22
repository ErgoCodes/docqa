import type { ErrorDefinition } from '../../../errors.js';

export const ConversationErrors = {
  NOT_FOUND: {
    code: 'CONVERSATION_NOT_FOUND',
    statusCode: 404,
    message: 'Conversation not found or does not belong to the user',
  },
  DOCUMENT_NOT_FOUND: {
    code: 'CONVERSATION_DOCUMENT_NOT_FOUND',
    statusCode: 404,
    message: 'One or more referenced documents do not exist or do not belong to the user',
  },
} satisfies Record<string, ErrorDefinition>;
