import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { generateRoomCode, storeRoomSyncData, addRoomMember } from '@/lib/redis-room-sync'

export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name } = await request.json()
    
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
    }

    // Generate unique room code
    let roomCode: string
    let attempts = 0
    const maxAttempts = 10

    do {
      roomCode = generateRoomCode()
      attempts++
      
      if (attempts > maxAttempts) {
        return NextResponse.json({ error: 'Failed to generate unique room code' }, { status: 500 })
      }
      
      // Check if code already exists in database
      const existingRoom = await prisma.room.findUnique({
        where: { code: roomCode }
      })
      
      if (!existingRoom) break
    } while (true)

    // Create room in database
    const room = await prisma.room.create({
      data: {
        code: roomCode,
        name: name.trim(),
        ownerId: user.id,
        isActive: true
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        }
      }
    })

    // Add owner as first member
    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: user.id,
        isActive: true
      }
    })

    // Initialize room sync data in Redis
    await storeRoomSyncData(roomCode, {
      roomCode,
      ownerId: user.id,
      playbackState: {
        isPlaying: false,
        position: 0,
        timestamp: Date.now(),
        volume: 0.5
      },
      lastUpdated: Date.now()
    })

    // Add owner to Redis members
    await addRoomMember(roomCode, user.id, user.displayName || user.email)

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        owner: room.owner,
        isActive: room.isActive,
        createdAt: room.createdAt
      }
    })

  } catch (error) {
    console.error('Failed to create room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}