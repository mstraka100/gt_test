import { apiClient } from './client';
import type { DirectMessage, DMMessage, DMMessagesResponse } from '../types';

export async function getDMs(): Promise<DirectMessage[]> {
  const { data } = await apiClient.get<{ dms: DirectMessage[] }>('/dms');
  return data.dms;
}

export async function getDM(id: string): Promise<DirectMessage> {
  const { data } = await apiClient.get<{ dm: DirectMessage }>(`/dms/${id}`);
  return data.dm;
}

export async function createDM(participantIds: string[]): Promise<DirectMessage> {
  const { data } = await apiClient.post<{ dm: DirectMessage }>('/dms', { participantIds });
  return data.dm;
}

export async function getDMMessages(
  dmId: string,
  options?: { limit?: number; before?: string }
): Promise<DMMessagesResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.before) params.set('before', options.before);

  const { data } = await apiClient.get<DMMessagesResponse>(
    `/dms/${dmId}/messages?${params}`
  );
  return data;
}

export async function sendDMMessage(dmId: string, content: string): Promise<DMMessage> {
  const { data } = await apiClient.post<{ message: DMMessage }>(`/dms/${dmId}/messages`, { content });
  return data.message;
}
