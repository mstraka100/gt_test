import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import type { Channel, DirectMessage, Message, User } from '../../types';
import { api } from '../../api/client';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface Props {
  selectedChannel: Channel | null;
  selectedDM: DirectMessage | null;
}

export function ChatArea({ selectedChannel, selectedDM }: Props) {
  const { user } = useAuth();
  const { joinChannel, leaveChannel, joinDM, leaveDM, sendMessage, sendDMMessage, sendTyping, onMessage, onTyping } =
    useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<User[]>([]);

  const loadMessages = useCallback(async () => {
    if (!selectedChannel && !selectedDM) return;
    setIsLoading(true);
    try {
      if (selectedChannel) {
        const response = await api.get<{ messages: Message[] }>(
          `/channels/${selectedChannel.id}/messages`
        );
        setMessages(response.messages);
      } else if (selectedDM) {
        const response = await api.get<{ messages: Message[] }>(`/dms/${selectedDM.id}/messages`);
        setMessages(response.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedChannel, selectedDM]);

  // Load messages and join room when selection changes
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
    loadMessages();

    if (selectedChannel) {
      joinChannel(selectedChannel.id);
      return () => leaveChannel(selectedChannel.id);
    } else if (selectedDM) {
      joinDM(selectedDM.id);
      return () => leaveDM(selectedDM.id);
    }
  }, [selectedChannel, selectedDM, loadMessages, joinChannel, leaveChannel, joinDM, leaveDM]);

  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onMessage((message: Message) => {
      const matchesChannel = selectedChannel && message.channelId === selectedChannel.id;
      const matchesDM = selectedDM && message.dmId === selectedDM.id;
      if (matchesChannel || matchesDM) {
        setMessages((prev) => [...prev, message]);
        // Remove typing indicator for this user
        setTypingUsers((prev) => prev.filter((u) => u.id !== message.userId));
      }
    });
    return unsubscribe;
  }, [onMessage, selectedChannel, selectedDM]);

  // Listen for typing indicators
  useEffect(() => {
    const unsubscribe = onTyping((data: { channelId: string; user: User }) => {
      if (selectedChannel?.id === data.channelId && data.user.id !== user?.id) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== data.user.id));
        }, 3000);
      }
    });
    return unsubscribe;
  }, [onTyping, selectedChannel, user]);

  const handleSendMessage = async (content: string) => {
    try {
      if (selectedChannel) {
        // Use WebSocket for real-time, REST as fallback
        sendMessage(selectedChannel.id, content);
        // Also send via REST to ensure persistence
        const { message } = await api.post<{ message: Message }>(
          `/channels/${selectedChannel.id}/messages`,
          { content }
        );
        // Message will come back via WebSocket, but add immediately for responsiveness
        setMessages((prev) => {
          // Avoid duplicate if WebSocket already added it
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      } else if (selectedDM) {
        sendDMMessage(selectedDM.id, content);
        const { message } = await api.post<{ message: Message }>(`/dms/${selectedDM.id}/messages`, {
          content,
        });
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTyping = () => {
    if (selectedChannel) {
      sendTyping(selectedChannel.id);
    }
  };

  const getOtherParticipants = (dm: DirectMessage): User[] => {
    return (dm.participants || []).filter((p) => p.id !== user?.id);
  };

  const getChatTitle = () => {
    if (selectedChannel) {
      return `# ${selectedChannel.name}`;
    }
    if (selectedDM) {
      const others = getOtherParticipants(selectedDM);
      if (others.length === 0) return 'Direct Message';
      if (others.length === 1) return others[0].displayName;
      return others.map((u) => u.displayName).join(', ');
    }
    return '';
  };

  const getChatDescription = () => {
    if (selectedChannel?.description) {
      return selectedChannel.description;
    }
    return null;
  };

  const getInputPlaceholder = () => {
    if (selectedChannel) {
      return `Message #${selectedChannel.name}`;
    }
    if (selectedDM) {
      const others = getOtherParticipants(selectedDM);
      if (others.length === 1) return `Message ${others[0].displayName}`;
      return 'Message';
    }
    return 'Message';
  };

  if (!selectedChannel && !selectedDM) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <h2 className="text-xl font-semibold mb-2">Welcome to Slack Clone</h2>
          <p>Select a channel or direct message to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-bold text-lg">{getChatTitle()}</h2>
        {getChatDescription() && (
          <p className="text-sm text-gray-500">{getChatDescription()}</p>
        )}
      </div>

      {/* Messages */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading messages...</div>
        </div>
      ) : (
        <MessageList messages={messages} />
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-sm text-gray-500">
          {typingUsers.map((u) => u.displayName).join(', ')}{' '}
          {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        placeholder={getInputPlaceholder()}
      />
    </div>
  );
}
