import { useState, useEffect, useCallback, useRef } from 'react'
import { measureRoundTripTime, calculateMemberSeek } from '@/lib/redis-room-sync'

interface RoomSyncHookProps {
  roomCode: string | null
  isOwner: boolean
  player: any | null
}

const SYNC_INTERVAL = 1000 // 1 second
const SYNC_TOLERANCE = 1000 // 1 second tolerance for sync

export function useRoomSync({ roomCode, isOwner, player }: RoomSyncHookProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<number>(0)
  const [syncErrors, setSyncErrors] = useState<string[]>([])
  const [RH, setRH] = useState<number>(0) // Host round trip time
  const [RM, setRM] = useState<number>(0) // Member round trip time
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isSyncingRef = useRef<boolean>(false)

  // Measure round trip time periodically
  const updateRoundTripTime = useCallback(async () => {
    try {
      const roundTripTime = await measureRoundTripTime()
      if (isOwner) {
        setRH(roundTripTime)
      } else {
        setRM(roundTripTime)
      }
    } catch (error) {
      console.warn('Failed to measure round trip time:', error)
    }
  }, [isOwner])

  // Owner: Send SH, TH, RH every second
  const sendHostSyncData = useCallback(async () => {
    if (!roomCode || !isOwner || !player) return

    try {
      const state = await player.getCurrentState()
      if (!state) return

      // SH = Host seek, TH = Host time (auto set in API), RH = Host round trip time
      await fetch('/api/rooms/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode,
          SH: state.position,
          isPlaying: !state.paused,
          RH: RH
        }),
      })
      
      setLastSyncTime(Date.now())
    } catch (error) {
      console.error('Failed to send host sync data:', error)
      setSyncErrors(prev => [...prev.slice(-4), `Send error: ${error}`])
    }
  }, [roomCode, isOwner, player, RH])

  // Member: Get host data and calculate own SM, TM, RM then adjust
  const syncToHost = useCallback(async () => {
    if (!roomCode || isOwner || !player || isSyncingRef.current) return

    isSyncingRef.current = true
    
    try {
      const response = await fetch(`/api/rooms/sync?code=${roomCode}`)
      if (!response.ok) {
        isSyncingRef.current = false
        return
      }

      const hostData = await response.json() // Contains SH, TH, RH, isPlaying
      
      const currentState = await player.getCurrentState()
      if (!currentState) {
        isSyncingRef.current = false
        return
      }

      // Member's own data
      const SM = currentState.position  // Member seek
      const TM = Date.now()            // Member time
      // RM already measured and stored in state

      // Calculate target seek using host data and member data
      const targetSeek = calculateMemberSeek(hostData, TM, RM)

      // Check if sync is needed
      const seekDiff = Math.abs(SM - targetSeek)
      
      if (seekDiff > SYNC_TOLERANCE) {
        console.log(`Syncing: SM=${SM}ms -> target=${targetSeek}ms (diff: ${seekDiff}ms)`)
        await player.seek(targetSeek)
      }

      // Sync play/pause state
      if (currentState.paused !== !hostData.isPlaying) {
        if (hostData.isPlaying && currentState.paused) {
          await player.resume()
        } else if (!hostData.isPlaying && !currentState.paused) {
          await player.pause()
        }
      }

      setLastSyncTime(Date.now())
      
    } catch (error) {
      console.error('Failed to sync to host:', error)
      setSyncErrors(prev => [...prev.slice(-4), `Sync error: ${error}`])
    } finally {
      isSyncingRef.current = false
    }
  }, [roomCode, isOwner, player, RM])

  // Main sync loop
  const performSync = useCallback(async () => {
    if (!roomCode) return

    setIsConnected(true)

    if (isOwner) {
      // Host sends SH, TH, RH every second
      await sendHostSyncData()
    } else {
      // Members read SH, TH, RH and calculate with their SM, TM, RM
      await syncToHost()
    }
  }, [roomCode, isOwner, sendHostSyncData, syncToHost])

  // Measure round trip time periodically
  useEffect(() => {
    if (!roomCode) return

    // Initial measurement
    updateRoundTripTime()
    
    // Update every 5 seconds
    const latencyInterval = setInterval(updateRoundTripTime, 5000)
    
    return () => clearInterval(latencyInterval)
  }, [roomCode, updateRoundTripTime])

  // Start/stop sync loop
  useEffect(() => {
    if (!roomCode) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
      setIsConnected(false)
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
    isConnected,
    lastSyncTime,
    syncErrors,
    latencyInfo: {
      currentLatency: isOwner ? RH : RM
    },
    manualSync: performSync,
    clearErrors: () => setSyncErrors([])
  }
}