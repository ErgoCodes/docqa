import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../../../errors.js';
import {
  documentIdParamsSchema,
  documentListResponseSchema,
  documentResponseSchema,
} from '../schemas/document.schemas.js';
import type { DocumentService } from '../services/document.service.js';
import { DocumentErrors } from '../types/document-errors.js';

export interface DocumentRoutesOptions {
  service: DocumentService;
}

export const registerDocumentRoutes: FastifyPluginAsync<DocumentRoutesOptions> = (app, { service }) => {
  app.post('/documents', { preHandler: app.authenticate }, async (request, reply) => {
    let data;
    try {
      data = await request.file();
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        (('code' in err && (err as { code: string }).code === 'FST_REQ_FILE_TOO_LARGE') ||
          ('statusCode' in err && (err as { statusCode: number }).statusCode === 413))
      ) {
        throw new AppError(DocumentErrors.FILE_TOO_LARGE);
      }
      throw err;
    }

    if (!data) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        message: 'Debes adjuntar un archivo PDF',
      });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        (('code' in err && (err as { code: string }).code === 'FST_REQ_FILE_TOO_LARGE') ||
          ('statusCode' in err && (err as { statusCode: number }).statusCode === 413))
      ) {
        throw new AppError(DocumentErrors.FILE_TOO_LARGE);
      }
      throw err;
    }

    if (data.file.truncated) {
      throw new AppError(DocumentErrors.FILE_TOO_LARGE);
    }

    const result = await service.upload({
      userId: request.user.sub,
      filename: data.filename,
      buffer,
    });

    void reply.status(201);
    return documentResponseSchema.parse(result);
  });

  app.get('/documents', { preHandler: app.authenticate }, async (request) => {
    const documents = await service.list(request.user.sub);
    return documentListResponseSchema.parse(documents);
  });

  app.get('/documents/:id', { preHandler: app.authenticate }, async (request) => {
    const params = documentIdParamsSchema.parse(request.params);
    const document = await service.getById(params.id, request.user.sub);
    return documentResponseSchema.parse(document);
  });

  return Promise.resolve();
};
