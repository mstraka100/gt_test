import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticate,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../middleware/auth';
import { config } from '../config';
import * as userModel from '../models/user';
import { User } from '../types';

// Mock the user model
jest.mock('../models/user');

describe('Auth Middleware', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed',
    displayName: 'Test User',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken(mockUser.id, mockUser.email);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; email: string };
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('should set correct expiration', () => {
      const token = generateAccessToken(mockUser.id, mockUser.email);
      const decoded = jwt.decode(token) as { exp: number; iat: number };

      const expectedExpiry = decoded.iat + config.jwtExpiresIn;
      expect(decoded.exp).toBe(expectedExpiry);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = generateRefreshToken(mockUser.id, mockUser.email);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; email: string };
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('should have longer expiration than access token', () => {
      const accessToken = generateAccessToken(mockUser.id, mockUser.email);
      const refreshToken = generateRefreshToken(mockUser.id, mockUser.email);

      const accessDecoded = jwt.decode(accessToken) as { exp: number; iat: number };
      const refreshDecoded = jwt.decode(refreshToken) as { exp: number; iat: number };

      const accessExpiry = accessDecoded.exp - accessDecoded.iat;
      const refreshExpiry = refreshDecoded.exp - refreshDecoded.iat;

      expect(refreshExpiry).toBeGreaterThan(accessExpiry);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = generateRefreshToken(mockUser.id, mockUser.email);
      const payload = verifyRefreshToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
    });

    it('should return null for invalid token', () => {
      const payload = verifyRefreshToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        config.jwtSecret,
        { expiresIn: -1 } // Already expired
      );

      const payload = verifyRefreshToken(expiredToken);
      expect(payload).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      const wrongSecretToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const payload = verifyRefreshToken(wrongSecretToken);
      expect(payload).toBeNull();
    });
  });

  describe('authenticate middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnValue({ json: jsonMock });

      mockReq = {
        headers: {},
      };
      mockRes = {
        status: statusMock,
        json: jsonMock,
      };
      mockNext = jest.fn();

      jest.clearAllMocks();
    });

    it('should reject request without authorization header', async () => {
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      mockReq.headers = { authorization: 'InvalidFormat token' };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'No token provided' });
    });

    it('should reject request with invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('should reject request with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email },
        config.jwtSecret,
        { expiresIn: -1 }
      );
      mockReq.headers = { authorization: `Bearer ${expiredToken}` };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Token expired' });
    });

    it('should reject request when user not found', async () => {
      const validToken = generateAccessToken(mockUser.id, mockUser.email);
      mockReq.headers = { authorization: `Bearer ${validToken}` };
      (userModel.findUserById as jest.Mock).mockResolvedValue(null);

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should authenticate valid token and set user on request', async () => {
      const validToken = generateAccessToken(mockUser.id, mockUser.email);
      mockReq.headers = { authorization: `Bearer ${validToken}` };
      (userModel.findUserById as jest.Mock).mockResolvedValue(mockUser);

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as Request).user).toEqual(mockUser);
    });
  });
});
