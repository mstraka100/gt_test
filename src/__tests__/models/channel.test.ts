import {
  createChannel,
  findChannelById,
  findChannelByName,
  updateChannel,
  deleteChannel,
  listChannels,
  addMember,
  removeMember,
  getChannelMembers,
  isMember,
  joinPublicChannel,
} from '../../models/channel';

// Helper to generate unique names for each test
let testCounter = 0;
const uniqueName = (base: string) => `${base}-${Date.now()}-${++testCounter}`;

describe('Channel Model', () => {
  const creatorId = 'user-creator-1';
  const memberId = 'user-member-1';

  describe('createChannel', () => {
    it('should create a public channel with valid input', async () => {
      const name = uniqueName('general');
      const channel = await createChannel({ name, description: 'Test channel' }, creatorId);

      expect(channel).toMatchObject({
        name: name.toLowerCase(),
        description: 'Test channel',
        type: 'public',
        creatorId,
        memberIds: [creatorId],
      });
      expect(channel.id).toBeDefined();
      expect(channel.createdAt).toBeInstanceOf(Date);
      expect(channel.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a private channel when specified', async () => {
      const name = uniqueName('private-channel');
      const channel = await createChannel({ name, type: 'private' }, creatorId);

      expect(channel.type).toBe('private');
    });

    it('should normalize channel name (lowercase, replace spaces with dashes)', async () => {
      const name = uniqueName('My Test Channel');
      const channel = await createChannel({ name }, creatorId);

      expect(channel.name).toBe(name.toLowerCase().replace(/\s+/g, '-'));
    });

    it('should throw error for duplicate channel name', async () => {
      const name = uniqueName('duplicate-channel');
      await createChannel({ name }, creatorId);

      await expect(createChannel({ name }, creatorId)).rejects.toThrow('Channel name already exists');
    });

    it('should add creator as owner member', async () => {
      const name = uniqueName('owner-test');
      const channel = await createChannel({ name }, creatorId);
      const members = await getChannelMembers(channel.id);

      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        channelId: channel.id,
        userId: creatorId,
        role: 'owner',
      });
    });
  });

  describe('findChannelById', () => {
    it('should find existing channel by id', async () => {
      const name = uniqueName('find-by-id');
      const created = await createChannel({ name }, creatorId);
      const found = await findChannelById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null for non-existent id', async () => {
      const found = await findChannelById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findChannelByName', () => {
    it('should find existing channel by name', async () => {
      const name = uniqueName('find-by-name');
      const created = await createChannel({ name }, creatorId);
      const found = await findChannelByName(name);

      expect(found).toEqual(created);
    });

    it('should find channel with case-insensitive search', async () => {
      const name = uniqueName('case-test');
      const created = await createChannel({ name }, creatorId);
      const found = await findChannelByName(name.toUpperCase());

      expect(found).toEqual(created);
    });

    it('should return null for non-existent name', async () => {
      const found = await findChannelByName('non-existent-channel');
      expect(found).toBeNull();
    });
  });

  describe('updateChannel', () => {
    it('should update channel description', async () => {
      const name = uniqueName('update-desc');
      const channel = await createChannel({ name }, creatorId);
      const updated = await updateChannel(channel.id, { description: 'Updated description' }, creatorId);

      expect(updated?.description).toBe('Updated description');
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(channel.createdAt.getTime());
    });

    it('should update channel name', async () => {
      const name = uniqueName('update-name');
      const newName = uniqueName('new-name');
      const channel = await createChannel({ name }, creatorId);
      const updated = await updateChannel(channel.id, { name: newName }, creatorId);

      expect(updated?.name).toBe(newName.toLowerCase());
    });

    it('should throw error when updating to existing name', async () => {
      const name1 = uniqueName('existing-name');
      const name2 = uniqueName('channel-to-update');
      await createChannel({ name: name1 }, creatorId);
      const channel2 = await createChannel({ name: name2 }, creatorId);

      await expect(updateChannel(channel2.id, { name: name1 }, creatorId)).rejects.toThrow(
        'Channel name already exists'
      );
    });

    it('should throw error for non-owner/admin user', async () => {
      const name = uniqueName('permission-test');
      const channel = await createChannel({ name }, creatorId);

      await expect(updateChannel(channel.id, { description: 'Hacked' }, 'random-user')).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should return null for non-existent channel', async () => {
      const result = await updateChannel('non-existent-id', { description: 'Test' }, creatorId);
      expect(result).toBeNull();
    });
  });

  describe('deleteChannel', () => {
    it('should delete channel when owner', async () => {
      const name = uniqueName('to-delete');
      const channel = await createChannel({ name }, creatorId);
      const deleted = await deleteChannel(channel.id, creatorId);

      expect(deleted).toBe(true);
      expect(await findChannelById(channel.id)).toBeNull();
    });

    it('should throw error when non-owner tries to delete', async () => {
      const name = uniqueName('protected-channel');
      const channel = await createChannel({ name }, creatorId);

      await expect(deleteChannel(channel.id, 'other-user')).rejects.toThrow('Only channel owner can delete');
    });

    it('should return false for non-existent channel', async () => {
      const deleted = await deleteChannel('non-existent-id', creatorId);
      expect(deleted).toBe(false);
    });
  });

  describe('listChannels', () => {
    it('should list public channels for any user', async () => {
      const name = uniqueName('public-list');
      await createChannel({ name, type: 'public' }, creatorId);

      const channels = await listChannels('random-user');
      const found = channels.find((c) => c.name === name.toLowerCase());

      expect(found).toBeDefined();
    });

    it('should list private channels only for members', async () => {
      const name = uniqueName('private-list');
      await createChannel({ name, type: 'private' }, creatorId);

      const creatorChannels = await listChannels(creatorId);
      const otherChannels = await listChannels('random-user');

      expect(creatorChannels.find((c) => c.name === name.toLowerCase())).toBeDefined();
      expect(otherChannels.find((c) => c.name === name.toLowerCase())).toBeUndefined();
    });
  });

  describe('addMember', () => {
    it('should add member to public channel', async () => {
      const name = uniqueName('add-member-public');
      const channel = await createChannel({ name, type: 'public' }, creatorId);
      const member = await addMember(channel.id, memberId, creatorId);

      expect(member).toMatchObject({
        channelId: channel.id,
        userId: memberId,
        role: 'member',
      });
      expect(await isMember(channel.id, memberId)).toBe(true);
    });

    it('should add member with custom role', async () => {
      const name = uniqueName('add-admin');
      const channel = await createChannel({ name }, creatorId);
      const member = await addMember(channel.id, memberId, creatorId, 'admin');

      expect(member.role).toBe('admin');
    });

    it('should throw error when adding to non-existent channel', async () => {
      await expect(addMember('non-existent', memberId, creatorId)).rejects.toThrow('Channel not found');
    });

    it('should throw error when user already a member', async () => {
      const name = uniqueName('duplicate-member');
      const channel = await createChannel({ name }, creatorId);

      await expect(addMember(channel.id, creatorId, creatorId)).rejects.toThrow('User is already a member');
    });

    it('should throw error when non-member tries to add to private channel', async () => {
      const name = uniqueName('private-add');
      const channel = await createChannel({ name, type: 'private' }, creatorId);

      await expect(addMember(channel.id, 'new-user', 'outsider')).rejects.toThrow('Permission denied');
    });
  });

  describe('removeMember', () => {
    it('should allow member to remove themselves', async () => {
      const name = uniqueName('self-remove');
      const channel = await createChannel({ name }, creatorId);
      await addMember(channel.id, memberId, creatorId);

      const removed = await removeMember(channel.id, memberId, memberId);

      expect(removed).toBe(true);
      expect(await isMember(channel.id, memberId)).toBe(false);
    });

    it('should allow owner to remove members', async () => {
      const name = uniqueName('owner-removes');
      const channel = await createChannel({ name }, creatorId);
      await addMember(channel.id, memberId, creatorId);

      const removed = await removeMember(channel.id, memberId, creatorId);

      expect(removed).toBe(true);
    });

    it('should prevent owner from leaving without transfer', async () => {
      const name = uniqueName('owner-leave');
      const channel = await createChannel({ name }, creatorId);

      await expect(removeMember(channel.id, creatorId, creatorId)).rejects.toThrow(
        'Owner must transfer ownership before leaving'
      );
    });

    it('should prevent removing owner by admin', async () => {
      const name = uniqueName('remove-owner');
      const channel = await createChannel({ name }, creatorId);
      const adminId = 'admin-user';
      await addMember(channel.id, adminId, creatorId, 'admin');

      await expect(removeMember(channel.id, creatorId, adminId)).rejects.toThrow('Cannot remove channel owner');
    });

    it('should throw error when user is not a member', async () => {
      const name = uniqueName('not-member');
      const channel = await createChannel({ name }, creatorId);

      await expect(removeMember(channel.id, 'random-user', creatorId)).rejects.toThrow('User is not a member');
    });
  });

  describe('joinPublicChannel', () => {
    it('should allow joining public channel', async () => {
      const name = uniqueName('join-public');
      const channel = await createChannel({ name, type: 'public' }, creatorId);

      const member = await joinPublicChannel(channel.id, memberId);

      expect(member.role).toBe('member');
      expect(await isMember(channel.id, memberId)).toBe(true);
    });

    it('should prevent joining private channel', async () => {
      const name = uniqueName('join-private');
      const channel = await createChannel({ name, type: 'private' }, creatorId);

      await expect(joinPublicChannel(channel.id, memberId)).rejects.toThrow(
        'Cannot join private channel without invitation'
      );
    });

    it('should throw error when already a member', async () => {
      const name = uniqueName('already-joined');
      const channel = await createChannel({ name, type: 'public' }, creatorId);

      await expect(joinPublicChannel(channel.id, creatorId)).rejects.toThrow('Already a member');
    });
  });

  describe('getChannelMembers', () => {
    it('should return all channel members', async () => {
      const name = uniqueName('list-members');
      const channel = await createChannel({ name }, creatorId);
      await addMember(channel.id, memberId, creatorId);

      const members = await getChannelMembers(channel.id);

      expect(members).toHaveLength(2);
      expect(members.map((m) => m.userId)).toContain(creatorId);
      expect(members.map((m) => m.userId)).toContain(memberId);
    });

    it('should return empty array for non-existent channel', async () => {
      const members = await getChannelMembers('non-existent');
      expect(members).toEqual([]);
    });
  });

  describe('isMember', () => {
    it('should return true for members', async () => {
      const name = uniqueName('is-member');
      const channel = await createChannel({ name }, creatorId);

      expect(await isMember(channel.id, creatorId)).toBe(true);
    });

    it('should return false for non-members', async () => {
      const name = uniqueName('not-member');
      const channel = await createChannel({ name }, creatorId);

      expect(await isMember(channel.id, 'other-user')).toBe(false);
    });

    it('should return false for non-existent channel', async () => {
      expect(await isMember('non-existent', creatorId)).toBe(false);
    });
  });
});
