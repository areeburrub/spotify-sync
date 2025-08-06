import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'

// GET - Simple ping endpoint for latency measurement
export async function GET(request: NextRequest) {
  try {
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ 
      pong: true,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Ping failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}