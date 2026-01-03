import { Message } from '../types';
import { getChannelMessages as getChannelMsgs } from './message';
import { getDMMessages as getDMMsgs } from './dm';
import { listChannels, isMember } from './channel';
import { getUserDMs, isParticipant } from './dm';

export interface SearchResult {
  id: string;
  type: 'channel_message' | 'dm_message';
  content: string;
  userId: string;
  channelId?: string;
  dmId?: string;
  createdAt: Date;
  matchHighlight?: string;
}

export interface SearchOptions {
  query: string;
  userId: string;
  limit?: number;
  channelId?: string; // Limit to specific channel
  dmId?: string; // Limit to specific DM
}

// Simple text search - in production, use Elasticsearch or similar
function matchesQuery(content: string, query: string): boolean {
  const normalizedContent = content.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  // Split query into words and check if all words are present
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);

  return queryWords.every((word) => normalizedContent.includes(word));
}

function highlightMatch(content: string, query: string): string {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 0);

  let highlighted = content;
  for (const word of queryWords) {
    const regex = new RegExp(`(${word})`, 'gi');
    highlighted = highlighted.replace(regex, '**$1**');
  }

  // Truncate to show context around first match
  if (highlighted.length > 150) {
    const firstMatchIndex = highlighted.indexOf('**');
    if (firstMatchIndex > 50) {
      highlighted = '...' + highlighted.slice(firstMatchIndex - 30);
    }
    if (highlighted.length > 150) {
      highlighted = highlighted.slice(0, 147) + '...';
    }
  }

  return highlighted;
}

// In-memory storage references for searching
// These will be populated by the message and DM models
const channelMessageStore: Map<string, Message[]> = new Map();
const dmMessageStore: Map<string, Array<{ id: string; dmId: string; userId: string; content: string; type: string; createdAt: Date; updatedAt: Date }>> = new Map();

// Registration functions for models to register their stores
export function registerChannelMessages(
  getMessages: (channelId: string, limit: number) => Promise<Message[]>
): void {
  // Store reference to the getter function
  (global as any).__getChannelMessages = getMessages;
}

export function registerDMMessages(
  getMessages: (dmId: string, limit: number) => Promise<Array<{ id: string; dmId: string; userId: string; content: string; type: string; createdAt: Date; updatedAt: Date }>>
): void {
  (global as any).__getDMMessages = getMessages;
}

export async function search(options: SearchOptions): Promise<SearchResult[]> {
  const { query, userId, limit = 20 } = options;

  if (!query || query.trim().length < 2) {
    return [];
  }

  const results: SearchResult[] = [];

  // Search channel messages
  if (!options.dmId) {
    const channels = await listChannels(userId);

    for (const channel of channels) {
      if (options.channelId && channel.id !== options.channelId) continue;

      // Check access
      if (channel.type === 'private' && !(await isMember(channel.id, userId))) {
        continue;
      }

      const messages = await getChannelMsgs(channel.id, 1000);

      for (const message of messages) {
        if (results.length >= limit) break;

        if (message.type === 'text' && matchesQuery(message.content, query)) {
          results.push({
            id: message.id,
            type: 'channel_message',
            content: message.content,
            userId: message.userId,
            channelId: message.channelId,
            createdAt: message.createdAt,
            matchHighlight: highlightMatch(message.content, query),
          });
        }
      }

      if (results.length >= limit) break;
    }
  }

  // Search DM messages
  if (!options.channelId) {
    const dms = await getUserDMs(userId);

    for (const dm of dms) {
      if (options.dmId && dm.id !== options.dmId) continue;

      const messages = await getDMMsgs(dm.id, 1000);

      for (const message of messages) {
        if (results.length >= limit) break;

        if (message.type === 'text' && matchesQuery(message.content, query)) {
          results.push({
            id: message.id,
            type: 'dm_message',
            content: message.content,
            userId: message.userId,
            dmId: message.dmId,
            createdAt: message.createdAt,
            matchHighlight: highlightMatch(message.content, query),
          });
        }
      }

      if (results.length >= limit) break;
    }
  }

  // Sort by date (newest first)
  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return results.slice(0, limit);
}
