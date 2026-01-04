import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSocket } from './useSocket';
import { useAuthStore } from '../stores/authStore';
import { io } from 'socket.io-client';
import type { User } from '../types';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

const mockedIo = vi.mocked(io);

describe('useSocket', () => {
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
    vi.clearAllMocks();
    useAuthStore.setState({ user: mockUser });
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('mock-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connection', () => {
    it('should not connect without access token', () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      renderHook(() => useSocket());

      expect(mockedIo).not.toHaveBeenCalled();
    });

    it('should connect with access token', () => {
      renderHook(() => useSocket());

      expect(mockedIo).toHaveBeenCalledWith('/', {
        auth: { token: 'mock-token' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    });

    it('should update connected state on connect event', async () => {
      const { result } = renderHook(() => useSocket());

      // Find the connect handler and call it
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );

      if (connectCall) {
        act(() => {
          connectCall[1]();
        });
      }

      await waitFor(() => {
        expect(result.current.connected).toBe(true);
      });
    });

    it('should update connected state on disconnect event', async () => {
      const { result } = renderHook(() => useSocket());

      // Simulate connect then disconnect
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      const disconnectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      );

      if (connectCall && disconnectCall) {
        act(() => {
          connectCall[1]();
        });
        act(() => {
          disconnectCall[1]();
        });
      }

      await waitFor(() => {
        expect(result.current.connected).toBe(false);
      });
    });

    it('should disconnect socket on unmount', () => {
      const { unmount } = renderHook(() => useSocket());

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('presence', () => {
    it('should update onlineUsers on presence:changed event', async () => {
      const { result } = renderHook(() => useSocket());

      const presenceCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'presence:changed'
      );

      if (presenceCall) {
        act(() => {
          presenceCall[1]({ userId: 'other-user', status: 'active' });
        });
      }

      await waitFor(() => {
        expect(result.current.onlineUsers.get('other-user')).toBe('active');
      });
    });

    it('should call updatePresence correctly', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.updatePresence('away');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('presence:update', {
        status: 'away',
      });
    });
  });

  describe('channel operations', () => {
    it('should emit channel:join when channelId is set', async () => {
      // First connect the socket
      const { rerender } = renderHook(
        ({ channelId }) => useSocket({ channelId }),
        { initialProps: { channelId: undefined as string | undefined } }
      );

      // Simulate connection
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      if (connectCall) {
        act(() => connectCall[1]());
      }

      // Clear previous emit calls
      mockSocket.emit.mockClear();

      // Now set the channelId
      rerender({ channelId: 'channel-123' });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('channel:join', {
          channelId: 'channel-123',
        });
      });
    });

    it('should call joinChannel imperatively', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.joinChannel('channel-456');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('channel:join', {
        channelId: 'channel-456',
      });
    });

    it('should call leaveChannel imperatively', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.leaveChannel('channel-456');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('channel:leave', {
        channelId: 'channel-456',
      });
    });

    it('should call emitTyping for channel', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.emitTyping('channel-789');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('message:typing', {
        channelId: 'channel-789',
      });
    });
  });

  describe('DM operations', () => {
    it('should call joinDM imperatively', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.joinDM('dm-123');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('dm:join', { dmId: 'dm-123' });
    });

    it('should call leaveDM imperatively', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.leaveDM('dm-123');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('dm:leave', { dmId: 'dm-123' });
    });

    it('should call emitDMTyping', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.emitDMTyping('dm-456');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('dm:typing', { dmId: 'dm-456' });
    });
  });

  describe('sendMessage', () => {
    it('should emit message:send for channel', async () => {
      const { result } = renderHook(() => useSocket({ channelId: 'channel-123' }));

      // Connect first
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      if (connectCall) {
        act(() => connectCall[1]());
      }

      act(() => {
        result.current.sendMessage('Hello world');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('message:send', {
        channelId: 'channel-123',
        content: 'Hello world',
        fileIds: undefined,
      });
    });

    it('should emit dm:send for DM', async () => {
      const { result } = renderHook(() => useSocket({ dmId: 'dm-123' }));

      // Connect first
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      if (connectCall) {
        act(() => connectCall[1]());
      }

      act(() => {
        result.current.sendMessage('Hello DM');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('dm:send', {
        dmId: 'dm-123',
        content: 'Hello DM',
        fileIds: undefined,
      });
    });

    it('should include fileIds when files are provided', () => {
      const { result } = renderHook(() => useSocket({ channelId: 'channel-123' }));

      // Connect
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      if (connectCall) {
        act(() => connectCall[1]());
      }

      const mockFiles = [
        {
          id: 'file-1',
          filename: 'test.txt',
          originalName: 'test.txt',
          mimeType: 'text/plain',
          size: 100,
          uploaderId: 'user-123',
          url: '/files/test.txt',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      act(() => {
        result.current.sendMessage('With file', mockFiles);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('message:send', {
        channelId: 'channel-123',
        content: 'With file',
        fileIds: ['file-1'],
      });
    });

    it('should add optimistic message to newMessages', async () => {
      const { result } = renderHook(() => useSocket({ channelId: 'channel-123' }));

      // Connect
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      if (connectCall) {
        act(() => connectCall[1]());
      }

      act(() => {
        result.current.sendMessage('Optimistic test');
      });

      await waitFor(() => {
        expect(result.current.newMessages.length).toBeGreaterThan(0);
        const message = result.current.newMessages[result.current.newMessages.length - 1];
        expect(message.content).toBe('Optimistic test');
        expect(message.id).toMatch(/^temp-/);
      });
    });
  });

  describe('sendTyping', () => {
    it('should emit message:typing for channel', () => {
      const { result } = renderHook(() => useSocket({ channelId: 'channel-123' }));

      act(() => {
        result.current.sendTyping();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('message:typing', {
        channelId: 'channel-123',
      });
    });

    it('should emit dm:typing for DM', () => {
      const { result } = renderHook(() => useSocket({ dmId: 'dm-123' }));

      act(() => {
        result.current.sendTyping();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('dm:typing', { dmId: 'dm-123' });
    });
  });

  describe('return values', () => {
    it('should return all expected methods and state', () => {
      const { result } = renderHook(() => useSocket());

      expect(result.current).toHaveProperty('connected');
      expect(result.current).toHaveProperty('newMessages');
      expect(result.current).toHaveProperty('typingUsers');
      expect(result.current).toHaveProperty('onlineUsers');
      expect(result.current).toHaveProperty('sendMessage');
      expect(result.current).toHaveProperty('sendTyping');
      expect(result.current).toHaveProperty('updatePresence');
      expect(result.current).toHaveProperty('joinChannel');
      expect(result.current).toHaveProperty('leaveChannel');
      expect(result.current).toHaveProperty('emitTyping');
      expect(result.current).toHaveProperty('joinDM');
      expect(result.current).toHaveProperty('leaveDM');
      expect(result.current).toHaveProperty('emitDMTyping');
    });

    it('should initialize with expected default values', () => {
      const { result } = renderHook(() => useSocket());

      expect(result.current.connected).toBe(false);
      expect(result.current.newMessages).toEqual([]);
      expect(result.current.typingUsers).toEqual([]);
      expect(result.current.onlineUsers).toBeInstanceOf(Map);
      expect(result.current.onlineUsers.size).toBe(0);
    });
  });
});
