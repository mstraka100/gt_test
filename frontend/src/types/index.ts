// User types (passwordHash excluded for frontend)
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: 'active' | 'away' | 'dnd' | 'offline';
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

// Channel types
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  creatorId: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Message types
export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  user?: User;
}

// Direct Message types
export interface DirectMessage {
  id: string;
  type: 'dm' | 'group_dm';
  participantIds: string[];
  participants?: User[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}

export interface DMMessage {
  id: string;
  dmId: string;
  userId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  user?: User;
}

// API Response types
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

export interface DMMessagesResponse {
  messages: DMMessage[];
  hasMore: boolean;
}

// Union type for any message response
export type AnyMessagesResponse = MessagesResponse | DMMessagesResponse;

// Base message type (shared properties)
export interface BaseMessage {
  id: string;
  userId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  user?: User;
}

// Type alias for any message
export type AnyMessage = Message | DMMessage;

// Socket event types
export interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}
