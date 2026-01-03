import { v4 as uuidv4 } from 'uuid';
import { Message } from '../types';

// In-memory storage
const messages: Map<string, Message> = new Map();
const channelMessages: Map<string, string[]> = new Map(); // channelId -> messageIds (ordered)

interface CreateMessageParams {
  channelId: string;
  userId: string;
  content: string;
  type?: Message['type'];
}

export async function createMessage(params: CreateMessageParams): Promise<Message> {
  const message: Message = {
    id: uuidv4(),
    channelId: params.channelId,
    userId: params.userId,
    content: params.content,
    type: params.type || 'text',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  messages.set(message.id, message);

  // Add to channel message list
  if (!channelMessages.has(params.channelId)) {
    channelMessages.set(params.channelId, []);
  }
  channelMessages.get(params.channelId)!.push(message.id);

  return message;
}

export async function findMessageById(id: string): Promise<Message | null> {
  return messages.get(id) || null;
}

export async function getChannelMessages(
  channelId: string,
  limit: number = 50,
  before?: string
): Promise<Message[]> {
  const messageIds = channelMessages.get(channelId) || [];

  let startIndex = messageIds.length;

  // If 'before' is specified, find its index and start from there
  if (before) {
    const beforeIndex = messageIds.indexOf(before);
    if (beforeIndex !== -1) {
      startIndex = beforeIndex;
    }
  }

  // Get the last 'limit' messages before startIndex
  const start = Math.max(0, startIndex - limit);
  const selectedIds = messageIds.slice(start, startIndex);

  return selectedIds
    .map((id) => messages.get(id))
    .filter((m): m is Message => m !== undefined);
}

export async function updateMessage(
  id: string,
  userId: string,
  content: string
): Promise<Message | null> {
  const message = messages.get(id);
  if (!message) return null;

  // Only the author can edit
  if (message.userId !== userId) {
    throw new Error('Permission denied');
  }

  message.content = content;
  message.updatedAt = new Date();
  message.editedAt = new Date();

  messages.set(id, message);
  return message;
}

export async function deleteMessage(id: string, userId: string): Promise<boolean> {
  const message = messages.get(id);
  if (!message) return false;

  // Only the author can delete
  if (message.userId !== userId) {
    throw new Error('Permission denied');
  }

  messages.delete(id);

  // Remove from channel list
  const channelMsgs = channelMessages.get(message.channelId);
  if (channelMsgs) {
    const index = channelMsgs.indexOf(id);
    if (index !== -1) {
      channelMsgs.splice(index, 1);
    }
  }

  return true;
}

export async function createSystemMessage(
  channelId: string,
  content: string
): Promise<Message> {
  return createMessage({
    channelId,
    userId: 'system',
    content,
    type: 'system',
  });
}
