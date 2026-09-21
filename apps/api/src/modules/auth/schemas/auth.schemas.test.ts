import { describe, expect, it } from 'vitest';
import { emailSchema, loginBodySchema, passwordSchema, refreshBodySchema, registerBodySchema } from './auth.schemas.js';

describe('emailSchema', () => {
  it('normaliza espacios y mayúsculas', () => {
    expect(emailSchema.parse('  Ana@Example.com  ')).toBe('ana@example.com');
  });

  it('rechaza un valor que no es un email', () => {
    expect(emailSchema.safeParse('no-es-un-email').success).toBe(false);
  });

  it('rechaza un email de más de 254 caracteres', () => {
    const local = 'a'.repeat(250);
    expect(emailSchema.safeParse(`${local}@example.com`).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('acepta el límite inferior de 12 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(12)).success).toBe(true);
  });

  it('acepta el límite superior de 128 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true);
  });

  it('rechaza menos de 12 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(11)).success).toBe(false);
  });

  it('rechaza más de 128 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('no exige mayúsculas, símbolos ni dígitos', () => {
    expect(passwordSchema.safeParse('solo-minusculas-y-guiones').success).toBe(true);
  });
});

describe('registerBodySchema', () => {
  it('acepta email y contraseña válidos y normaliza el email', () => {
    const result = registerBodySchema.parse({ email: 'Ana@Example.com', password: 'contrasena-larga-123' });
    expect(result.email).toBe('ana@example.com');
  });

  it('rechaza campos extra', () => {
    expect(
      registerBodySchema.safeParse({ email: 'ana@example.com', password: 'contrasena-larga-123', role: 'admin' })
        .success,
    ).toBe(false);
  });

  it('rechaza una contraseña igual al email', () => {
    expect(registerBodySchema.safeParse({ email: 'iguales@example.com', password: 'iguales@example.com' }).success).toBe(
      false,
    );
  });
});

describe('loginBodySchema', () => {
  it('acepta cualquier contraseña no vacía, sin exigir la política de 12 caracteres', () => {
    expect(loginBodySchema.safeParse({ email: 'ana@example.com', password: 'corta' }).success).toBe(true);
  });

  it('rechaza una contraseña vacía', () => {
    expect(loginBodySchema.safeParse({ email: 'ana@example.com', password: '' }).success).toBe(false);
  });
});

describe('refreshBodySchema', () => {
  it('acepta un refreshToken no vacío', () => {
    expect(refreshBodySchema.safeParse({ refreshToken: 'algun-token' }).success).toBe(true);
  });

  it('rechaza un cuerpo sin refreshToken', () => {
    expect(refreshBodySchema.safeParse({}).success).toBe(false);
  });
});
