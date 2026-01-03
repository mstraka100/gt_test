import { Router, Request, Response } from 'express';
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  storeRefreshToken,
  getRefreshTokenUserId,
  revokeRefreshToken,
  findUserById,
  sanitizeUser,
} from '../models/user';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticate,
} from '../middleware/auth';
import { CreateUserInput, LoginInput } from '../types';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const input: CreateUserInput = req.body;

    // Validate required fields
    if (!input.email || !input.username || !input.password || !input.displayName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Validate password strength
    if (input.password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(input.username)) {
      res.status(400).json({ error: 'Username must be 3-30 characters, alphanumeric with _ or -' });
      return;
    }

    const user = await createUser(input);
    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    storeRefreshToken(refreshToken, user.id);

    res.status(201).json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Email already registered' || error.message === 'Username already taken') {
        res.status(409).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const input: LoginInput = req.body;

    if (!input.email || !input.password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await findUserByEmail(input.email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await verifyPassword(user, input.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id, user.email);

    storeRefreshToken(refreshToken, user.id);

    res.json({
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const storedUserId = getRefreshTokenUserId(refreshToken);
    if (!storedUserId || storedUserId !== payload.userId) {
      res.status(401).json({ error: 'Refresh token revoked' });
      return;
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Rotate refresh token
    revokeRefreshToken(refreshToken);
    const newAccessToken = generateAccessToken(user.id, user.email);
    const newRefreshToken = generateRefreshToken(user.id, user.email);
    storeRefreshToken(newRefreshToken, user.id);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      revokeRefreshToken(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({ user: sanitizeUser(req.user!) });
});

export default router;
