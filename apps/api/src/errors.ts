import { ZodError } from 'zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_REFRESH_TOKEN'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_PAGES'
  | 'DOCUMENT_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  path: string;
  message: string;
}

export interface ErrorDefinition {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: ErrorDetail[];

  constructor(definition: ErrorDefinition, details?: ErrorDetail[]) {
    super(definition.message);
    this.code = definition.code;
    this.statusCode = definition.statusCode;
    this.details = details;
  }
}

export interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
  requestId: string;
}

export function buildErrorResponse(
  requestId: string,
  code: ErrorCode,
  message: string,
  details?: ErrorDetail[],
): ErrorResponseBody {
  return { error: { code, message, details }, requestId };
}

export interface MappedError {
  statusCode: number;
  body: ErrorResponseBody;
}

/**
 * Traduce cualquier error capturado a una respuesta HTTP con la forma estándar
 * de la API. Función pura para poder testear el mapeo sin levantar Fastify.
 */
export function mapErrorToResponse(error: unknown, requestId: string): MappedError {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, body: buildErrorResponse(requestId, error.code, error.message, error.details) };
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    return {
      statusCode: 400,
      body: buildErrorResponse(requestId, 'VALIDATION_ERROR', 'Los datos enviados no son válidos', details),
    };
  }

  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'FST_REQ_FILE_TOO_LARGE') {
    return {
      statusCode: 413,
      body: buildErrorResponse(requestId, 'FILE_TOO_LARGE', 'El archivo no puede superar los 10 MB'),
    };
  }

  return { statusCode: 500, body: buildErrorResponse(requestId, 'INTERNAL_ERROR', 'Error interno del servidor') };
}
