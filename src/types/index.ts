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
