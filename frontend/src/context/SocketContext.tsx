import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getAccessToken } from '../api/client';
import type { Message, User } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  joinDM: (dmId: string) => void;
  leaveDM: (dmId: string) => void;
  sendMessage: (channelId: string, content: string) => void;
  sendDMMessage: (dmId: string, content: string) => void;
  sendTyping: (channelId: string) => void;
  onMessage: (callback: (message: Message) => void) => () => void;
  onTyping: (callback: (data: { channelId: string; user: User }) => void) => () => void;
  onUserOnline: (callback: (user: User) => void) => () => void;
  onUserOffline: (callback: (userId: string) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const joinChannel = useCallback(
    (channelId: string) => {
      socket?.emit('channel:join', channelId);
    },
    [socket]
  );

  const leaveChannel = useCallback(
    (channelId: string) => {
      socket?.emit('channel:leave', channelId);
    },
    [socket]
  );

  const joinDM = useCallback(
    (dmId: string) => {
      socket?.emit('dm:join', dmId);
    },
    [socket]
  );

  const leaveDM = useCallback(
    (dmId: string) => {
      socket?.emit('dm:leave', dmId);
    },
    [socket]
  );

  const sendMessage = useCallback(
    (channelId: string, content: string) => {
      socket?.emit('message:send', { channelId, content });
    },
    [socket]
  );

  const sendDMMessage = useCallback(
    (dmId: string, content: string) => {
      socket?.emit('dm:message', { dmId, content });
    },
    [socket]
  );

  const sendTyping = useCallback(
    (channelId: string) => {
      socket?.emit('message:typing', channelId);
    },
    [socket]
  );

  const onMessage = useCallback(
    (callback: (message: Message) => void) => {
      socket?.on('message:new', callback);
      return () => {
        socket?.off('message:new', callback);
      };
    },
    [socket]
  );

  const onTyping = useCallback(
    (callback: (data: { channelId: string; user: User }) => void) => {
      socket?.on('message:typing', callback);
      return () => {
        socket?.off('message:typing', callback);
      };
    },
    [socket]
  );

  const onUserOnline = useCallback(
    (callback: (user: User) => void) => {
      socket?.on('user:online', callback);
      return () => {
        socket?.off('user:online', callback);
      };
    },
    [socket]
  );

  const onUserOffline = useCallback(
    (callback: (userId: string) => void) => {
      socket?.on('user:offline', callback);
      return () => {
        socket?.off('user:offline', callback);
      };
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinChannel,
        leaveChannel,
        joinDM,
        leaveDM,
        sendMessage,
        sendDMMessage,
        sendTyping,
        onMessage,
        onTyping,
        onUserOnline,
        onUserOffline,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
