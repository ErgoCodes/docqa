import { tokenStore } from '../auth/token-store';
import { env } from '../lib/env';
import { HttpError } from './http-error';
import { ensureFreshTokens, SessionExpiredError } from './refresh-lock';

type SessionExpiredListener = () => void;
const sessionExpiredListeners: Set<SessionExpiredListener> = new Set();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  tokenStore.clear();
  for (const listener of sessionExpiredListeners) {
    listener();
  }
}

interface RequestOptions extends RequestInit {
  retryOn401?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { retryOn401 = true, headers: customHeaders, ...restOptions } = options;

  const url = path.startsWith('http') ? path : `${env.apiUrl}${path}`;
  const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/register');

  const headers = new Headers(customHeaders);

  const tokens = tokenStore.read();
  if (tokens?.accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  // Set application/json if body is plain object and not FormData
  if (
    restOptions.body &&
    !(restOptions.body instanceof FormData) &&
    typeof restOptions.body === 'string' &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  if (response.status === 401 && retryOn401 && !isAuthRoute) {
    try {
      const { accessToken } = await ensureFreshTokens();
      const retryHeaders = new Headers(customHeaders);
      retryHeaders.set('Authorization', `Bearer ${accessToken}`);
      if (
        restOptions.body &&
        !(restOptions.body instanceof FormData) &&
        typeof restOptions.body === 'string' &&
        !retryHeaders.has('Content-Type')
      ) {
        retryHeaders.set('Content-Type', 'application/json');
      }

      const retryResponse = await fetch(url, {
        ...restOptions,
        headers: retryHeaders,
      });

      if (!retryResponse.ok) {
        if (retryResponse.status === 401) {
          notifySessionExpired();
        }
        throw await HttpError.fromResponse(retryResponse);
      }

      if (retryResponse.status === 204) {
        return undefined as T;
      }

      return (await retryResponse.json()) as T;
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        notifySessionExpired();
      }
      throw err;
    }
  }

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestInit): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' });
  },

  post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    return request<T>(path, {
      ...options,
      method: 'POST',
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return request<T>(path, { ...options, method: 'DELETE' });
  },

  upload<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);
    return request<T>(path, {
      method: 'POST',
      body: formData,
    });
  },
};
