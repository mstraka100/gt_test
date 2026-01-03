import request from 'supertest';
import { createTestApp, createTestUser, authHeader } from '../setup';

const app = createTestApp();

describe('Channels Routes', () => {
  let testCounter = 0;
  const uniqueName = () => `test-channel-${Date.now()}-${++testCounter}`;

  describe('POST /channels', () => {
    it('should create a channel with valid input', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const res = await request(app)
        .post('/channels')
        .set(authHeader(token))
        .send({ name, description: 'Test channel' });

      expect(res.status).toBe(201);
      expect(res.body.channel).toMatchObject({
        name: name.toLowerCase(),
        description: 'Test channel',
        type: 'public',
      });
    });

    it('should create a private channel', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const res = await request(app)
        .post('/channels')
        .set(authHeader(token))
        .send({ name, type: 'private' });

      expect(res.status).toBe(201);
      expect(res.body.channel.type).toBe('private');
    });

    it('should return 400 for missing name', async () => {
      const { token } = await createTestUser();

      const res = await request(app).post('/channels').set(authHeader(token)).send({ description: 'No name' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Channel name is required');
    });

    it('should return 400 for name too short', async () => {
      const { token } = await createTestUser();

      const res = await request(app).post('/channels').set(authHeader(token)).send({ name: 'a' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Channel name must be 2-80 characters');
    });

    it('should return 400 for name too long', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/channels')
        .set(authHeader(token))
        .send({ name: 'a'.repeat(81) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Channel name must be 2-80 characters');
    });

    it('should return 400 for invalid type', async () => {
      const { token } = await createTestUser();

      const res = await request(app)
        .post('/channels')
        .set(authHeader(token))
        .send({ name: uniqueName(), type: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid channel type');
    });

    it('should return 409 for duplicate name', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      await request(app).post('/channels').set(authHeader(token)).send({ name });
      const res = await request(app).post('/channels').set(authHeader(token)).send({ name });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Channel name already exists');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).post('/channels').send({ name: uniqueName() });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /channels', () => {
    it('should list channels visible to user', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      await request(app).post('/channels').set(authHeader(token)).send({ name });

      const res = await request(app).get('/channels').set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.channels).toBeInstanceOf(Array);
      expect(res.body.channels.some((c: { name: string }) => c.name === name.toLowerCase())).toBe(true);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/channels');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /channels/:id', () => {
    it('should get channel by id', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).get(`/channels/${channelId}`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.channel.id).toBe(channelId);
    });

    it('should return 404 for non-existent channel', async () => {
      const { token } = await createTestUser();

      const res = await request(app).get('/channels/non-existent-id').set(authHeader(token));

      expect(res.status).toBe(404);
    });

    it('should return 403 for private channel non-member', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app)
        .post('/channels')
        .set(authHeader(creatorToken))
        .send({ name, type: 'private' });
      const channelId = createRes.body.channel.id;

      const res = await request(app).get(`/channels/${channelId}`).set(authHeader(otherToken));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /channels/name/:name', () => {
    it('should get channel by name', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      await request(app).post('/channels').set(authHeader(token)).send({ name });

      const res = await request(app).get(`/channels/name/${name}`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.channel.name).toBe(name.toLowerCase());
    });

    it('should return 404 for non-existent name', async () => {
      const { token } = await createTestUser();

      const res = await request(app).get('/channels/name/non-existent').set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /channels/:id', () => {
    it('should update channel description', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app)
        .patch(`/channels/${channelId}`)
        .set(authHeader(token))
        .send({ description: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.channel.description).toBe('Updated');
    });

    it('should update channel name', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();
      const newName = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).patch(`/channels/${channelId}`).set(authHeader(token)).send({ name: newName });

      expect(res.status).toBe(200);
      expect(res.body.channel.name).toBe(newName.toLowerCase());
    });

    it('should return 400 for empty update', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).patch(`/channels/${channelId}`).set(authHeader(token)).send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('No valid fields to update');
    });

    it('should return 403 for non-owner/admin', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(creatorToken)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app)
        .patch(`/channels/${channelId}`)
        .set(authHeader(otherToken))
        .send({ description: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /channels/:id', () => {
    it('should delete channel as owner', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).delete(`/channels/${channelId}`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Channel deleted');

      // Verify deleted
      const getRes = await request(app).get(`/channels/${channelId}`).set(authHeader(token));
      expect(getRes.status).toBe(404);
    });

    it('should return 403 for non-owner', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(creatorToken)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).delete(`/channels/${channelId}`).set(authHeader(otherToken));

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent channel', async () => {
      const { token } = await createTestUser();

      const res = await request(app).delete('/channels/non-existent').set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });

  describe('POST /channels/:id/join', () => {
    it('should join public channel', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: joinerToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(creatorToken)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).post(`/channels/${channelId}/join`).set(authHeader(joinerToken));

      expect(res.status).toBe(200);
      expect(res.body.member.role).toBe('member');
    });

    it('should return 403 for private channel', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: joinerToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app)
        .post('/channels')
        .set(authHeader(creatorToken))
        .send({ name, type: 'private' });
      const channelId = createRes.body.channel.id;

      const res = await request(app).post(`/channels/${channelId}/join`).set(authHeader(joinerToken));

      expect(res.status).toBe(403);
    });

    it('should return 409 if already member', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).post(`/channels/${channelId}/join`).set(authHeader(token));

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Already a member');
    });
  });

  describe('POST /channels/:id/leave', () => {
    it('should leave channel as member', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: memberToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(creatorToken)).send({ name });
      const channelId = createRes.body.channel.id;

      await request(app).post(`/channels/${channelId}/join`).set(authHeader(memberToken));

      const res = await request(app).post(`/channels/${channelId}/leave`).set(authHeader(memberToken));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Left channel');
    });

    it('should return 400 for owner trying to leave', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).post(`/channels/${channelId}/leave`).set(authHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Owner must transfer ownership before leaving');
    });

    it('should return 400 for non-member', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(creatorToken)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).post(`/channels/${channelId}/leave`).set(authHeader(otherToken));

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('User is not a member');
    });
  });

  describe('GET /channels/:id/members', () => {
    it('should list channel members', async () => {
      const { token, user } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).get(`/channels/${channelId}/members`).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].userId).toBe(user.id);
      expect(res.body.members[0].role).toBe('owner');
    });

    it('should return 403 for private channel non-member', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: otherToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app)
        .post('/channels')
        .set(authHeader(creatorToken))
        .send({ name, type: 'private' });
      const channelId = createRes.body.channel.id;

      const res = await request(app).get(`/channels/${channelId}/members`).set(authHeader(otherToken));

      expect(res.status).toBe(403);
    });
  });

  describe('POST /channels/:id/members', () => {
    it('should add member to channel', async () => {
      const { token: creatorToken } = await createTestUser();
      const { user: memberUser } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(creatorToken)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app)
        .post(`/channels/${channelId}/members`)
        .set(authHeader(creatorToken))
        .send({ userId: memberUser.id });

      expect(res.status).toBe(201);
      expect(res.body.member.userId).toBe(memberUser.id);
    });

    it('should return 400 for missing userId', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app).post(`/channels/${channelId}/members`).set(authHeader(token)).send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('userId is required');
    });

    it('should return 404 for non-existent user', async () => {
      const { token } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(token)).send({ name });
      const channelId = createRes.body.channel.id;

      const res = await request(app)
        .post(`/channels/${channelId}/members`)
        .set(authHeader(token))
        .send({ userId: 'non-existent' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });
  });

  describe('DELETE /channels/:id/members/:userId', () => {
    it('should remove member from channel', async () => {
      const { token: creatorToken } = await createTestUser();
      const { user: memberUser, token: memberToken } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(creatorToken)).send({ name });
      const channelId = createRes.body.channel.id;

      await request(app).post(`/channels/${channelId}/join`).set(authHeader(memberToken));

      const res = await request(app)
        .delete(`/channels/${channelId}/members/${memberUser.id}`)
        .set(authHeader(creatorToken));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Member removed');
    });

    it('should return 403 for non-admin trying to remove others', async () => {
      const { token: creatorToken } = await createTestUser();
      const { token: member1Token, user: member1User } = await createTestUser();
      const { token: member2Token, user: member2User } = await createTestUser();
      const name = uniqueName();

      const createRes = await request(app).post('/channels').set(authHeader(creatorToken)).send({ name });
      const channelId = createRes.body.channel.id;

      await request(app).post(`/channels/${channelId}/join`).set(authHeader(member1Token));
      await request(app).post(`/channels/${channelId}/join`).set(authHeader(member2Token));

      const res = await request(app)
        .delete(`/channels/${channelId}/members/${member2User.id}`)
        .set(authHeader(member1Token));

      expect(res.status).toBe(403);
    });
  });
});
