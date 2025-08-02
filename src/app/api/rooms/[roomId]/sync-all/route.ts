import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { getValidSpotifyToken } from '@/lib/spotify-token'

async function syncUserToTrack(accessToken: string, trackUri: string) {
  try {
    // Start playing the track from the beginning (position 0)
    const response = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        uris: [trackUri],
        position_ms: 0
      })
    })

    return { success: response.status === 204 || response.ok, status: response.status }
  } catch (error) {
    console.error('Error syncing user:', error)
    return { success: false, error: error }
  }
}

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
    const { currentTrack } = await request.json()

    if (!currentTrack) {
      return NextResponse.json({ error: 'Current track URI is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get room with all members
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if user is admin
    if (room.adminId !== user.id) {
      return NextResponse.json({ error: 'Only room admin can sync all members' }, { status: 403 })
    }

    // Get access tokens for all members (including admin)
    const memberSyncPromises = room.members.map(async (member) => {
      const accessToken = await getValidSpotifyToken(member.user.id)
      if (!accessToken) {
        return {
          userId: member.user.id,
          userName: member.user.name,
          success: false,
          error: 'Unable to get valid access token'
        }
      }

      const syncResult = await syncUserToTrack(accessToken, currentTrack)
      return {
        userId: member.user.id,
        userName: member.user.name,
        success: syncResult.success,
        status: syncResult.status,
        error: syncResult.error
      }
    })

    // Execute all sync operations in parallel
    const syncResults = await Promise.all(memberSyncPromises)

    // Update room with sync info
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        currentTrack,
        trackPosition: 0, // Always start from beginning
        isPlaying: true,
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

    const successCount = syncResults.filter(result => result.success).length
    const totalMembers = syncResults.length

    return NextResponse.json({
      room: updatedRoom,
      syncResults,
      summary: {
        totalMembers,
        successCount,
        failedCount: totalMembers - successCount
      }
    })

  } catch (error) {
    console.error('Error syncing all members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}