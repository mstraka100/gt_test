import {
  createMessage,
  findMessageById,
  getChannelMessages,
  updateMessage,
  deleteMessage,
  createSystemMessage,
} from '../../models/message';

// Helper to generate unique channel IDs for test isolation
let testCounter = 0;
const uniqueChannelId = () => `channel-${Date.now()}-${++testCounter}`;

describe('Message Model', () => {
  const userId = 'user-1';
  const otherUserId = 'user-2';

  describe('createMessage', () => {
    it('should create a text message with valid input', async () => {
      const channelId = uniqueChannelId();
      const message = await createMessage({
        channelId,
        userId,
        content: 'Hello, world!',
      });

      expect(message).toMatchObject({
        channelId,
        userId,
        content: 'Hello, world!',
        type: 'text',
      });
      expect(message.id).toBeDefined();
      expect(message.createdAt).toBeInstanceOf(Date);
      expect(message.updatedAt).toBeInstanceOf(Date);
    });

    it('should create message with custom type', async () => {
      const channelId = uniqueChannelId();
      const message = await createMessage({
        channelId,
        userId,
        content: 'System notification',
        type: 'system',
      });

      expect(message.type).toBe('system');
    });

    it('should add message to channel message list', async () => {
      const channelId = uniqueChannelId();
      await createMessage({ channelId, userId, content: 'First' });
      await createMessage({ channelId, userId, content: 'Second' });

      const messages = await getChannelMessages(channelId);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
    });
  });

  describe('findMessageById', () => {
    it('should find existing message by id', async () => {
      const channelId = uniqueChannelId();
      const created = await createMessage({ channelId, userId, content: 'Test message' });
      const found = await findMessageById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null for non-existent id', async () => {
      const found = await findMessageById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('getChannelMessages', () => {
    it('should return messages in order', async () => {
      const channelId = uniqueChannelId();
      await createMessage({ channelId, userId, content: 'First' });
      await createMessage({ channelId, userId, content: 'Second' });
      await createMessage({ channelId, userId, content: 'Third' });

      const messages = await getChannelMessages(channelId);

      expect(messages.map((m) => m.content)).toEqual(['First', 'Second', 'Third']);
    });

    it('should return empty array for channel with no messages', async () => {
      const messages = await getChannelMessages('empty-channel');
      expect(messages).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const channelId = uniqueChannelId();
      for (let i = 1; i <= 10; i++) {
        await createMessage({ channelId, userId, content: `Message ${i}` });
      }

      const messages = await getChannelMessages(channelId, 5);

      expect(messages).toHaveLength(5);
      // Should return last 5 messages (pagination from end)
      expect(messages[0].content).toBe('Message 6');
      expect(messages[4].content).toBe('Message 10');
    });

    it('should support pagination with before cursor', async () => {
      const channelId = uniqueChannelId();
      const createdMessages = [];
      for (let i = 1; i <= 5; i++) {
        createdMessages.push(await createMessage({ channelId, userId, content: `Message ${i}` }));
      }

      // Get messages before the 4th message
      const messages = await getChannelMessages(channelId, 2, createdMessages[3].id);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Message 2');
      expect(messages[1].content).toBe('Message 3');
    });

    it('should return all messages when before cursor not found', async () => {
      const channelId = uniqueChannelId();
      await createMessage({ channelId, userId, content: 'Test' });

      const messages = await getChannelMessages(channelId, 50, 'non-existent-cursor');

      expect(messages).toHaveLength(1);
    });
  });

  describe('updateMessage', () => {
    it('should update message content by author', async () => {
      const channelId = uniqueChannelId();
      const message = await createMessage({ channelId, userId, content: 'Original' });

      const updated = await updateMessage(message.id, userId, 'Updated content');

      expect(updated?.content).toBe('Updated content');
      expect(updated?.editedAt).toBeInstanceOf(Date);
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(message.createdAt.getTime());
    });

    it('should throw error when non-author tries to update', async () => {
      const channelId = uniqueChannelId();
      const message = await createMessage({ channelId, userId, content: 'Original' });

      await expect(updateMessage(message.id, otherUserId, 'Hacked')).rejects.toThrow('Permission denied');
    });

    it('should return null for non-existent message', async () => {
      const result = await updateMessage('non-existent-id', userId, 'Test');
      expect(result).toBeNull();
    });

    it('should set editedAt timestamp', async () => {
      const channelId = uniqueChannelId();
      const message = await createMessage({ channelId, userId, content: 'Original' });

      expect(message.editedAt).toBeUndefined();

      const updated = await updateMessage(message.id, userId, 'Edited');

      expect(updated?.editedAt).toBeDefined();
      expect(updated?.editedAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteMessage', () => {
    it('should delete message by author', async () => {
      const channelId = uniqueChannelId();
      const message = await createMessage({ channelId, userId, content: 'To delete' });

      const deleted = await deleteMessage(message.id, userId);

      expect(deleted).toBe(true);
      expect(await findMessageById(message.id)).toBeNull();
    });

    it('should remove message from channel list', async () => {
      const channelId = uniqueChannelId();
      await createMessage({ channelId, userId, content: 'Keep' });
      const toDelete = await createMessage({ channelId, userId, content: 'Delete' });
      await createMessage({ channelId, userId, content: 'Also keep' });

      await deleteMessage(toDelete.id, userId);

      const messages = await getChannelMessages(channelId);
      expect(messages.map((m) => m.content)).toEqual(['Keep', 'Also keep']);
    });

    it('should throw error when non-author tries to delete', async () => {
      const channelId = uniqueChannelId();
      const message = await createMessage({ channelId, userId, content: 'Protected' });

      await expect(deleteMessage(message.id, otherUserId)).rejects.toThrow('Permission denied');
    });

    it('should return false for non-existent message', async () => {
      const deleted = await deleteMessage('non-existent-id', userId);
      expect(deleted).toBe(false);
    });
  });

  describe('createSystemMessage', () => {
    it('should create a system message', async () => {
      const channelId = uniqueChannelId();
      const message = await createSystemMessage(channelId, 'User joined the channel');

      expect(message).toMatchObject({
        channelId,
        userId: 'system',
        content: 'User joined the channel',
        type: 'system',
      });
    });

    it('should add system message to channel list', async () => {
      const channelId = uniqueChannelId();
      await createMessage({ channelId, userId, content: 'Regular message' });
      await createSystemMessage(channelId, 'System message');

      const messages = await getChannelMessages(channelId);

      expect(messages).toHaveLength(2);
      expect(messages[1].type).toBe('system');
      expect(messages[1].userId).toBe('system');
    });
  });
});
