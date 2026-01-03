import {
  findOrCreateDM,
  findDMById,
  findDMBetweenUsers,
  getUserDMs,
  isParticipant,
  createDMMessage,
  getDMMessages,
  findDMMessageById,
  updateDMMessage,
  deleteDMMessage,
  addParticipant,
  leaveGroupDM,
} from './dm';

describe('DM Model', () => {
  describe('findOrCreateDM', () => {
    it('should create a 1:1 DM between two users', async () => {
      const dm = await findOrCreateDM(['user1', 'user2'], 'user1');

      expect(dm.id).toBeDefined();
      expect(dm.type).toBe('dm');
      expect(dm.participantIds).toHaveLength(2);
      expect(dm.participantIds).toContain('user1');
      expect(dm.participantIds).toContain('user2');
      expect(dm.createdAt).toBeInstanceOf(Date);
      expect(dm.updatedAt).toBeInstanceOf(Date);
    });

    it('should add creator to participants if not included', async () => {
      const dm = await findOrCreateDM(['user3'], 'user4');

      expect(dm.participantIds).toContain('user3');
      expect(dm.participantIds).toContain('user4');
      expect(dm.participantIds).toHaveLength(2);
    });

    it('should return existing DM for same 1:1 participants', async () => {
      const dm1 = await findOrCreateDM(['user5', 'user6'], 'user5');
      const dm2 = await findOrCreateDM(['user6', 'user5'], 'user6');

      expect(dm1.id).toBe(dm2.id);
    });

    it('should create group DM for 3+ participants', async () => {
      const dm = await findOrCreateDM(['user7', 'user8', 'user9'], 'user7');

      expect(dm.type).toBe('group_dm');
      expect(dm.participantIds).toHaveLength(3);
    });

    it('should remove duplicate participants', async () => {
      const dm = await findOrCreateDM(['user10', 'user10', 'user11'], 'user10');

      expect(dm.participantIds).toHaveLength(2);
    });

    it('should throw error for fewer than 2 participants', async () => {
      await expect(findOrCreateDM(['user12'], 'user12'))
        .rejects.toThrow('DM requires at least 2 participants');
    });
  });

  describe('findDMById', () => {
    it('should find DM by id', async () => {
      const dm = await findOrCreateDM(['user20', 'user21'], 'user20');
      const found = await findDMById(dm.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(dm.id);
    });

    it('should return null for non-existent DM', async () => {
      const found = await findDMById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findDMBetweenUsers', () => {
    it('should find existing DM between two users', async () => {
      const dm = await findOrCreateDM(['user30', 'user31'], 'user30');
      const found = await findDMBetweenUsers(['user30', 'user31']);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(dm.id);
    });

    it('should return null for non-existent DM', async () => {
      const found = await findDMBetweenUsers(['user32', 'user33']);
      expect(found).toBeNull();
    });

    it('should return null for more or less than 2 users', async () => {
      const found = await findDMBetweenUsers(['user34']);
      expect(found).toBeNull();
    });
  });

  describe('getUserDMs', () => {
    it('should return all DMs for a user', async () => {
      await findOrCreateDM(['user40', 'user41'], 'user40');
      await findOrCreateDM(['user40', 'user42'], 'user40');

      const dms = await getUserDMs('user40');

      expect(dms.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for user with no DMs', async () => {
      const dms = await getUserDMs('user-with-no-dms');
      expect(dms).toEqual([]);
    });

    it('should sort DMs by most recent activity', async () => {
      const dm1 = await findOrCreateDM(['user43', 'user44'], 'user43');
      const dm2 = await findOrCreateDM(['user43', 'user45'], 'user43');

      // Send a message to dm1 to update its lastMessageAt
      await createDMMessage({ dmId: dm1.id, userId: 'user43', content: 'Hello' });

      const dms = await getUserDMs('user43');
      expect(dms[0].id).toBe(dm1.id);
    });
  });

  describe('isParticipant', () => {
    it('should return true for participant', async () => {
      const dm = await findOrCreateDM(['user50', 'user51'], 'user50');
      const result = await isParticipant(dm.id, 'user50');
      expect(result).toBe(true);
    });

    it('should return false for non-participant', async () => {
      const dm = await findOrCreateDM(['user52', 'user53'], 'user52');
      const result = await isParticipant(dm.id, 'user54');
      expect(result).toBe(false);
    });

    it('should return false for non-existent DM', async () => {
      const result = await isParticipant('non-existent', 'user55');
      expect(result).toBe(false);
    });
  });

  describe('DM Messages', () => {
    describe('createDMMessage', () => {
      it('should create a message in a DM', async () => {
        const dm = await findOrCreateDM(['user60', 'user61'], 'user60');
        const message = await createDMMessage({
          dmId: dm.id,
          userId: 'user60',
          content: 'Hello World',
        });

        expect(message.id).toBeDefined();
        expect(message.dmId).toBe(dm.id);
        expect(message.userId).toBe('user60');
        expect(message.content).toBe('Hello World');
        expect(message.type).toBe('text');
        expect(message.createdAt).toBeInstanceOf(Date);
      });

      it('should update DM lastMessageAt', async () => {
        const dm = await findOrCreateDM(['user62', 'user63'], 'user62');
        const beforeLastMessage = dm.lastMessageAt;

        await createDMMessage({
          dmId: dm.id,
          userId: 'user62',
          content: 'Test',
        });

        const updatedDM = await findDMById(dm.id);
        expect(updatedDM!.lastMessageAt).not.toEqual(beforeLastMessage);
      });

      it('should throw error for non-existent DM', async () => {
        await expect(createDMMessage({
          dmId: 'non-existent',
          userId: 'user64',
          content: 'Hello',
        })).rejects.toThrow('DM not found');
      });
    });

    describe('getDMMessages', () => {
      it('should return messages in a DM', async () => {
        const dm = await findOrCreateDM(['user70', 'user71'], 'user70');
        await createDMMessage({ dmId: dm.id, userId: 'user70', content: 'First' });
        await createDMMessage({ dmId: dm.id, userId: 'user71', content: 'Second' });

        const messages = await getDMMessages(dm.id);

        expect(messages.length).toBe(2);
      });

      it('should respect limit parameter', async () => {
        const dm = await findOrCreateDM(['user72', 'user73'], 'user72');
        for (let i = 0; i < 10; i++) {
          await createDMMessage({ dmId: dm.id, userId: 'user72', content: `Msg ${i}` });
        }

        const messages = await getDMMessages(dm.id, 5);

        expect(messages.length).toBe(5);
      });

      it('should return empty array for DM with no messages', async () => {
        const dm = await findOrCreateDM(['user74', 'user75'], 'user74');
        const messages = await getDMMessages(dm.id);
        expect(messages).toEqual([]);
      });
    });

    describe('findDMMessageById', () => {
      it('should find message by id', async () => {
        const dm = await findOrCreateDM(['user80', 'user81'], 'user80');
        const message = await createDMMessage({
          dmId: dm.id,
          userId: 'user80',
          content: 'Test',
        });

        const found = await findDMMessageById(message.id);

        expect(found).not.toBeNull();
        expect(found!.id).toBe(message.id);
      });

      it('should return null for non-existent message', async () => {
        const found = await findDMMessageById('non-existent');
        expect(found).toBeNull();
      });
    });

    describe('updateDMMessage', () => {
      it('should update message content', async () => {
        const dm = await findOrCreateDM(['user90', 'user91'], 'user90');
        const message = await createDMMessage({
          dmId: dm.id,
          userId: 'user90',
          content: 'Original',
        });

        const updated = await updateDMMessage(message.id, 'user90', 'Updated');

        expect(updated).not.toBeNull();
        expect(updated!.content).toBe('Updated');
        expect(updated!.editedAt).toBeInstanceOf(Date);
      });

      it('should throw error when non-author tries to edit', async () => {
        const dm = await findOrCreateDM(['user92', 'user93'], 'user92');
        const message = await createDMMessage({
          dmId: dm.id,
          userId: 'user92',
          content: 'Original',
        });

        await expect(updateDMMessage(message.id, 'user93', 'Hacked'))
          .rejects.toThrow('Permission denied');
      });

      it('should return null for non-existent message', async () => {
        const result = await updateDMMessage('non-existent', 'user94', 'Content');
        expect(result).toBeNull();
      });
    });

    describe('deleteDMMessage', () => {
      it('should delete message', async () => {
        const dm = await findOrCreateDM(['user100', 'user101'], 'user100');
        const message = await createDMMessage({
          dmId: dm.id,
          userId: 'user100',
          content: 'To be deleted',
        });

        const result = await deleteDMMessage(message.id, 'user100');

        expect(result).toBe(true);
        const found = await findDMMessageById(message.id);
        expect(found).toBeNull();
      });

      it('should throw error when non-author tries to delete', async () => {
        const dm = await findOrCreateDM(['user102', 'user103'], 'user102');
        const message = await createDMMessage({
          dmId: dm.id,
          userId: 'user102',
          content: 'Protected',
        });

        await expect(deleteDMMessage(message.id, 'user103'))
          .rejects.toThrow('Permission denied');
      });

      it('should return false for non-existent message', async () => {
        const result = await deleteDMMessage('non-existent', 'user104');
        expect(result).toBe(false);
      });
    });
  });

  describe('Group DM Operations', () => {
    describe('addParticipant', () => {
      it('should add participant to group DM', async () => {
        const dm = await findOrCreateDM(['user110', 'user111', 'user112'], 'user110');
        const updated = await addParticipant(dm.id, 'user113');

        expect(updated).not.toBeNull();
        expect(updated!.participantIds).toContain('user113');
        expect(updated!.participantIds).toHaveLength(4);
      });

      it('should throw error for 1:1 DM', async () => {
        const dm = await findOrCreateDM(['user114', 'user115'], 'user114');

        await expect(addParticipant(dm.id, 'user116'))
          .rejects.toThrow('Cannot add participants to 1:1 DM');
      });

      it('should throw error if user already a participant', async () => {
        const dm = await findOrCreateDM(['user117', 'user118', 'user119'], 'user117');

        await expect(addParticipant(dm.id, 'user117'))
          .rejects.toThrow('User is already a participant');
      });

      it('should return null for non-existent DM', async () => {
        const result = await addParticipant('non-existent', 'user120');
        expect(result).toBeNull();
      });
    });

    describe('leaveGroupDM', () => {
      it('should remove participant from group DM', async () => {
        const dm = await findOrCreateDM(['user130', 'user131', 'user132'], 'user130');
        const result = await leaveGroupDM(dm.id, 'user131');

        expect(result).toBe(true);

        const updated = await findDMById(dm.id);
        expect(updated!.participantIds).not.toContain('user131');
      });

      it('should throw error for 1:1 DM', async () => {
        const dm = await findOrCreateDM(['user133', 'user134'], 'user133');

        await expect(leaveGroupDM(dm.id, 'user133'))
          .rejects.toThrow('Cannot leave 1:1 DM');
      });

      it('should throw error if user not a participant', async () => {
        const dm = await findOrCreateDM(['user135', 'user136', 'user137'], 'user135');

        await expect(leaveGroupDM(dm.id, 'user138'))
          .rejects.toThrow('Not a participant');
      });

      it('should return false for non-existent DM', async () => {
        const result = await leaveGroupDM('non-existent', 'user139');
        expect(result).toBe(false);
      });
    });
  });
});
