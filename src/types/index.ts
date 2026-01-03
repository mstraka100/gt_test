export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  avatarUrl?: string;
  status: 'active' | 'away' | 'dnd' | 'offline';
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateUserInput {
  displayName?: string;
  avatarUrl?: string;
  status?: User['status'];
}

// Channel types
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  creatorId: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  type?: 'public' | 'private';
}

export interface UpdateChannelInput {
  name?: string;
  description?: string;
}

export interface ChannelMember {
  channelId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}

// Message types
export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
}

export interface CreateMessageInput {
  channelId: string;
  content: string;
}

// Direct Message types
export interface DirectMessage {
  id: string;
  type: 'dm' | 'group_dm';
  participantIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

export interface DMMessage {
  id: string;
  dmId: string;
  userId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
}

export interface CreateDMInput {
  participantIds: string[];
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'mention' | 'dm' | 'channel_invite' | 'system';
  title: string;
  body: string;
  read: boolean;
  data?: {
    channelId?: string;
    dmId?: string;
    messageId?: string;
    senderId?: string;
  };
  createdAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  mentions: boolean;
  directMessages: boolean;
  channelMessages: boolean;
  sounds: boolean;
  desktop: boolean;
}

// File types
export interface FileUpload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  channelId?: string;
  dmId?: string;
  messageId?: string;
  createdAt: Date;
}

export interface MessageAttachment {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

// WebSocket event types - Client to Server
export interface ClientToServerEvents {
  'channel:join': (data: { channelId: string }) => void;
  'channel:leave': (data: { channelId: string }) => void;
  'message:send': (data: { channelId: string; content: string }) => void;
  'message:typing': (data: { channelId: string }) => void;
  'presence:update': (data: { status: User['status'] }) => void;
}

// WebSocket event types - Server to Client
export interface ServerToClientEvents {
  'channel:joined': (data: { channelId: string; userId: string }) => void;
  'channel:left': (data: { channelId: string; userId: string }) => void;
  'channel:history': (data: { channelId: string; messages: Message[] }) => void;
  'message:new': (message: Message) => void;
  'message:typing': (data: { channelId: string; userId: string }) => void;
  'presence:changed': (data: { userId: string; status: User['status'] }) => void;
  'error': (data: { message: string }) => void;
}
