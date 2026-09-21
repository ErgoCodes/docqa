export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`Ya existe un usuario con el email ${email}`);
    this.name = 'DuplicateEmailError';
  }
}
