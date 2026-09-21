import type { User } from '../types/user.js';

export interface NewUser {
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface UserRepository {
  insert: (user: NewUser) => Promise<User>;
  findByEmail: (email: string) => Promise<User | null>;
  findById: (userId: string) => Promise<User | null>;
}
