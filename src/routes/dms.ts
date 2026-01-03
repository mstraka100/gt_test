import { Router, Request, Response } from 'express';
import {
  findOrCreateDM,
  findDMById,
  getUserDMs,
  isParticipant,
  createDMMessage,
  getDMMessages,
  findDMMessageById,
  updateDMMessage,
  deleteDMMessage,
  addParticipant,
  leaveGroupDM,
} from '../models/dm';
import { findUserById, sanitizeUser } from '../models/user';
import { authenticate } from '../middleware/auth';

const router = Router();

// All DM routes require authentication
router.use(authenticate);

// GET /dms - List user's DMs
router.get('/', async (req: Request, res: Response) => {
  try {
    const dms = await getUserDMs(req.user!.id);

    // Fetch participant details for each DM
    const dmsWithUsers = await Promise.all(
      dms.map(async (dm) => {
        const participants = await Promise.all(
          dm.participantIds.map(async (userId) => {
            const user = await findUserById(userId);
            return user ? sanitizeUser(user) : null;
          })
        );
        return {
          ...dm,
          participants: participants.filter(Boolean),
        };
      })
    );

    res.json({ dms: dmsWithUsers });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /dms - Create or get existing DM
router.post('/', async (req: Request, res: Response) => {
  try {
    const { participantIds } = req.body;

    if (!participantIds || !Array.isArray(participantIds)) {
      res.status(400).json({ error: 'participantIds array required' });
      return;
    }

    if (participantIds.length === 0) {
      res.status(400).json({ error: 'At least one other participant required' });
      return;
    }

    // Verify all participants exist
    for (const userId of participantIds) {
      const user = await findUserById(userId);
      if (!user) {
        res.status(404).json({ error: `User ${userId} not found` });
        return;
      }
    }

    const dm = await findOrCreateDM(participantIds, req.user!.id);

    // Fetch participant details
    const participants = await Promise.all(
      dm.participantIds.map(async (userId) => {
        const user = await findUserById(userId);
        return user ? sanitizeUser(user) : null;
      })
    );

    res.status(201).json({
      dm: {
        ...dm,
        participants: participants.filter(Boolean),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'DM requires at least 2 participants') {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /dms/:id - Get DM by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dm = await findDMById(req.params.id);
    if (!dm) {
      res.status(404).json({ error: 'DM not found' });
      return;
    }

    // Check if user is a participant
    if (!dm.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const participants = await Promise.all(
      dm.participantIds.map(async (userId) => {
        const user = await findUserById(userId);
        return user ? sanitizeUser(user) : null;
      })
    );

    res.json({
      dm: {
        ...dm,
        participants: participants.filter(Boolean),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /dms/:id/messages - Get messages in a DM
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    const dm = await findDMById(req.params.id);
    if (!dm) {
      res.status(404).json({ error: 'DM not found' });
      return;
    }

    if (!dm.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const messages = await getDMMessages(req.params.id, limit, before);

    const messagesWithUsers = await Promise.all(
      messages.map(async (message) => {
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

// POST /dms/:id/messages - Send a message in a DM
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Message content required' });
      return;
    }

    if (content.length > 4000) {
      res.status(400).json({ error: 'Message too long (max 4000 characters)' });
      return;
    }

    const dm = await findDMById(req.params.id);
    if (!dm) {
      res.status(404).json({ error: 'DM not found' });
      return;
    }

    if (!dm.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const message = await createDMMessage({
      dmId: req.params.id,
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

// PATCH /dms/:id/messages/:messageId - Edit a DM message
router.patch('/:id/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: 'Message content required' });
      return;
    }

    if (content.length > 4000) {
      res.status(400).json({ error: 'Message too long (max 4000 characters)' });
      return;
    }

    const dm = await findDMById(req.params.id);
    if (!dm) {
      res.status(404).json({ error: 'DM not found' });
      return;
    }

    if (!dm.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const message = await updateDMMessage(
      req.params.messageId,
      req.user!.id,
      content.trim()
    );

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

// DELETE /dms/:id/messages/:messageId - Delete a DM message
router.delete('/:id/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const dm = await findDMById(req.params.id);
    if (!dm) {
      res.status(404).json({ error: 'DM not found' });
      return;
    }

    if (!dm.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const deleted = await deleteDMMessage(req.params.messageId, req.user!.id);
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

// POST /dms/:id/participants - Add participant to group DM
router.post('/:id/participants', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    const dm = await findDMById(req.params.id);
    if (!dm) {
      res.status(404).json({ error: 'DM not found' });
      return;
    }

    if (!dm.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updatedDM = await addParticipant(req.params.id, userId);

    const participants = await Promise.all(
      updatedDM!.participantIds.map(async (uid) => {
        const u = await findUserById(uid);
        return u ? sanitizeUser(u) : null;
      })
    );

    res.json({
      dm: {
        ...updatedDM,
        participants: participants.filter(Boolean),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Cannot add participants to 1:1 DM') {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error.message === 'User is already a participant') {
        res.status(409).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /dms/:id/leave - Leave a group DM
router.post('/:id/leave', async (req: Request, res: Response) => {
  try {
    const dm = await findDMById(req.params.id);
    if (!dm) {
      res.status(404).json({ error: 'DM not found' });
      return;
    }

    if (!dm.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await leaveGroupDM(req.params.id, req.user!.id);
    res.json({ message: 'Left group DM' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Cannot leave 1:1 DM') {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
