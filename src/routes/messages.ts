import { Router, Request, Response } from 'express';
import {
  createMessage,
  findMessageById,
  getChannelMessages,
  updateMessage,
  deleteMessage,
} from '../models/message';
import { findChannelById, isMember } from '../models/channel';
import { findUserById, sanitizeUser } from '../models/user';
import { authenticate } from '../middleware/auth';

const router = Router();

// All message routes require authentication
router.use(authenticate);

// GET /messages/channel/:channelId - Get messages for a channel
router.get('/channel/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    const channel = await findChannelById(channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check access for private channels
    if (channel.type === 'private') {
      const member = await isMember(channelId, req.user!.id);
      if (!member) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const messages = await getChannelMessages(channelId, limit, before);

    // Fetch user details for each message
    const messagesWithUsers = await Promise.all(
      messages.map(async (message) => {
        if (message.userId === 'system') {
          return { ...message, user: null };
        }
        const user = await findUserById(message.userId);
        return {
          ...message,
          user: user ? sanitizeUser(user) : null,
        };
      })
    );

    res.json({
      messages: messagesWithUsers,
      hasMore: messages.length === limit,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /messages - Create a new message
router.post('/', async (req: Request, res: Response) => {
  try {
    const { channelId, content } = req.body;

    if (!channelId || !content) {
      res.status(400).json({ error: 'channelId and content are required' });
      return;
    }

    if (content.trim().length === 0) {
      res.status(400).json({ error: 'Message content cannot be empty' });
      return;
    }

    if (content.length > 4000) {
      res.status(400).json({ error: 'Message too long (max 4000 characters)' });
      return;
    }

    const channel = await findChannelById(channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Must be a member to post
    const member = await isMember(channelId, req.user!.id);
    if (!member) {
      res.status(403).json({ error: 'Not a channel member' });
      return;
    }

    const message = await createMessage({
      channelId,
      userId: req.user!.id,
      content: content.trim(),
    });

    const user = await findUserById(req.user!.id);

    res.status(201).json({
      message: {
        ...message,
        user: user ? sanitizeUser(user) : null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /messages/:id - Get a specific message
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const message = await findMessageById(req.params.id);
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const channel = await findChannelById(message.channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check access for private channels
    if (channel.type === 'private') {
      const member = await isMember(message.channelId, req.user!.id);
      if (!member) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const user = message.userId === 'system' ? null : await findUserById(message.userId);

    res.json({
      message: {
        ...message,
        user: user ? sanitizeUser(user) : null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /messages/:id - Edit a message
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    if (content.trim().length === 0) {
      res.status(400).json({ error: 'Message content cannot be empty' });
      return;
    }

    if (content.length > 4000) {
      res.status(400).json({ error: 'Message too long (max 4000 characters)' });
      return;
    }

    const message = await updateMessage(req.params.id, req.user!.id, content.trim());
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const user = await findUserById(req.user!.id);

    res.json({
      message: {
        ...message,
        user: user ? sanitizeUser(user) : null,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permission denied') {
      res.status(403).json({ error: 'Can only edit your own messages' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /messages/:id - Delete a message
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteMessage(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    res.json({ message: 'Message deleted' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permission denied') {
      res.status(403).json({ error: 'Can only delete your own messages' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
