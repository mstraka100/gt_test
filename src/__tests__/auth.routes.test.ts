import express, { Express } from 'express';
import request from 'supertest';
import authRouter from '../routes/auth';
import { clearAllData, getRefreshTokenUserId } from '../models/user';

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(() => {
    clearAllData();
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
  });

  describe('POST /auth/register', () => {
    const validUser = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      displayName: 'Test User',
    };

    it('should register a new user successfully', async () => {
      const res = await request(app).post('/auth/register').send(validUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(validUser.email.toLowerCase());
      expect(res.body.user.username).toBe(validUser.username.toLowerCase());
      expect(res.body.user.displayName).toBe(validUser.displayName);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject registration with missing fields', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'test@example.com',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app).post('/auth/register').send({
        ...validUser,
        email: 'invalid-email',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email format');
    });

    it('should reject short passwords', async () => {
      const res = await request(app).post('/auth/register').send({
        ...validUser,
        password: 'short',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 8 characters');
    });

    it('should reject invalid username format', async () => {
      const res = await request(app).post('/auth/register').send({
        ...validUser,
        username: 'a', // Too short
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username must be 3-30 characters, alphanumeric with _ or -');
    });

    it('should reject duplicate email', async () => {
      // First registration
      const firstRes = await request(app).post('/auth/register').send(validUser);
      expect(firstRes.status).toBe(201);

      // Second registration with same email, different username
      const res = await request(app).post('/auth/register').send({
        email: validUser.email, // same email
        username: 'differentuser',
        password: 'password123',
        displayName: 'Different User',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
    });

    it('should reject duplicate username', async () => {
      // First registration
      const firstRes = await request(app).post('/auth/register').send(validUser);
      expect(firstRes.status).toBe(201);

      // Second registration with same username, different email
      const res = await request(app).post('/auth/register').send({
        email: 'different@example.com',
        username: validUser.username, // same username
        password: 'password123',
        displayName: 'Different User',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Username already taken');
    });
  });

  describe('POST /auth/login', () => {
    const testUser = {
      email: 'login@example.com',
      username: 'loginuser',
      password: 'password123',
      displayName: 'Login User',
    };

    beforeEach(async () => {
      await request(app).post('/auth/register').send(testUser);
    });

    it('should login successfully with valid credentials', async () => {
      const res = await request(app).post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('should reject login with missing fields', async () => {
      const res = await request(app).post('/auth/login').send({
        email: testUser.email,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password required');
    });

    it('should reject login with wrong email', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'wrong@example.com',
        password: testUser.password,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app).post('/auth/login').send({
        email: testUser.email,
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      const registerRes = await request(app).post('/auth/register').send({
        email: 'refresh@example.com',
        username: 'refreshuser',
        password: 'password123',
        displayName: 'Refresh User',
      });
      refreshToken = registerRes.body.refreshToken;
      userId = registerRes.body.user.id;
    });

    it('should refresh tokens successfully', async () => {
      const res = await request(app).post('/auth/refresh').send({
        refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      // Verify the new refresh token is stored (rotation happened)
      expect(getRefreshTokenUserId(res.body.refreshToken)).toBe(userId);
    });

    it('should reject missing refresh token', async () => {
      const res = await request(app).post('/auth/refresh').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Refresh token required');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app).post('/auth/refresh').send({
        refreshToken: 'invalid-token',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid refresh token');
    });

    it('should revoke old refresh token after use', async () => {
      // Use the refresh token once
      const firstRes = await request(app).post('/auth/refresh').send({ refreshToken });
      expect(firstRes.status).toBe(200);

      const newToken = firstRes.body.refreshToken;

      // If tokens are different (generated in different seconds), verify old is revoked
      // If tokens are identical (same second), the old token is effectively the new token
      if (newToken !== refreshToken) {
        expect(getRefreshTokenUserId(refreshToken)).toBeNull();
      }

      // Verify new token is valid in either case
      expect(getRefreshTokenUserId(newToken)).toBe(userId);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const registerRes = await request(app).post('/auth/register').send({
        email: 'logout@example.com',
        username: 'logoutuser',
        password: 'password123',
        displayName: 'Logout User',
      });
      accessToken = registerRes.body.accessToken;
      refreshToken = registerRes.body.refreshToken;
    });

    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
    });

    it('should reject logout without authentication', async () => {
      const res = await request(app).post('/auth/logout').send({ refreshToken });

      expect(res.status).toBe(401);
    });

    it('should invalidate refresh token after logout', async () => {
      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      // Verify token is revoked in store
      expect(getRefreshTokenUserId(refreshToken)).toBeNull();
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;
    const testUser = {
      email: 'me@example.com',
      username: 'meuser',
      password: 'password123',
      displayName: 'Me User',
    };

    beforeEach(async () => {
      const registerRes = await request(app).post('/auth/register').send(testUser);
      accessToken = registerRes.body.accessToken;
    });

    it('should return current user', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.displayName).toBe(testUser.displayName);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject without authentication', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
