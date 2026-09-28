import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChunk } from './useChunk';

interface ChunkPreviewDialogProps {
  chunkId: string | null;
  documentTitle?: string;
  page?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChunkPreviewDialog({
  chunkId,
  documentTitle,
  page,
  open,
  onOpenChange,
}: ChunkPreviewDialogProps) {
  const { data: chunk, isLoading, isError } = useChunk(open ? chunkId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Fragmento citado</DialogTitle>
          <DialogDescription>
            {documentTitle ? `${documentTitle}` : 'Documento'}
            {page !== undefined ? ` • Página ${page}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto rounded-md bg-muted p-4 text-sm font-mono whitespace-pre-wrap select-text">
          {isLoading && (
            <div className="text-muted-foreground py-4 text-center font-sans">
              Cargando fragmento...
            </div>
          )}
          {isError && (
            <div className="text-destructive py-4 text-center font-sans">
              No se pudo cargar el fragmento citado.
            </div>
          )}
          {chunk && (
            <p className="text-foreground leading-relaxed">{chunk.text}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
