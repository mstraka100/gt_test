import { formatDistanceToNow } from 'date-fns';
import type { Message, DMMessage } from '../../types';

interface Props {
  message: Message | DMMessage;
  showAvatar?: boolean;
}

export function MessageItem({ message, showAvatar = true }: Props) {
  const user = message.user;
  const timestamp = new Date(message.createdAt);

  return (
    <div className="px-5 py-1 flex gap-3 hover:bg-white/5 group">
      {showAvatar ? (
        <div 
          className="w-9 h-9 rounded flex-shrink-0 flex items-center justify-center text-sm font-medium"
          style={{ backgroundColor: 'var(--slack-hover)', color: 'var(--slack-text)' }}
        >
          {user?.displayName?.charAt(0).toUpperCase() || '?'}
        </div>
      ) : (
        <div className="w-9 flex-shrink-0" />
      )}
      
      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm" style={{ color: 'var(--slack-text)' }}>
              {user?.displayName || 'Unknown'}
            </span>
            <span className="text-xs" style={{ color: 'var(--slack-text-muted)' }}>
              {formatDistanceToNow(timestamp, { addSuffix: true })}
            </span>
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--slack-text)' }}>
          {message.content}
        </div>
      </div>
    </div>
  );
}
