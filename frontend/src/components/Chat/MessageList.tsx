import { useEffect, useRef } from 'react';
import type { Message } from '../../types';

interface Props {
  messages: Message[];
}

export function MessageList({ messages }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const shouldShowDateDivider = (current: Message, previous: Message | null) => {
    if (!previous) return true;
    const currentDate = new Date(current.createdAt).toDateString();
    const previousDate = new Date(previous.createdAt).toDateString();
    return currentDate !== previousDate;
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message, index) => {
        const previous = index > 0 ? messages[index - 1] : null;
        const showDivider = shouldShowDateDivider(message, previous);

        return (
          <div key={message.id}>
            {showDivider && (
              <div className="flex items-center my-4">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="px-4 text-sm text-gray-500 font-medium">
                  {formatDate(message.createdAt)}
                </span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>
            )}
            <div className="flex items-start gap-3 mb-4 hover:bg-gray-50 -mx-4 px-4 py-1 rounded">
              <div className="w-9 h-9 rounded bg-[#4A154B] text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                {message.user?.displayName?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-gray-900">
                    {message.user?.displayName || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                </div>
                <p className="text-gray-800 break-words whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
