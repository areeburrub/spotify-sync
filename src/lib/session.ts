import { cookies } from 'next/headers';
import { verifyJWT, UserSession } from './jwt';

export async function getSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      return null;
    }

    return verifyJWT(sessionCookie.value);
  } catch (error) {
    console.error('Session retrieval failed:', error);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}