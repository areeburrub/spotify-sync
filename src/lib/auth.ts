import { NextRequest } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { 
  exchangeCodeForTokens, 
  getSpotifyUser, 
  refreshAccessToken,
  encryptToken,
  decryptToken,
  SpotifyTokenResponse 
} from './spotify'
import { createSession, getSession, verifyJWT } from './session'

const prisma = new PrismaClient()

export interface AuthUser {
  id: string
  spotifyId: string
  email: string
  displayName: string | null
  images: any
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date
}

// Authenticate user with Spotify OAuth code
export async function authenticateWithSpotify(
  code: string,
  codeVerifier: string
): Promise<{ user: AuthUser; sessionId: string; token: string }> {
  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier)
    
    // Get user profile from Spotify
    const spotifyUser = await getSpotifyUser(tokens.access_token)
    
    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    
    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { spotifyId: spotifyUser.id },
    })
    
    if (user) {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: spotifyUser.email,
          displayName: spotifyUser.display_name,
          images: spotifyUser.images,
          accessToken: encryptToken(tokens.access_token),
          refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : user.refreshToken,
          tokenExpiresAt,
        },
      })
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          spotifyId: spotifyUser.id,
          email: spotifyUser.email,
          displayName: spotifyUser.display_name,
          images: spotifyUser.images,
          accessToken: encryptToken(tokens.access_token),
          refreshToken: encryptToken(tokens.refresh_token!),
          tokenExpiresAt,
        },
      })
    }
    
    // Create session
    const session = await createSession(user.id, user.spotifyId)
    
    return {
      user: {
        id: user.id,
        spotifyId: user.spotifyId,
        email: user.email,
        displayName: user.displayName,
        images: user.images,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token!,
        tokenExpiresAt,
      },
      sessionId: session.sessionId,
      token: session.token,
    }
  } catch (error) {
    console.error('Authentication failed:', error)
    throw new Error('Authentication failed')
  }
}

// Get authenticated user
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const session = await getSession()
  if (!session) return null
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    })
    
    if (!user) return null
    
    // Check if token needs refresh
    const now = new Date()
    if (user.tokenExpiresAt <= now) {
      // Token expired, try to refresh
      const refreshedUser = await refreshUserToken(user.id)
      return refreshedUser
    }
    
    return {
      id: user.id,
      spotifyId: user.spotifyId,
      email: user.email,
      displayName: user.displayName,
      images: user.images,
      accessToken: decryptToken(user.accessToken),
      refreshToken: decryptToken(user.refreshToken),
      tokenExpiresAt: user.tokenExpiresAt,
    }
  } catch (error) {
    console.error('Failed to get authenticated user:', error)
    return null
  }
}

/**
 * Verify session from NextRequest and return user data
 */
export async function verifySession(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Get session token from cookie
    const token = request.cookies.get('spotify-session')?.value
    if (!token) return null

    // Verify JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
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

    // Check if token needs refresh
    const now = new Date()
    if (session.user.tokenExpiresAt <= now) {
      // Token expired, try to refresh
      const refreshedUser = await refreshUserToken(session.user.id)
      return refreshedUser
    }

    return {
      id: session.user.id,
      spotifyId: session.user.spotifyId,
      email: session.user.email,
      displayName: session.user.displayName,
      images: session.user.images,
      accessToken: decryptToken(session.user.accessToken),
      refreshToken: decryptToken(session.user.refreshToken),
      tokenExpiresAt: session.user.tokenExpiresAt,
    }
  } catch (error) {
    console.error('Session verification failed:', error)
    return null
  }
}

// Refresh user's access token
export async function refreshUserToken(userId: string): Promise<AuthUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })
    
    if (!user) return null
    
    const refreshToken = decryptToken(user.refreshToken)
    const tokens = await refreshAccessToken(refreshToken)
    
    // Calculate new expiration
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    
    // Update user with new tokens
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : user.refreshToken,
        tokenExpiresAt,
      },
    })
    
    return {
      id: updatedUser.id,
      spotifyId: updatedUser.spotifyId,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      images: updatedUser.images,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken,
      tokenExpiresAt,
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
    return null
  }
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const user = await getAuthenticatedUser()
  return user !== null
}

// Require authentication (throws if not authenticated)
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}