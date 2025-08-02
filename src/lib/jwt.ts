import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  displayName: string;
  spotifyId: string;
  image?: string;
  exp?: number;
  iat?: number;
}

export function signJWT(payload: Omit<UserSession, 'exp' | 'iat'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyJWT(token: string): UserSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserSession;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}