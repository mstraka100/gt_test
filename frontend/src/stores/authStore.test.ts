import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import type { User } from '../types';

describe('authStore', () => {
  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  describe('initial state', () => {
    it('should have null user by default', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it('should have isLoading true by default', () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
    });
  });

  describe('login', () => {
    it('should set user and tokens on login', () => {
      const { login } = useAuthStore.getState();

      login(mockUser, 'access-token-123', 'refresh-token-456');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should store tokens in localStorage', () => {
      const { login } = useAuthStore.getState();

      login(mockUser, 'access-token-123', 'refresh-token-456');

      expect(localStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token-456');
    });
  });

  describe('logout', () => {
    it('should clear user and tokens on logout', () => {
      // First login
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      });

      const { logout } = useAuthStore.getState();
      logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should remove tokens from localStorage', () => {
      const { logout } = useAuthStore.getState();

      logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorage.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('setUser', () => {
    it('should update user and set isLoading to false', () => {
      const { setUser } = useAuthStore.getState();

      setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should update isLoading state', () => {
      const { setLoading } = useAuthStore.getState();

      setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);

      setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });
});
