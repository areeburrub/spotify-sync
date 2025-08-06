import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { refreshUserToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Get current session
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'No active session' },
        { status: 401 }
      )
    }
    
    // Refresh the user's token
    const refreshedUser = await refreshUserToken(session.userId)
    
    if (!refreshedUser) {
      return NextResponse.json(
        { error: 'Token refresh failed' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      tokenExpiresAt: refreshedUser.tokenExpiresAt,
    })
  } catch (error) {
    console.error('Token refresh failed:', error)
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    )
  }
}