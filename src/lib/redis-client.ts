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
 * Fixed audio sync logic with proper latency compensation
 */
export function calculateMemberSeekClient(
  hostData: HostSyncData,
  TM: number, // Member's current time 
  RM: number, // Member's round trip time
  previousSeeks: number[] = [], // For jitter smoothing
  audioLatency: number = 150 // Audio system latency (ms)
): number {
  if (!hostData.isPlaying) {
    return hostData.SH
  }
  
  // Step 1: Calculate how much time has passed since host sent the data
  const timeSinceHostUpdate = TM - hostData.TH
  
  // Step 2: Account for network delays in the sync chain
  // Host: RH is round-trip time to write to Redis (use half for write latency)
  const hostWriteDelay = (hostData.RH || 0) / 2 // Host's write delay to Redis
  
  // Member: RM is full round-trip time to read from Redis (use full RM for read latency)
  const memberReadDelay = RM // Member's full read delay from Redis
  
  // Step 3: Calculate the total time difference accounting for:
  // - Time elapsed since host update
  // - Host's delay writing to Redis (subtract - data was written earlier)
  // - Member's delay reading from Redis (add - data is stale by this amount)
  // - Audio system latency (add - audio takes time to play)
  const totalDelay = timeSinceHostUpdate - (hostWriteDelay + memberReadDelay)
  
  // Step 4: Calculate target seek position
  const rawSeek = hostData.SH + totalDelay
  
  // Step 5: Jitter smoothing for stable playback
  if (previousSeeks.length > 0) {
    const recentSeeks = previousSeeks.slice(-3) // Last 3 seeks
    const weights = [0.2, 0.3, 0.5] // Exponential weighting
    
    let smoothedSeek = rawSeek * 0.6 // 60% current calculation
    recentSeeks.forEach((seek, i) => {
      const weight = weights[i] || 0.1
      smoothedSeek += seek * weight * 0.4 // 40% historical
    })
    
    // Debug logging
    console.log(`[Sync] Raw: ${rawSeek.toFixed(1)}ms, Smoothed: ${smoothedSeek.toFixed(1)}ms, NetDelay: hostWrite=${hostWriteDelay.toFixed(1)}ms memberRead=${memberReadDelay.toFixed(1)}ms, Audio: ${audioLatency}ms`)
    
    return Math.max(0, smoothedSeek)
  }
  
  console.log(`[Sync] Raw seek: ${rawSeek.toFixed(1)}ms, Total delay: ${totalDelay.toFixed(1)}ms, hostWrite: ${hostWriteDelay.toFixed(1)}ms, memberRead: ${memberReadDelay.toFixed(1)}ms`)
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
 * Estimate browser audio system latency
 */
export function estimateAudioLatency(): number {
  try {
    // Check for AudioContext with proper TypeScript compatibility
    const AudioContextClass = (typeof AudioContext !== 'undefined') 
      ? AudioContext 
      : (typeof window !== 'undefined' && (window as any).webkitAudioContext) 
        ? (window as any).webkitAudioContext 
        : null
    
    if (AudioContextClass) {
      const tempContext = new AudioContextClass()
      
      // Use properties that are actually available (based on Web Audio API docs)
      // Note: outputLatency is missing in Chrome, baseLatency may not be available
      const baseLatency = (tempContext as any).baseLatency || 0
      const outputLatency = (tempContext as any).outputLatency || 0
      
      tempContext.close()
      
      // Convert to milliseconds and add typical browser/Spotify SDK overhead
      const measuredLatency = (baseLatency + outputLatency) * 1000
      const audioLatency = measuredLatency > 0 ? measuredLatency + 100 : 150 // +100ms for Spotify SDK or fallback
      
      console.log(`[Audio] Estimated latency: ${audioLatency.toFixed(1)}ms (base: ${(baseLatency*1000).toFixed(1)}ms, output: ${(outputLatency*1000).toFixed(1)}ms)`)
      return Math.max(50, Math.min(audioLatency, 500)) // Clamp between 50-500ms
    }
  } catch (error) {
    console.warn('[Audio] Could not estimate audio latency:', error)
  }
  
  // Fallback: typical web audio latency based on research
  // Most browsers: 100-200ms, Spotify Web Playback SDK adds ~50-100ms
  return 150
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