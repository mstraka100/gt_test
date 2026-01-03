import request from 'supertest';
import { createTestApp, createTestUser, authHeader } from '../setup';

const app = createTestApp();

describe('Messages Routes', () => {
  let testCounter = 0;
  const uniqueChannelName = () => `msg-test-channel-${Date.now()}-${++testCounter}`;

  async function createChannelForTest(token: string) {
    const name = uniqueChannelName();
    const res = await request(app).post('/channels').set(authHeader(token)).send({ name });
    return res.body.channel;
  }

  describe('POST /messages', () => {
    it('should create a message in channel', async () => {
      const { token, user } = await createTestUser();
      const channel = await createChannelForTest(token);

      const res = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: 'Hello, world!' });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatchObject({
        channelId: channel.id,
        userId: user.id,
        content: 'Hello, world!',
        type: 'text',
      });
      expect(res.body.message.user).toBeDefined();
    });

    it('should return 400 for missing channelId', async () => {
      const { token } = await createTestUser();

      const res = await request(app).post('/messages').set(authHeader(token)).send({ content: 'Hello' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('channelId and content are required');
    });

    it('should return 400 for missing content', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const res = await request(app).post('/messages').set(authHeader(token)).send({ channelId: channel.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('channelId and content are required');
    });

    it('should return 400 for empty content', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const res = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Message content cannot be empty');
    });

    it('should return 400 for content too long', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const res = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: 'x'.repeat(4001) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Message too long (max 4000 characters)');
    });

    it('should return 404 for non-existent channel', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: 'non-existent', content: 'Hello' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Channel not found');
    });

    it('should return 403 for non-member posting', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const channel = await createChannelForTest(creatorToken);

      const res = await request(app)
        .post('/messages')
        .set(authHeader(otherToken))
        .send({ channelId: channel.id, content: 'Hello' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Not a channel member');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/messages').send({ channelId: 'test', content: 'Hello' });

      expect(res.status).toBe(401);
    });

    it('should trim whitespace from content', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const res = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: '  Hello  ' });

      expect(res.status).toBe(201);
      expect(res.body.message.content).toBe('Hello');
    });
  });

  describe('GET /messages/channel/:channelId', () => {
    it('should get messages for channel', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      await request(app).post('/messages').set(authHeader(token)).send({ channelId: channel.id, content: 'First' });
      await request(app).post('/messages').set(authHeader(token)).send({ channelId: channel.id, content: 'Second' });

      const res = await request(app).get(`/messages/channel/${channel.id}`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].content).toBe('First');
      expect(res.body.messages[1].content).toBe('Second');
      expect(res.body.messages[0].user).toBeDefined();
    });

    it('should return empty array for channel with no messages', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const res = await request(app).get(`/messages/channel/${channel.id}`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
      expect(res.body.hasMore).toBe(false);
    });

    it('should respect limit parameter', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      for (let i = 1; i <= 10; i++) {
        await request(app)
          .post('/messages')
          .set(authHeader(token))
          .send({ channelId: channel.id, content: `Message ${i}` });
      }

      const res = await request(app).get(`/messages/channel/${channel.id}?limit=5`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(5);
      expect(res.body.hasMore).toBe(true);
    });

    it('should cap limit at 100', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const res = await request(app).get(`/messages/channel/${channel.id}?limit=200`).set(authHeader(token));

      expect(res.status).toBe(200);
      // Just check it doesn't error - limit should be capped to 100
    });

    it('should support pagination with before cursor', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const messages = [];
      for (let i = 1; i <= 5; i++) {
        const r = await request(app)
          .post('/messages')
          .set(authHeader(token))
          .send({ channelId: channel.id, content: `Message ${i}` });
        messages.push(r.body.message);
      }

      const res = await request(app)
        .get(`/messages/channel/${channel.id}?limit=2&before=${messages[3].id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].content).toBe('Message 2');
      expect(res.body.messages[1].content).toBe('Message 3');
    });

    it('should return 404 for non-existent channel', async () => {
      const { token } = await createTestUser();

      const res = await request(app).get('/messages/channel/non-existent').set(authHeader(token));

      expect(res.status).toBe(404);
    });

    it('should return 403 for private channel non-member', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();

      const createRes = await request(app)
        .post('/channels')
        .set(authHeader(creatorToken))
        .send({ name: uniqueChannelName(), type: 'private' });
      const channelId = createRes.body.channel.id;

      const res = await request(app).get(`/messages/channel/${channelId}`).set(authHeader(otherToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /messages/:id', () => {
    it('should get specific message', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const createRes = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: 'Test message' });
      const messageId = createRes.body.message.id;

      const res = await request(app).get(`/messages/${messageId}`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.message.id).toBe(messageId);
      expect(res.body.message.content).toBe('Test message');
      expect(res.body.message.user).toBeDefined();
    });

    it('should return 404 for non-existent message', async () => {
      const { token } = await createTestUser();

      const res = await request(app).get('/messages/non-existent').set(authHeader(token));

      expect(res.status).toBe(404);
    });

    it('should return 403 for private channel message non-member', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();

      const createChannelRes = await request(app)
        .post('/channels')
        .set(authHeader(creatorToken))
        .send({ name: uniqueChannelName(), type: 'private' });
      const channelId = createChannelRes.body.channel.id;

      const createMsgRes = await request(app)
        .post('/messages')
        .set(authHeader(creatorToken))
        .send({ channelId, content: 'Secret' });
      const messageId = createMsgRes.body.message.id;

      const res = await request(app).get(`/messages/${messageId}`).set(authHeader(otherToken));

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /messages/:id', () => {
    it('should update message content', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const createRes = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: 'Original' });
      const messageId = createRes.body.message.id;

      const res = await request(app)
        .patch(`/messages/${messageId}`)
        .set(authHeader(token))
        .send({ content: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.message.content).toBe('Updated');
      expect(res.body.message.editedAt).toBeDefined();
    });

    it('should return 400 for missing content', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const createRes = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: 'Original' });
      const messageId = createRes.body.message.id;

      const res = await request(app).patch(`/messages/${messageId}`).set(authHeader(token)).send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('content is required');
    });

    it('should return 400 for empty content', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const createRes = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: 'Original' });
      const messageId = createRes.body.message.id;

      const res = await request(app).patch(`/messages/${messageId}`).set(authHeader(token)).send({ content: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Message content cannot be empty');
    });

    it('should return 400 for content too long', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const createRes = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: 'Original' });
      const messageId = createRes.body.message.id;

      const res = await request(app)
        .patch(`/messages/${messageId}`)
        .set(authHeader(token))
        .send({ content: 'x'.repeat(4001) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Message too long (max 4000 characters)');
    });

    it('should return 403 for non-author trying to edit', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const channel = await createChannelForTest(creatorToken);

      // Add other user to channel
      await request(app).post(`/channels/${channel.id}/join`).set(authHeader(otherToken));

      const createRes = await request(app)
        .post('/messages')
        .set(authHeader(creatorToken))
        .send({ channelId: channel.id, content: 'Original' });
      const messageId = createRes.body.message.id;

      const res = await request(app)
        .patch(`/messages/${messageId}`)
        .set(authHeader(otherToken))
        .send({ content: 'Hacked' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Can only edit your own messages');
    });

    it('should return 404 for non-existent message', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .patch('/messages/non-existent')
        .set(authHeader(token))
        .send({ content: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /messages/:id', () => {
    it('should delete message', async () => {
      const { token } = await createTestUser();
      const channel = await createChannelForTest(token);

      const createRes = await request(app)
        .post('/messages')
        .set(authHeader(token))
        .send({ channelId: channel.id, content: 'To delete' });
      const messageId = createRes.body.message.id;

      const res = await request(app).delete(`/messages/${messageId}`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Message deleted');

      // Verify deleted
      const getRes = await request(app).get(`/messages/${messageId}`).set(authHeader(token));
      expect(getRes.status).toBe(404);
    });

    it('should return 403 for non-author trying to delete', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const channel = await createChannelForTest(creatorToken);

      // Add other user to channel
      await request(app).post(`/channels/${channel.id}/join`).set(authHeader(otherToken));

      const createRes = await request(app)
        .post('/messages')
        .set(authHeader(creatorToken))
        .send({ channelId: channel.id, content: 'Protected' });
      const messageId = createRes.body.message.id;

      const res = await request(app).delete(`/messages/${messageId}`).set(authHeader(otherToken));

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Can only delete your own messages');
    });

    it('should return 404 for non-existent message', async () => {
      const { token } = await createTestUser();

      const res = await request(app).delete('/messages/non-existent').set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });
});
