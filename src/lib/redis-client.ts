import { Redis } from '@upstash/redis'

// Client-side Redis connection using public env vars
const redis = new Redis({
  url: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_URL!,
  token: process.env.NEXT_PUBLIC_UPSTASH_REDIS_REST_TOKEN!,
})

interface HostSyncData {
  SH: number // Host seek position in milliseconds
  TH: number // Host unix timestamp
  RH: number | null // Host round trip time (null initially)
  isPlaying: boolean
}

const ROOM_SYNC_PREFIX = 'room:sync:'
const ROOM_TTL = 86400 // 24 hours in seconds

/**
 * Store host sync data directly from client (SH, TH, RH)
 */
export async function storeHostSyncDataClient(
  roomCode: string, 
  SH: number, 
  isPlaying: boolean, 
  RH: number | null = null
): Promise<void> {
  try {
    const syncData: HostSyncData = {
      SH,
      TH: Date.now(),
      RH,
      isPlaying
    }
    
    const key = `${ROOM_SYNC_PREFIX}${roomCode}`
    await redis.set(key, syncData, { ex: ROOM_TTL })
    
    console.log(`[Client] Stored host sync: SH=${SH}ms, TH=${syncData.TH}, RH=${RH}`)
  } catch (error) {
    console.error('[Client] Failed to store host sync data:', error)
    throw error
  }
}

/**
 * Get host sync data directly from client
 */
export async function getHostSyncDataClient(roomCode: string): Promise<HostSyncData | null> {
  try {
    const key = `${ROOM_SYNC_PREFIX}${roomCode}`
    const syncData = await redis.get<HostSyncData>(key)
    
    return syncData
  } catch (error) {
    console.error('[Client] Failed to get host sync data:', error)
    return null
  }
}

/**
 * Calculate member's adjusted seek based on host data and member timing
 * Enhanced with jitter smoothing and clock drift compensation
 */
export function calculateMemberSeekClient(
  hostData: HostSyncData,
  TM: number, // Member's current time 
  RM: number, // Member's round trip time
  previousSeeks: number[] = [] // For jitter smoothing
): number {
  if (!hostData.isPlaying) {
    return hostData.SH
  }
  
  // Calculate time difference considering latencies
  const hostLatency = hostData.RH || 0
  const timeDiff = TM - hostData.TH
  const latencyAdjustment = (RM - hostLatency) / 2
  
  // Basic seek calculation
  const rawSeek = hostData.SH + timeDiff - latencyAdjustment
  
  // Jitter smoothing: Use weighted average of recent seeks
  if (previousSeeks.length > 0) {
    const recentSeeks = previousSeeks.slice(-3) // Last 3 seeks
    const weights = [0.1, 0.3, 0.6] // More weight to recent values
    
    let smoothedSeek = rawSeek * 0.7 // 70% current calculation
    recentSeeks.forEach((seek, i) => {
      smoothedSeek += seek * (weights[i] || 0.1) * 0.3 // 30% historical
    })
    
    return Math.max(0, smoothedSeek)
  }
  
  return Math.max(0, rawSeek)
}

/**
 * Calculate adaptive sync tolerance based on network conditions
 */
export function getAdaptiveSyncTolerance(RM: number, RH: number): number {
  const avgLatency = (RM + (RH || 0)) / 2
  
  // Base tolerance: 1 second
  let tolerance = 1000
  
  // Increase tolerance for high latency connections
  if (avgLatency > 200) {
    tolerance += avgLatency * 2 // 2x latency buffer
  } else if (avgLatency > 100) {
    tolerance += avgLatency // 1x latency buffer  
  }
  
  // Minimum 500ms, maximum 5000ms tolerance
  return Math.min(Math.max(tolerance, 500), 5000)
}

/**
 * Measure round trip time using direct ping (no API route)
 */
export async function measureRoundTripTimeClient(): Promise<number> {
  try {
    const startTime = performance.now()
    
    // Use a lightweight Redis operation for latency measurement
    const key = `ping:${Date.now()}`
    await redis.set(key, 'ping', { ex: 1 }) // 1 second TTL
    await redis.get(key) // Read it back
    
    const endTime = performance.now()
    
    return Math.max(0, endTime - startTime)
  } catch (error) {
    console.warn('[Client] Round trip time measurement failed:', error)
    return 0
  }
}