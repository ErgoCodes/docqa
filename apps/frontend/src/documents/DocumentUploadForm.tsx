import * as React from 'react';
import { HttpError } from '@/api/http-error';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateDocumentFile } from './document-validation';
import { useDocuments } from './useDocuments';

export function DocumentUploadForm() {
  const { uploadDocument, isUploading } = useDocuments();
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0] ?? null;
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
    } catch (err) {
      if (HttpError.isHttpError(err)) {
        setError(err.message);
      } else {
        setError('Error al subir el documento. Inténtalo de nuevo.');
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Subir documento</CardTitle>
        <CardDescription>
          Sube un archivo PDF (máx. 10 MB, hasta 50 páginas) para indexarlo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
          <div className="space-y-2">
            <Label htmlFor="pdf-upload">Archivo PDF</Label>
            <Input
              id="pdf-upload"
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
          <Button type="submit" disabled={!file || isUploading} className="w-full sm:w-auto">
            {isUploading ? 'Subiendo e indexando...' : 'Subir documento'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
