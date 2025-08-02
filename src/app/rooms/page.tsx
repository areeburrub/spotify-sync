'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Room {
  id: string
  name: string
  adminId: string
  isActive: boolean
  createdAt: string
  admin: {
    name: string
    image?: string
  }
  members: Array<{
    user: {
      name: string
      image?: string
    }
  }>
}

export default function RoomsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
      return
    }
    
    if (session) {
      fetchRooms()
    }
  }, [session, status, router])

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms')
      if (response.ok) {
        const data = await response.json()
        setRooms(data)
      }
    } catch (error) {
      console.error('Error fetching rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoomName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newRoomName.trim() })
      })

      if (response.ok) {
        const room = await response.json()
        console.log('Room created:', room)
        setRooms(prev => [room, ...prev])
        setNewRoomName('')
        setShowCreateForm(false)
        // Show success message or stay on page to see the new room
        // router.push(`/rooms/${room.id}`)
      } else {
        const errorData = await response.json()
        console.error('Error creating room:', errorData)
        alert('Failed to create room: ' + (errorData.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error creating room:', error)
      alert('Failed to create room. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const joinRoom = async (roomId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST'
      })

      if (response.ok) {
        router.push(`/rooms/${roomId}`)
      }
    } catch (error) {
      console.error('Error joining room:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-purple-400 text-lg flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          Loading rooms...
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
                onClick={() => router.push('/')}
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                Music Rooms
              </h1>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
            >
              Create Room
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Create Room Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-white mb-4">Create New Room</h2>
              <form onSubmit={createRoom}>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Enter room name"
                  className="w-full bg-black/30 border border-purple-700/50 rounded-lg px-4 py-2 text-white placeholder-purple-300 focus:outline-none focus:border-purple-500 mb-4"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewRoomName('')
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newRoomName.trim() || creating}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rooms Grid */}
        <div className="space-y-6">
          {rooms.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No rooms yet</h3>
              <p className="text-purple-300 mb-4">Create your first room to start syncing music with friends</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 font-medium"
              >
                Create First Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm hover:border-purple-600/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/rooms/${room.id}`)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white truncate">{room.name}</h3>
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                      Active
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {room.admin.image && (
                        <img
                          src={room.admin.image}
                          alt="Admin"
                          className="w-6 h-6 rounded-full ring-1 ring-purple-500"
                        />
                      )}
                      <span className="text-purple-300 text-sm">
                        Admin: {room.admin.name}
                      </span>
                    </div>
                    
                    <div className="text-purple-300 text-sm">
                      {room.members.length} member{room.members.length !== 1 ? 's' : ''}
                    </div>
                    
                    <div className="text-purple-400 text-xs">
                      Created {new Date(room.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}