'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import Image from 'next/image'
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'

interface SpotifyPlayerProps {
  accessToken: string
  initialState?: any
}

interface PlayerState {
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
    }
  }
  position: number
}



export default function SpotifyPlayer({ accessToken, initialState }: SpotifyPlayerProps) {
  const [player, setPlayer] = useState<any>(null)
  const [deviceId, setDeviceId] = useState<string>('')
  const [playerState, setPlayerState] = useState<PlayerState | null>(null)
  const [volume, setVolume] = useState(50)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load Spotify Web Playback SDK
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if SDK is already loaded
    if (window.Spotify) {
      initializePlayer()
      return
    }

    // Load SDK script
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    
    window.onSpotifyWebPlaybackSDKReady = () => {
      initializePlayer()
    }

    document.body.appendChild(script)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const initializePlayer = () => {
    const spotifyPlayer = new window.Spotify.Player({
      name: 'Spotify Sync Player',
      getOAuthToken: (cb) => cb(accessToken),
      volume: 0.5
    })

    setPlayer(spotifyPlayer)

    // Ready event
    spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('Ready with Device ID', device_id)
      setDeviceId(device_id)
      setIsReady(true)
      
      // Auto-transfer playback to this device when ready
      transferPlaybackToDevice(device_id)
    })

    // Not Ready event
    spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('Device ID has gone offline', device_id)
      setIsReady(false)
    })

    // Player state changes - REAL-TIME UPDATES
      spotifyPlayer.addListener('player_state_changed', (state: PlayerState) => {
      console.log('🎵 Player state changed:', {
        paused: state?.paused,
        position: state?.position,
        track: state?.track_window?.current_track?.name,
        timestamp: Date.now()
      })
      
      if (state) {
        // Update all state immediately for real-time responsiveness
        setPlayerState(state)
        setPosition(state.position)
        setDuration(state.track_window.current_track?.duration_ms || 0)
      }
    })

    // Error listeners
    spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('Initialization error:', message)
    })

    spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Authentication error:', message)
    })

    spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Account error:', message)
    })

    spotifyPlayer.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('Playback error:', message)
    })

    // Connect to the player
    spotifyPlayer.connect()
  }

  // REAL-TIME position updates when playing
  useEffect(() => {
    if (playerState && !playerState.paused && duration > 0 && player) {
      console.log('🔄 Starting real-time position updates')
      
      intervalRef.current = setInterval(async () => {
        try {
          const state = await player.getCurrentState()
          if (state && !state.paused) {
            // Only update position for smooth progress - avoid UI flicker
            setPosition(state.position)
            
            // Sync full state occasionally to catch any changes
            if (Math.random() < 0.1) { // 10% of the time
              setPlayerState(state)
              if (state.track_window?.current_track?.duration_ms !== duration) {
                setDuration(state.track_window.current_track.duration_ms || 0)
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to get current state:', error)
        }
      }, 250) // Update every 250ms for super smooth progress
      
    } else {
      if (intervalRef.current) {
        console.log('⏹️ Stopping position updates - paused or no duration')
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

  const handlePlayPause = async () => {
    if (!player) {
      console.error('Player not available')
      return
    }
    
    try {
      console.log('🎮 Toggling play/pause...', { currentPaused: playerState?.paused })
      
      // INSTANT UI FEEDBACK - Update immediately for responsiveness
      if (playerState) {
        const optimisticState = { ...playerState, paused: !playerState.paused }
        setPlayerState(optimisticState)
      }
      
      // Execute the actual command
      await player.togglePlay()
      console.log('✅ Play/pause command executed successfully')
      
    } catch (error) {
      console.error('❌ Failed to toggle play/pause:', error)
      // Revert optimistic update on failure
      const actualState = await player.getCurrentState()
      if (actualState) setPlayerState(actualState)
    }
  }

  const handlePrevious = async () => {
    if (!player) {
      console.error('Player not available')
      return
    }
    
    try {
      console.log('⏪ Going to previous track...')
      
      // Execute the command - track change will be handled by player_state_changed event
      await player.previousTrack()
      console.log('✅ Previous track command executed successfully')
      
    } catch (error) {
      console.error('❌ Failed to go to previous track:', error)
    }
  }

  const handleNext = async () => {
    if (!player) {
      console.error('Player not available')
      return
    }
    
    try {
      console.log('⏩ Going to next track...')
      
      // Execute the command - track change will be handled by player_state_changed event
      await player.nextTrack()
      console.log('✅ Next track command executed successfully')
      
    } catch (error) {
      console.error('❌ Failed to go to next track:', error)
    }
  }

  const handleSeek = async (newPosition: number[]) => {
    if (!player) {
      console.error('Player not available')
      return
    }
    
    try {
      const seekPosition = Math.floor((newPosition[0] / 100) * duration)
      console.log('🎯 Seeking to position:', seekPosition, 'of', duration, `(${newPosition[0]}%)`)
      
      // INSTANT UI FEEDBACK - Update position immediately
      setPosition(seekPosition)
      
      // Execute the actual seek command
      await player.seek(seekPosition)
      console.log('✅ Seek command executed successfully')
      
    } catch (error) {
      console.error('❌ Failed to seek:', error)
      // Revert to actual position on failure
      const actualState = await player.getCurrentState()
      if (actualState) {
        setPosition(actualState.position)
        setPlayerState(actualState)
      }
    }
  }

  const handleVolumeChange = async (newVolume: number[]) => {
    if (!player) {
      console.error('Player not available')
      return
    }
    
    try {
      const volumeValue = newVolume[0] / 100
      console.log('🔊 Setting volume to:', volumeValue, `(${newVolume[0]}%)`)
      
      // INSTANT UI FEEDBACK - Update volume slider immediately
      setVolume(newVolume[0])
      
      // Execute the actual volume command
      await player.setVolume(volumeValue)
      console.log('✅ Volume command executed successfully')
      
    } catch (error) {
      console.error('❌ Failed to set volume:', error)
      // Revert to actual volume on failure
      try {
        const actualVolume = await player.getVolume()
        setVolume(Math.round(actualVolume * 100))
      } catch (getError) {
        console.error('Failed to get actual volume:', getError)
      }
    }
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const transferPlaybackToDevice = async (deviceId: string) => {
    if (!deviceId) return
    
    try {
      console.log('Transferring playback to device:', deviceId)
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false, // Don't auto-play, just transfer
        }),
      })
      
      if (!response.ok) {
        const error = await response.text()
        console.error('Transfer playback failed:', response.status, error)
      } else {
        console.log('Playback transferred successfully')
      }
    } catch (error) {
      console.error('Failed to transfer playback:', error)
    }
  }

  const transferPlayback = async () => {
    if (!deviceId) return
    await transferPlaybackToDevice(deviceId)
  }

  if (!isReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spotify Player</CardTitle>
          <CardDescription>
            {deviceId ? 'Connecting to Spotify...' : 'Loading Spotify Web Player...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
        </CardContent>
      </Card>
    )
  }

  if (!playerState || !playerState.track_window?.current_track) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spotify Player</CardTitle>
          <CardDescription>Web player ready - transfer playback to start</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Button onClick={transferPlayback} className="bg-green-500 hover:bg-green-600">
            Transfer Playback to Web Player
          </Button>
          <p className="text-gray-500 text-sm mt-2">
            Click to start playing music through this web player
          </p>
        </CardContent>
      </Card>
    )
  }

  const currentTrack = playerState.track_window.current_track
  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Now Playing</CardTitle>
        <CardDescription>Spotify Web Player</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Track Info */}
        <div className="flex items-center gap-4">
          {currentTrack.album.images[0] && (
            <Image
              src={currentTrack.album.images[0].url}
              alt="Album cover"
              width={80}
              height={80}
              className="rounded-lg"
            />
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{currentTrack.name}</h3>
            <p className="text-gray-600">
              by {currentTrack.artists.map(artist => artist.name).join(', ')}
            </p>
            <p className="text-gray-500 text-sm">
              from "{currentTrack.album.name}"
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[progressPercentage]}
            max={100}
            step={1}
            onValueChange={handleSeek}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-500">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            onClick={handlePlayPause}
            className="h-12 w-12 bg-green-500 hover:bg-green-600"
          >
            {playerState.paused ? (
              <Play className="h-6 w-6" />
            ) : (
              <Pause className="h-6 w-6" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-gray-500" />
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            className="flex-1"
          />
          <span className="text-sm text-gray-500 w-8">{volume}%</span>
        </div>
      </CardContent>
    </Card>
  )
}