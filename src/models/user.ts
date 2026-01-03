import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { User, CreateUserInput, UpdateUserInput } from '../types';

// In-memory storage (replace with database in production)
const users: Map<string, User> = new Map();
const usersByEmail: Map<string, string> = new Map();
const usersByUsername: Map<string, string> = new Map();

// Refresh token storage
const refreshTokens: Map<string, string> = new Map(); // token -> userId

export async function createUser(input: CreateUserInput): Promise<User> {
  // Check for existing email
  if (usersByEmail.has(input.email.toLowerCase())) {
    throw new Error('Email already registered');
  }

  // Check for existing username
  if (usersByUsername.has(input.username.toLowerCase())) {
    throw new Error('Username already taken');
  }

  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

  const user: User = {
    id: uuidv4(),
    email: input.email.toLowerCase(),
    username: input.username.toLowerCase(),
    passwordHash,
    displayName: input.displayName,
    status: 'offline',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.set(user.id, user);
  usersByEmail.set(user.email, user.id);
  usersByUsername.set(user.username, user.id);

  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  return users.get(id) || null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const userId = usersByEmail.get(email.toLowerCase());
  if (!userId) return null;
  return users.get(userId) || null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const userId = usersByUsername.get(username.toLowerCase());
  if (!userId) return null;
  return users.get(userId) || null;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
  const user = users.get(id);
  if (!user) return null;

  const updatedUser: User = {
    ...user,
    ...input,
    updatedAt: new Date(),
  };

  users.set(id, updatedUser);
  return updatedUser;
}

export async function listUsers(): Promise<User[]> {
  return Array.from(users.values());
}

export function storeRefreshToken(token: string, userId: string): void {
  refreshTokens.set(token, userId);
}

export function getRefreshTokenUserId(token: string): string | null {
  return refreshTokens.get(token) || null;
}

export function revokeRefreshToken(token: string): boolean {
  return refreshTokens.delete(token);
}

export function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
