import { describe, expect, it } from 'vitest';
import { emailSchema, passwordSchema } from './auth.schemas.js';

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
