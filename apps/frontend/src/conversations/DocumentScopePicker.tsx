import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { conversationsApi } from '@/api/conversations';
import type { DocumentItem } from '@/api/types';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-4">
      {readyDocuments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-4 text-center">
          <p className="text-muted-foreground text-xs">
            No hay documentos listos aún. Espera que termine el procesamiento o sube un PDF.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-2.5 rounded-lg border border-border/60 bg-secondary/30 p-3 transition-colors hover:bg-secondary/50">
            <Checkbox
              id="all-docs"
              checked={useAll}
              onCheckedChange={(checked) => {
                setUseAll(Boolean(checked));
                if (checked) setSelectedIds([]);
              }}
            />
            <Label htmlFor="all-docs" className="font-medium text-sm cursor-pointer select-none">
              Consultar todos los documentos disponibles ({readyDocuments.length})
            </Label>
          </div>

          {!useAll && (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2 bg-card">
              {readyDocuments.map((doc) => {
                const isChecked = selectedIds.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center space-x-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/50"
                  >
                    <Checkbox
                      id={`doc-${doc.id}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleDocument(doc.id)}
                    />
                    <Label
                      htmlFor={`doc-${doc.id}`}
                      className="truncate text-sm font-normal cursor-pointer select-none flex-1"
                    >
                      {doc.title}{' '}
                      <span className="text-muted-foreground text-xs">({doc.pages} pág.)</span>
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Button
        onClick={() => {
          void handleStartConversation();
        }}
        disabled={!canStart || isCreating}
        className="w-full h-10 font-semibold"
      >
        {isCreating ? 'Iniciando conversación...' : 'Iniciar conversación'}
      </Button>
    </div>
  );
}
