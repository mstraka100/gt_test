import { apiClient } from './client';
import type { LoginInput, RegisterInput, AuthResponse, User } from '../types';

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
  return data;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', input);
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem('refreshToken');
  await apiClient.post('/auth/logout', { refreshToken });
}
