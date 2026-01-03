import { Router, Request, Response } from 'express';
import {
  createChannel,
  findChannelById,
  findChannelByName,
  updateChannel,
  deleteChannel,
  listChannels,
  addMember,
  removeMember,
  getChannelMembers,
  isMember,
  joinPublicChannel,
} from '../models/channel';
import { findUserById, sanitizeUser } from '../models/user';
import { authenticate } from '../middleware/auth';
import { CreateChannelInput, UpdateChannelInput } from '../types';

const router = Router();

// All channel routes require authentication
router.use(authenticate);

// GET /channels - List channels visible to user
router.get('/', async (req: Request, res: Response) => {
  try {
    const channels = await listChannels(req.user!.id);
    res.json({ channels });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /channels - Create a new channel
router.post('/', async (req: Request, res: Response) => {
  try {
    const input: CreateChannelInput = req.body;

    if (!input.name) {
      res.status(400).json({ error: 'Channel name is required' });
      return;
    }

    if (input.name.length < 2 || input.name.length > 80) {
      res.status(400).json({ error: 'Channel name must be 2-80 characters' });
      return;
    }

    if (input.type && !['public', 'private'].includes(input.type)) {
      res.status(400).json({ error: 'Invalid channel type' });
      return;
    }

    const channel = await createChannel(input, req.user!.id);
    res.status(201).json({ channel });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Channel name already exists') {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error.message === 'Invalid channel name') {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /channels/:id - Get channel by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const channel = await findChannelById(req.params.id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check access for private channels
    if (channel.type === 'private' && !channel.memberIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ channel });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /channels/name/:name - Get channel by name
router.get('/name/:name', async (req: Request, res: Response) => {
  try {
    const channel = await findChannelByName(req.params.name);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check access for private channels
    if (channel.type === 'private' && !channel.memberIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ channel });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /channels/:id - Update channel
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const input: UpdateChannelInput = {};

    if (req.body.name !== undefined) {
      if (req.body.name.length < 2 || req.body.name.length > 80) {
        res.status(400).json({ error: 'Channel name must be 2-80 characters' });
        return;
      }
      input.name = req.body.name;
    }

    if (req.body.description !== undefined) {
      input.description = req.body.description;
    }

    if (Object.keys(input).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const channel = await updateChannel(req.params.id, input, req.user!.id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    res.json({ channel });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Permission denied') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error.message === 'Channel name already exists') {
        res.status(409).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /channels/:id - Delete channel
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteChannel(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.json({ message: 'Channel deleted' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Only channel owner can delete') {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /channels/:id/join - Join a public channel
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const member = await joinPublicChannel(req.params.id, req.user!.id);
    res.json({ member });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Channel not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'Cannot join private channel without invitation') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error.message === 'Already a member') {
        res.status(409).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /channels/:id/leave - Leave a channel
router.post('/:id/leave', async (req: Request, res: Response) => {
  try {
    await removeMember(req.params.id, req.user!.id, req.user!.id);
    res.json({ message: 'Left channel' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Channel not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'User is not a member') {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error.message === 'Owner must transfer ownership before leaving') {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /channels/:id/members - List channel members
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const channel = await findChannelById(req.params.id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Must be a member to see member list (for private channels)
    if (channel.type === 'private' && !channel.memberIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const members = await getChannelMembers(req.params.id);

    // Fetch user details for each member
    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const user = await findUserById(member.userId);
        return {
          ...member,
          user: user ? sanitizeUser(user) : null,
        };
      })
    );

    res.json({ members: membersWithUsers });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /channels/:id/members - Add a member to channel
router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Check if target user exists
    const targetUser = await findUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const member = await addMember(req.params.id, userId, req.user!.id);
    res.status(201).json({ member });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Channel not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'Permission denied') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error.message === 'User is already a member') {
        res.status(409).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /channels/:id/members/:userId - Remove a member from channel
router.delete('/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    await removeMember(req.params.id, req.params.userId, req.user!.id);
    res.json({ message: 'Member removed' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Channel not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'User is not a member') {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error.message === 'Permission denied') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error.message === 'Cannot remove channel owner') {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
