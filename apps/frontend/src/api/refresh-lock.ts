import { tokenStore } from '../auth/token-store';
import { authApi } from './auth';

const LOCK_NAME = 'docqa-auth-refresh';

export class SessionExpiredError extends Error {
  constructor() {
    super('the session is no longer valid; sign in again');
    this.name = 'SessionExpiredError';
  }
}

let inFlightLock: Promise<unknown> | null = null;

export function fallbackSingleTabLock<T>(_name: string, callback: () => Promise<T>): Promise<T> {
  if (inFlightLock) {
    return inFlightLock as Promise<T>;
  }
  const run = callback().finally(() => {
    inFlightLock = null;
  });
  inFlightLock = run;
  return run;
}

export type LockRequester = <T>(name: string, callback: () => Promise<T>) => Promise<T>;

export async function ensureFreshTokens(
  customLockRequester?: LockRequester,
): Promise<{ accessToken: string }> {
  const before = tokenStore.read();
  if (!before) {
    throw new SessionExpiredError();
  }

  const requestLock: LockRequester =
    customLockRequester ??
    (typeof navigator !== 'undefined' && 'locks' in navigator
      ? <T>(name: string, cb: () => Promise<T>): Promise<T> =>
          navigator.locks.request(name, cb) as Promise<T>
      : fallbackSingleTabLock);

  return requestLock(LOCK_NAME, async () => {
    const current = tokenStore.read();

    if (!current) {
      throw new SessionExpiredError();
    }

    if (current.refreshToken !== before.refreshToken) {
      return { accessToken: current.accessToken };
    }

    try {
      const tokens = await authApi.refresh(current.refreshToken);
      tokenStore.write({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      return { accessToken: tokens.accessToken };
    } catch {
      tokenStore.clear();
      throw new SessionExpiredError();
    }
  });
}
