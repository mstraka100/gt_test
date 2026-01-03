import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { getDM, sendDMMessage } from '../../api/dms';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { MessageList } from '../messages/MessageList';
import { MessageInput } from '../messages/MessageInput';
import type { DMMessage } from '../../types';

interface DMViewProps {
  dmId: string;
}

export default function DMView({ dmId }: DMViewProps) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [newMessages, setNewMessages] = useState<DMMessage[]>([]);
  const currentUser = useAuthStore((s) => s.user);
  const { joinDM, leaveDM, emitDMTyping } = useSocket();

  // Join/leave DM room for real-time updates
  useEffect(() => {
    joinDM(dmId);
    setNewMessages([]);
    return () => leaveDM(dmId);
  }, [dmId, joinDM, leaveDM]);

  const { data: dm } = useQuery({
    queryKey: ['dm', dmId],
    queryFn: () => getDM(dmId),
  });

  const otherParticipants = dm?.participants?.filter((p) => p.id !== currentUser?.id);
  const displayName = otherParticipants?.map((p) => p.displayName).join(', ') || 'Conversation';

  const handleSend = async (content: string) => {
    if (!content.trim() || sending) return;
    setSending(true);

    try {
      await sendDMMessage(dmId, content);
      queryClient.invalidateQueries({ queryKey: ['dm', dmId, 'messages'] });
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    emitDMTyping(dmId);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* DM header */}
      <div className="h-12 px-4 flex items-center border-b border-[var(--slack-border)]">
        <div className="w-6 h-6 rounded bg-green-600 flex items-center justify-center text-white text-xs mr-2">
          {otherParticipants?.[0]?.displayName?.[0]?.toUpperCase() || '?'}
        </div>
        <span className="font-bold text-white">{displayName}</span>
      </div>

      {/* Messages */}
      <MessageList type="dm" id={dmId} newMessages={newMessages} />

      {/* Message input */}
      <MessageInput
        placeholder={`Message ${displayName}`}
        onSend={handleSend}
        onTyping={handleTyping}
        disabled={sending}
      />
    </div>
  );
}
