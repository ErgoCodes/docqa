import { Link, Outlet } from '@tanstack/react-router';
import { useGlobalPendingQuestionGuard } from './app/use-global-pending-guard';
import { useAuth } from './auth/AuthProvider';
import { Button } from './components/ui/button';

export function App() {
  useGlobalPendingQuestionGuard();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col selection:bg-primary/15 selection:text-foreground">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="size-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs tracking-tighter shadow-2xs group-hover:scale-105 transition-transform duration-150 ease-[var(--ease-out)]">
              DQ
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight leading-none">DocQA</span>
              <span className="text-muted-foreground hidden text-[11px] sm:inline leading-none mt-1">
                Asistente RAG sobre documentos
              </span>
            </div>
          </Link>
          {isAuthenticated && (
            <div className="flex items-center gap-3 text-sm">
              {user?.email && (
                <span className="text-muted-foreground hidden text-xs md:inline px-2 py-1 rounded-md bg-secondary/50 border border-border/40">
                  {user.email}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void logout()}
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                Cerrar sesión
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="container mx-auto max-w-5xl flex-1 px-4 sm:px-6 py-4">
        <Outlet />
      </main>
    </div>
  );
}
