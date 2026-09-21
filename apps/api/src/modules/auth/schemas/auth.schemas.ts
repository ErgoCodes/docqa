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

// La contraseña de login no exige la política de registro (12-128): eso
// filtraría la regla a quien solo está probando credenciales, y aceptaría
// una cadena arbitrariamente larga que encarecería el argon2 de verify sin
// motivo. Un tope generoso basta para no malgastar cómputo.
const loginPasswordSchema = z.string().min(1).max(128);

export const registerBodySchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .strict()
  .refine(({ email, password }) => password.toLowerCase() !== email, {
    path: ['password'],
    message: 'La contraseña no puede ser igual al email',
  });

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({ email: emailSchema, password: loginPasswordSchema }).strict();

export type LoginBody = z.infer<typeof loginBodySchema>;

export const refreshBodySchema = z.object({ refreshToken: z.string().min(1) }).strict();

export type RefreshBody = z.infer<typeof refreshBodySchema>;

// Las respuestas se construyen con .parse(), no solo se tipan: z.object()
// descarta claves desconocidas, así que es estructuralmente imposible que un
// passwordHash se cuele en una respuesta aunque el servicio devolviera el
// documento entero por error.
export const authUserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.date(),
});

export const authTokensResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number(),
});

export const authResultResponseSchema = z.object({
  user: authUserResponseSchema,
  tokens: authTokensResponseSchema,
});
