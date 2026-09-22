import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { MAX_UPLOAD_BYTES } from '../modules/documents/types/document.js';

/**
 * Se registra sobre la instancia raíz para procesar subidas multipart de archivos
 * limitando el tamaño a MAX_UPLOAD_BYTES (10 MB) y como máximo 1 archivo por petición.
 */
export async function registerMultipart(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1,
    },
  });
}
