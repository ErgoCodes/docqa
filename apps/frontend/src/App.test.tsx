import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';

describe('App', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    localStorage.clear();
  });

  function renderWithProviders() {
    const rootRoute = createRootRoute({ component: App });
    const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <div>Home Content</div> });
    const routeTree = rootRoute.addChildren([indexRoute]);
    const memoryHistory = createMemoryHistory({ initialEntries: ['/'] });
    const testRouter = createRouter({ routeTree, history: memoryHistory });

    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={testRouter} />
        </AuthProvider>
      </QueryClientProvider>,
    );
  }

  it('renders application brand and header', async () => {
    renderWithProviders();
    expect(await screen.findByText('DocQA')).toBeInTheDocument();
    expect(screen.getByText('Asistente RAG sobre documentos')).toBeInTheDocument();
  });

  it('displays user email and logout button when authenticated', async () => {
    localStorage.setItem(
      'docqa.tokens.v1',
      JSON.stringify({ accessToken: 'a-tok', refreshToken: 'r-tok' }),
    );
    localStorage.setItem(
      'docqa.user.v1',
      JSON.stringify({ id: 'u1', email: 'test@example.com', createdAt: '2026-09-01' }),
    );

    renderWithProviders();

    expect(await screen.findByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
  });
});
