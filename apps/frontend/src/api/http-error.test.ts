import { describe, expect, it } from 'vitest';
import { HttpError } from './http-error';

describe('HttpError', () => {
  it('creates an instance with default code', () => {
    const err = new HttpError(500, 'Server broke');
    expect(err.status).toBe(500);
    expect(err.message).toBe('Server broke');
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.name).toBe('HttpError');
  });

  it('parses standard error response correctly', async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email o contraseña incorrectos',
          details: [{ path: 'email', message: 'invalid email' }],
        },
        requestId: 'req-123',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );

    const httpError = await HttpError.fromResponse(response);
    expect(httpError.status).toBe(401);
    expect(httpError.code).toBe('INVALID_CREDENTIALS');
    expect(httpError.message).toBe('Email o contraseña incorrectos');
    expect(httpError.details).toEqual([{ path: 'email', message: 'invalid email' }]);
    expect(httpError.requestId).toBe('req-123');
  });

  it('handles non-JSON response gracefully', async () => {
    const response = new Response('Bad Gateway', { status: 502 });
    const httpError = await HttpError.fromResponse(response);
    expect(httpError.status).toBe(502);
    expect(httpError.message).toBe('Request failed with status 502');
    expect(httpError.code).toBe('INTERNAL_ERROR');
  });

  it('identifies HttpError via isHttpError', () => {
    const err = new HttpError(404, 'Not Found');
    expect(HttpError.isHttpError(err)).toBe(true);
    expect(HttpError.isHttpError(new Error('Generic'))).toBe(false);
    expect(HttpError.isHttpError(null)).toBe(false);
  });
});
