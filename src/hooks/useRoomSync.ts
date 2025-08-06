import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  storeHostSyncDataClient, 
  getHostSyncDataClient, 
  calculateMemberSeekClient, 
  measureRoundTripTimeClient,
  getAdaptiveSyncTolerance,
  estimateAudioLatency
} from '@/lib/redis-client'

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
  const [audioLatency, setAudioLatency] = useState<number>(150) // Audio system latency
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isSyncingRef = useRef<boolean>(false)
  const previousSeeksRef = useRef<number[]>([]) // For jitter smoothing

  // Measure round trip time periodically - DIRECT REDIS CALL
  const updateRoundTripTime = useCallback(async () => {
    try {
      const roundTripTime = await measureRoundTripTimeClient()
      if (isOwner) {
        setRH(roundTripTime)
      } else {
        setRM(roundTripTime)
      }
      console.log(`[${isOwner ? 'Host' : 'Member'}] RTT: ${roundTripTime.toFixed(1)}ms`)
    } catch (error) {
      console.warn('Failed to measure round trip time:', error)
    }
  }, [isOwner])

  // Owner: Send SH, TH, RH every second - DIRECT REDIS CALL
  const sendHostSyncData = useCallback(async () => {
    if (!roomCode || !isOwner || !player) return

    try {
      const state = await player.getCurrentState()
      if (!state) return

      // DIRECT REDIS WRITE - NO API ROUTE
      await storeHostSyncDataClient(
        roomCode,
        state.position, // SH
        !state.paused,  // isPlaying
        RH              // RH
      )
      
      setLastSyncTime(Date.now())
      console.log(`[Host] Synced: SH=${state.position}ms, RH=${RH.toFixed(1)}ms`)
    } catch (error) {
      console.error('Failed to send host sync data:', error)
      setSyncErrors(prev => [...prev.slice(-4), `Send error: ${error}`])
    }
  }, [roomCode, isOwner, player, RH])

  // Member: Get host data and calculate own SM, TM, RM then adjust - DIRECT REDIS CALL
  const syncToHost = useCallback(async () => {
    if (!roomCode || isOwner || !player || isSyncingRef.current) return

    isSyncingRef.current = true
    
    try {
      // DIRECT REDIS READ - NO API ROUTE
      const hostData = await getHostSyncDataClient(roomCode)
      if (!hostData) {
        isSyncingRef.current = false
        return
      }

      const currentState = await player.getCurrentState()
      if (!currentState) {
        isSyncingRef.current = false
        return
      }

      // Member's own data
      const SM = currentState.position  // Member seek
      const TM = Date.now()            // Member time
      // RM already measured and stored in state

      // Calculate target seek using host data and member data - CORRECTED AUDIO SYNC LOGIC
      const targetSeek = calculateMemberSeekClient(hostData, TM, RM, previousSeeksRef.current, audioLatency)
      
      // Update seek history for jitter smoothing
      previousSeeksRef.current.push(targetSeek)
      if (previousSeeksRef.current.length > 5) {
        previousSeeksRef.current.shift() // Keep last 5 seeks
      }

      // Use adaptive sync tolerance based on network conditions
      const adaptiveTolerance = getAdaptiveSyncTolerance(RM, hostData.RH || 0)
      const seekDiff = Math.abs(SM - targetSeek)
      
      if (seekDiff > adaptiveTolerance) {
        console.log(`[Member] Syncing: SM=${SM}ms -> target=${targetSeek}ms (diff: ${seekDiff}ms, tolerance=${adaptiveTolerance}ms, netLatency=${RM.toFixed(1)}ms, audioLatency=${audioLatency}ms)`)
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

  // Main sync loop - NO NETWORK REQUESTS, DIRECT REDIS
  const performSync = useCallback(async () => {
    if (!roomCode) return

    setIsConnected(true)

    if (isOwner) {
      // Host sends SH, TH, RH every second - DIRECT REDIS
      await sendHostSyncData()
    } else {
      // Members read SH, TH, RH and calculate with their SM, TM, RM - DIRECT REDIS
      await syncToHost()
    }
  }, [roomCode, isOwner, sendHostSyncData, syncToHost])

  // Measure round trip time and audio latency periodically - DIRECT REDIS
  useEffect(() => {
    if (!roomCode) return

    // Initial measurements
    updateRoundTripTime()
    
    // Measure audio latency once (it's relatively stable)
    const measuredAudioLatency = estimateAudioLatency()
    setAudioLatency(measuredAudioLatency)
    
    // Update network latency every 1 second
    const latencyInterval = setInterval(updateRoundTripTime, 1000)
    
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