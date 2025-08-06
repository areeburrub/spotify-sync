import { NextRequest, NextResponse } from 'next/server'
import { generatePKCE, getAuthorizationUrl } from '@/lib/spotify'
import { storeOAuthSession } from '@/lib/redis-oauth-store'
import { getSession } from '@/lib/session'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    // Check if user is already authenticated
    const existingSession = await getSession()
    if (existingSession) {
      console.log('User already authenticated, redirecting to dashboard')
      return NextResponse.redirect(new URL('/app', request.url))
    }
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = generatePKCE()
    
    // Generate a unique session ID for this OAuth attempt
    const sessionId = crypto.randomBytes(16).toString('hex')
    
    // Generate state for CSRF protection with embedded session ID
    const baseState = crypto.randomBytes(32).toString('hex')
    const state = `${baseState}.${sessionId}` // Embed session ID in state
    
    // Store OAuth session data server-side
    await storeOAuthSession(sessionId, codeVerifier, baseState)
    
    // Generate authorization URL
    const authUrl = getAuthorizationUrl(codeChallenge, state)
    
    console.log('Storing OAuth session:', { sessionId, codeVerifier: codeVerifier.substring(0, 20) + '...', state: state.substring(0, 20) + '...' })
    
    console.log('Session stored, redirecting to:', authUrl)
    
    // Create response with redirect
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Login initiation failed:', error)
    return NextResponse.json(
      { error: 'Failed to initiate login' },
      { status: 500 }
    )
  }
}