import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import channelRoutes from '../routes/channels';
import messageRoutes from '../routes/messages';
import { createUser, findUserById } from '../models/user';
import { TokenPayload } from '../types';

// Counter for unique test data
let testCounter = 0;

export function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/channels', channelRoutes);
  app.use('/messages', messageRoutes);
  return app;
}

export function generateTestToken(userId: string, email: string): string {
  const payload: TokenPayload = { userId, email };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

export async function createTestUser(overrides: Partial<{ email: string; username: string; displayName: string }> = {}) {
  const suffix = `${Date.now()}-${++testCounter}`;
  const user = await createUser({
    email: overrides.email || `test-${suffix}@example.com`,
    username: overrides.username || `testuser-${suffix}`,
    password: 'password123',
    displayName: overrides.displayName || `Test User ${suffix}`,
  });
  const token = generateTestToken(user.id, user.email);
  return { user, token };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
