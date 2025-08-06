import { Redis } from '@upstash/redis'

interface RoomSyncData {
  roomCode: string
  ownerId: string
  currentTrack?: {
    uri: string
    id: string
    name: string
    artist: string
    duration: number
  }
  playbackState: {
    isPlaying: boolean
    position: number // in milliseconds
    timestamp: number // Unix timestamp when position was recorded
    volume: number
  }
  lastUpdated: number // Unix timestamp
}

interface MemberLatency {
  userId: string
  latency: number // in milliseconds
  lastPing: number // Unix timestamp
}

interface RoomMembers {
  [userId: string]: {
    displayName: string
    isOnline: boolean
    lastSeen: number
    deviceId?: string
  }
}

// Initialize Redis client (reuse from oauth store)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const ROOM_SYNC_PREFIX = 'room:sync:'
const ROOM_MEMBERS_PREFIX = 'room:members:'
const ROOM_LATENCY_PREFIX = 'room:latency:'
const ROOM_TTL = 86400 // 24 hours in seconds

/**
 * Store room synchronization data in Redis
 */
export async function storeRoomSyncData(roomCode: string, syncData: RoomSyncData): Promise<void> {
  try {
    const key = `${ROOM_SYNC_PREFIX}${roomCode}`
    await redis.set(key, syncData, { ex: ROOM_TTL })
    
    console.log('Stored room sync data:', roomCode)
  } catch (error) {
    console.error('Failed to store room sync data:', error)
    throw error
  }
}

/**
 * Get room synchronization data from Redis
 */
export async function getRoomSyncData(roomCode: string): Promise<RoomSyncData | null> {
  try {
    const key = `${ROOM_SYNC_PREFIX}${roomCode}`
    const syncData = await redis.get<RoomSyncData>(key)
    
    if (!syncData) {
      console.log('Room sync data not found:', roomCode)
      return null
    }
    
    console.log('Retrieved room sync data:', roomCode)
    return syncData
  } catch (error) {
    console.error('Failed to get room sync data:', error)
    return null
  }
}

/**
 * Update playback position for a room
 */
export async function updateRoomPlayback(
  roomCode: string, 
  position: number, 
  isPlaying: boolean,
  timestamp?: number
): Promise<void> {
  try {
    const currentData = await getRoomSyncData(roomCode)
    if (!currentData) {
      throw new Error('Room not found')
    }

    const updatedData: RoomSyncData = {
      ...currentData,
      playbackState: {
        ...currentData.playbackState,
        position,
        isPlaying,
        timestamp: timestamp || Date.now()
      },
      lastUpdated: Date.now()
    }

    await storeRoomSyncData(roomCode, updatedData)
  } catch (error) {
    console.error('Failed to update room playback:', error)
    throw error
  }
}

/**
 * Calculate synchronized position based on latency
 */
export function calculateSyncedPosition(
  recordedPosition: number,
  recordedTimestamp: number,
  isPlaying: boolean,
  userLatency: number = 0
): number {
  if (!isPlaying) {
    return recordedPosition
  }

  const now = Date.now()
  const timeDiff = now - recordedTimestamp
  const adjustedTimeDiff = Math.max(0, timeDiff - userLatency)
  
  return recordedPosition + adjustedTimeDiff
}

/**
 * Store member latency data
 */
export async function storeMemberLatency(
  roomCode: string, 
  userId: string, 
  latency: number
): Promise<void> {
  try {
    const key = `${ROOM_LATENCY_PREFIX}${roomCode}`
    const latencyData: MemberLatency = {
      userId,
      latency,
      lastPing: Date.now()
    }
    
    // Store in a hash for efficient access
    await redis.hset(key, { [userId]: latencyData })
    await redis.expire(key, ROOM_TTL)
    
    console.log(`Stored latency for user ${userId} in room ${roomCode}: ${latency}ms`)
  } catch (error) {
    console.error('Failed to store member latency:', error)
    throw error
  }
}

/**
 * Get member latency data
 */
export async function getMemberLatency(roomCode: string, userId: string): Promise<number> {
  try {
    const key = `${ROOM_LATENCY_PREFIX}${roomCode}`
    const latencyData = await redis.hget<MemberLatency>(key, userId)
    
    if (!latencyData) {
      return 0 // Default to 0 if no latency data
    }
    
    // Return 0 if data is older than 30 seconds
    const isStale = Date.now() - latencyData.lastPing > 30000
    return isStale ? 0 : latencyData.latency
  } catch (error) {
    console.error('Failed to get member latency:', error)
    return 0
  }
}

/**
 * Store room members data
 */
export async function storeRoomMembers(roomCode: string, members: RoomMembers): Promise<void> {
  try {
    const key = `${ROOM_MEMBERS_PREFIX}${roomCode}`
    await redis.set(key, members, { ex: ROOM_TTL })
    
    console.log('Stored room members:', roomCode)
  } catch (error) {
    console.error('Failed to store room members:', error)
    throw error
  }
}

/**
 * Get room members data
 */
export async function getRoomMembers(roomCode: string): Promise<RoomMembers | null> {
  try {
    const key = `${ROOM_MEMBERS_PREFIX}${roomCode}`
    const members = await redis.get<RoomMembers>(key)
    
    return members || null
  } catch (error) {
    console.error('Failed to get room members:', error)
    return null
  }
}

/**
 * Add member to room
 */
export async function addRoomMember(
  roomCode: string, 
  userId: string, 
  displayName: string,
  deviceId?: string
): Promise<void> {
  try {
    const currentMembers = await getRoomMembers(roomCode) || {}
    
    currentMembers[userId] = {
      displayName,
      isOnline: true,
      lastSeen: Date.now(),
      deviceId
    }
    
    await storeRoomMembers(roomCode, currentMembers)
  } catch (error) {
    console.error('Failed to add room member:', error)
    throw error
  }
}

/**
 * Remove member from room
 */
export async function removeRoomMember(roomCode: string, userId: string): Promise<void> {
  try {
    const currentMembers = await getRoomMembers(roomCode)
    if (!currentMembers || !currentMembers[userId]) {
      return
    }
    
    delete currentMembers[userId]
    await storeRoomMembers(roomCode, currentMembers)
    
    // Also remove latency data
    const latencyKey = `${ROOM_LATENCY_PREFIX}${roomCode}`
    await redis.hdel(latencyKey, userId)
  } catch (error) {
    console.error('Failed to remove room member:', error)
    throw error
  }
}

/**
 * Update member online status
 */
export async function updateMemberStatus(
  roomCode: string, 
  userId: string, 
  isOnline: boolean
): Promise<void> {
  try {
    const currentMembers = await getRoomMembers(roomCode)
    if (!currentMembers || !currentMembers[userId]) {
      return
    }
    
    currentMembers[userId] = {
      ...currentMembers[userId],
      isOnline,
      lastSeen: Date.now()
    }
    
    await storeRoomMembers(roomCode, currentMembers)
  } catch (error) {
    console.error('Failed to update member status:', error)
    throw error
  }
}

/**
 * Clean up expired room data
 */
export async function cleanupRoomData(roomCode: string): Promise<void> {
  try {
    const keys = [
      `${ROOM_SYNC_PREFIX}${roomCode}`,
      `${ROOM_MEMBERS_PREFIX}${roomCode}`,
      `${ROOM_LATENCY_PREFIX}${roomCode}`
    ]
    
    await redis.del(...keys)
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
 * Ping latency measurement - returns timestamp for round-trip calculation
 */
export function createLatencyPing(): number {
  return Date.now()
}

/**
 * Calculate latency from ping timestamp
 */
export function calculateLatency(pingTimestamp: number): number {
  return Math.max(0, Date.now() - pingTimestamp)
}