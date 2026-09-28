import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { conversationsApi } from '@/api/conversations';
import type { DocumentItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface DocumentScopePickerProps {
  documents: DocumentItem[];
}

export function DocumentScopePicker({ documents }: DocumentScopePickerProps) {
  const navigate = useNavigate();
  const readyDocuments = documents.filter((d) => d.status === 'ready');

  const [useAll, setUseAll] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);

  const toggleDocument = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const handleStartConversation = async () => {
    setIsCreating(true);
    try {
      const docIdsToPass = useAll ? [] : selectedIds;
      const conversation = await conversationsApi.create(docIdsToPass);
      void navigate({
        to: '/conversations/$id',
        params: { id: conversation.id },
      });
    } finally {
      setIsCreating(false);
    }
  };

  const canStart = readyDocuments.length > 0 && (useAll || selectedIds.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Nueva conversación</CardTitle>
        <CardDescription>
          Selecciona el alcance de documentos para consultar con el asistente RAG
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {readyDocuments.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay documentos listos aún. Espera a que termine el procesamiento o sube un nuevo archivo.
          </p>
        ) : (
          <>
            <div className="flex items-center space-x-2 border-b pb-3">
              <Checkbox
                id="all-docs"
                checked={useAll}
                onCheckedChange={(checked) => {
                  setUseAll(Boolean(checked));
                  if (checked) setSelectedIds([]);
                }}
              />
              <Label htmlFor="all-docs" className="font-semibold cursor-pointer">
                Consultar todos los documentos disponibles ({readyDocuments.length})
              </Label>
            </div>

            {!useAll && (
              <div className="max-h-48 space-y-2 overflow-y-auto pt-1">
                {readyDocuments.map((doc) => {
                  const isChecked = selectedIds.includes(doc.id);
                  return (
                    <div key={doc.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`doc-${doc.id}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleDocument(doc.id)}
                      />
                      <Label
                        htmlFor={`doc-${doc.id}`}
                        className="truncate text-sm font-normal cursor-pointer"
                      >
                        {doc.title} ({doc.pages} pág.)
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => {
            void handleStartConversation();
          }}
          disabled={!canStart || isCreating}
          className="w-full sm:w-auto"
        >
          {isCreating ? 'Iniciando...' : 'Iniciar conversación'}
        </Button>
      </CardFooter>
    </Card>
  );
}
