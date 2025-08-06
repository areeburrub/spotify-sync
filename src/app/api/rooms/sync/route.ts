import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { getHostSyncData, storeHostSyncData } from '@/lib/redis-room-sync'
import { prisma } from '@/lib/prisma'

// GET - Get current sync data for members
export async function GET(request: NextRequest) {
  try {
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomCode = searchParams.get('code')

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 })
    }

    // Verify user is in the room
    const room = await prisma.room.findUnique({
      where: { code: roomCode },
      include: { members: true }
    })

    if (!room || !room.members.some(member => member.userId === user.id)) {
      return NextResponse.json({ error: 'Room not found or access denied' }, { status: 404 })
    }

    const hostData = await getHostSyncData(roomCode)
    if (!hostData) {
      return NextResponse.json({ error: 'No sync data available' }, { status: 404 })
    }

    return NextResponse.json(hostData)

  } catch (error) {
    console.error('Failed to get sync data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Store sync data (owner only)
export async function POST(request: NextRequest) {
  try {
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { roomCode, SH, isPlaying, RH = null } = body

    if (!roomCode || typeof SH !== 'number' || typeof isPlaying !== 'boolean') {
      return NextResponse.json({ error: 'Invalid sync data' }, { status: 400 })
    }

    // Verify user is room owner
    const room = await prisma.room.findUnique({
      where: { code: roomCode }
    })

    if (!room || room.ownerId !== user.id) {
      return NextResponse.json({ error: 'Only room owner can send sync data' }, { status: 403 })
    }

    await storeHostSyncData(roomCode, SH, isPlaying, RH)
    
    return NextResponse.json({ 
      success: true,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Failed to store sync data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}