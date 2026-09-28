import * as React from 'react';
import { authApi } from '@/api/auth';
import { onSessionExpired } from '@/api/client';
import type { AuthUser } from '@/api/types';
import { tokenStore } from './token-store';

const USER_KEY = 'docqa.user.v1';

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = React.useState(() => tokenStore.read());
  const [user, setUser] = React.useState<AuthUser | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = React.useState(false);

  const isAuthenticated = Boolean(tokens?.accessToken);

  React.useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      setTokens(null);
      setUser(null);
      writeStoredUser(null);
    });
    return unsubscribe;
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.login(email, password);
      tokenStore.write(result.tokens);
      writeStoredUser(result.user);
      setTokens(result.tokens);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = React.useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.register(email, password);
      tokenStore.write(result.tokens);
      writeStoredUser(result.user);
      setTokens(result.tokens);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = React.useCallback(async () => {
    const currentTokens = tokenStore.read();
    if (currentTokens?.refreshToken) {
      try {
        await authApi.logout(currentTokens.refreshToken);
      } catch {
        // Continue clearing local state regardless of server logout response
      }
    }
    tokenStore.clear();
    writeStoredUser(null);
    setTokens(null);
    setUser(null);
  }, []);

  const value = React.useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      user,
      isLoading,
      login,
      register,
      logout,
    }),
    [isAuthenticated, user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
