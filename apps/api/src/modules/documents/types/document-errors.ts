import type { ErrorDefinition } from '../../../errors.js';

export const DocumentErrors = {
  INVALID_FILE_TYPE: {
    code: 'INVALID_FILE_TYPE',
    statusCode: 415,
    message: 'El archivo debe ser un documento PDF válido',
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    statusCode: 413,
    message: 'El archivo no puede superar los 10 MB',
  },
  TOO_MANY_PAGES: {
    code: 'TOO_MANY_PAGES',
    statusCode: 422,
    message: 'El documento no puede superar las 50 páginas',
  },
  DOCUMENT_NOT_FOUND: {
    code: 'DOCUMENT_NOT_FOUND',
    statusCode: 404,
    message: 'Documento no encontrado',
  },
} satisfies Record<string, ErrorDefinition>;
