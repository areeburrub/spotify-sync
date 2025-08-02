import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await params

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const room = await prisma.room.findUnique({
      where: { 
        id: roomId,
        isActive: true 
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const existingMembership = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: roomId,
          userId: user.id
        }
      }
    })

    if (existingMembership) {
      return NextResponse.json({ error: 'Already a member of this room' }, { status: 400 })
    }

    const roomMember = await prisma.roomMember.create({
      data: {
        roomId: roomId,
        userId: user.id
      },
      include: {
        user: true,
        room: {
          include: {
            admin: true,
            members: {
              include: {
                user: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(roomMember)
  } catch (error) {
    console.error('Error joining room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}