'use client'

import { useSpotify } from '@/contexts/SpotifyContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Image from 'next/image'
import { Play, Pause, SkipBack, SkipForward, Volume2, Shuffle, Repeat, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function SpotifyPlayerV2() {
  const {
    playerState,
    isReady,
    deviceId,
    volume,
    position,
    duration,
    togglePlay,
    previousTrack,
    nextTrack,
    seek,
    setVolume,
    transferPlayback,
    play,
    getUserPlaylists,
    error,
    clearError
  } = useSpotify()

  const [playlists, setPlaylists] = useState<any[]>([])
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false)

  // Load user playlists for quick access
  useEffect(() => {
    if (isReady && deviceId) {
      loadUserPlaylists()
    }
  }, [isReady, deviceId])

  const loadUserPlaylists = async () => {
    try {
      setIsLoadingPlaylists(true)
      const playlistData = await getUserPlaylists(10) // Get top 10 playlists
      if (playlistData?.items) {
        setPlaylists(playlistData.items)
      }
    } catch (err) {
      console.error('Failed to load playlists:', err)
    } finally {
      setIsLoadingPlaylists(false)
    }
  }

  const handlePlayPlaylist = async (playlistUri: string) => {
    try {
      await play(playlistUri)
    } catch (err) {
      console.error('Failed to play playlist:', err)
    }
  }

  const handleTransferPlayback = async () => {
    try {
      await transferPlayback(deviceId, false)
    } catch (err) {
      console.error('Failed to transfer playback:', err)
    }
  }

  const handleSeek = async (newPosition: number[]) => {
    if (duration > 0) {
      const seekPosition = Math.floor((newPosition[0] / 100) * duration)
      try {
        await seek(seekPosition)
      } catch (err) {
        console.error('Failed to seek:', err)
      }
    }
  }

  const handleVolumeChange = async (newVolume: number[]) => {
    try {
      await setVolume(newVolume[0])
    } catch (err) {
      console.error('Failed to set volume:', err)
    }
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Loading state
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          {error && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error && !playerState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spotify Player</CardTitle>
          <CardDescription>Connection Error</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={clearError} variant="outline">
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    )
  }

  // No track playing state
  if (!playerState?.track_window?.current_track) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spotify Player</CardTitle>
          <CardDescription>Ready to play music</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="text-center py-4">
            <Button onClick={handleTransferPlayback} className="bg-green-500 hover:bg-green-600 mb-4">
              Transfer Playback to Web Player
            </Button>
            <p className="text-gray-500 text-sm mb-4">
              Or start playing music from your Spotify app, then transfer here
            </p>
            
            <div className="space-y-2">
              <Button 
                onClick={() => togglePlay()} 
                variant="outline"
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Playing Music
              </Button>
            </div>
          </div>

          {/* Quick Playlist Access */}
          {playlists.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Quick Play</h4>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {playlists.slice(0, 5).map((playlist) => (
                  <Button
                    key={playlist.id}
                    variant="ghost"
                    className="justify-start text-left h-auto p-2"
                    onClick={() => handlePlayPlaylist(playlist.uri)}
                  >
                    <div className="flex items-center gap-2">
                      {playlist.images?.[0] && (
                        <Image
                          src={playlist.images[0].url}
                          alt={playlist.name}
                          width={32}
                          height={32}
                          className="rounded"
                        />
                      )}
                      <div className="truncate">
                        <div className="font-medium truncate">{playlist.name}</div>
                        <div className="text-xs text-gray-500">{playlist.tracks?.total || 0} tracks</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
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
        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button variant="ghost" size="sm" onClick={clearError} className="ml-2">
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

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
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{currentTrack.name}</h3>
            <p className="text-gray-600 truncate">
              by {currentTrack.artists.map(artist => artist.name).join(', ')}
            </p>
            <p className="text-gray-500 text-sm truncate">
              from "{currentTrack.album.name}"
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[progressPercentage]}
            max={100}
            step={0.1}
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
            onClick={previousTrack}
            disabled={!playerState}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            onClick={togglePlay}
            className="h-12 w-12 bg-green-500 hover:bg-green-600"
            disabled={!playerState}
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
            onClick={nextTrack}
            disabled={!playerState}
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

        {/* Context Info */}
        {playerState.context?.uri && (
          <div className="text-xs text-gray-500 text-center">
            Playing from: {playerState.context.uri.split(':')[1]} 
          </div>
        )}
      </CardContent>
    </Card>
  )
}