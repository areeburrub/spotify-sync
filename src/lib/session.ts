import { cookies } from 'next/headers'
import { PrismaClient } from '@/generated/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
const SESSION_COOKIE_NAME = 'spotify-session'
const SESSION_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

// Base64 URL encoding (without padding)
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Create JWT using Web Crypto API (edge runtime compatible)
async function createJWT(payload: object, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_DURATION
  }
  
  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(jwtPayload))
  
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', secretKey, data)
  const signatureB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)))
  
  return `${headerB64}.${payloadB64}.${signatureB64}`
}

// Verify JWT using Web Crypto API (edge runtime compatible)
export async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const [headerB64, payloadB64, signatureB64] = parts
    
    // Decode payload
    const payload = JSON.parse(atob(payloadB64))
    
    // Check if token is expired
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    
    // Create signature verification data
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const secretKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    // Decode the signature from base64url
    const signature = new Uint8Array(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => c.charCodeAt(0))
    )
    
    // Verify signature
    const isValid = await crypto.subtle.verify('HMAC', secretKey, signature, data)
    
    return isValid ? payload : null
  } catch (error) {
    return null
  }
}

const prisma = new PrismaClient()

export interface SessionData {
  userId: string
  spotifyId: string
  sessionId: string
}

// Create a new session for a user (without setting cookie)
export async function createSession(userId: string, spotifyId: string): Promise<{ sessionId: string; token: string }> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000)
  
  // Generate JWT token using Web Crypto API (edge runtime compatible)
  const token = await createJWT({ userId, spotifyId }, JWT_SECRET)
  
  // Store session in database
  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })
  
  return { sessionId: session.id, token }
}

// Set session cookie (for use in API routes)
export function setSessionCookie(token: string): { name: string; value: string; options: any } {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: SESSION_DURATION,
      path: '/',
    }
  }
}

// Verify and get session data from cookie
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    
    if (!token) return null
    
    // Verify JWT token using Web Crypto API (edge runtime compatible)
    const payload = await verifyJWT(token, JWT_SECRET)
    if (!payload) return null
    
    // Check if session exists in database
    const session = await prisma.session.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    })
    
    if (!session) return null
    
    return {
      userId: session.userId,
      spotifyId: session.user.spotifyId,
      sessionId: session.id,
    }
  } catch (error) {
    console.error('Session verification failed:', error)
    return null
  }
}

// Delete session and clear cookie
export async function deleteSession(): Promise<void> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    
    if (token) {
      // Remove from database
      await prisma.session.deleteMany({
        where: { token },
      })
    }
    
    // Clear cookie
    cookieStore.delete(SESSION_COOKIE_NAME)
  } catch (error) {
    console.error('Session deletion failed:', error)
  }
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  })
}