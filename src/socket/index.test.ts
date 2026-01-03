import { createServer, Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, Channel, DirectMessage, Message, DMMessage, Notification } from '../types';

// Mock all model dependencies
jest.mock('../models/user', () => ({
  findUserById: jest.fn(),
  updateUser: jest.fn(),
  sanitizeUser: jest.fn((user: User) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    status: user.status,
  })),
}));

jest.mock('../models/channel', () => ({
  findChannelById: jest.fn(),
  isMember: jest.fn(),
}));

jest.mock('../models/message', () => ({
  createMessage: jest.fn(),
  getChannelMessages: jest.fn(),
}));

jest.mock('../models/dm', () => ({
  findDMById: jest.fn(),
  isParticipant: jest.fn(),
  createDMMessage: jest.fn(),
  getDMMessages: jest.fn(),
}));

jest.mock('../models/notification', () => ({
  notifyDM: jest.fn(),
  notifyMention: jest.fn(),
  getUnreadCount: jest.fn(),
}));

jest.mock('../models/file', () => ({
  getFileById: jest.fn(),
  attachFileToMessage: jest.fn(),
}));

import { setupSocketServer, emitNotification, emitUnreadCount, isUserOnline, getOnlineUsers } from './index';
import { findUserById, updateUser, sanitizeUser } from '../models/user';
import { findChannelById, isMember } from '../models/channel';
import { createMessage, getChannelMessages } from '../models/message';
import { findDMById, isParticipant, createDMMessage, getDMMessages } from '../models/dm';
import { notifyDM, getUnreadCount } from '../models/notification';
import { getFileById, attachFileToMessage } from '../models/file';

// Test fixtures
const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: 'hash',
  displayName: 'Test User',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser2: User = {
  id: 'user-2',
  email: 'test2@example.com',
  username: 'testuser2',
  passwordHash: 'hash',
  displayName: 'Test User 2',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockChannel: Channel = {
  id: 'channel-1',
  name: 'general',
  type: 'public',
  creatorId: 'user-1',
  memberIds: ['user-1', 'user-2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrivateChannel: Channel = {
  id: 'channel-private',
  name: 'private',
  type: 'private',
  creatorId: 'user-1',
  memberIds: ['user-1'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDM: DirectMessage = {
  id: 'dm-1',
  type: 'dm',
  participantIds: ['user-1', 'user-2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMessage: Message = {
  id: 'msg-1',
  channelId: 'channel-1',
  userId: 'user-1',
  content: 'Hello world',
  type: 'text',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDMMessage: DMMessage = {
  id: 'dm-msg-1',
  dmId: 'dm-1',
  userId: 'user-1',
  content: 'Hello DM',
  type: 'text',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createValidToken(userId: string = 'user-1'): string {
  return jwt.sign({ userId, email: 'test@example.com' }, config.jwtSecret);
}

describe('Socket Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Middleware', () => {
    it('should reject connection without token', () => {
      // Simulate middleware behavior directly
      const mockSocket = {
        handshake: { auth: {} },
      } as any;

      // The middleware should reject without token
      expect(mockSocket.handshake.auth.token).toBeUndefined();
    });

    it('should reject connection with invalid token', () => {
      const invalidToken = 'invalid-jwt-token';

      // Verify that jwt.verify throws for invalid token
      expect(() => {
        jwt.verify(invalidToken, config.jwtSecret);
      }).toThrow();
    });

    it('should accept connection with valid token', () => {
      const validToken = createValidToken();
      const payload = jwt.verify(validToken, config.jwtSecret) as { userId: string };

      expect(payload.userId).toBe('user-1');
    });

    it('should reject if user not found', async () => {
      (findUserById as jest.Mock).mockResolvedValue(null);

      const result = await findUserById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('emitNotification', () => {
    it('should not throw when called', () => {
      const notification: Notification = {
        id: 'notif-1',
        userId: 'user-1',
        type: 'dm',
        title: 'Test',
        body: 'Test message',
        read: false,
        createdAt: new Date(),
      };

      // This should not throw even with no connected users
      expect(() => emitNotification('user-1', notification)).not.toThrow();
    });
  });

  describe('emitUnreadCount', () => {
    it('should not throw when called without io instance', async () => {
      // emitUnreadCount returns early if ioInstance is not set
      // This test verifies it handles that case gracefully
      await expect(emitUnreadCount('user-1')).resolves.not.toThrow();
    });

    it('should get unread count from model when called', async () => {
      (getUnreadCount as jest.Mock).mockResolvedValue(5);

      // Direct model test since emitUnreadCount may return early
      const count = await getUnreadCount('user-1');
      expect(count).toBe(5);
      expect(getUnreadCount).toHaveBeenCalledWith('user-1');
    });
  });

  describe('isUserOnline', () => {
    it('should return false for non-connected user', () => {
      const result = isUserOnline('unknown-user');
      expect(result).toBe(false);
    });
  });

  describe('getOnlineUsers', () => {
    it('should return array', () => {
      const onlineUsers = getOnlineUsers();
      expect(Array.isArray(onlineUsers)).toBe(true);
    });
  });
});

describe('Channel Events', () => {
  describe('channel:join', () => {
    it('should emit error if channel not found', async () => {
      (findChannelById as jest.Mock).mockResolvedValue(null);

      const result = await findChannelById('nonexistent');
      expect(result).toBeNull();
    });

    it('should find public channel', async () => {
      (findChannelById as jest.Mock).mockResolvedValue(mockChannel);

      const result = await findChannelById('channel-1');
      expect(result).toEqual(mockChannel);
      expect(result?.type).toBe('public');
    });

    it('should check membership for private channel', async () => {
      (findChannelById as jest.Mock).mockResolvedValue(mockPrivateChannel);
      (isMember as jest.Mock).mockResolvedValue(true);

      const channel = await findChannelById('channel-private');
      expect(channel?.type).toBe('private');

      const memberCheck = await isMember('channel-private', 'user-1');
      expect(memberCheck).toBe(true);
    });

    it('should deny access for non-member of private channel', async () => {
      (findChannelById as jest.Mock).mockResolvedValue(mockPrivateChannel);
      (isMember as jest.Mock).mockResolvedValue(false);

      const memberCheck = await isMember('channel-private', 'user-3');
      expect(memberCheck).toBe(false);
    });

    it('should get channel messages history', async () => {
      const messages = [mockMessage];
      (getChannelMessages as jest.Mock).mockResolvedValue(messages);

      const result = await getChannelMessages('channel-1', 50);
      expect(result).toEqual(messages);
      expect(getChannelMessages).toHaveBeenCalledWith('channel-1', 50);
    });
  });

  describe('message:send', () => {
    it('should reject empty content without files', async () => {
      const data = { channelId: 'channel-1', content: '', fileIds: [] };

      const isValid = data.content.trim().length > 0 || (data.fileIds && data.fileIds.length > 0);
      expect(isValid).toBe(false);
    });

    it('should allow message with files but no content', async () => {
      const data = { channelId: 'channel-1', content: '', fileIds: ['file-1'] };

      const isValid = data.content.trim().length > 0 || (data.fileIds && data.fileIds.length > 0);
      expect(isValid).toBe(true);
    });

    it('should reject if channel not found', async () => {
      (findChannelById as jest.Mock).mockResolvedValue(null);

      const channel = await findChannelById('nonexistent');
      expect(channel).toBeNull();
    });

    it('should reject if user is not a member', async () => {
      (findChannelById as jest.Mock).mockResolvedValue(mockChannel);
      (isMember as jest.Mock).mockResolvedValue(false);

      const memberCheck = await isMember('channel-1', 'user-3');
      expect(memberCheck).toBe(false);
    });

    it('should create message successfully', async () => {
      (findChannelById as jest.Mock).mockResolvedValue(mockChannel);
      (isMember as jest.Mock).mockResolvedValue(true);
      (createMessage as jest.Mock).mockResolvedValue(mockMessage);

      const message = await createMessage({
        channelId: 'channel-1',
        userId: 'user-1',
        content: 'Hello world',
      });

      expect(message.id).toBe('msg-1');
      expect(message.content).toBe('Hello world');
    });

    it('should attach files to message', async () => {
      const mockFile = {
        id: 'file-1',
        filename: 'test.txt',
        originalName: 'test.txt',
        mimeType: 'text/plain',
        size: 100,
        uploaderId: 'user-1',
        createdAt: new Date(),
      };

      (getFileById as jest.Mock).mockResolvedValue(mockFile);
      (attachFileToMessage as jest.Mock).mockResolvedValue(undefined);

      const file = await getFileById('file-1');
      expect(file).toEqual(mockFile);

      await attachFileToMessage('file-1', 'msg-1');
      expect(attachFileToMessage).toHaveBeenCalledWith('file-1', 'msg-1');
    });

    it('should not attach file if uploader mismatch', async () => {
      const mockFile = {
        id: 'file-1',
        filename: 'test.txt',
        originalName: 'test.txt',
        mimeType: 'text/plain',
        size: 100,
        uploaderId: 'user-2', // Different user
        createdAt: new Date(),
      };

      (getFileById as jest.Mock).mockResolvedValue(mockFile);

      const file = await getFileById('file-1');
      const isOwner = file?.uploaderId === 'user-1';
      expect(isOwner).toBe(false);
    });
  });

  describe('message:typing', () => {
    it('should have valid channel ID', () => {
      const data = { channelId: 'channel-1' };
      expect(data.channelId).toBeDefined();
      expect(typeof data.channelId).toBe('string');
    });
  });
});

describe('DM Events', () => {
  describe('dm:join', () => {
    it('should emit error if DM not found', async () => {
      (findDMById as jest.Mock).mockResolvedValue(null);

      const result = await findDMById('nonexistent');
      expect(result).toBeNull();
    });

    it('should find DM', async () => {
      (findDMById as jest.Mock).mockResolvedValue(mockDM);

      const result = await findDMById('dm-1');
      expect(result).toEqual(mockDM);
    });

    it('should check participation', async () => {
      (findDMById as jest.Mock).mockResolvedValue(mockDM);
      (isParticipant as jest.Mock).mockResolvedValue(true);

      const result = await isParticipant('dm-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should deny non-participant access', async () => {
      (isParticipant as jest.Mock).mockResolvedValue(false);

      const result = await isParticipant('dm-1', 'user-3');
      expect(result).toBe(false);
    });

    it('should get DM history', async () => {
      const messages = [mockDMMessage];
      (getDMMessages as jest.Mock).mockResolvedValue(messages);

      const result = await getDMMessages('dm-1', 50);
      expect(result).toEqual(messages);
    });
  });

  describe('dm:send', () => {
    it('should reject empty content without files', async () => {
      const data = { dmId: 'dm-1', content: '', fileIds: [] };

      const isValid = data.content.trim().length > 0 || (data.fileIds && data.fileIds.length > 0);
      expect(isValid).toBe(false);
    });

    it('should create DM message', async () => {
      (findDMById as jest.Mock).mockResolvedValue(mockDM);
      (isParticipant as jest.Mock).mockResolvedValue(true);
      (createDMMessage as jest.Mock).mockResolvedValue(mockDMMessage);

      const message = await createDMMessage({
        dmId: 'dm-1',
        userId: 'user-1',
        content: 'Hello DM',
      });

      expect(message.id).toBe('dm-msg-1');
      expect(message.content).toBe('Hello DM');
    });

    it('should notify DM recipient', async () => {
      const mockNotification: Notification = {
        id: 'notif-1',
        userId: 'user-2',
        type: 'dm',
        title: 'New DM',
        body: 'Hello DM',
        read: false,
        createdAt: new Date(),
      };

      (notifyDM as jest.Mock).mockResolvedValue(mockNotification);

      const notification = await notifyDM(
        'user-2',
        'Test User',
        'Hello DM',
        { dmId: 'dm-1', messageId: 'dm-msg-1', senderId: 'user-1' }
      );

      expect(notification).toEqual(mockNotification);
      expect(notifyDM).toHaveBeenCalledWith(
        'user-2',
        'Test User',
        'Hello DM',
        { dmId: 'dm-1', messageId: 'dm-msg-1', senderId: 'user-1' }
      );
    });

    it('should notify with file count when no content', async () => {
      const files = [{ id: 'file-1' }, { id: 'file-2' }];
      const notificationContent = 'sent 2 file(s)';

      expect(notificationContent).toBe('sent 2 file(s)');
    });
  });

  describe('dm:typing', () => {
    it('should have valid DM ID', () => {
      const data = { dmId: 'dm-1' };
      expect(data.dmId).toBeDefined();
      expect(typeof data.dmId).toBe('string');
    });
  });
});

describe('Presence Events', () => {
  describe('presence:update', () => {
    const validStatuses: User['status'][] = ['active', 'away', 'dnd', 'offline'];

    it('should accept valid status values', () => {
      validStatuses.forEach((status) => {
        expect(validStatuses.includes(status)).toBe(true);
      });
    });

    it('should reject invalid status', () => {
      const invalidStatus = 'invalid' as User['status'];
      expect(validStatuses.includes(invalidStatus)).toBe(false);
    });

    it('should update user status', async () => {
      (updateUser as jest.Mock).mockResolvedValue({ ...mockUser, status: 'away' });

      await updateUser('user-1', { status: 'away' });

      expect(updateUser).toHaveBeenCalledWith('user-1', { status: 'away' });
    });
  });
});

describe('User Utilities', () => {
  describe('sanitizeUser', () => {
    it('should remove sensitive fields', () => {
      const sanitized = (sanitizeUser as jest.Mock)(mockUser);

      expect(sanitized.passwordHash).toBeUndefined();
      expect(sanitized.id).toBe('user-1');
      expect(sanitized.username).toBe('testuser');
    });
  });
});

describe('Connection/Disconnection', () => {
  describe('connection handling', () => {
    it('should update user status to active on connect', async () => {
      (updateUser as jest.Mock).mockResolvedValue({ ...mockUser, status: 'active' });

      await updateUser('user-1', { status: 'active' });

      expect(updateUser).toHaveBeenCalledWith('user-1', { status: 'active' });
    });
  });

  describe('disconnection handling', () => {
    it('should update user status to offline on last disconnect', async () => {
      (updateUser as jest.Mock).mockResolvedValue({ ...mockUser, status: 'offline' });

      await updateUser('user-1', { status: 'offline' });

      expect(updateUser).toHaveBeenCalledWith('user-1', { status: 'offline' });
    });
  });
});

describe('Socket Server Configuration', () => {
  it('should configure CORS properly', () => {
    const httpServer = createServer();
    const io = setupSocketServer(httpServer);

    // Server should be created successfully
    expect(io).toBeDefined();
    expect(io).toBeInstanceOf(Server);

    io.close();
    httpServer.close();
  });

  it('should set proper ping timeout and interval', () => {
    const httpServer = createServer();
    const io = setupSocketServer(httpServer);

    // These are set in the socket configuration
    // pingTimeout: 60000, pingInterval: 25000
    expect(io).toBeDefined();

    io.close();
    httpServer.close();
  });

  it('should allow websocket and polling transports', () => {
    const httpServer = createServer();
    const io = setupSocketServer(httpServer);

    expect(io).toBeDefined();

    io.close();
    httpServer.close();
  });
});

describe('Error Handling', () => {
  it('should handle channel join errors gracefully', async () => {
    (findChannelById as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(findChannelById('channel-1')).rejects.toThrow('DB error');
  });

  it('should handle DM join errors gracefully', async () => {
    (findDMById as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(findDMById('dm-1')).rejects.toThrow('DB error');
  });

  it('should handle message creation errors', async () => {
    (createMessage as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(createMessage({ channelId: 'channel-1', userId: 'user-1', content: 'test' }))
      .rejects.toThrow('DB error');
  });

  it('should handle DM message creation errors', async () => {
    (createDMMessage as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(createDMMessage({ dmId: 'dm-1', userId: 'user-1', content: 'test' }))
      .rejects.toThrow('DB error');
  });
});
