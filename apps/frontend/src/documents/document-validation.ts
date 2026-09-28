export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateDocumentFile(file: File): string | null {
  if (!file) {
    return 'Debes seleccionar un archivo';
  }

  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    return 'El archivo debe ser un documento PDF válido';
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'El archivo no puede superar los 10 MB';
  }

  return null;
}
