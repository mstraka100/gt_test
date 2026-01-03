import { Router, Request, Response } from 'express';
import {
  findUserById,
  findUserByUsername,
  updateUser,
  listUsers,
  sanitizeUser,
} from '../models/user';
import { authenticate } from '../middleware/auth';
import { UpdateUserInput } from '../types';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /users - List all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await listUsers();
    res.json({ users: users.map(sanitizeUser) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:id - Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/username/:username - Get user by username
router.get('/username/:username', async (req: Request, res: Response) => {
  try {
    const user = await findUserByUsername(req.params.username);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /users/:id - Update user profile
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    // Users can only update their own profile
    if (req.user!.id !== req.params.id) {
      res.status(403).json({ error: 'Cannot update other users' });
      return;
    }

    const input: UpdateUserInput = {};

    // Only allow updating specific fields
    if (req.body.displayName !== undefined) {
      input.displayName = req.body.displayName;
    }
    if (req.body.avatarUrl !== undefined) {
      input.avatarUrl = req.body.avatarUrl;
    }
    if (req.body.status !== undefined) {
      const validStatuses = ['active', 'away', 'dnd', 'offline'];
      if (!validStatuses.includes(req.body.status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      input.status = req.body.status;
    }

    if (Object.keys(input).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const user = await updateUser(req.params.id, input);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
