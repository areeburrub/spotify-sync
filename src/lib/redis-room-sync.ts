import { Redis } from '@upstash/redis'

interface HostSyncData {
  SH: number // Host seek position in milliseconds
  TH: number // Host unix timestamp
  RH: number | null // Host round trip time (null initially)
  isPlaying: boolean
}


// Initialize Redis client (reuse from oauth store)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const ROOM_SYNC_PREFIX = 'room:sync:'
const ROOM_TTL = 86400 // 24 hours in seconds

/**
 * Store host sync data (SH, TH, RH)
 */
export async function storeHostSyncData(
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
    
    console.log(`Stored host sync: SH=${SH}ms, TH=${syncData.TH}, RH=${RH}`)
  } catch (error) {
    console.error('Failed to store host sync data:', error)
    throw error
  }
}

/**
 * Get host sync data from Redis
 */
export async function getHostSyncData(roomCode: string): Promise<HostSyncData | null> {
  try {
    const key = `${ROOM_SYNC_PREFIX}${roomCode}`
    const syncData = await redis.get<HostSyncData>(key)
    
    if (!syncData) {
      return null
    }
    
    return syncData
  } catch (error) {
    console.error('Failed to get host sync data:', error)
    return null
  }
}


/**
 * Calculate member's adjusted seek based on host data and member timing
 */
export function calculateMemberSeek(
  hostData: HostSyncData,
  TM: number, // Member's current time 
  RM: number  // Member's round trip time
): number {
  if (!hostData.isPlaying) {
    return hostData.SH
  }
  
  // Calculate time difference considering latencies
  const hostLatency = hostData.RH || 0
  const timeDiff = TM - hostData.TH
  const latencyAdjustment = (RM - hostLatency) / 2
  
  // Adjust host seek with time difference and latency
  const adjustedSeek = hostData.SH + timeDiff - latencyAdjustment
  
  return Math.max(0, adjustedSeek)
}








/**
 * Clean up room sync data
 */
export async function cleanupRoomData(roomCode: string): Promise<void> {
  try {
    const key = `${ROOM_SYNC_PREFIX}${roomCode}`
    await redis.del(key)
    console.log('Cleaned up room data:', roomCode)
  } catch (error) {
    console.error('Failed to cleanup room data:', error)
    throw error
  }
}

/**
 * Generate a unique 6-digit room code
 */
export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Measure round trip time using ping
 */
export async function measureRoundTripTime(): Promise<number> {
  try {
    const startTime = performance.now()
    const response = await fetch('/api/rooms/ping', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    })
    const endTime = performance.now()
    
    if (!response.ok) return 0
    
    return Math.max(0, endTime - startTime)
  } catch {
    return 0
  }
}