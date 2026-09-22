/* eslint-disable n/no-unsupported-features/node-builtins */
import type { FastifyInstance } from 'fastify';
import { PDFDocument } from 'pdf-lib';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../../testing/build-test-app.js';
import { MAX_UPLOAD_BYTES } from '../types/document.js';

interface DocumentResponseBody {
  id: string;
  title: string;
  status: 'processing' | 'ready' | 'error';
  pages: number;
  error: string | null;
  createdAt: string;
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

async function buildPdfBuffer(pageCount: number): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage();
  }
  return Buffer.from(await pdfDoc.save());
}

async function registerAndGetToken(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'password-segura-123' },
  });
  const body = res.json<{ tokens: { accessToken: string } }>();
  return body.tokens.accessToken;
}

describe('rutas de documentos', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  describe('seguridad y autenticación', () => {
    it('todas las rutas exigen token de acceso válido (401 si falta)', async () => {
      ({ app } = await buildTestApp());

      const postRes = await app.inject({ method: 'POST', url: '/documents' });
      expect(postRes.statusCode).toBe(401);

      const getListRes = await app.inject({ method: 'GET', url: '/documents' });
      expect(getListRes.statusCode).toBe(401);

      const getByIdRes = await app.inject({ method: 'GET', url: '/documents/doc-123' });
      expect(getByIdRes.statusCode).toBe(401);

      const deleteRes = await app.inject({ method: 'DELETE', url: '/documents/doc-123' });
      expect(deleteRes.statusCode).toBe(401);
    });
  });

  describe('ciclo de vida y aislamiento RNF-01', () => {
    it('subir PDF, listar, ver detalle y comprobar aislamiento entre usuarios', async () => {
      ({ app } = await buildTestApp());

      const tokenUserA = await registerAndGetToken(app, 'usuarioA@example.com');
      const tokenUserB = await registerAndGetToken(app, 'usuarioB@example.com');

      // 1. User A sube un PDF válido de 2 páginas
      const pdfBuffer = await buildPdfBuffer(2);
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'informe-ventas.pdf');

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/documents',
        headers: { authorization: `Bearer ${tokenUserA}` },
        payload: form,
      });

      expect(uploadRes.statusCode).toBe(201);
      const createdDoc = uploadRes.json<DocumentResponseBody>();
      expect(createdDoc.id).toBeDefined();
      expect(createdDoc.title).toBe('informe-ventas');
      expect(createdDoc.pages).toBe(2);
      expect(createdDoc.status).toBe('processing');
      expect(createdDoc.error).toBeNull();

      // 2. User A lista sus documentos y encuentra el recién subido
      const listUserARes = await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { authorization: `Bearer ${tokenUserA}` },
      });
      expect(listUserARes.statusCode).toBe(200);
      const listUserA = listUserARes.json<DocumentResponseBody[]>();
      expect(listUserA).toHaveLength(1);
      expect(listUserA[0]?.id).toBe(createdDoc.id);

      // 3. User A consulta el detalle del documento
      const detailUserARes = await app.inject({
        method: 'GET',
        url: `/documents/${createdDoc.id}`,
        headers: { authorization: `Bearer ${tokenUserA}` },
      });
      expect(detailUserARes.statusCode).toBe(200);
      expect(detailUserARes.json<DocumentResponseBody>()).toEqual(createdDoc);

      // 4. RNF-01: User B lista sus documentos y NO ve el documento de User A
      const listUserBRes = await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { authorization: `Bearer ${tokenUserB}` },
      });
      expect(listUserBRes.statusCode).toBe(200);
      expect(listUserBRes.json<DocumentResponseBody[]>()).toHaveLength(0);

      // 5. RNF-01: User B intenta acceder al ID del documento de User A y recibe 404 DOCUMENT_NOT_FOUND (nunca 403)
      const detailUserBRes = await app.inject({
        method: 'GET',
        url: `/documents/${createdDoc.id}`,
        headers: { authorization: `Bearer ${tokenUserB}` },
      });
      expect(detailUserBRes.statusCode).toBe(404);
      expect(detailUserBRes.json<ErrorResponseBody>().error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });

  describe('borrado y aislamiento RNF-01', () => {
    it('sube, borra y comprueba que deja de aparecer en detalle y listado', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'delete-flow@example.com');

      const pdfBuffer = await buildPdfBuffer(1);
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'a-borrar.pdf');

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/documents',
        headers: { authorization: `Bearer ${token}` },
        payload: form,
      });
      const createdDoc = uploadRes.json<DocumentResponseBody>();

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/documents/${createdDoc.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(deleteRes.statusCode).toBe(204);
      expect(deleteRes.body).toBe('');

      const getByIdRes = await app.inject({
        method: 'GET',
        url: `/documents/${createdDoc.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getByIdRes.statusCode).toBe(404);
      expect(getByIdRes.json<ErrorResponseBody>().error.code).toBe('DOCUMENT_NOT_FOUND');

      const listRes = await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listRes.json<DocumentResponseBody[]>()).toHaveLength(0);
    });

    it('DELETE sobre un id inexistente devuelve 404 DOCUMENT_NOT_FOUND', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'delete-404@example.com');

      const res = await app.inject({
        method: 'DELETE',
        url: '/documents/id-que-no-existe',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json<ErrorResponseBody>().error.code).toBe('DOCUMENT_NOT_FOUND');
    });

    it('RNF-01: el usuario B no puede borrar un documento del usuario A, que sigue intacto', async () => {
      ({ app } = await buildTestApp());
      const tokenUserA = await registerAndGetToken(app, 'delete-userA@example.com');
      const tokenUserB = await registerAndGetToken(app, 'delete-userB@example.com');

      const pdfBuffer = await buildPdfBuffer(1);
      const form = new FormData();
      form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'de-usuario-a.pdf');

      const uploadRes = await app.inject({
        method: 'POST',
        url: '/documents',
        headers: { authorization: `Bearer ${tokenUserA}` },
        payload: form,
      });
      const createdDoc = uploadRes.json<DocumentResponseBody>();

      const deleteByUserBRes = await app.inject({
        method: 'DELETE',
        url: `/documents/${createdDoc.id}`,
        headers: { authorization: `Bearer ${tokenUserB}` },
      });
      expect(deleteByUserBRes.statusCode).toBe(404);
      expect(deleteByUserBRes.json<ErrorResponseBody>().error.code).toBe('DOCUMENT_NOT_FOUND');

      const detailUserARes = await app.inject({
        method: 'GET',
        url: `/documents/${createdDoc.id}`,
        headers: { authorization: `Bearer ${tokenUserA}` },
      });
      expect(detailUserARes.statusCode).toBe(200);
      expect(detailUserARes.json<DocumentResponseBody>()).toEqual(createdDoc);
    });
  });

  describe('validaciones de subida y manejo de errores', () => {
    it('rechaza una petición sin archivo adjunto con 400 VALIDATION_ERROR', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'val@example.com');

      const form = new FormData();
      // Sin adjuntar 'file'

      const res = await app.inject({
        method: 'POST',
        url: '/documents',
        headers: { authorization: `Bearer ${token}` },
        payload: form,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json<ErrorResponseBody>().error.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza un archivo que no es un PDF válido con 415 INVALID_FILE_TYPE', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'txt@example.com');

      const fakeFile = Buffer.from('contenido de texto plano');
      const form = new FormData();
      form.append('file', new Blob([fakeFile], { type: 'text/plain' }), 'documento.txt');

      const res = await app.inject({
        method: 'POST',
        url: '/documents',
        headers: { authorization: `Bearer ${token}` },
        payload: form,
      });

      expect(res.statusCode).toBe(415);
      expect(res.json<ErrorResponseBody>().error.code).toBe('INVALID_FILE_TYPE');
    });

    it('rechaza un PDF con más de 50 páginas con 422 TOO_MANY_PAGES', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'pages@example.com');

      const longPdf = await buildPdfBuffer(51);
      const form = new FormData();
      form.append('file', new Blob([longPdf], { type: 'application/pdf' }), 'muchas-paginas.pdf');

      const res = await app.inject({
        method: 'POST',
        url: '/documents',
        headers: { authorization: `Bearer ${token}` },
        payload: form,
      });

      expect(res.statusCode).toBe(422);
      expect(res.json<ErrorResponseBody>().error.code).toBe('TOO_MANY_PAGES');
    });

    it('rechaza un archivo que supera MAX_UPLOAD_BYTES con 413 FILE_TOO_LARGE vía multipart', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'large@example.com');

      const largeBuffer = Buffer.alloc(MAX_UPLOAD_BYTES + 1024);
      largeBuffer.set(Buffer.from('%PDF-1.4\n'), 0);

      const form = new FormData();
      form.append('file', new Blob([largeBuffer], { type: 'application/pdf' }), 'pesado.pdf');

      const res = await app.inject({
        method: 'POST',
        url: '/documents',
        headers: { authorization: `Bearer ${token}` },
        payload: form,
      });

      expect(res.statusCode).toBe(413);
      expect(res.json<ErrorResponseBody>().error.code).toBe('FILE_TOO_LARGE');
    });

    it('GET /documents/:id devuelve 404 DOCUMENT_NOT_FOUND para un id inexistente', async () => {
      ({ app } = await buildTestApp());
      const token = await registerAndGetToken(app, 'get404@example.com');

      const res = await app.inject({
        method: 'GET',
        url: '/documents/id-que-no-existe',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json<ErrorResponseBody>().error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });
});
