import { beforeEach, describe, expect, it } from 'vitest';
import { tokenStore } from './token-store';

describe('tokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads null when storage is empty', () => {
    expect(tokenStore.read()).toBeNull();
  });

  it('writes and reads tokens', () => {
    tokenStore.write({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    expect(tokenStore.read()).toEqual({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('clears stored tokens', () => {
    tokenStore.write({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    tokenStore.clear();
    expect(tokenStore.read()).toBeNull();
  });

  it('does not cache in module memory across writes to localStorage', () => {
    tokenStore.write({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    expect(tokenStore.read()?.accessToken).toBe('acc-1');

    // Simulate another tab modifying localStorage directly
    localStorage.setItem(
      'docqa.tokens.v1',
      JSON.stringify({ accessToken: 'acc-2', refreshToken: 'ref-2' }),
    );

    // Immediate next read must reflect the new value, not a stale cache
    expect(tokenStore.read()).toEqual({ accessToken: 'acc-2', refreshToken: 'ref-2' });
  });

  it('handles invalid JSON in localStorage safely', () => {
    localStorage.setItem('docqa.tokens.v1', 'not-valid-json');
    expect(tokenStore.read()).toBeNull();
  });
});
