import { Link, Outlet } from '@tanstack/react-router';
import { useGlobalPendingQuestionGuard } from './app/use-global-pending-guard';
import { useAuth } from './auth/AuthProvider';
import { Button } from './components/ui/button';

export function App() {
  useGlobalPendingQuestionGuard();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="bg-card border-b">
        <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">DocQA</span>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Asistente RAG sobre documentos
            </span>
          </Link>
          {isAuthenticated && (
            <div className="flex items-center gap-3 text-sm">
              {user?.email && (
                <span className="text-muted-foreground hidden text-xs md:inline">
                  {user.email}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                Cerrar sesión
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="container mx-auto max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
