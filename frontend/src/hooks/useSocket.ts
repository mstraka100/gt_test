import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import type { Message, DMMessage, User } from '../types';

interface UseSocketOptions {
  channelId?: string | null;
  dmId?: string | null;
}

interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

export function useSocket({ channelId, dmId }: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [newMessages, setNewMessages] = useState<(Message | DMMessage)[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, User['status']>>(new Map());
  const { user } = useAuthStore();

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io('/', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Presence events
    socket.on('presence:changed', (data: { userId: string; status: User['status'] }) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data.status);
        return next;
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Join/leave channel room
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    if (channelId) {
      socket.emit('channel:join', { channelId });
      setNewMessages([]);
      setTypingUsers([]);

      const handleNewMessage = (message: Message) => {
        if (message.channelId === channelId && message.userId !== user?.id) {
          setNewMessages((prev) => [...prev, message]);
        }
      };

      const handleTyping = (data: { channelId: string; userId: string }) => {
        if (data.channelId === channelId && data.userId !== user?.id) {
          setTypingUsers((prev) => {
            const existing = prev.find((t) => t.userId === data.userId);
            const now = Date.now();
            if (existing) {
              return prev.map((t) =>
                t.userId === data.userId ? { ...t, timestamp: now } : t
              );
            }
            return [...prev, { userId: data.userId, username: 'Someone', timestamp: now }];
          });
        }
      };

      socket.on('message:new', handleNewMessage);
      socket.on('message:typing', handleTyping);

      return () => {
        socket.emit('channel:leave', { channelId });
        socket.off('message:new', handleNewMessage);
        socket.off('message:typing', handleTyping);
      };
    }
  }, [channelId, connected, user?.id]);

  // Join/leave DM room
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    if (dmId) {
      socket.emit('dm:join', { dmId });
      setNewMessages([]);
      setTypingUsers([]);

      const handleNewDM = (message: DMMessage) => {
        if (message.dmId === dmId && message.userId !== user?.id) {
          setNewMessages((prev) => [...prev, message]);
        }
      };

      const handleDMTyping = (data: { dmId: string; userId: string }) => {
        if (data.dmId === dmId && data.userId !== user?.id) {
          setTypingUsers((prev) => {
            const existing = prev.find((t) => t.userId === data.userId);
            const now = Date.now();
            if (existing) {
              return prev.map((t) =>
                t.userId === data.userId ? { ...t, timestamp: now } : t
              );
            }
            return [...prev, { userId: data.userId, username: 'Someone', timestamp: now }];
          });
        }
      };

      socket.on('dm:new', handleNewDM);
      socket.on('dm:typing', handleDMTyping);

      return () => {
        socket.emit('dm:leave', { dmId });
        socket.off('dm:new', handleNewDM);
        socket.off('dm:typing', handleDMTyping);
      };
    }
  }, [dmId, connected, user?.id]);

  // Clear stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((t) => now - t.timestamp < 3000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const sendMessage = useCallback((content: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    if (channelId) {
      socket.emit('message:send', { channelId, content });
      const now = Date.now();
      const optimisticMessage: Message = {
        id: 'temp-' + now,
        channelId,
        userId: user?.id || '',
        content,
        type: 'text',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: user || undefined,
      };
      setNewMessages((prev) => [...prev, optimisticMessage]);
    } else if (dmId) {
      socket.emit('dm:send', { dmId, content });
      const now = Date.now();
      const optimisticMessage: DMMessage = {
        id: 'temp-' + now,
        dmId,
        userId: user?.id || '',
        content,
        type: 'text',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: user || undefined,
      };
      setNewMessages((prev) => [...prev, optimisticMessage]);
    }
  }, [channelId, dmId, user]);

  const sendTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (channelId) {
      socket.emit('message:typing', { channelId });
    } else if (dmId) {
      socket.emit('dm:typing', { dmId });
    }
  }, [channelId, dmId]);

  const updatePresence = useCallback((status: User['status']) => {
    socketRef.current?.emit('presence:update', { status });
  }, []);

  // Imperative channel methods
  const joinChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('channel:join', { channelId });
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('channel:leave', { channelId });
  }, []);

  const emitTyping = useCallback((channelId: string) => {
    socketRef.current?.emit('message:typing', { channelId });
  }, []);

  // Imperative DM methods
  const joinDM = useCallback((dmId: string) => {
    socketRef.current?.emit('dm:join', { dmId });
  }, []);

  const leaveDM = useCallback((dmId: string) => {
    socketRef.current?.emit('dm:leave', { dmId });
  }, []);

  const emitDMTyping = useCallback((dmId: string) => {
    socketRef.current?.emit('dm:typing', { dmId });
  }, []);

  return {
    connected,
    newMessages,
    typingUsers,
    onlineUsers,
    sendMessage,
    sendTyping,
    updatePresence,
    joinChannel,
    leaveChannel,
    emitTyping,
    joinDM,
    leaveDM,
    emitDMTyping,
  };
}
