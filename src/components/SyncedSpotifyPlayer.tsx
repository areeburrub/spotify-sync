'use client'

import { useEffect } from 'react'
import { useSpotify } from '@/contexts/SpotifyContext'
import { useRoomSync } from '@/hooks/useRoomSync'
import SpotifyPlayerV2 from './SpotifyPlayerV2'
import SyncStatus from './SyncStatus'

interface Room {
  id: string
  code: string
  name: string
  owner: {
    id: string
    displayName: string | null
    email: string
  }
  isActive: boolean
  createdAt: string
  memberCount?: number
}

interface SyncedSpotifyPlayerProps {
  currentRoom: Room | null
  isRoomOwner: boolean
}

export default function SyncedSpotifyPlayer({ 
  currentRoom, 
  isRoomOwner 
}: SyncedSpotifyPlayerProps) {
  const { player } = useSpotify()
  
  const roomSync = useRoomSync({
    roomCode: currentRoom?.code || null,
    isOwner: isRoomOwner,
    player
  })

  return (
    <div className="space-y-4">
      {/* Sync Status - only show when in a room */}
      {currentRoom && (
        <SyncStatus
          isConnected={roomSync.isConnected}
          lastSyncTime={roomSync.lastSyncTime}
          latencyInfo={roomSync.latencyInfo}
          syncErrors={roomSync.syncErrors}
          memberCount={currentRoom.memberCount}
          isOwner={isRoomOwner}
          onManualSync={roomSync.manualSync}
          onClearErrors={roomSync.clearErrors}
        />
      )}

      {/* Spotify Player */}
      <SpotifyPlayerV2 />
    </div>
  )
}