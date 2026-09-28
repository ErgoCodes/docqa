import type { ApiErrorCode, ApiErrorDetail, ApiErrorPayload } from './types';

export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(
    status: number,
    message: string,
    code: ApiErrorCode = 'INTERNAL_ERROR',
    details?: ApiErrorDetail[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  static isHttpError(error: unknown): error is HttpError {
    return error instanceof HttpError;
  }

  static async fromResponse(response: Response): Promise<HttpError> {
    try {
      const data = (await response.json()) as ApiErrorPayload;
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        return new HttpError(
          response.status,
          data.error.message || `Request failed with status ${response.status}`,
          data.error.code || 'INTERNAL_ERROR',
          data.error.details,
          data.requestId,
        );
      }
    } catch {
      // Body is not JSON or cannot be parsed
    }
    return new HttpError(response.status, `Request failed with status ${response.status}`);
  }
}
