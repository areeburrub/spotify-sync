'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Room {
  id: string
  name: string
  adminId: string
  currentTrack: string | null
  trackPosition: number
  isPlaying: boolean
  lastSync: string
  admin: {
    id: string
    name: string
    image?: string
  }
  members: Array<{
    user: {
      id: string
      name: string
      image?: string
    }
  }>
}

interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string }>
  }
  uri: string
  duration_ms: number
}

interface SpotifyPlaybackState {
  is_playing: boolean
  progress_ms: number
  item: SpotifyTrack | null
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [roomId, setRoomId] = useState<string | null>(null)
  
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null)
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ roomId: id }) => setRoomId(id))
  }, [params])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
      return
    }
    
    if (session && roomId) {
      fetchRoom()
      fetchPlaybackState()
    }
  }, [session, status, router, roomId])

  useEffect(() => {
    if (room && currentUserId) {
      setIsAdmin(room.adminId === currentUserId)
    }
  }, [room, currentUserId])

  // No longer need polling since sync is done via Promise.all

  const fetchRoom = async () => {
    try {
      const response = await fetch(`/api/rooms`)
      if (response.ok) {
        const rooms = await response.json()
        const foundRoom = rooms.find((r: Room) => r.id === roomId)
        if (foundRoom) {
          setRoom(foundRoom)
          // Find current user in the room members to get their database ID
          const currentMember = foundRoom.members.find((member: any) => 
            member.user.email === session?.user?.email
          )
          if (currentMember) {
            setCurrentUserId(currentMember.user.id)
          }
        } else {
          router.push('/rooms')
        }
      }
    } catch (error) {
      console.error('Error fetching room:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPlaybackState = async () => {
    try {
      const response = await fetch('/api/spotify/playback')
      if (response.ok) {
        const data = await response.json()
        setPlaybackState(data)
        setCurrentTrack(data.item)
      }
    } catch (error) {
      console.error('Error fetching playback state:', error)
    }
  }

  // Removed individual sync functions - now using Promise.all approach

  const syncRoom = async () => {
    if (!isAdmin || !playbackState?.item) return
    
    setSyncing(true)
    try {
      const response = await fetch(`/api/rooms/${roomId}/sync-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentTrack: playbackState.item.uri
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setRoom(result.room)
        setLastSyncTime(new Date())
        
        // Show sync results
        const { summary } = result
        console.log(`Sync completed: ${summary.successCount}/${summary.totalMembers} members synced successfully`)
        
        // Refresh our own playback state after sync
        setTimeout(() => {
          fetchPlaybackState()
        }, 1500)
      } else {
        const errorData = await response.json()
        console.error('Sync failed:', errorData.error)
      }
    } catch (error) {
      console.error('Error syncing room:', error)
    } finally {
      setSyncing(false)
    }
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-purple-400 text-lg flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          Loading room...
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Room not found</h2>
          <button
            onClick={() => router.push('/rooms')}
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            ← Back to Rooms
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-purple-900/50 bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/rooms')}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                ← Back to Rooms
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                {room.name}
              </h1>
              {isAdmin && (
                <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                  Admin
                </span>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={syncRoom}
                disabled={syncing || !playbackState?.item}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium flex items-center gap-2"
              >
                {syncing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {syncing ? 'Syncing All...' : 'Sync All Members'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Track Banner */}
          <div className="lg:col-span-2">
            {currentTrack ? (
              <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  {currentTrack.album.images[0] && (
                    <img
                      src={currentTrack.album.images[0].url}
                      alt="Album Cover"
                      className="w-16 h-16 rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white">{currentTrack.name}</h2>
                    <p className="text-purple-300 text-lg">{currentTrack.artists.map(a => a.name).join(', ')}</p>
                    <p className="text-purple-400">{currentTrack.album.name}</p>
                  </div>
                  {playbackState && (
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${playbackState.is_playing ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="text-purple-300 font-medium">
                        {playbackState.is_playing ? 'Playing' : 'Paused'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-8 backdrop-blur-sm">
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">No Track Playing</h2>
                  <p className="text-purple-300">Start playing music on Spotify to sync with the room</p>
                </div>
              </div>
            )}
          </div>

          {/* Room Info */}
          <div className="space-y-6">
            {/* Room Members */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Room Members</h3>
              <div className="space-y-3">
                {room.members.map((member) => (
                  <div key={member.user.id} className="flex items-center gap-3">
                    {member.user.image && (
                      <img
                        src={member.user.image}
                        alt={member.user.name}
                        className="w-8 h-8 rounded-full ring-2 ring-purple-500"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-white font-medium">{member.user.name}</p>
                      {member.user.id === room.adminId && (
                        <p className="text-purple-300 text-xs">Admin</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Status */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Sync Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-purple-300">Last Sync:</span>
                  <span className="text-white text-sm">
                    {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-300">Room Status:</span>
                  <span className="text-green-400 text-sm">Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-300">Your Role:</span>
                  <span className="text-white text-sm">
                    {isAdmin ? 'Admin' : 'Member'}
                  </span>
                </div>
              </div>
              
              {!isAdmin && (
                <div className="mt-4 p-3 bg-purple-900/30 rounded-lg">
                  <p className="text-purple-300 text-sm">
                    🎵 When admin syncs, all members will play the same track from 0:00 simultaneously
                  </p>
                </div>
              )}
              
              {isAdmin && (
                <div className="mt-4 p-3 bg-purple-900/30 rounded-lg">
                  <p className="text-purple-300 text-sm">
                    🎛️ "Sync All Members" starts your current track from 0:00 on everyone's Spotify simultaneously
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}