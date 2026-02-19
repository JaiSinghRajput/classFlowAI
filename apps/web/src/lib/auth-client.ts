const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthResponse {
  success: boolean;
  data?: {
    user?: User;
    userId?: string;
    token?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('auth_token', token);
  } catch {
    // Private browsing may throw
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('auth_token');
  } catch {
    // Private browsing may throw
  }
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json: AuthResponse = await response.json();

  if (!json.success || !json.data?.user || !json.data?.token) {
    throw new Error(json.error?.message || 'Login failed');
  }

  setToken(json.data.token);
  return json.data.user;
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  const json: AuthResponse = await response.json();

  if (!json.success || !json.data?.userId) {
    throw new Error(json.error?.message || 'Registration failed');
  }

  const user = await login(email, password);
  return user;
}

export function logout(): void {
  clearToken();
}
