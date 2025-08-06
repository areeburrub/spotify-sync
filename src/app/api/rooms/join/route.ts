import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await request.json()
    
    if (!code || code.toString().length !== 6) {
      return NextResponse.json({ error: 'Invalid room code' }, { status: 400 })
    }

    // Find room by code
    const room = await prisma.room.findUnique({
      where: { 
        code: code.toString(),
        isActive: true 
      },
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
      return NextResponse.json({ error: 'Room not found or inactive' }, { status: 404 })
    }

    // Check if user is already a member
    const existingMember = room.members.find(member => member.userId === user.id)
    
    if (!existingMember) {
      // Add user as room member
      await prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.id,
          isActive: true
        }
      })
    } else if (!existingMember.isActive) {
      // Reactivate existing member
      await prisma.roomMember.update({
        where: { id: existingMember.id },
        data: { isActive: true }
      })
    }

    // No Redis member tracking needed - simplified approach
    
    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        owner: room.owner,
        isActive: room.isActive,
        createdAt: room.createdAt,
        memberCount: room.members.filter(m => m.isActive).length + (existingMember ? 0 : 1)
      },
      isOwner: room.ownerId === user.id
    })

  } catch (error) {
    console.error('Failed to join room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}