import {
  createUser,
  findUserById,
  findUserByEmail,
  findUserByUsername,
  verifyPassword,
  updateUser,
  listUsers,
  storeRefreshToken,
  getRefreshTokenUserId,
  revokeRefreshToken,
  sanitizeUser,
  clearAllData,
} from '../models/user';
import { CreateUserInput } from '../types';

describe('User Model', () => {
  const validInput: CreateUserInput = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    displayName: 'Test User',
  };

  beforeEach(() => {
    clearAllData();
  });

  describe('createUser', () => {
    it('should create a user with valid input', async () => {
      const user = await createUser(validInput);

      expect(user).toHaveProperty('id');
      expect(user.email).toBe(validInput.email.toLowerCase());
      expect(user.username).toBe(validInput.username.toLowerCase());
      expect(user.displayName).toBe(validInput.displayName);
      expect(user.passwordHash).not.toBe(validInput.password);
      expect(user.status).toBe('offline');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should hash the password', async () => {
      const user = await createUser(validInput);

      expect(user.passwordHash).not.toBe(validInput.password);
      expect(user.passwordHash.startsWith('$2')).toBe(true); // bcrypt prefix
    });

    it('should normalize email to lowercase', async () => {
      const user = await createUser({
        ...validInput,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(user.email).toBe('test@example.com');
    });

    it('should normalize username to lowercase', async () => {
      const user = await createUser({
        ...validInput,
        username: 'TestUser123',
      });

      expect(user.username).toBe('testuser123');
    });

    it('should reject duplicate email', async () => {
      await createUser(validInput);

      await expect(
        createUser({
          ...validInput,
          username: 'different',
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should reject duplicate username', async () => {
      await createUser(validInput);

      await expect(
        createUser({
          ...validInput,
          email: 'different@example.com',
        })
      ).rejects.toThrow('Username already taken');
    });

    it('should generate unique IDs', async () => {
      const user1 = await createUser(validInput);
      const user2 = await createUser({
        ...validInput,
        email: 'other@example.com',
        username: 'other',
      });

      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe('findUserById', () => {
    it('should find existing user', async () => {
      const created = await createUser(validInput);
      const found = await findUserById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe(created.email);
    });

    it('should return null for non-existent user', async () => {
      const found = await findUserById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should find user by email', async () => {
      const created = await createUser(validInput);
      const found = await findUserByEmail(validInput.email);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should be case-insensitive', async () => {
      await createUser(validInput);
      const found = await findUserByEmail('TEST@EXAMPLE.COM');

      expect(found).not.toBeNull();
      expect(found?.email).toBe(validInput.email);
    });

    it('should return null for non-existent email', async () => {
      const found = await findUserByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });
  });

  describe('findUserByUsername', () => {
    it('should find user by username', async () => {
      const created = await createUser(validInput);
      const found = await findUserByUsername(validInput.username);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('should be case-insensitive', async () => {
      await createUser(validInput);
      const found = await findUserByUsername('TESTUSER');

      expect(found).not.toBeNull();
      expect(found?.username).toBe(validInput.username);
    });

    it('should return null for non-existent username', async () => {
      const found = await findUserByUsername('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const user = await createUser(validInput);
      const isValid = await verifyPassword(user, validInput.password);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const user = await createUser(validInput);
      const isValid = await verifyPassword(user, 'wrongpassword');

      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      const user = await createUser(validInput);
      const isValid = await verifyPassword(user, '');

      expect(isValid).toBe(false);
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const user = await createUser(validInput);
      const updated = await updateUser(user.id, {
        displayName: 'New Name',
        status: 'active',
      });

      expect(updated).not.toBeNull();
      expect(updated?.displayName).toBe('New Name');
      expect(updated?.status).toBe('active');
    });

    it('should update updatedAt timestamp', async () => {
      const user = await createUser(validInput);
      const originalUpdatedAt = user.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await updateUser(user.id, { displayName: 'New Name' });

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should return null for non-existent user', async () => {
      const updated = await updateUser('non-existent', { displayName: 'New Name' });
      expect(updated).toBeNull();
    });

    it('should preserve unchanged fields', async () => {
      const user = await createUser(validInput);
      const updated = await updateUser(user.id, { status: 'away' });

      expect(updated?.displayName).toBe(validInput.displayName);
      expect(updated?.email).toBe(validInput.email);
    });
  });

  describe('listUsers', () => {
    it('should list all users', async () => {
      await createUser(validInput);
      await createUser({
        ...validInput,
        email: 'other@example.com',
        username: 'other',
      });

      const users = await listUsers();

      expect(users).toHaveLength(2);
    });

    it('should return empty array when no users', async () => {
      const users = await listUsers();
      expect(users).toHaveLength(0);
    });
  });

  describe('Refresh Token Management', () => {
    describe('storeRefreshToken', () => {
      it('should store refresh token', () => {
        const token = 'test-refresh-token';
        const userId = 'user-123';

        storeRefreshToken(token, userId);
        const storedUserId = getRefreshTokenUserId(token);

        expect(storedUserId).toBe(userId);
      });
    });

    describe('getRefreshTokenUserId', () => {
      it('should return userId for valid token', () => {
        const token = 'valid-token';
        const userId = 'user-456';

        storeRefreshToken(token, userId);
        const result = getRefreshTokenUserId(token);

        expect(result).toBe(userId);
      });

      it('should return null for unknown token', () => {
        const result = getRefreshTokenUserId('unknown-token');
        expect(result).toBeNull();
      });
    });

    describe('revokeRefreshToken', () => {
      it('should revoke existing token', () => {
        const token = 'to-revoke';
        storeRefreshToken(token, 'user-789');

        const result = revokeRefreshToken(token);

        expect(result).toBe(true);
        expect(getRefreshTokenUserId(token)).toBeNull();
      });

      it('should return false for non-existent token', () => {
        const result = revokeRefreshToken('non-existent');
        expect(result).toBe(false);
      });
    });
  });

  describe('sanitizeUser', () => {
    it('should remove passwordHash from user object', async () => {
      const user = await createUser(validInput);
      const sanitized = sanitizeUser(user);

      expect(sanitized).not.toHaveProperty('passwordHash');
      expect(sanitized.id).toBe(user.id);
      expect(sanitized.email).toBe(user.email);
      expect(sanitized.displayName).toBe(user.displayName);
    });

    it('should preserve all other fields', async () => {
      const user = await createUser(validInput);
      const sanitized = sanitizeUser(user);

      expect(sanitized.id).toBe(user.id);
      expect(sanitized.email).toBe(user.email);
      expect(sanitized.username).toBe(user.username);
      expect(sanitized.displayName).toBe(user.displayName);
      expect(sanitized.status).toBe(user.status);
      expect(sanitized.createdAt).toEqual(user.createdAt);
      expect(sanitized.updatedAt).toEqual(user.updatedAt);
    });
  });
});
