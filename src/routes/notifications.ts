import { Router, Request, Response } from 'express';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
} from '../models/notification';
import { authenticate } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /notifications - Get user's notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const unreadOnly = req.query.unread === 'true';

    const notifications = await getUserNotifications(req.user!.id, limit, unreadOnly);
    const unreadCount = await getUnreadCount(req.user!.id);

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /notifications/unread-count - Get unread notification count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const count = await getUnreadCount(req.user!.id);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notifications/:id/read - Mark notification as read
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const notification = await markAsRead(req.params.id, req.user!.id);
    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ notification });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permission denied') {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notifications/read-all - Mark all notifications as read
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const count = await markAllAsRead(req.user!.id);
    res.json({ markedRead: count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /notifications/:id - Delete a notification
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteNotification(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permission denied') {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /notifications/preferences - Get notification preferences
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const prefs = await getPreferences(req.user!.id);
    res.json({ preferences: prefs });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /notifications/preferences - Update notification preferences
router.patch('/preferences', async (req: Request, res: Response) => {
  try {
    const updates: Record<string, boolean> = {};
    const allowedFields = ['mentions', 'directMessages', 'channelMessages', 'sounds', 'desktop'];

    for (const field of allowedFields) {
      if (typeof req.body[field] === 'boolean') {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const prefs = await updatePreferences(req.user!.id, updates);
    res.json({ preferences: prefs });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
