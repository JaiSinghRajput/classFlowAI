import bcrypt from 'bcryptjs';
import { generateId } from '@classflowai/utils';

interface User {
  id: string;
  email: string;
  name: string;
}

// In-memory user store (to be replaced with MongoDB in Phase 7 extension)
const users = new Map<string, { id: string; email: string; passwordHash: string; name: string }>();

/**
 * Create a new user with hashed password
 */
export async function createUser(email: string, password: string, name: string): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 12);
  
  const user = {
    id: generateId('user'),
    email: email.toLowerCase(),
    passwordHash,
    name,
  };
  
  users.set(user.id, user);
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
  const user = Array.from(users.values()).find(u => u.email === email.toLowerCase());
  if (!user) return null;
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

/**
 * Validate user credentials
 */
export async function validateUserCredentials(email: string, password: string): Promise<User | null> {
  const user = Array.from(users.values()).find(u => u.email === email.toLowerCase());
  if (!user) return null;
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
  const user = users.get(id);
  if (!user) return null;
  
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
