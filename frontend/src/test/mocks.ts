import type { User, Message, DMMessage, FileUpload } from '../types';

export const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  displayName: 'Test User',
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockUsers: User[] = [
  mockUser,
  {
    id: 'user-2',
    email: 'alice@example.com',
    username: 'alice',
    displayName: 'Alice Smith',
    status: 'away',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

export const mockFileUpload: FileUpload = {
  id: 'file-1',
  filename: 'abc123.pdf',
  originalName: 'document.pdf',
  mimeType: 'application/pdf',
  size: 1024 * 50,
  uploaderId: 'user-1',
  url: '/uploads/abc123.pdf',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const mockImageUpload: FileUpload = {
  id: 'file-2',
  filename: 'img123.png',
  originalName: 'photo.png',
  mimeType: 'image/png',
  size: 1024 * 200,
  uploaderId: 'user-1',
  url: '/uploads/img123.png',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export const mockMessage: Message = {
  id: 'msg-1',
  channelId: 'channel-1',
  userId: 'user-1',
  content: 'Hello, world!',
  type: 'text',
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
  user: mockUser,
};

export const mockDMMessage: DMMessage = {
  id: 'dm-msg-1',
  dmId: 'dm-1',
  userId: 'user-1',
  content: 'Hello via DM!',
  type: 'text',
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
  user: mockUser,
};

export const mockMessageWithLink: Message = {
  id: 'msg-2',
  channelId: 'channel-1',
  userId: 'user-1',
  content: 'Check out https://example.com for more info',
  type: 'text',
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
  user: mockUser,
};

export const mockMessageWithFiles: Message = {
  id: 'msg-3',
  channelId: 'channel-1',
  userId: 'user-1',
  content: 'Here are the files',
  type: 'text',
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
  user: mockUser,
  files: [mockFileUpload, mockImageUpload],
};
