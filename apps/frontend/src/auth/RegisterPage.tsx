import * as React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { HttpError } from '@/api/http-error';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from './AuthProvider';

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      void navigate({ to: '/' });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres');
      return;
    }

    if (password.toLowerCase() === trimmedEmail.toLowerCase()) {
      setError('La contraseña no puede ser igual al email');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(trimmedEmail, password);
      void navigate({ to: '/' });
    } catch (err) {
      if (HttpError.isHttpError(err)) {
        setError(err.message);
      } else {
        setError('Error al registrar usuario. Inténtalo de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Crear cuenta</CardTitle>
          <CardDescription>
            Regístrate para comenzar a consultar tus documentos con DocQA
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <CardContent className="space-y-4">
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña (mínimo 12 caracteres)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
                minLength={12}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creando cuenta...' : 'Registrarse'}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Inicia sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
