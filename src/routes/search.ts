import { Router, Request, Response } from 'express';
import { search } from '../models/search';
import { findUserById, sanitizeUser } from '../models/user';
import { findChannelById } from '../models/channel';
import { findDMById } from '../models/dm';
import { authenticate } from '../middleware/auth';

const router = Router();

// All search routes require authentication
router.use(authenticate);

// GET /search - Search messages
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const channelId = req.query.channel as string | undefined;
    const dmId = req.query.dm as string | undefined;

    if (!query || query.trim().length < 2) {
      res.status(400).json({ error: 'Query must be at least 2 characters' });
      return;
    }

    // Verify access to specific channel or DM if provided
    if (channelId) {
      const channel = await findChannelById(channelId);
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      if (channel.type === 'private' && !channel.memberIds.includes(req.user!.id)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    if (dmId) {
      const dm = await findDMById(dmId);
      if (!dm) {
        res.status(404).json({ error: 'DM not found' });
        return;
      }
      if (!dm.participantIds.includes(req.user!.id)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const results = await search({
      query: query.trim(),
      userId: req.user!.id,
      limit,
      channelId,
      dmId,
    });

    // Enrich results with user and context data
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const user = await findUserById(result.userId);
        let context = null;

        if (result.channelId) {
          const channel = await findChannelById(result.channelId);
          if (channel) {
            context = { type: 'channel', id: channel.id, name: channel.name };
          }
        } else if (result.dmId) {
          const dm = await findDMById(result.dmId);
          if (dm) {
            const participants = await Promise.all(
              dm.participantIds
                .filter((id) => id !== req.user!.id)
                .map(async (id) => {
                  const u = await findUserById(id);
                  return u ? sanitizeUser(u) : null;
                })
            );
            context = {
              type: 'dm',
              id: dm.id,
              participants: participants.filter(Boolean),
            };
          }
        }

        return {
          ...result,
          user: user ? sanitizeUser(user) : null,
          context,
        };
      })
    );

    res.json({
      query: query.trim(),
      results: enrichedResults,
      count: enrichedResults.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
