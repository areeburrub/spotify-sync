'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, Wifi, WifiOff, Clock, Signal } from 'lucide-react'

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

interface RoomManagerProps {
  onRoomJoined: (room: Room, isOwner: boolean) => void
  onRoomLeft: () => void
  currentRoom?: Room | null
  isOwner?: boolean
}

export default function RoomManager({ 
  onRoomJoined, 
  onRoomLeft, 
  currentRoom, 
  isOwner 
}: RoomManagerProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const createRoom = async () => {
    if (!roomName.trim()) {
      setError('Room name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: roomName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create room')
      }

      const data = await response.json()
      onRoomJoined(data.room, true)
      setIsCreating(false)
      setRoomName('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      setError('Please enter a valid 6-digit room code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: roomCode.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to join room')
      }

      const data = await response.json()
      onRoomJoined(data.room, data.isOwner)
      setIsJoining(false)
      setRoomCode('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  const leaveRoom = async () => {
    if (!currentRoom) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId: currentRoom.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to leave room')
      }

      onRoomLeft()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to leave room')
    } finally {
      setLoading(false)
    }
  }

  if (currentRoom) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {currentRoom.name}
                {isOwner && <Badge variant="secondary">Owner</Badge>}
              </CardTitle>
              <CardDescription>
                Room Code: <span className="font-mono text-lg font-bold">{currentRoom.code}</span>
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={leaveRoom}
              disabled={loading}
            >
              Leave Room
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {currentRoom.memberCount || 1} member{(currentRoom.memberCount || 1) !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-2 text-green-600">
              <Wifi className="h-4 w-4" />
              Connected
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            <p><strong>Owner:</strong> {currentRoom.owner.displayName || currentRoom.owner.email}</p>
            <p><strong>Created:</strong> {new Date(currentRoom.createdAt).toLocaleString()}</p>
          </div>

          {error && (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Create Room */}
      <Card>
        <CardHeader>
          <CardTitle>Create Room</CardTitle>
          <CardDescription>
            Start a new sync room and invite others to join
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isCreating ? (
            <Button 
              onClick={() => setIsCreating(true)} 
              className="w-full"
              disabled={loading}
            >
              Create New Room
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  placeholder="Enter room name..."
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={createRoom} 
                  disabled={loading || !roomName.trim()}
                  className="flex-1"
                >
                  {loading ? 'Creating...' : 'Create Room'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsCreating(false)
                    setRoomName('')
                    setError(null)
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Join Room */}
      <Card>
        <CardHeader>
          <CardTitle>Join Room</CardTitle>
          <CardDescription>
            Enter a 6-digit room code to join an existing room
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isJoining ? (
            <Button 
              variant="outline" 
              onClick={() => setIsJoining(true)} 
              className="w-full"
              disabled={loading}
            >
              Join Existing Room
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomCode">Room Code</Label>
                <Input
                  id="roomCode"
                  placeholder="000000"
                  value={roomCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setRoomCode(value)
                  }}
                  maxLength={6}
                  className="text-center font-mono text-lg"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={joinRoom} 
                  disabled={loading || roomCode.length !== 6}
                  className="flex-1"
                >
                  {loading ? 'Joining...' : 'Join Room'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsJoining(false)
                    setRoomCode('')
                    setError(null)
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}