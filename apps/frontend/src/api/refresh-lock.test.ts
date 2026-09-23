import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../auth/token-store';
import { authApi } from './auth';
import {
  ensureFreshTokens,
  fallbackSingleTabLock,
  type LockRequester,
  SessionExpiredError,
} from './refresh-lock';

describe('refresh-lock (ensureFreshTokens)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Mocking an async sequential LockRequester mimicking Web Locks API queue
  function createSequentialLock(): LockRequester {
    let queue = Promise.resolve();
    return <T>(_name: string, callback: () => Promise<T>): Promise<T> => {
      const result = queue.then(() => callback());
      // Catch errors in queue so next lock acquire still executes
      queue = result.catch(() => {}) as Promise<void>;
      return result;
    };
  }

  it('throws SessionExpiredError immediately if tokenStore is empty', async () => {
    await expect(ensureFreshTokens()).rejects.toThrow(SessionExpiredError);
  });

  it('(a) executes authApi.refresh exactly once for concurrent calls and returns the new accessToken to all', async () => {
    tokenStore.write({ accessToken: 'old-access', refreshToken: 'old-refresh' });

    const refreshSpy = vi.spyOn(authApi, 'refresh').mockImplementation(async () => {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
      };
    });

    const mockLock = createSequentialLock();

    const [res1, res2] = await Promise.all([
      ensureFreshTokens(mockLock),
      ensureFreshTokens(mockLock),
    ]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(res1).toEqual({ accessToken: 'new-access' });
    expect(res2).toEqual({ accessToken: 'new-access' });
    expect(tokenStore.read()).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('(b) adopts already rotated tokens if another tab rotated them while waiting for lock', async () => {
    tokenStore.write({ accessToken: 'initial-access', refreshToken: 'initial-refresh' });

    const refreshSpy = vi.spyOn(authApi, 'refresh').mockResolvedValue({
      accessToken: 'tab1-access',
      refreshToken: 'tab1-refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    });

    const mockLock = createSequentialLock();

    // Before second lock runs, simulate tab 1 updating storage
    const call1 = ensureFreshTokens(mockLock);
    const call2 = ensureFreshTokens(mockLock);

    const [res1, res2] = await Promise.all([call1, call2]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(res1.accessToken).toBe('tab1-access');
    expect(res2.accessToken).toBe('tab1-access');
  });

  it('(c) clears storage and throws SessionExpiredError when authApi.refresh fails', async () => {
    tokenStore.write({ accessToken: 'invalid-access', refreshToken: 'invalid-refresh' });

    vi.spyOn(authApi, 'refresh').mockRejectedValue(new Error('INVALID_REFRESH_TOKEN'));

    const mockLock = createSequentialLock();

    await expect(ensureFreshTokens(mockLock)).rejects.toThrow(SessionExpiredError);
    expect(tokenStore.read()).toBeNull();
  });

  it('(d) second queued call throws SessionExpiredError without calling refresh if storage became empty', async () => {
    tokenStore.write({ accessToken: 'invalid-access', refreshToken: 'invalid-refresh' });

    const refreshSpy = vi.spyOn(authApi, 'refresh').mockRejectedValueOnce(new Error('INVALID_REFRESH_TOKEN'));

    const mockLock = createSequentialLock();

    const p1 = ensureFreshTokens(mockLock);
    const p2 = ensureFreshTokens(mockLock);

    await expect(p1).rejects.toThrow(SessionExpiredError);
    await expect(p2).rejects.toThrow(SessionExpiredError);

    // Only one refresh attempt was made
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('(e) uses fallbackSingleTabLock when Web Locks API is unavailable', async () => {
    tokenStore.write({ accessToken: 'old-access', refreshToken: 'old-refresh' });

    const refreshSpy = vi.spyOn(authApi, 'refresh').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        accessToken: 'fb-access',
        refreshToken: 'fb-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
      };
    });

    // Test fallbackSingleTabLock directly
    const [res1, res2] = await Promise.all([
      fallbackSingleTabLock('lock', () => ensureFreshTokens(fallbackSingleTabLock)),
      fallbackSingleTabLock('lock', () => ensureFreshTokens(fallbackSingleTabLock)),
    ]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(res1.accessToken).toBe('fb-access');
    expect(res2.accessToken).toBe('fb-access');
  });
});
