import * as React from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { App } from '@/App';
import { useAuth } from '@/auth/AuthProvider';
import { LoginPage } from '@/auth/LoginPage';
import { RegisterPage } from '@/auth/RegisterPage';
import { ConversationPanel } from '@/conversations/ConversationPanel';
import { HomePage } from '@/documents/HomePage';

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: '/login' });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return <Outlet />;
}

const rootRoute = createRootRoute({
  component: App,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});

const protectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  component: ProtectedLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/',
  component: HomePage,
});

function ConversationView() {
  const { id } = useParams({ from: '/protected/conversations/$id' });
  return <ConversationPanel conversationId={id} />;
}

const conversationRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/conversations/$id',
  component: ConversationView,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  protectedLayoutRoute.addChildren([indexRoute, conversationRoute]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
