import { randomUUID } from 'node:crypto';
import path from 'node:path';

const DEFAULT_TITLE = 'documento.pdf';

/**
 * Genera una clave de almacenamiento aleatoria única por usuario y documento
 * para evitar colisiones y prevenir ataques de path traversal.
 */
export function buildStorageKey(userId: string): string {
  return `${userId}/${randomUUID()}.pdf`;
}

/**
 * Sanea el nombre de archivo original:
 * - Extrae solo el nombre base descartando cualquier ruta o directorio.
 * - Elimina la extensión .pdf final.
 * - Recorta espacios en blanco en los extremos.
 * - Si queda vacío, asigna un nombre por defecto.
 */
export function sanitizeTitle(filename: string): string {
  const baseName = path.basename(filename.trim());
  const withoutExtension = baseName.replace(/\.pdf$/i, '').trim();

  return withoutExtension.length > 0 ? withoutExtension : DEFAULT_TITLE;
}
