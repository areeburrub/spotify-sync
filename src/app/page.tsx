'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

interface SpotifyUser {
  country: string
  display_name: string
  email: string
  followers: {
    total: number
  }
  images: Array<{
    url: string
    height: number
    width: number
  }>
  product: string
}

export default function Home() {
  const { data: session, status } = useSession()
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session?.accessToken) {
      fetchSpotifyProfile()
    }
  }, [session])

  const fetchSpotifyProfile = async () => {
    if (!session?.accessToken) return
    
    setLoading(true)
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSpotifyUser(data)
      }
    } catch (error) {
      console.error('Error fetching Spotify profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-purple-400 text-lg flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          Loading...
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-purple-900/20"></div>
        
        {/* Floating elements */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-purple-500/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-20 w-48 h-48 bg-purple-600/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-purple-400/10 rounded-full blur-xl"></div>
        
        <div className="relative z-10 text-center space-y-8 p-8">
          <div className="space-y-4">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              Spotify Sync
            </h1>
            <p className="text-xl text-purple-300 max-w-md mx-auto">
              Connect your Spotify account to unlock your music universe
            </p>
          </div>
          
          <button
            onClick={() => signIn('spotify')}
            className="group relative bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-4 px-8 rounded-full transition-all duration-300 flex items-center gap-3 mx-auto shadow-lg hover:shadow-purple-500/25 hover:scale-105"
          >
            <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.959-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.361 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Login with Spotify
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
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              Spotify Sync
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-purple-900/30 rounded-full px-4 py-2">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-8 h-8 rounded-full ring-2 ring-purple-500"
                  />
                )}
                <span className="text-purple-300 font-medium">
                  {session.user?.name}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-white">
              Welcome back, <span className="text-purple-400">{session.user?.name}</span>
            </h2>
            <p className="text-purple-300 text-lg">
              Your music dashboard is ready to rock
            </p>
          </div>

          {/* User Profile Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Spotify Profile Card */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.959-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.361 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Spotify Profile</h3>
                  <p className="text-purple-300 text-sm">Connected Account</p>
                </div>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : spotifyUser ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {spotifyUser.images?.[0] && (
                      <img
                        src={spotifyUser.images[0].url}
                        alt="Spotify Profile"
                        className="w-16 h-16 rounded-full ring-2 ring-purple-500"
                      />
                    )}
                    <div>
                      <p className="font-medium text-white">{spotifyUser.display_name}</p>
                      <p className="text-purple-300 text-sm">{spotifyUser.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-purple-300">Followers</p>
                      <p className="text-white font-semibold">{spotifyUser.followers?.total.toLocaleString()}</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-purple-300">Country</p>
                      <p className="text-white font-semibold">{spotifyUser.country}</p>
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-purple-300 text-sm">Subscription</p>
                    <p className="text-white font-semibold capitalize">{spotifyUser.product}</p>
                  </div>
                </div>
              ) : (
                <p className="text-purple-300">Loading profile...</p>
              )}
            </div>

            {/* Quick Stats Card */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Quick Stats</h3>
                  <p className="text-purple-300 text-sm">Your Music Data</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-purple-300 text-sm">Session Status</p>
                  <p className="text-green-400 font-semibold">✓ Connected</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-purple-300 text-sm">Last Login</p>
                  <p className="text-white font-semibold">Just now</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-purple-300 text-sm">Access Token</p>
                  <p className="text-green-400 font-semibold">Active</p>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
                  <p className="text-purple-300 text-sm">Manage Your Music</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => window.location.href = '/rooms'}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 text-sm font-medium"
                >
                  Music Rooms
                </button>
                <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 text-sm font-medium">
                  Recently Played
                </button>
                <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 text-sm font-medium">
                  Top Tracks
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
