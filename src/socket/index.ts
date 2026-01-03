import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { findUserById, updateUser, sanitizeUser } from '../models/user';
import { findChannelById, isMember } from '../models/channel';
import { createMessage, getChannelMessages } from '../models/message';
import { findDMById, isParticipant, createDMMessage, getDMMessages } from '../models/dm';
import { notifyDM, notifyMention, getUnreadCount } from '../models/notification';
import { getFileById, attachFileToMessage } from '../models/file';
import { TokenPayload, User, Message, Notification, FileUpload } from '../types';

interface AuthenticatedSocket extends Socket {
  user?: User;
}

// Track online users and their sockets
const userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

// Store io instance for notification delivery
let ioInstance: Server | null = null;

// Helper to send notification to a user via WebSocket
export function emitNotification(userId: string, notification: Notification): void {
  if (!ioInstance) return;

  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      ioInstance.to(socketId).emit('notification:new', notification);
    }
  }
}

// Helper to emit unread count update
export async function emitUnreadCount(userId: string): Promise<void> {
  if (!ioInstance) return;

  const count = await getUnreadCount(userId);
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      ioInstance.to(socketId).emit('notification:count', { count });
    }
  }
}

export function setupSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Store io instance for notification delivery
  ioInstance = io;

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
      const user = await findUserById(payload.userId);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    console.log(`User connected: ${user.username} (${socket.id})`);

    // Track user socket
    if (!userSockets.has(user.id)) {
      userSockets.set(user.id, new Set());
    }
    userSockets.get(user.id)!.add(socket.id);

    // Update user status to active
    await updateUser(user.id, { status: 'active' });
    io.emit('presence:changed', { userId: user.id, status: 'active' });

    // Join a channel room
    socket.on('channel:join', async (data: { channelId: string }) => {
      try {
        const channel = await findChannelById(data.channelId);
        if (!channel) {
          socket.emit('error', { message: 'Channel not found' });
          return;
        }

        // Check membership for private channels
        if (channel.type === 'private') {
          const member = await isMember(data.channelId, user.id);
          if (!member) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }
        }

        socket.join(`channel:${data.channelId}`);

        // Notify others in channel
        socket.to(`channel:${data.channelId}`).emit('channel:joined', {
          channelId: data.channelId,
          userId: user.id,
        });

        // Send recent messages to the user
        const messages = await getChannelMessages(data.channelId, 50);
        socket.emit('channel:history', { channelId: data.channelId, messages });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // Leave a channel room
    socket.on('channel:leave', (data: { channelId: string }) => {
      socket.leave(`channel:${data.channelId}`);
      socket.to(`channel:${data.channelId}`).emit('channel:left', {
        channelId: data.channelId,
        userId: user.id,
      });
    });

    // Send a message
    socket.on('message:send', async (data: { channelId: string; content: string; fileIds?: string[] }) => {
      try {
        // Allow empty content if there are files attached
        if ((!data.content || data.content.trim().length === 0) && (!data.fileIds || data.fileIds.length === 0)) {
          socket.emit('error', { message: 'Message content or files required' });
          return;
        }

        const channel = await findChannelById(data.channelId);
        if (!channel) {
          socket.emit('error', { message: 'Channel not found' });
          return;
        }

        // Check if user is a member
        const member = await isMember(data.channelId, user.id);
        if (!member) {
          socket.emit('error', { message: 'Not a channel member' });
          return;
        }

        const message = await createMessage({
          channelId: data.channelId,
          userId: user.id,
          content: data.content?.trim() || '',
        });

        // Attach files to message if provided
        const files: FileUpload[] = [];
        if (data.fileIds && data.fileIds.length > 0) {
          for (const fileId of data.fileIds) {
            const file = await getFileById(fileId);
            if (file && file.uploaderId === user.id) {
              await attachFileToMessage(fileId, message.id);
              files.push({
                ...file,
                url: `/files/${file.id}/download`,
              } as FileUpload);
            }
          }
        }

        // Include user info and files in the broadcast
        const messageWithUser = {
          ...message,
          user: sanitizeUser(user),
          files: files.length > 0 ? files : undefined,
        };

        // Broadcast to all users in the channel (including sender)
        io.to(`channel:${data.channelId}`).emit('message:new', messageWithUser);
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('message:typing', (data: { channelId: string }) => {
      socket.to(`channel:${data.channelId}`).emit('message:typing', {
        channelId: data.channelId,
        userId: user.id,
      });
    });

    // Presence update
    socket.on('presence:update', async (data: { status: User['status'] }) => {
      const validStatuses: User['status'][] = ['active', 'away', 'dnd', 'offline'];
      if (!validStatuses.includes(data.status)) {
        socket.emit('error', { message: 'Invalid status' });
        return;
      }

      await updateUser(user.id, { status: data.status });
      io.emit('presence:changed', { userId: user.id, status: data.status });
    });

    // DM: Join a DM room
    socket.on('dm:join', async (data: { dmId: string }) => {
      try {
        const dm = await findDMById(data.dmId);
        if (!dm) {
          socket.emit('error', { message: 'DM not found' });
          return;
        }

        const participant = await isParticipant(data.dmId, user.id);
        if (!participant) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(`dm:${data.dmId}`);

        // Send recent messages
        const messages = await getDMMessages(data.dmId, 50);
        socket.emit('dm:history', { dmId: data.dmId, messages });
      } catch (error) {
        socket.emit('error', { message: 'Failed to join DM' });
      }
    });

    // DM: Leave a DM room
    socket.on('dm:leave', (data: { dmId: string }) => {
      socket.leave(`dm:${data.dmId}`);
    });

    // DM: Send a message
    socket.on('dm:send', async (data: { dmId: string; content: string; fileIds?: string[] }) => {
      try {
        // Allow empty content if there are files attached
        if ((!data.content || data.content.trim().length === 0) && (!data.fileIds || data.fileIds.length === 0)) {
          socket.emit('error', { message: 'Message content or files required' });
          return;
        }

        const dm = await findDMById(data.dmId);
        if (!dm) {
          socket.emit('error', { message: 'DM not found' });
          return;
        }

        const participant = await isParticipant(data.dmId, user.id);
        if (!participant) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        const message = await createDMMessage({
          dmId: data.dmId,
          userId: user.id,
          content: data.content?.trim() || '',
        });

        // Attach files to message if provided
        const files: FileUpload[] = [];
        if (data.fileIds && data.fileIds.length > 0) {
          for (const fileId of data.fileIds) {
            const file = await getFileById(fileId);
            if (file && file.uploaderId === user.id) {
              await attachFileToMessage(fileId, message.id);
              files.push({
                ...file,
                url: `/files/${file.id}/download`,
              } as FileUpload);
            }
          }
        }

        // Include user info and files in the broadcast
        const messageWithUser = {
          ...message,
          user: sanitizeUser(user),
          files: files.length > 0 ? files : undefined,
        };

        // Broadcast to all participants in the DM
        io.to(`dm:${data.dmId}`).emit('dm:new', messageWithUser);

        // Send notifications to other participants
        const notificationContent = data.content?.trim() || (files.length > 0 ? `sent ${files.length} file(s)` : '');
        for (const participantId of dm.participantIds) {
          if (participantId !== user.id) {
            const notification = await notifyDM(
              participantId,
              user.displayName,
              notificationContent,
              { dmId: data.dmId, messageId: message.id, senderId: user.id }
            );
            if (notification) {
              emitNotification(participantId, notification);
              emitUnreadCount(participantId);
            }
          }
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // DM: Typing indicator
    socket.on('dm:typing', (data: { dmId: string }) => {
      socket.to(`dm:${data.dmId}`).emit('dm:typing', {
        dmId: data.dmId,
        userId: user.id,
      });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.username} (${socket.id})`);

      // Remove socket from tracking
      const sockets = userSockets.get(user.id);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(user.id);
          // User has no more active connections, set to offline
          await updateUser(user.id, { status: 'offline' });
          io.emit('presence:changed', { userId: user.id, status: 'offline' });
        }
      }
    });
  });

  return io;
}

export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}

export function getOnlineUsers(): string[] {
  return Array.from(userSockets.keys());
}
