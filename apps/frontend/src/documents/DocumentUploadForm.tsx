import * as React from 'react';
import { HttpError } from '@/api/http-error';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Button } from '@/components/ui/button';
import { validateDocumentFile } from './document-validation';
import { useDocuments } from './useDocuments';

interface DocumentUploadFormProps {
  onSuccess?: () => void;
  compact?: boolean;
}

export function DocumentUploadForm({ onSuccess, compact = false }: DocumentUploadFormProps) {
  const { uploadDocument, isUploading } = useDocuments();
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSelectedFile = (selected: File | null) => {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }

    const validationError = validateDocumentFile(selected);
    if (validationError) {
      setError(validationError);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(selected);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    handleSelectedFile(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;

    const dropped = e.dataTransfer.files?.[0] ?? null;
    handleSelectedFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Debes seleccionar un archivo PDF');
      return;
    }

    setError(null);
    try {
      await uploadDocument(file);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onSuccess?.();
    } catch (err) {
      if (HttpError.isHttpError(err)) {
        setError(err.message);
      } else {
        setError('Error al subir el documento. Inténtalo de nuevo.');
      }
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="space-y-4"
    >
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-[border-color,background-color] duration-150 ease-[var(--ease-out)] cursor-pointer select-none ${
          isDragging
            ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
            : 'border-border/80 bg-secondary/30 hover:bg-secondary/60 hover:border-border'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          id="pdf-upload"
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
        />

        <div className="size-10 rounded-xl bg-background shadow-xs border border-border/80 flex items-center justify-center mb-3 text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground truncate max-w-xs">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB • Listo para subir</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Haz clic o arrastra un archivo PDF
            </p>
            <p className="text-xs text-muted-foreground">
              Máx. 10 MB, hasta 50 páginas
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {file && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isUploading}
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={!file || isUploading}
          className={compact ? 'w-full' : 'w-full sm:w-auto'}
        >
          {isUploading ? 'Subiendo e indexando...' : 'Subir documento'}
        </Button>
      </div>
    </form>
  );
}
