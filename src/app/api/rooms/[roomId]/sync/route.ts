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
    const { currentTrack, trackPosition, isPlaying } = await request.json()

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          where: { userId: user.id }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    if (room.members.length === 0) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
    }

    if (room.adminId !== user.id) {
      return NextResponse.json({ error: 'Only room admin can sync playback' }, { status: 403 })
    }

    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        currentTrack,
        trackPosition,
        isPlaying,
        lastSync: new Date()
      },
      include: {
        admin: true,
        members: {
          include: {
            user: true
          }
        }
      }
    })

    return NextResponse.json(updatedRoom)
  } catch (error) {
    console.error('Error syncing room:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
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
      where: { id: roomId },
      include: {
        admin: true,
        members: {
          where: { userId: user.id }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    if (room.members.length === 0) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 })
    }

    return NextResponse.json({
      currentTrack: room.currentTrack,
      trackPosition: room.trackPosition,
      isPlaying: room.isPlaying,
      lastSync: room.lastSync
    })
  } catch (error) {
    console.error('Error getting room sync state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}