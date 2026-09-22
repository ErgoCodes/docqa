import type { ErrorDefinition } from '../../../errors.js';

export const ChunkErrors = {
  NOT_FOUND: {
    code: 'CHUNK_NOT_FOUND',
    statusCode: 404,
    message: 'Chunk not found',
  },
} satisfies Record<string, ErrorDefinition>;
