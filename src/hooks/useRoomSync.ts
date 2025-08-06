import { useState, useEffect, useCallback, useRef } from 'react'
import { useLatencySync } from './useLatencySync'

interface Track {
  uri: string
  id: string
  name: string
  artist: string
  duration: number
}

interface PlaybackState {
  isPlaying: boolean
  position: number
  timestamp: number
  volume: number
}

interface RoomSyncData {
  roomCode: string
  ownerId: string
  currentTrack?: Track
  playbackState: PlaybackState
  lastUpdated: number
  syncedPosition?: number
  userLatency?: number
}

interface RoomSyncHookProps {
  roomCode: string | null
  isOwner: boolean
  player: any | null
}

const SYNC_INTERVAL = 1000 // 1 second
const POSITION_TOLERANCE = 2000 // 2 seconds tolerance for sync

export function useRoomSync({ roomCode, isOwner, player }: RoomSyncHookProps) {
  const [syncData, setSyncData] = useState<RoomSyncData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<number>(0)
  const [syncErrors, setSyncErrors] = useState<string[]>([])
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastKnownPositionRef = useRef<number>(0)
  const isSyncingRef = useRef<boolean>(false)
  
  // Use latency monitoring
  const latencySync = useLatencySync(roomCode)

  // Fetch current sync data from server
  const fetchSyncData = useCallback(async (): Promise<RoomSyncData | null> => {
    if (!roomCode) return null

    try {
      const response = await fetch(`/api/rooms/sync?code=${roomCode}`)
      if (!response.ok) {
        throw new Error('Failed to fetch sync data')
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to fetch sync data:', error)
      setSyncErrors(prev => [...prev.slice(-4), `Fetch error: ${error}`])
      return null
    }
  }, [roomCode])

  // Update server with current playback state (owner only)
  const updateServerPlayback = useCallback(async (
    position: number, 
    isPlaying: boolean, 
    timestamp?: number
  ) => {
    if (!roomCode || !isOwner) return

    try {
      await fetch('/api/rooms/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode,
          action: 'updatePlayback',
          position,
          isPlaying,
          timestamp: timestamp || Date.now()
        }),
      })
    } catch (error) {
      console.error('Failed to update server playback:', error)
      setSyncErrors(prev => [...prev.slice(-4), `Update error: ${error}`])
    }
  }, [roomCode, isOwner])

  // Update server with current track (owner only)
  const updateServerTrack = useCallback(async (track: any) => {
    if (!roomCode || !isOwner) return

    try {
      await fetch('/api/rooms/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode,
          action: 'updateTrack',
          track
        }),
      })
    } catch (error) {
      console.error('Failed to update server track:', error)
      setSyncErrors(prev => [...prev.slice(-4), `Track update error: ${error}`])
    }
  }, [roomCode, isOwner])

  // Sync member's playback to owner's state
  const syncToOwner = useCallback(async (targetData: RoomSyncData) => {
    if (!player || isOwner || isSyncingRef.current) return

    isSyncingRef.current = true
    
    try {
      const currentState = await player.getCurrentState()
      if (!currentState) {
        isSyncingRef.current = false
        return
      }

      const { syncedPosition = 0 } = targetData
      const currentPosition = currentState.position
      const positionDiff = Math.abs(currentPosition - syncedPosition)
      
      // Only sync if difference is significant
      if (positionDiff > POSITION_TOLERANCE) {
        console.log(`Syncing position: ${currentPosition} -> ${syncedPosition} (diff: ${positionDiff}ms)`)
        await player.seek(syncedPosition)
      }

      // Sync play/pause state
      if (currentState.paused !== !targetData.playbackState.isPlaying) {
        if (targetData.playbackState.isPlaying && currentState.paused) {
          await player.resume()
        } else if (!targetData.playbackState.isPlaying && !currentState.paused) {
          await player.pause()
        }
      }

      // Sync track if different
      if (targetData.currentTrack && 
          currentState.track_window.current_track.uri !== targetData.currentTrack.uri) {
        // Note: We can't directly change tracks through Web Playback SDK
        // This would need to be handled through Web API
        console.log('Track change detected, but cannot change tracks via Web Playback SDK')
      }

      setLastSyncTime(Date.now())
      
    } catch (error) {
      console.error('Failed to sync to owner:', error)
      setSyncErrors(prev => [...prev.slice(-4), `Sync error: ${error}`])
    } finally {
      isSyncingRef.current = false
    }
  }, [player, isOwner])

  // Broadcast owner's state to server
  const broadcastOwnerState = useCallback(async () => {
    if (!player || !isOwner) return

    try {
      const state = await player.getCurrentState()
      if (!state) return

      const currentPosition = state.position
      const isPlaying = !state.paused
      const now = Date.now()

      // Only update if position has changed significantly or play state changed
      const positionDiff = Math.abs(currentPosition - lastKnownPositionRef.current)
      if (positionDiff > 1000 || isPlaying !== syncData?.playbackState.isPlaying) {
        await updateServerPlayback(currentPosition, isPlaying, now)
        lastKnownPositionRef.current = currentPosition
      }

    } catch (error) {
      console.error('Failed to broadcast owner state:', error)
      setSyncErrors(prev => [...prev.slice(-4), `Broadcast error: ${error}`])
    }
  }, [player, isOwner, updateServerPlayback, syncData])

  // Main sync loop
  const performSync = useCallback(async () => {
    if (!roomCode) return

    const data = await fetchSyncData()
    if (!data) return

    setSyncData(data)
    setIsConnected(true)

    if (isOwner) {
      // Owner broadcasts their state
      await broadcastOwnerState()
    } else {
      // Members sync to owner's state
      await syncToOwner(data)
    }
  }, [roomCode, isOwner, fetchSyncData, broadcastOwnerState, syncToOwner])

  // Handle player state changes (owner only)
  useEffect(() => {
    if (!player || !isOwner) return

    const handleStateChange = async (state: any | null) => {
      if (!state || !roomCode) return

      try {
        // Update server with new state
        await updateServerPlayback(state.position, !state.paused)
        
        // Update track if changed
        const currentTrack = state.track_window.current_track
        if (currentTrack && (!syncData?.currentTrack || 
            syncData.currentTrack.uri !== currentTrack.uri)) {
          await updateServerTrack(currentTrack)
        }
      } catch (error) {
        console.error('Failed to handle state change:', error)
      }
    }

    player.addListener('player_state_changed', handleStateChange)

    return () => {
      player.removeListener('player_state_changed', handleStateChange)
    }
  }, [player, isOwner, roomCode, updateServerPlayback, updateServerTrack, syncData])

  // Start/stop sync loop
  useEffect(() => {
    if (!roomCode) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
      setIsConnected(false)
      setSyncData(null)
      return
    }

    // Initial sync
    performSync()

    // Set up sync interval
    syncIntervalRef.current = setInterval(performSync, SYNC_INTERVAL)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [roomCode, performSync])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [])

  return {
    syncData,
    isConnected,
    lastSyncTime,
    syncErrors,
    latencyInfo: latencySync,
    manualSync: performSync,
    clearErrors: () => setSyncErrors([])
  }
}