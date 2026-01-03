import { v4 as uuidv4 } from 'uuid';
import { FileUpload } from '../types';

// In-memory storage
const files: Map<string, FileUpload> = new Map();
const fileData: Map<string, Buffer> = new Map(); // fileId -> file contents
const channelFiles: Map<string, string[]> = new Map(); // channelId -> fileIds
const dmFiles: Map<string, string[]> = new Map(); // dmId -> fileIds
const userFiles: Map<string, string[]> = new Map(); // userId -> fileIds

// Max file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
];

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  uploaderId: string;
  channelId?: string;
  dmId?: string;
}

export async function uploadFile(input: UploadFileInput): Promise<FileUpload> {
  if (input.buffer.length > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }

  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new Error('File type not allowed');
  }

  const fileId = uuidv4();
  const extension = input.originalName.split('.').pop() || '';
  const filename = `${fileId}${extension ? '.' + extension : ''}`;

  const file: FileUpload = {
    id: fileId,
    filename,
    originalName: input.originalName,
    mimeType: input.mimeType,
    size: input.buffer.length,
    uploaderId: input.uploaderId,
    channelId: input.channelId,
    dmId: input.dmId,
    createdAt: new Date(),
  };

  files.set(fileId, file);
  fileData.set(fileId, input.buffer);

  // Track file in relevant collections
  if (!userFiles.has(input.uploaderId)) {
    userFiles.set(input.uploaderId, []);
  }
  userFiles.get(input.uploaderId)!.push(fileId);

  if (input.channelId) {
    if (!channelFiles.has(input.channelId)) {
      channelFiles.set(input.channelId, []);
    }
    channelFiles.get(input.channelId)!.push(fileId);
  }

  if (input.dmId) {
    if (!dmFiles.has(input.dmId)) {
      dmFiles.set(input.dmId, []);
    }
    dmFiles.get(input.dmId)!.push(fileId);
  }

  return file;
}

export async function getFileById(id: string): Promise<FileUpload | null> {
  return files.get(id) || null;
}

export async function getFileData(id: string): Promise<Buffer | null> {
  return fileData.get(id) || null;
}

export async function getChannelFiles(channelId: string): Promise<FileUpload[]> {
  const fileIds = channelFiles.get(channelId) || [];
  return fileIds
    .map((id) => files.get(id))
    .filter((f): f is FileUpload => f !== undefined);
}

export async function getDMFiles(dmId: string): Promise<FileUpload[]> {
  const fileIds = dmFiles.get(dmId) || [];
  return fileIds
    .map((id) => files.get(id))
    .filter((f): f is FileUpload => f !== undefined);
}

export async function getUserFiles(userId: string): Promise<FileUpload[]> {
  const fileIds = userFiles.get(userId) || [];
  return fileIds
    .map((id) => files.get(id))
    .filter((f): f is FileUpload => f !== undefined);
}

export async function deleteFile(id: string, userId: string): Promise<boolean> {
  const file = files.get(id);
  if (!file) return false;

  // Only uploader can delete
  if (file.uploaderId !== userId) {
    throw new Error('Permission denied');
  }

  files.delete(id);
  fileData.delete(id);

  // Remove from collections
  const userFileList = userFiles.get(userId);
  if (userFileList) {
    const index = userFileList.indexOf(id);
    if (index !== -1) userFileList.splice(index, 1);
  }

  if (file.channelId) {
    const channelFileList = channelFiles.get(file.channelId);
    if (channelFileList) {
      const index = channelFileList.indexOf(id);
      if (index !== -1) channelFileList.splice(index, 1);
    }
  }

  if (file.dmId) {
    const dmFileList = dmFiles.get(file.dmId);
    if (dmFileList) {
      const index = dmFileList.indexOf(id);
      if (index !== -1) dmFileList.splice(index, 1);
    }
  }

  return true;
}

export async function attachFileToMessage(
  fileId: string,
  messageId: string
): Promise<FileUpload | null> {
  const file = files.get(fileId);
  if (!file) return null;

  file.messageId = messageId;
  files.set(fileId, file);

  return file;
}
