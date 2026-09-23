import { env } from '../lib/env';
import { HttpError } from './http-error';
import type { AuthResult, AuthTokens } from './types';

export const authApi = {
  async register(email: string, password: string): Promise<AuthResult> {
    const response = await fetch(`${env.apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw await HttpError.fromResponse(response);
    }

    return (await response.json()) as AuthResult;
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const response = await fetch(`${env.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw await HttpError.fromResponse(response);
    }

    return (await response.json()) as AuthResult;
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const response = await fetch(`${env.apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw await HttpError.fromResponse(response);
    }

    return (await response.json()) as AuthTokens;
  },

  async logout(refreshToken: string): Promise<void> {
    const response = await fetch(`${env.apiUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok && response.status !== 204) {
      throw await HttpError.fromResponse(response);
    }
  },
};
