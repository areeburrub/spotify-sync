'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { SpotifyProvider } from '@/contexts/SpotifyContext'
import SpotifyPlayerV2 from '@/components/SpotifyPlayerV2'
import RoomManager from '@/components/RoomManager'
import SyncedSpotifyPlayer from '@/components/SyncedSpotifyPlayer'

interface User {
  id: string
  spotifyId: string
  email: string
  displayName: string | null
  images: any
  accessToken: string
}

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

export default function AppPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [isRoomOwner, setIsRoomOwner] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/user')
      if (!response.ok) {
        router.push('/login')
        return
      }
      const userData = await response.json()
      setUser(userData.user)
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleRoomJoined = (room: Room, isOwner: boolean) => {
    setCurrentRoom(room)
    setIsRoomOwner(isOwner)
  }

  const handleRoomLeft = () => {
    setCurrentRoom(null)
    setIsRoomOwner(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-600 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  const profileImage = user.images && Array.isArray(user.images) && user.images.length > 0
    ? user.images[0]?.url
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Spotify Sync Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              {profileImage && (
                <Image
                  src={profileImage}
                  alt="Profile"
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              )}
              <div>
                <h2 className="text-2xl">{user.displayName || 'Spotify User'}</h2>
                <p className="text-gray-600">{user.email}</p>
              </div>
            </CardTitle>
            <CardDescription>
              Connected to Spotify ID: {user.spotifyId}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Room Management */}
        {!currentRoom && (
          <RoomManager
            onRoomJoined={handleRoomJoined}
            onRoomLeft={handleRoomLeft}
          />
        )}

        {/* Spotify Web Player with Room Sync */}
        <SpotifyProvider accessToken={user.accessToken}>
          {currentRoom ? (
            <div className="space-y-4">
              <RoomManager
                onRoomJoined={handleRoomJoined}
                onRoomLeft={handleRoomLeft}
                currentRoom={currentRoom}
                isOwner={isRoomOwner}
              />
              <SyncedSpotifyPlayer
                currentRoom={currentRoom}
                isRoomOwner={isRoomOwner}
              />
            </div>
          ) : (
            <SpotifyPlayerV2 />
          )}
        </SpotifyProvider>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your Spotify account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold">Spotify ID</h3>
                <p className="text-gray-600 text-sm">{user.spotifyId}</p>
              </div>
              <div>
                <h3 className="font-semibold">Email</h3>
                <p className="text-gray-600">{user.email}</p>
              </div>
              <div>
                <h3 className="font-semibold">Display Name</h3>
                <p className="text-gray-600">{user.displayName || 'Not set'}</p>
              </div>
              <div>
                <h3 className="font-semibold">Token Status</h3>
                <p className="text-green-600">✓ Active & Connected</p>
              </div>
            </CardContent>
          </Card>

          {/* Room Sync Features */}
          <Card>
            <CardHeader>
              <CardTitle>🎵 Room Sync Features</CardTitle>
              <CardDescription>Synchronized music listening with friends</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Create & join sync rooms</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Real-time latency calculation</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Automatic position sync</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Smart jitter compensation</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Owner controls playback</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-500">✓</span>
                <span>Connection quality monitoring</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}