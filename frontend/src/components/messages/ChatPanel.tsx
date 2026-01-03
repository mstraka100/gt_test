import { useQuery } from '@tanstack/react-query';
import { getChannel } from '../../api/channels';
import { getDM } from '../../api/dms';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from '../common/TypingIndicator';

export function ChatPanel() {
  const { currentView, currentChannelId, currentDMId } = useUIStore();
  const { user } = useAuthStore();

  const { data: channel } = useQuery({
    queryKey: ['channel', currentChannelId],
    queryFn: () => getChannel(currentChannelId!),
    enabled: currentView === 'channel' && !!currentChannelId,
  });

  const { data: dm } = useQuery({
    queryKey: ['dm', currentDMId],
    queryFn: () => getDM(currentDMId!),
    enabled: currentView === 'dm' && !!currentDMId,
  });

  const { newMessages, typingUsers, sendMessage, sendTyping } = useSocket({
    channelId: currentView === 'channel' ? currentChannelId : null,
    dmId: currentView === 'dm' ? currentDMId : null,
  });

  if (currentView === 'none') {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--slack-text-muted)' }}>
        <div className="text-center">
          <div className="text-4xl mb-4">👋</div>
          <div className="text-xl">Welcome to Slit</div>
          <div className="mt-2">Select a channel or DM to start chatting</div>
        </div>
      </div>
    );
  }

  const getTitle = () => {
    if (currentView === 'channel' && channel) {
      return `# ${channel.name}`;
    }
    if (currentView === 'dm' && dm) {
      const others = dm.participants?.filter((p) => p.id !== user?.id) || [];
      if (others.length === 1) return others[0].displayName;
      return others.map((p) => p.displayName).join(', ');
    }
    return 'Loading...';
  };

  const getPlaceholder = () => {
    if (currentView === 'channel' && channel) {
      return `Message #${channel.name}`;
    }
    if (currentView === 'dm' && dm) {
      const others = dm.participants?.filter((p) => p.id !== user?.id) || [];
      if (others.length === 1) return `Message ${others[0].displayName}`;
      return 'Message this conversation';
    }
    return 'Type a message...';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div 
        className="h-12 px-5 flex items-center border-b flex-shrink-0"
        style={{ borderColor: 'var(--slack-border)' }}
      >
        <span className="font-bold" style={{ color: 'var(--slack-text)' }}>
          {getTitle()}
        </span>
      </div>

      {/* Messages */}
      <MessageList
        type={currentView}
        id={currentView === 'channel' ? currentChannelId! : currentDMId!}
        newMessages={newMessages}
      />

      {/* Typing indicator */}
      <TypingIndicator usernames={typingUsers.map((t) => t.username)} />

      {/* Input */}
      <MessageInput
        placeholder={getPlaceholder()}
        onSend={sendMessage}
        onTyping={sendTyping}
      />
    </div>
  );
}
