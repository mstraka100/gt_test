import { apiClient } from './client';
import type { FileUpload } from '../types';

export interface UploadFileParams {
  file: File;
  channelId?: string;
  dmId?: string;
}

export interface UploadFileResponse {
  file: FileUpload;
}

export async function uploadFile(params: UploadFileParams): Promise<FileUpload> {
  const formData = new FormData();
  formData.append('file', params.file);

  if (params.channelId) {
    formData.append('channelId', params.channelId);
  }
  if (params.dmId) {
    formData.append('dmId', params.dmId);
  }

  const response = await apiClient.post<UploadFileResponse>('/files', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.file;
}

export async function getChannelFiles(channelId: string): Promise<FileUpload[]> {
  const response = await apiClient.get<{ files: FileUpload[] }>(`/files/channel/${channelId}`);
  return response.data.files;
}

export async function getDMFiles(dmId: string): Promise<FileUpload[]> {
  const response = await apiClient.get<{ files: FileUpload[] }>(`/files/dm/${dmId}`);
  return response.data.files;
}

export async function deleteFile(fileId: string): Promise<void> {
  await apiClient.delete(`/files/${fileId}`);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
