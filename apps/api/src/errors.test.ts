import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, mapErrorToResponse } from './errors.js';

describe('mapErrorToResponse', () => {
  it('mapea un AppError a su código y estado propios', () => {
    const error = new AppError({ code: 'EMAIL_ALREADY_REGISTERED', statusCode: 409, message: 'Ya existe una cuenta con ese email' });

    const result = mapErrorToResponse(error, 'req-1');

    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual({
      error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'Ya existe una cuenta con ese email', details: undefined },
      requestId: 'req-1',
    });
  });

  it('incluye los details de un AppError cuando existen', () => {
    const error = new AppError({ code: 'VALIDATION_ERROR', statusCode: 400, message: 'Datos inválidos' }, [
      { path: 'email', message: 'Email inválido' },
    ]);

    const result = mapErrorToResponse(error, 'req-2');

    expect(result.body.error.details).toEqual([{ path: 'email', message: 'Email inválido' }]);
  });

  it('mapea un ZodError a 400 con un detalle por cada issue', () => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(12) });
    const parseResult = schema.safeParse({ email: 'no-es-un-email', password: 'corta' });
    if (parseResult.success) {
      throw new Error('el parseo de prueba debía fallar');
    }

    const result = mapErrorToResponse(parseResult.error, 'req-3');

    expect(result.statusCode).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(result.body.error.details).toHaveLength(2);
    expect(result.body.error.details?.[0]).toMatchObject({ path: 'email' });
  });

  it('mapea cualquier otro error a 500 sin filtrar su mensaje original', () => {
    const result = mapErrorToResponse(new Error('detalle interno sensible'), 'req-4');

    expect(result.statusCode).toBe(500);
    expect(result.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(result.body)).not.toContain('detalle interno sensible');
  });
});
