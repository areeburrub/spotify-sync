import { Redis } from '@upstash/redis'

interface OAuthSession {
  codeVerifier: string
  state: string
  expiresAt: number
}

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const OAUTH_PREFIX = 'oauth:'
const OAUTH_TTL = 600 // 10 minutes in seconds

export async function storeOAuthSession(sessionId: string, codeVerifier: string, state: string): Promise<void> {
  try {
    const session: OAuthSession = {
      codeVerifier,
      state,
      expiresAt: Date.now() + OAUTH_TTL * 1000,
    }
    
    const key = `${OAUTH_PREFIX}${sessionId}`
    // Upstash Redis automatically serializes objects
    await redis.set(key, session, { ex: OAUTH_TTL })
    
    console.log('Stored OAuth session in Redis:', sessionId)
  } catch (error) {
    console.error('Failed to store OAuth session:', error)
    throw error
  }
}

export async function getOAuthSession(sessionId: string): Promise<{ codeVerifier: string; state: string } | null> {
  try {
    const key = `${OAUTH_PREFIX}${sessionId}`
    const sessionData = await redis.get<OAuthSession>(key)
    
    if (!sessionData) {
      console.log('OAuth session not found in Redis:', sessionId)
      return null
    }
    
    // Upstash Redis automatically deserializes JSON, so no need to parse
    const session = sessionData
    
    // Check if expired (double-check, though Redis TTL should handle this)
    if (session.expiresAt < Date.now()) {
      console.log('OAuth session expired:', sessionId)
      await redis.del(key)
      return null
    }
    
    console.log('Retrieved OAuth session from Redis:', sessionId)
    return {
      codeVerifier: session.codeVerifier,
      state: session.state,
    }
  } catch (error) {
    console.error('Failed to get OAuth session:', error)
    return null
  }
}

export async function removeOAuthSession(sessionId: string): Promise<void> {
  try {
    const key = `${OAUTH_PREFIX}${sessionId}`
    await redis.del(key)
    console.log('Removed OAuth session from Redis:', sessionId)
  } catch (error) {
    console.error('Failed to remove OAuth session:', error)
  }
}