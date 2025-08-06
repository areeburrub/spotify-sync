import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await params

    // Get room details from database
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if user is a member
    const isMember = room.members.some(member => member.userId === user.id)
    const isOwner = room.ownerId === user.id

    if (!isMember && !isOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        owner: room.owner,
        isActive: room.isActive,
        createdAt: room.createdAt,
        memberCount: room.members.length
      },
      members: room.members.map(member => ({
        id: member.id,
        user: member.user,
        joinedAt: member.joinedAt,
        isOnline: true, // Simplified - assume all members are online
        lastSeen: new Date().toISOString()
      })),
      isOwner,
      isMember: true
    })

  } catch (error) {
    console.error('Failed to get room details:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}