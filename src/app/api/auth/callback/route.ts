import { NextRequest, NextResponse } from 'next/server'
import { authenticateWithSpotify } from '@/lib/auth'
import { getOAuthSession, removeOAuthSession } from '@/lib/redis-oauth-store'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, state } = body

    console.log('Received code:', code.substring(0, 20) + '...')
    console.log('Received state:', state.substring(0, 20) + '...')
    
    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }
    
    // Extract session ID from state parameter
    const stateParts = state.split('.')
    if (stateParts.length !== 2) {
      return NextResponse.json(
        { error: 'Invalid state format' },
        { status: 400 }
      )
    }
    
    const [baseState, sessionId] = stateParts
    console.log('Extracted session ID from state:', sessionId)
    console.log('Base state for verification:', baseState.substring(0, 20) + '...')
    
    // Get stored OAuth session data
    const oauthSession = await getOAuthSession(sessionId)
    
    if (!oauthSession) {
      return NextResponse.json(
        { error: 'OAuth session expired or not found' },
        { status: 400 }
      )
    }
    
    // Verify state to prevent CSRF attacks
    if (baseState !== oauthSession.state) {
      await removeOAuthSession(sessionId)
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      )
    }
    
    // Clean up OAuth session
    await removeOAuthSession(sessionId)
    
    // Authenticate with Spotify
    const result = await authenticateWithSpotify(code, oauthSession.codeVerifier)
    
    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        spotifyId: result.user.spotifyId,
        email: result.user.email,
        displayName: result.user.displayName,
      },
    })
    
    // Set session cookie using the token from the authentication result
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/',
    }
    
    console.log('Callback - Setting cookie with options:', cookieOptions)
    console.log('Callback - Token (first 20 chars):', result.token.substring(0, 20))
    console.log('Callback - NODE_ENV:', process.env.NODE_ENV)
    
    response.cookies.set('spotify-session', result.token, cookieOptions)
    
    return response
  } catch (error) {
    console.error('Callback processing failed:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}