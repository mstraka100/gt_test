import { useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getChannelMessages } from '../../api/channels';
import { getDMMessages } from '../../api/dms';
import { MessageItem } from './MessageItem';
import type { AnyMessage, AnyMessagesResponse } from '../../types';

interface Props {
  type: 'channel' | 'dm';
  id: string;
  newMessages: AnyMessage[];
}

export function MessageList({ type, id, newMessages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<AnyMessagesResponse>({
    queryKey: [type, id, 'messages'],
    queryFn: async ({ pageParam }) => {
      if (type === 'channel') {
        return getChannelMessages(id, { limit: 50, before: pageParam as string | undefined });
      } else {
        return getDMMessages(id, { limit: 50, before: pageParam as string | undefined });
      }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.messages.length === 0) return undefined;
      return lastPage.messages[lastPage.messages.length - 1].id;
    },
    initialPageParam: undefined as string | undefined,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [newMessages]);

  // Initial scroll to bottom
  useEffect(() => {
    if (containerRef.current && data?.pages) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [data?.pages?.length]);

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: containerRef.current,
      rootMargin: '100px',
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  // Combine fetched messages with new real-time messages
  const fetchedMessages: AnyMessage[] = data?.pages?.flatMap((page) => page.messages as AnyMessage[]).reverse() || [];
  const allMessages: AnyMessage[] = [...fetchedMessages, ...newMessages];

  // Group messages by sender for compact display
  const shouldShowAvatar = (index: number): boolean => {
    if (index === 0) return true;
    const prev = allMessages[index - 1];
    const curr = allMessages[index];
    return prev.userId !== curr.userId;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--slack-text-muted)' }}>
        Loading messages...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto flex flex-col">
      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-1" />
      
      {isFetchingNextPage && (
        <div className="py-2 text-center text-sm" style={{ color: 'var(--slack-text-muted)' }}>
          Loading more...
        </div>
      )}
      
      {allMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--slack-text-muted)' }}>
          No messages yet. Start the conversation!
        </div>
      ) : (
        <div className="py-2">
          {allMessages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              showAvatar={shouldShowAvatar(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
