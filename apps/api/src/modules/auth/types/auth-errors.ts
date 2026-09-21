import type { ErrorDefinition } from '../../../errors.js';

export const AuthErrors = {
  EMAIL_ALREADY_REGISTERED: {
    code: 'EMAIL_ALREADY_REGISTERED',
    statusCode: 409,
    message: 'Ya existe una cuenta con ese email',
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    statusCode: 401,
    message: 'Email o contraseña incorrectos',
  },
  INVALID_REFRESH_TOKEN: {
    code: 'INVALID_REFRESH_TOKEN',
    statusCode: 401,
    message: 'El token de renovación no es válido',
  },
} satisfies Record<string, ErrorDefinition>;
