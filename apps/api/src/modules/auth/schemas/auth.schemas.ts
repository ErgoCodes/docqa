import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Mínimo 12 caracteres, sin reglas de composición (mayúsculas/símbolos):
// siguiendo NIST SP 800-63B, esas reglas empeoran las contraseñas reales.
export const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(128, 'La contraseña no puede superar los 128 caracteres');
