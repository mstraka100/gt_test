import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  uploadFile,
  getFileById,
  getFileData,
  getChannelFiles,
  getDMFiles,
  getUserFiles,
  deleteFile,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from '../models/file';
import { findChannelById, isMember } from '../models/channel';
import { findDMById, isParticipant } from '../models/dm';
import { findUserById, sanitizeUser } from '../models/user';
import { authenticate } from '../middleware/auth';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// All file routes require authentication
router.use(authenticate);

// POST /files - Upload a file
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const { channelId, dmId } = req.body;

    // Verify access to channel or DM if provided
    if (channelId) {
      const channel = await findChannelById(channelId);
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      const member = await isMember(channelId, req.user!.id);
      if (!member) {
        res.status(403).json({ error: 'Not a channel member' });
        return;
      }
    }

    if (dmId) {
      const dm = await findDMById(dmId);
      if (!dm) {
        res.status(404).json({ error: 'DM not found' });
        return;
      }
      const participant = await isParticipant(dmId, req.user!.id);
      if (!participant) {
        res.status(403).json({ error: 'Not a DM participant' });
        return;
      }
    }

    const file = await uploadFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      uploaderId: req.user!.id,
      channelId,
      dmId,
    });

    const uploader = await findUserById(req.user!.id);

    res.status(201).json({
      file: {
        ...file,
        url: `/files/${file.id}/download`,
        uploader: uploader ? sanitizeUser(uploader) : null,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'File too large') {
        res.status(413).json({ error: 'File too large (max 10MB)' });
        return;
      }
      if (error.message === 'File type not allowed') {
        res.status(415).json({ error: 'File type not allowed' });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /files/:id - Get file metadata
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const file = await getFileById(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Check access
    if (file.channelId) {
      const channel = await findChannelById(file.channelId);
      if (channel && channel.type === 'private') {
        const member = await isMember(file.channelId, req.user!.id);
        if (!member) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }
    }

    if (file.dmId) {
      const participant = await isParticipant(file.dmId, req.user!.id);
      if (!participant) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const uploader = await findUserById(file.uploaderId);

    res.json({
      file: {
        ...file,
        url: `/files/${file.id}/download`,
        uploader: uploader ? sanitizeUser(uploader) : null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /files/:id/download - Download a file
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const file = await getFileById(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Check access
    if (file.channelId) {
      const channel = await findChannelById(file.channelId);
      if (channel && channel.type === 'private') {
        const member = await isMember(file.channelId, req.user!.id);
        if (!member) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }
    }

    if (file.dmId) {
      const participant = await isParticipant(file.dmId, req.user!.id);
      if (!participant) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const data = await getFileData(req.params.id);
    if (!data) {
      res.status(404).json({ error: 'File data not found' });
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /files/channel/:channelId - List files in a channel
router.get('/channel/:channelId', async (req: Request, res: Response) => {
  try {
    const channel = await findChannelById(req.params.channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    if (channel.type === 'private') {
      const member = await isMember(req.params.channelId, req.user!.id);
      if (!member) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const files = await getChannelFiles(req.params.channelId);

    const filesWithUploaders = await Promise.all(
      files.map(async (file) => {
        const uploader = await findUserById(file.uploaderId);
        return {
          ...file,
          url: `/files/${file.id}/download`,
          uploader: uploader ? sanitizeUser(uploader) : null,
        };
      })
    );

    res.json({ files: filesWithUploaders });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /files/dm/:dmId - List files in a DM
router.get('/dm/:dmId', async (req: Request, res: Response) => {
  try {
    const dm = await findDMById(req.params.dmId);
    if (!dm) {
      res.status(404).json({ error: 'DM not found' });
      return;
    }

    const participant = await isParticipant(req.params.dmId, req.user!.id);
    if (!participant) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const files = await getDMFiles(req.params.dmId);

    const filesWithUploaders = await Promise.all(
      files.map(async (file) => {
        const uploader = await findUserById(file.uploaderId);
        return {
          ...file,
          url: `/files/${file.id}/download`,
          uploader: uploader ? sanitizeUser(uploader) : null,
        };
      })
    );

    res.json({ files: filesWithUploaders });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /files/my - List user's uploaded files
router.get('/my', async (req: Request, res: Response) => {
  try {
    const files = await getUserFiles(req.user!.id);

    const filesWithUrls = files.map((file) => ({
      ...file,
      url: `/files/${file.id}/download`,
    }));

    res.json({ files: filesWithUrls });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /files/:id - Delete a file
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteFile(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.json({ message: 'File deleted' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Permission denied') {
      res.status(403).json({ error: 'Can only delete your own files' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
