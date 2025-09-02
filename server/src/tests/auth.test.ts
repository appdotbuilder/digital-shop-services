import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { createUser, loginUser, getUserById, getAllUsers } from '../handlers/auth';
import { eq } from 'drizzle-orm';
import { pbkdf2Sync } from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'default_secret_for_development';
const SALT_ROUNDS = 10000;

// Helper to verify password hash
const verifyPasswordHash = (password: string, hashedPassword: string): boolean => {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

// Helper to decode token payload
const decodeToken = (token: string): any => {
  const [header, payload, signature] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
};

// Test input data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'customer'
};

const testAdminInput: CreateUserInput = {
  email: 'admin@example.com',
  password: 'adminpass123',
  first_name: 'Admin',
  last_name: 'User',
  role: 'admin'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('Auth Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a new user with default role', async () => {
      const userInputWithoutRole: CreateUserInput = {
        email: 'noRole@example.com',
        password: 'password123',
        first_name: 'No',
        last_name: 'Role'
      };

      const result = await createUser(userInputWithoutRole);

      expect(result.email).toEqual('noRole@example.com');
      expect(result.first_name).toEqual('No');
      expect(result.last_name).toEqual('Role');
      expect(result.role).toEqual('customer');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.password_hash).toBeDefined();
      expect(result.password_hash).not.toEqual('password123');
    });

    it('should create a user with specified role', async () => {
      const result = await createUser(testAdminInput);

      expect(result.email).toEqual('admin@example.com');
      expect(result.role).toEqual('admin');
      expect(result.first_name).toEqual('Admin');
      expect(result.last_name).toEqual('User');
    });

    it('should hash the password correctly', async () => {
      const result = await createUser(testUserInput);

      // Verify password was hashed
      expect(result.password_hash).not.toEqual(testUserInput.password);
      expect(result.password_hash).toContain(':'); // Salt:Hash format
      
      // Verify hash can be compared with original password
      const isValidHash = verifyPasswordHash(testUserInput.password, result.password_hash);
      expect(isValidHash).toBe(true);

      // Verify wrong password fails
      const isInvalidHash = verifyPasswordHash('wrongpassword', result.password_hash);
      expect(isInvalidHash).toBe(false);
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].first_name).toEqual('John');
      expect(users[0].last_name).toEqual('Doe');
      expect(users[0].role).toEqual('customer');
      expect(users[0].is_active).toBe(true);
    });

    it('should prevent duplicate email registration', async () => {
      await createUser(testUserInput);

      await expect(createUser(testUserInput))
        .rejects.toThrow(/already exists/i);
    });
  });

  describe('loginUser', () => {
    it('should login with valid credentials', async () => {
      // Create user first
      await createUser(testUserInput);

      const result = await loginUser(testLoginInput);

      expect(result.user.email).toEqual('test@example.com');
      expect(result.user.first_name).toEqual('John');
      expect(result.user.last_name).toEqual('Doe');
      expect(result.user.role).toEqual('customer');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // JWT format
    });

    it('should generate valid token', async () => {
      await createUser(testUserInput);

      const result = await loginUser(testLoginInput);

      // Verify token format and payload
      const decoded = decodeToken(result.token);
      expect(decoded.userId).toEqual(result.user.id);
      expect(decoded.email).toEqual('test@example.com');
      expect(decoded.role).toEqual('customer');
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should reject login with invalid email', async () => {
      await createUser(testUserInput);

      const invalidEmailInput: LoginInput = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await expect(loginUser(invalidEmailInput))
        .rejects.toThrow(/invalid email or password/i);
    });

    it('should reject login with invalid password', async () => {
      await createUser(testUserInput);

      const invalidPasswordInput: LoginInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(loginUser(invalidPasswordInput))
        .rejects.toThrow(/invalid email or password/i);
    });

    it('should reject login for inactive user', async () => {
      // Create user first
      const user = await createUser(testUserInput);

      // Deactivate user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, user.id))
        .execute();

      await expect(loginUser(testLoginInput))
        .rejects.toThrow(/account is deactivated/i);
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const createdUser = await createUser(testUserInput);

      const result = await getUserById(createdUser.id);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdUser.id);
      expect(result!.email).toEqual('test@example.com');
      expect(result!.first_name).toEqual('John');
      expect(result!.last_name).toEqual('Doe');
      expect(result!.role).toEqual('customer');
    });

    it('should return null when user not found', async () => {
      const result = await getUserById(999);

      expect(result).toBeNull();
    });

    it('should return inactive user', async () => {
      const createdUser = await createUser(testUserInput);

      // Deactivate user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, createdUser.id))
        .execute();

      const result = await getUserById(createdUser.id);

      expect(result).toBeDefined();
      expect(result!.is_active).toBe(false);
    });
  });

  describe('getAllUsers', () => {
    it('should return empty array when no users exist', async () => {
      const result = await getAllUsers();

      expect(result).toEqual([]);
    });

    it('should return all users', async () => {
      await createUser(testUserInput);
      await createUser(testAdminInput);

      const result = await getAllUsers();

      expect(result).toHaveLength(2);
      
      const emails = result.map(user => user.email);
      expect(emails).toContain('test@example.com');
      expect(emails).toContain('admin@example.com');
      
      const roles = result.map(user => user.role);
      expect(roles).toContain('customer');
      expect(roles).toContain('admin');
    });

    it('should include inactive users', async () => {
      const user = await createUser(testUserInput);
      
      // Deactivate user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, user.id))
        .execute();

      const result = await getAllUsers();

      expect(result).toHaveLength(1);
      expect(result[0].is_active).toBe(false);
    });

    it('should return users with all required fields', async () => {
      await createUser(testUserInput);

      const result = await getAllUsers();

      const user = result[0];
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.password_hash).toBeDefined();
      expect(user.first_name).toBeDefined();
      expect(user.last_name).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.is_active).toBeDefined();
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });
});