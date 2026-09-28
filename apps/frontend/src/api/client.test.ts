import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../auth/token-store';
import { apiClient, onSessionExpired } from './client';
import * as refreshLockModule from './refresh-lock';
import { SessionExpiredError } from './refresh-lock';

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('attaches Authorization header when accessToken exists in tokenStore', async () => {
    tokenStore.write({ accessToken: 'test-token', refreshToken: 'test-ref' });

    let capturedHeaders: Headers | undefined;
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = init?.headers as Headers | undefined;
      return Promise.resolve(
        new Response(JSON.stringify({ data: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.get<{ data: string }>('/documents');

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/documents',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(capturedHeaders?.get('Authorization')).toBe('Bearer test-token');
  });

  it('triggers token refresh on 401 and retries original request once with new token', async () => {
    tokenStore.write({ accessToken: 'expired-token', refreshToken: 'valid-refresh' });

    let attempt = 0;
    let retryHeaders: Headers | undefined;

    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      attempt += 1;
      if (attempt === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: 'UNAUTHORIZED', message: 'Token expired' },
              requestId: 'r1',
            }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      retryHeaders = init?.headers as Headers | undefined;
      return Promise.resolve(
        new Response(JSON.stringify([{ id: 'doc-1' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(refreshLockModule, 'ensureFreshTokens').mockResolvedValueOnce({
      accessToken: 'refreshed-token',
    });

    const result = await apiClient.get<Array<{ id: string }>>('/documents');

    expect(result).toEqual([{ id: 'doc-1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryHeaders?.get('Authorization')).toBe('Bearer refreshed-token');
  });

  it('does not retry 401 on /auth/login or /auth/register', async () => {
    const fetchMock = vi.fn(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: { code: 'INVALID_CREDENTIALS', message: 'Wrong password' },
            requestId: 'r2',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const ensureSpy = vi.spyOn(refreshLockModule, 'ensureFreshTokens');

    await expect(apiClient.post('/auth/login', { email: 'a@b.com', password: 'password' })).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ensureSpy).not.toHaveBeenCalled();
  });

  it('triggers session expired notification and clears storage when refresh fails with SessionExpiredError', async () => {
    tokenStore.write({ accessToken: 'old-access', refreshToken: 'dead-refresh' });

    const fetchMock = vi.fn(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: { code: 'UNAUTHORIZED', message: 'Token expired' },
            requestId: 'r3',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(refreshLockModule, 'ensureFreshTokens').mockRejectedValueOnce(
      new SessionExpiredError(),
    );

    const expiredListener = vi.fn();
    const unsubscribe = onSessionExpired(expiredListener);

    await expect(apiClient.get('/documents')).rejects.toThrow(SessionExpiredError);

    expect(expiredListener).toHaveBeenCalledTimes(1);
    expect(tokenStore.read()).toBeNull();

    unsubscribe();
  });
});
