import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'default_secret_for_development';
const SALT_ROUNDS = 10000;

// Simple password hashing using PBKDF2
const hashPassword = (password: string): string => {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

// Verify password against hash
const verifyPassword = (password: string, hashedPassword: string): boolean => {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

// Simple JWT-like token creation
const createToken = (payload: { userId: number; email: string; role: string }): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadWithExp = { ...payload, exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) }; // 24h expiry
  const payloadEncoded = Buffer.from(JSON.stringify(payloadWithExp)).toString('base64url');
  
  const signature = createHash('sha256')
    .update(`${header}.${payloadEncoded}.${JWT_SECRET}`)
    .digest('base64url');
  
  return `${header}.${payloadEncoded}.${signature}`;
};

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const password_hash = hashPassword(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role || 'customer'
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};

export const loginUser = async (input: LoginInput): Promise<{ user: User; token: string }> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = verifyPassword(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = createToken({ 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    });

    return { user, token };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

export const getUserById = async (id: number): Promise<User | null> => {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Get user by ID failed:', error);
    throw error;
  }
};

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const users = await db.select()
      .from(usersTable)
      .execute();

    return users;
  } catch (error) {
    console.error('Get all users failed:', error);
    throw error;
  }
};