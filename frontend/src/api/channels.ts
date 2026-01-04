import { apiClient } from './client';
import type { Channel, Message, MessagesResponse } from '../types';

export async function getChannels(): Promise<Channel[]> {
  const { data } = await apiClient.get<{ channels: Channel[] }>('/channels');
  return data.channels;
}

export async function getChannel(id: string): Promise<Channel> {
  const { data } = await apiClient.get<{ channel: Channel }>(`/channels/${id}`);
  return data.channel;
}

export async function joinChannel(id: string): Promise<void> {
  await apiClient.post(`/channels/${id}/join`);
}

export async function getChannelMessages(
  channelId: string,
  options?: { limit?: number; before?: string }
): Promise<MessagesResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.before) params.set('before', options.before);

  const { data } = await apiClient.get<MessagesResponse>(
    `/messages/channel/${channelId}?${params}`
  );
  return data;
}

export async function sendMessage(channelId: string, content: string): Promise<Message> {
  const { data } = await apiClient.post<{ message: Message }>('/messages', { channelId, content });
  return data.message;
}

export interface CreateChannelInput {
  name: string;
  description?: string;
  type?: 'public' | 'private';
}

export async function createChannel(input: CreateChannelInput): Promise<Channel> {
  const { data } = await apiClient.post<{ channel: Channel }>('/channels', input);
  return data.channel;
}
