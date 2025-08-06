import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { removeRoomMember, cleanupRoomData } from '@/lib/redis-room-sync'

export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await request.json()
    
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // Find room and user's membership
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          where: { isActive: true }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Find user's membership
    const membership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: roomId,
          userId: user.id
        }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 400 })
    }

    // Deactivate membership
    await prisma.roomMember.update({
      where: { id: membership.id },
      data: { isActive: false }
    })

    // Remove from Redis
    await removeRoomMember(room.code, user.id)

    // If user is the owner and there are other active members, transfer ownership
    if (room.ownerId === user.id) {
      const activeMembers = room.members.filter(m => m.userId !== user.id && m.isActive)
      
      if (activeMembers.length > 0) {
        // Transfer to the first active member
        const newOwner = activeMembers[0]
        await prisma.room.update({
          where: { id: roomId },
          data: { ownerId: newOwner.userId }
        })
        
        return NextResponse.json({ 
          success: true, 
          message: 'Left room and transferred ownership',
          newOwnerId: newOwner.userId 
        })
      } else {
        // No other members, deactivate the room
        await prisma.room.update({
          where: { id: roomId },
          data: { isActive: false }
        })
        
        // Clean up Redis data
        await cleanupRoomData(room.code)
        
        return NextResponse.json({ 
          success: true, 
          message: 'Left room and room was closed' 
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Left room successfully' 
    })

  } catch (error) {
    console.error('Failed to leave room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}