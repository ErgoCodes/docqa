export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

const KEY = 'docqa.tokens.v1';

export const tokenStore = {
  read(): StoredTokens | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as StoredTokens) : null;
    } catch {
      return null;
    }
  },
  write(tokens: StoredTokens): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(tokens));
    } catch {
      // storage not available or quota exceeded
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // no-op
    }
  },
};
