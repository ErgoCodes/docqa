import { z } from 'zod';
import type { AccessTokenPayload } from '../types/access-token.js';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// El payload del JWT llega tipado por declaration merging, pero eso es una
// promesa del compilador sobre un dato que viene de la red: se revalida en
// tiempo de ejecución dentro del decorator `authenticate`.
export const accessTokenPayloadSchema: z.ZodType<AccessTokenPayload> = z.object({
  sub: z.string().min(1),
  typ: z.literal('access'),
});

// Mínimo 12 caracteres, sin reglas de composición (mayúsculas/símbolos):
// siguiendo NIST SP 800-63B, esas reglas empeoran las contraseñas reales.
export const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128, 'La contraseña no puede superar los 128 caracteres');
