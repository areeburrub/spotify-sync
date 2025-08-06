import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'
import { 
  getRoomSyncData, 
  updateRoomPlayback, 
  storeRoomSyncData,
  getMemberLatency,
  storeMemberLatency,
  calculateSyncedPosition,
  createLatencyPing,
  calculateLatency
} from '@/lib/redis-room-sync'

// GET - Get current room sync data
export async function GET(request: NextRequest) {
  try {
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomCode = searchParams.get('code')
    const action = searchParams.get('action')

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 })
    }

    // Handle ping for latency measurement
    if (action === 'ping') {
      return NextResponse.json({ 
        timestamp: createLatencyPing(),
        serverTime: Date.now()
      })
    }

    const syncData = await getRoomSyncData(roomCode)
    if (!syncData) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get user's latency for position calculation
    const userLatency = await getMemberLatency(roomCode, user.id)
    
    // Calculate synced position based on latency
    const syncedPosition = calculateSyncedPosition(
      syncData.playbackState.position,
      syncData.playbackState.timestamp,
      syncData.playbackState.isPlaying,
      userLatency
    )

    return NextResponse.json({
      ...syncData,
      syncedPosition,
      userLatency
    })

  } catch (error) {
    console.error('Failed to get room sync data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Update room sync data (owner only) or report latency
export async function POST(request: NextRequest) {
  try {
    const user = await verifySession(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { roomCode, action } = body

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 })
    }

    // Handle latency reporting
    if (action === 'reportLatency') {
      const { pingTimestamp } = body
      if (typeof pingTimestamp !== 'number') {
        return NextResponse.json({ error: 'Invalid ping timestamp' }, { status: 400 })
      }

      const latency = calculateLatency(pingTimestamp)
      await storeMemberLatency(roomCode, user.id, latency)
      
      return NextResponse.json({ 
        latency,
        timestamp: Date.now()
      })
    }

    // Get current room data to verify ownership for playback updates
    const currentSyncData = await getRoomSyncData(roomCode)
    if (!currentSyncData) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Only room owner can update playback state
    if (currentSyncData.ownerId !== user.id) {
      return NextResponse.json({ error: 'Only room owner can control playback' }, { status: 403 })
    }

    // Handle different sync actions
    switch (action) {
      case 'updatePlayback': {
        const { position, isPlaying, timestamp } = body
        
        if (typeof position !== 'number' || typeof isPlaying !== 'boolean') {
          return NextResponse.json({ error: 'Invalid playback data' }, { status: 400 })
        }

        await updateRoomPlayback(roomCode, position, isPlaying, timestamp)
        
        return NextResponse.json({ 
          success: true,
          timestamp: Date.now()
        })
      }

      case 'updateTrack': {
        const { track } = body
        
        if (!track || !track.uri) {
          return NextResponse.json({ error: 'Invalid track data' }, { status: 400 })
        }

        const updatedSyncData = {
          ...currentSyncData,
          currentTrack: {
            uri: track.uri,
            id: track.id || '',
            name: track.name || '',
            artist: track.artists?.[0]?.name || '',
            duration: track.duration_ms || 0
          },
          playbackState: {
            ...currentSyncData.playbackState,
            position: 0,
            timestamp: Date.now()
          },
          lastUpdated: Date.now()
        }

        await storeRoomSyncData(roomCode, updatedSyncData)
        
        return NextResponse.json({ 
          success: true,
          syncData: updatedSyncData
        })
      }

      case 'updateVolume': {
        const { volume } = body
        
        if (typeof volume !== 'number' || volume < 0 || volume > 1) {
          return NextResponse.json({ error: 'Invalid volume level' }, { status: 400 })
        }

        const updatedSyncData = {
          ...currentSyncData,
          playbackState: {
            ...currentSyncData.playbackState,
            volume
          },
          lastUpdated: Date.now()
        }

        await storeRoomSyncData(roomCode, updatedSyncData)
        
        return NextResponse.json({ 
          success: true,
          volume
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Failed to update room sync data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}