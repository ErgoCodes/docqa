import { Button } from '@/components/ui/button';

export function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">DocQA</h1>
      <p className="text-muted-foreground">
        Asistente RAG sobre documentos — en construcción.
      </p>
      <Button>Empezar</Button>
    </main>
  );
}
