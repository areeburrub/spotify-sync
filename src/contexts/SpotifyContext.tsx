'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'

// Types
interface SpotifyPlayerState {
  paused: boolean
  track_window: {
    current_track: {
      name: string
      artists: Array<{ name: string }>
      album: {
        name: string
        images: Array<{ url: string }>
      }
      duration_ms: number
      id: string
      uri: string
    }
    next_tracks: Array<any>
    previous_tracks: Array<any>
  }
  position: number
  context?: {
    uri: string
    metadata?: any
  }
}

interface SpotifyDevice {
  id: string
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number
}

interface SpotifyContextType {
  // Player state
  player: any
  playerState: SpotifyPlayerState | null
  isReady: boolean
  deviceId: string
  volume: number
  position: number
  duration: number
  
  // Player controls
  play: (contextUri?: string, uris?: string[], offset?: number) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  previousTrack: () => Promise<void>
  nextTrack: () => Promise<void>
  seek: (position: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
  
  // Web API functions
  transferPlayback: (deviceId?: string, play?: boolean) => Promise<void>
  getDevices: () => Promise<SpotifyDevice[]>
  getCurrentPlayback: () => Promise<any>
  getUserPlaylists: (limit?: number) => Promise<any>
  getPlaylist: (playlistId: string) => Promise<any>
  getPlaylistTracks: (playlistId: string, limit?: number) => Promise<any>
  
  // Error handling
  error: string | null
  clearError: () => void
}

const SpotifyContext = createContext<SpotifyContextType | null>(null)

interface SpotifyProviderProps {
  children: React.ReactNode
  accessToken: string
}

export function SpotifyProvider({ children, accessToken }: SpotifyProviderProps) {
  // Player state
  const [player, setPlayer] = useState<any>(null)
  const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const [volume, setVolume] = useState(50)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // Refs for cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const playerRef = useRef<any>(null)

  // Error handling
  const clearError = useCallback(() => setError(null), [])
  
  const handleError = useCallback((message: string, err?: any) => {
    console.error(message, err)
    setError(message)
  }, [])

  // Web API helper function
  const spotifyApiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 1000
        console.warn(`Rate limited. Waiting ${waitTime}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return spotifyApiCall(endpoint, options) // Retry
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `HTTP ${response.status}`)
      }

      return response.status === 204 ? null : await response.json()
    } catch (err) {
      handleError(`Spotify API Error: ${endpoint}`, err)
      throw err
    }
  }, [accessToken, handleError])

  // Initialize player
  useEffect(() => {
    if (typeof window === 'undefined') return

    const initializePlayer = () => {
      if (!window.Spotify) {
        console.error('Spotify Web Playback SDK not loaded')
        return
      }

      const spotifyPlayer = new window.Spotify.Player({
        name: 'Spotify Sync Web Player',
        getOAuthToken: (cb) => cb(accessToken),
        volume: 0.5
      })

      playerRef.current = spotifyPlayer
      setPlayer(spotifyPlayer)

      // Ready event
      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('🎵 Spotify Player Ready:', device_id)
        setDeviceId(device_id)
        setIsReady(true)
        clearError()
      })

      // Not Ready event
      spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.log('🔴 Device offline:', device_id)
        setIsReady(false)
      })

      // Player state changes
      spotifyPlayer.addListener('player_state_changed', (state: SpotifyPlayerState) => {
        if (state) {
          console.log('🎵 Player state changed:', {
            paused: state.paused,
            track: state.track_window?.current_track?.name,
            position: state.position
          })
          
          setPlayerState(state)
          setPosition(state.position)
          setDuration(state.track_window?.current_track?.duration_ms || 0)
          clearError()
        }
      })

      // Error listeners
      spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
        handleError('Player initialization failed', message)
      })

      spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
        handleError('Authentication failed', message)
      })

      spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
        handleError('Account error - Premium required', message)
      })

      spotifyPlayer.addListener('playback_error', ({ message }: { message: string }) => {
        console.warn('Playback error:', message)
        // Don't set as critical error for playback issues
        if (message.includes('no list was loaded')) {
          console.log('🎵 No playlist loaded - will try to load one')
        }
      })

      // Connect player
      spotifyPlayer.connect().then((success: boolean) => {
        if (success) {
          console.log('🎵 Successfully connected to Spotify!')
        } else {
          handleError('Failed to connect to Spotify')
        }
      })
    }

    // Check if SDK is already loaded
    if (window.Spotify) {
      initializePlayer()
    } else {
      // Load SDK script
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      
      window.onSpotifyWebPlaybackSDKReady = initializePlayer
      document.body.appendChild(script)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (playerRef.current) {
        playerRef.current.disconnect()
      }
    }
  }, [accessToken, handleError, clearError])

  // Real-time position updates
  useEffect(() => {
    if (playerState && !playerState.paused && duration > 0 && player) {
      intervalRef.current = setInterval(async () => {
        try {
          const state = await player.getCurrentState()
          if (state && !state.paused) {
            setPosition(state.position)
          }
        } catch (err) {
          console.warn('Failed to get current state:', err)
        }
      }, 250)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [playerState?.paused, duration, player])

  // Player control functions
  const play = useCallback(async (contextUri?: string, uris?: string[], offset?: number) => {
    if (!deviceId) throw new Error('No active device')
    
    try {
      const body: any = {}
      
      if (contextUri) {
        body.context_uri = contextUri
      } else if (uris) {
        body.uris = uris
      }
      
      if (offset !== undefined) {
        body.offset = { position: offset }
      }

      await spotifyApiCall(`/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify(body)
      })
      
      console.log('▶️ Playback started')
    } catch (err) {
      handleError('Failed to start playback', err)
      throw err
    }
  }, [deviceId, spotifyApiCall, handleError])

  const pause = useCallback(async () => {
    if (!player) throw new Error('Player not available')
    
    try {
      await player.pause()
      console.log('⏸️ Playback paused')
    } catch (err) {
      handleError('Failed to pause', err)
      throw err
    }
  }, [player, handleError])

  const resume = useCallback(async () => {
    if (!player) throw new Error('Player not available')
    
    try {
      await player.resume()
      console.log('▶️ Playback resumed')
    } catch (err) {
      handleError('Failed to resume', err)
      throw err
    }
  }, [player, handleError])

  const togglePlay = useCallback(async () => {
    if (!player) throw new Error('Player not available')
    
    try {
      // Check if we have an active context/playlist loaded
      if (!playerState?.track_window?.current_track) {
        console.log('🎵 No track loaded, attempting to load user\'s music...')
        
        // Try to get user's recently played or saved tracks
        try {
          const recentlyPlayed = await spotifyApiCall('/me/player/recently-played?limit=1')
          if (recentlyPlayed?.items?.[0]) {
            const trackUri = recentlyPlayed.items[0].track.uri
            await play(undefined, [trackUri])
            return
          }
        } catch (err) {
          console.warn('Could not load recently played tracks')
        }
        
        // Fallback: try to load user's saved tracks
        try {
          const savedTracks = await spotifyApiCall('/me/tracks?limit=1')
          if (savedTracks?.items?.[0]) {
            const trackUri = savedTracks.items[0].track.uri
            await play(undefined, [trackUri])
            return
          }
        } catch (err) {
          console.warn('Could not load saved tracks')
        }
        
        throw new Error('No music available to play. Please start playback from a Spotify app first.')
      }
      
      // If we have a track, toggle play/pause
      await player.togglePlay()
      console.log('🎮 Toggled playback')
    } catch (err) {
      handleError('Failed to toggle playback', err)
      throw err
    }
  }, [player, playerState, play, spotifyApiCall, handleError])

  const previousTrack = useCallback(async () => {
    if (!player) throw new Error('Player not available')
    
    try {
      await player.previousTrack()
      console.log('⏪ Previous track')
    } catch (err) {
      handleError('Failed to go to previous track', err)
      throw err
    }
  }, [player, handleError])

  const nextTrack = useCallback(async () => {
    if (!player) throw new Error('Player not available')
    
    try {
      await player.nextTrack()
      console.log('⏩ Next track')
    } catch (err) {
      handleError('Failed to go to next track', err)
      throw err
    }
  }, [player, handleError])

  const seek = useCallback(async (positionMs: number) => {
    if (!player) throw new Error('Player not available')
    
    try {
      await player.seek(positionMs)
      setPosition(positionMs) // Optimistic update
      console.log('🎯 Seeked to:', positionMs)
    } catch (err) {
      handleError('Failed to seek', err)
      throw err
    }
  }, [player, handleError])

  const setVolumeControl = useCallback(async (volumePercent: number) => {
    if (!player) throw new Error('Player not available')
    
    try {
      await player.setVolume(volumePercent / 100)
      setVolume(volumePercent)
      console.log('🔊 Volume set to:', volumePercent)
    } catch (err) {
      handleError('Failed to set volume', err)
      throw err
    }
  }, [player, handleError])

  // Web API functions
  const transferPlayback = useCallback(async (targetDeviceId?: string, shouldPlay = false) => {
    const deviceToUse = targetDeviceId || deviceId
    if (!deviceToUse) throw new Error('No device available')
    
    try {
      await spotifyApiCall('/me/player', {
        method: 'PUT',
        body: JSON.stringify({
          device_ids: [deviceToUse],
          play: shouldPlay
        })
      })
      console.log('🔄 Playback transferred to:', deviceToUse)
    } catch (err) {
      handleError('Failed to transfer playback', err)
      throw err
    }
  }, [deviceId, spotifyApiCall, handleError])

  const getDevices = useCallback(async (): Promise<SpotifyDevice[]> => {
    try {
      const response = await spotifyApiCall('/me/player/devices')
      return response?.devices || []
    } catch (err) {
      handleError('Failed to get devices', err)
      return []
    }
  }, [spotifyApiCall, handleError])

  const getCurrentPlayback = useCallback(async () => {
    try {
      return await spotifyApiCall('/me/player')
    } catch (err) {
      handleError('Failed to get current playback', err)
      return null
    }
  }, [spotifyApiCall, handleError])

  const getUserPlaylists = useCallback(async (limit = 20) => {
    try {
      return await spotifyApiCall(`/me/playlists?limit=${limit}`)
    } catch (err) {
      handleError('Failed to get playlists', err)
      return null
    }
  }, [spotifyApiCall, handleError])

  const getPlaylist = useCallback(async (playlistId: string) => {
    try {
      return await spotifyApiCall(`/playlists/${playlistId}`)
    } catch (err) {
      handleError('Failed to get playlist', err)
      return null
    }
  }, [spotifyApiCall, handleError])

  const getPlaylistTracks = useCallback(async (playlistId: string, limit = 50) => {
    try {
      return await spotifyApiCall(`/playlists/${playlistId}/tracks?limit=${limit}`)
    } catch (err) {
      handleError('Failed to get playlist tracks', err)
      return null
    }
  }, [spotifyApiCall, handleError])

  const contextValue: SpotifyContextType = {
    // Player state
    player,
    playerState,
    isReady,
    deviceId,
    volume,
    position,
    duration,
    
    // Player controls
    play,
    pause,
    resume,
    togglePlay,
    previousTrack,
    nextTrack,
    seek,
    setVolume: setVolumeControl,
    
    // Web API functions
    transferPlayback,
    getDevices,
    getCurrentPlayback,
    getUserPlaylists,
    getPlaylist,
    getPlaylistTracks,
    
    // Error handling
    error,
    clearError
  }

  return (
    <SpotifyContext.Provider value={contextValue}>
      {children}
    </SpotifyContext.Provider>
  )
}

export function useSpotify() {
  const context = useContext(SpotifyContext)
  if (!context) {
    throw new Error('useSpotify must be used within a SpotifyProvider')
  }
  return context
}

// Global types for Spotify Web Playback SDK
declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume: number
      }) => any
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}