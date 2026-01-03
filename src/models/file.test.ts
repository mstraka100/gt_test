import {
  uploadFile,
  getFileById,
  getFileData,
  getChannelFiles,
  getDMFiles,
  getUserFiles,
  deleteFile,
  attachFileToMessage,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from './file';

describe('File Model', () => {
  describe('Constants', () => {
    it('should have MAX_FILE_SIZE set to 10MB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('should have allowed MIME types defined', () => {
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain('text/plain');
    });
  });

  describe('uploadFile', () => {
    it('should upload a valid file', async () => {
      const buffer = Buffer.from('test file content');
      const file = await uploadFile({
        buffer,
        originalName: 'test.txt',
        mimeType: 'text/plain',
        uploaderId: 'user1',
      });

      expect(file.id).toBeDefined();
      expect(file.originalName).toBe('test.txt');
      expect(file.mimeType).toBe('text/plain');
      expect(file.size).toBe(buffer.length);
      expect(file.uploaderId).toBe('user1');
      expect(file.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique filename with extension', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('test'),
        originalName: 'document.pdf',
        mimeType: 'application/pdf',
        uploaderId: 'user2',
      });

      expect(file.filename).toMatch(/^[a-f0-9-]+\.pdf$/);
    });

    it('should handle file without extension', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('test'),
        originalName: 'noextension',
        mimeType: 'text/plain',
        uploaderId: 'user3',
      });

      expect(file.filename).toBeDefined();
      expect(file.originalName).toBe('noextension');
    });

    it('should associate file with channel', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('test'),
        originalName: 'channel-file.txt',
        mimeType: 'text/plain',
        uploaderId: 'user4',
        channelId: 'channel1',
      });

      expect(file.channelId).toBe('channel1');
    });

    it('should associate file with DM', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('test'),
        originalName: 'dm-file.txt',
        mimeType: 'text/plain',
        uploaderId: 'user5',
        dmId: 'dm1',
      });

      expect(file.dmId).toBe('dm1');
    });

    it('should throw error for file exceeding max size', async () => {
      const largeBuffer = Buffer.alloc(MAX_FILE_SIZE + 1);

      await expect(uploadFile({
        buffer: largeBuffer,
        originalName: 'large.txt',
        mimeType: 'text/plain',
        uploaderId: 'user6',
      })).rejects.toThrow('File too large');
    });

    it('should throw error for disallowed MIME type', async () => {
      await expect(uploadFile({
        buffer: Buffer.from('test'),
        originalName: 'script.exe',
        mimeType: 'application/x-msdownload',
        uploaderId: 'user7',
      })).rejects.toThrow('File type not allowed');
    });

    it('should accept all allowed MIME types', async () => {
      for (const mimeType of ALLOWED_MIME_TYPES) {
        const file = await uploadFile({
          buffer: Buffer.from('test'),
          originalName: 'test-file',
          mimeType,
          uploaderId: `user-mime-${mimeType}`,
        });
        expect(file.mimeType).toBe(mimeType);
      }
    });
  });

  describe('getFileById', () => {
    it('should retrieve file by id', async () => {
      const uploaded = await uploadFile({
        buffer: Buffer.from('content'),
        originalName: 'findme.txt',
        mimeType: 'text/plain',
        uploaderId: 'user10',
      });

      const found = await getFileById(uploaded.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(uploaded.id);
      expect(found!.originalName).toBe('findme.txt');
    });

    it('should return null for non-existent file', async () => {
      const found = await getFileById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('getFileData', () => {
    it('should retrieve file buffer', async () => {
      const content = 'Test file data content';
      const buffer = Buffer.from(content);

      const uploaded = await uploadFile({
        buffer,
        originalName: 'data.txt',
        mimeType: 'text/plain',
        uploaderId: 'user11',
      });

      const data = await getFileData(uploaded.id);

      expect(data).not.toBeNull();
      expect(data!.toString()).toBe(content);
    });

    it('should return null for non-existent file', async () => {
      const data = await getFileData('non-existent-id');
      expect(data).toBeNull();
    });
  });

  describe('getChannelFiles', () => {
    it('should return files in a channel', async () => {
      const channelId = 'channel-files-test';

      await uploadFile({
        buffer: Buffer.from('file1'),
        originalName: 'file1.txt',
        mimeType: 'text/plain',
        uploaderId: 'user20',
        channelId,
      });

      await uploadFile({
        buffer: Buffer.from('file2'),
        originalName: 'file2.txt',
        mimeType: 'text/plain',
        uploaderId: 'user21',
        channelId,
      });

      const files = await getChannelFiles(channelId);

      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.every(f => f.channelId === channelId)).toBe(true);
    });

    it('should return empty array for channel with no files', async () => {
      const files = await getChannelFiles('empty-channel');
      expect(files).toEqual([]);
    });
  });

  describe('getDMFiles', () => {
    it('should return files in a DM', async () => {
      const dmId = 'dm-files-test';

      await uploadFile({
        buffer: Buffer.from('dm-file1'),
        originalName: 'dmfile1.txt',
        mimeType: 'text/plain',
        uploaderId: 'user30',
        dmId,
      });

      await uploadFile({
        buffer: Buffer.from('dm-file2'),
        originalName: 'dmfile2.txt',
        mimeType: 'text/plain',
        uploaderId: 'user31',
        dmId,
      });

      const files = await getDMFiles(dmId);

      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.every(f => f.dmId === dmId)).toBe(true);
    });

    it('should return empty array for DM with no files', async () => {
      const files = await getDMFiles('empty-dm');
      expect(files).toEqual([]);
    });
  });

  describe('getUserFiles', () => {
    it('should return files uploaded by user', async () => {
      const userId = 'user-files-test';

      await uploadFile({
        buffer: Buffer.from('user-file1'),
        originalName: 'userfile1.txt',
        mimeType: 'text/plain',
        uploaderId: userId,
      });

      await uploadFile({
        buffer: Buffer.from('user-file2'),
        originalName: 'userfile2.png',
        mimeType: 'image/png',
        uploaderId: userId,
      });

      const files = await getUserFiles(userId);

      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.every(f => f.uploaderId === userId)).toBe(true);
    });

    it('should return empty array for user with no files', async () => {
      const files = await getUserFiles('user-no-files');
      expect(files).toEqual([]);
    });
  });

  describe('deleteFile', () => {
    it('should delete file by uploader', async () => {
      const userId = 'user40';
      const uploaded = await uploadFile({
        buffer: Buffer.from('to-delete'),
        originalName: 'delete-me.txt',
        mimeType: 'text/plain',
        uploaderId: userId,
      });

      const result = await deleteFile(uploaded.id, userId);

      expect(result).toBe(true);

      const found = await getFileById(uploaded.id);
      expect(found).toBeNull();

      const data = await getFileData(uploaded.id);
      expect(data).toBeNull();
    });

    it('should remove file from user files list', async () => {
      const userId = 'user41';
      const uploaded = await uploadFile({
        buffer: Buffer.from('user-file'),
        originalName: 'file.txt',
        mimeType: 'text/plain',
        uploaderId: userId,
      });

      await deleteFile(uploaded.id, userId);

      const userFiles = await getUserFiles(userId);
      expect(userFiles.find(f => f.id === uploaded.id)).toBeUndefined();
    });

    it('should remove file from channel files list', async () => {
      const userId = 'user42';
      const channelId = 'channel-delete-test';
      const uploaded = await uploadFile({
        buffer: Buffer.from('channel-file'),
        originalName: 'file.txt',
        mimeType: 'text/plain',
        uploaderId: userId,
        channelId,
      });

      await deleteFile(uploaded.id, userId);

      const channelFiles = await getChannelFiles(channelId);
      expect(channelFiles.find(f => f.id === uploaded.id)).toBeUndefined();
    });

    it('should remove file from DM files list', async () => {
      const userId = 'user43';
      const dmId = 'dm-delete-test';
      const uploaded = await uploadFile({
        buffer: Buffer.from('dm-file'),
        originalName: 'file.txt',
        mimeType: 'text/plain',
        uploaderId: userId,
        dmId,
      });

      await deleteFile(uploaded.id, userId);

      const dmFiles = await getDMFiles(dmId);
      expect(dmFiles.find(f => f.id === uploaded.id)).toBeUndefined();
    });

    it('should throw error when non-uploader tries to delete', async () => {
      const uploaded = await uploadFile({
        buffer: Buffer.from('protected'),
        originalName: 'protected.txt',
        mimeType: 'text/plain',
        uploaderId: 'user44',
      });

      await expect(deleteFile(uploaded.id, 'user45'))
        .rejects.toThrow('Permission denied');
    });

    it('should return false for non-existent file', async () => {
      const result = await deleteFile('non-existent', 'user46');
      expect(result).toBe(false);
    });
  });

  describe('attachFileToMessage', () => {
    it('should attach file to message', async () => {
      const uploaded = await uploadFile({
        buffer: Buffer.from('attach-me'),
        originalName: 'attachment.txt',
        mimeType: 'text/plain',
        uploaderId: 'user50',
      });

      const messageId = 'message-123';
      const result = await attachFileToMessage(uploaded.id, messageId);

      expect(result).not.toBeNull();
      expect(result!.messageId).toBe(messageId);

      const found = await getFileById(uploaded.id);
      expect(found!.messageId).toBe(messageId);
    });

    it('should return null for non-existent file', async () => {
      const result = await attachFileToMessage('non-existent', 'message-456');
      expect(result).toBeNull();
    });
  });

  describe('File Size Edge Cases', () => {
    it('should accept file at exactly max size', async () => {
      const exactMaxBuffer = Buffer.alloc(MAX_FILE_SIZE);

      const file = await uploadFile({
        buffer: exactMaxBuffer,
        originalName: 'max-size.txt',
        mimeType: 'text/plain',
        uploaderId: 'user60',
      });

      expect(file.size).toBe(MAX_FILE_SIZE);
    });

    it('should accept empty file (0 bytes)', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const file = await uploadFile({
        buffer: emptyBuffer,
        originalName: 'empty.txt',
        mimeType: 'text/plain',
        uploaderId: 'user61',
      });

      expect(file.size).toBe(0);
    });
  });

  describe('Image Files', () => {
    it('should accept JPEG images', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('fake-jpeg'),
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
        uploaderId: 'user70',
      });

      expect(file.mimeType).toBe('image/jpeg');
    });

    it('should accept PNG images', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('fake-png'),
        originalName: 'image.png',
        mimeType: 'image/png',
        uploaderId: 'user71',
      });

      expect(file.mimeType).toBe('image/png');
    });

    it('should accept GIF images', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('fake-gif'),
        originalName: 'animation.gif',
        mimeType: 'image/gif',
        uploaderId: 'user72',
      });

      expect(file.mimeType).toBe('image/gif');
    });

    it('should accept WebP images', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('fake-webp'),
        originalName: 'modern.webp',
        mimeType: 'image/webp',
        uploaderId: 'user73',
      });

      expect(file.mimeType).toBe('image/webp');
    });
  });

  describe('Document Files', () => {
    it('should accept PDF files', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('fake-pdf'),
        originalName: 'document.pdf',
        mimeType: 'application/pdf',
        uploaderId: 'user80',
      });

      expect(file.mimeType).toBe('application/pdf');
    });

    it('should accept CSV files', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('col1,col2\nval1,val2'),
        originalName: 'data.csv',
        mimeType: 'text/csv',
        uploaderId: 'user81',
      });

      expect(file.mimeType).toBe('text/csv');
    });

    it('should accept JSON files', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('{"key": "value"}'),
        originalName: 'config.json',
        mimeType: 'application/json',
        uploaderId: 'user82',
      });

      expect(file.mimeType).toBe('application/json');
    });

    it('should accept ZIP files', async () => {
      const file = await uploadFile({
        buffer: Buffer.from('fake-zip'),
        originalName: 'archive.zip',
        mimeType: 'application/zip',
        uploaderId: 'user83',
      });

      expect(file.mimeType).toBe('application/zip');
    });
  });
});
