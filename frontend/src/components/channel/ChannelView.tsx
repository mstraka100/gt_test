import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { getChannel, sendMessage } from '../../api/channels';
import { useSocket } from '../../hooks/useSocket';
import { MessageList } from '../messages/MessageList';
import { MessageInput } from '../messages/MessageInput';
import type { Message } from '../../types';

interface ChannelViewProps {
  channelId: string;
}

export default function ChannelView({ channelId }: ChannelViewProps) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [newMessages, setNewMessages] = useState<Message[]>([]);
  const { joinChannel, leaveChannel, emitTyping } = useSocket();

  // Join/leave channel room for real-time updates
  useEffect(() => {
    joinChannel(channelId);
    setNewMessages([]);
    return () => leaveChannel(channelId);
  }, [channelId, joinChannel, leaveChannel]);

  const { data: channel } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => getChannel(channelId),
  });

  const handleSend = async (content: string) => {
    if (!content.trim() || sending) return;
    setSending(true);

    try {
      await sendMessage(channelId, content);
      queryClient.invalidateQueries({ queryKey: ['channel', channelId, 'messages'] });
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    emitTyping(channelId);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Channel header */}
      <div className="h-12 px-4 flex items-center border-b border-[var(--slack-border)]">
        <span className="text-lg text-[var(--slack-text-muted)] mr-2">#</span>
        <span className="font-bold text-white">{channel?.name || 'Loading...'}</span>
        {channel?.description && (
          <span className="ml-3 text-[var(--slack-text-muted)] text-sm truncate">
            {channel.description}
          </span>
        )}
      </div>

      {/* Messages */}
      <MessageList type="channel" id={channelId} newMessages={newMessages} />

      {/* Message input */}
      <MessageInput
        placeholder={`Message #${channel?.name || '...'}`}
        onSend={handleSend}
        onTyping={handleTyping}
        disabled={sending}
      />
    </div>
  );
}
