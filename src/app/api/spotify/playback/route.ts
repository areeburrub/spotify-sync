import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { getValidSpotifyToken } from '@/lib/spotify-token'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, trackUri, position, volume } = await request.json()

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const accessToken = await getValidSpotifyToken(user.id)
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Unable to get valid Spotify access token' }, { status: 401 })
    }

    let spotifyEndpoint = ''
    let method = 'PUT'
    let body = null

    switch (action) {
      case 'play':
        spotifyEndpoint = 'https://api.spotify.com/v1/me/player/play'
        if (trackUri) {
          body = JSON.stringify({ uris: [trackUri] })
        }
        break
      case 'pause':
        spotifyEndpoint = 'https://api.spotify.com/v1/me/player/pause'
        break
      case 'seek':
        if (typeof position !== 'number') {
          return NextResponse.json({ error: 'Position is required for seek action' }, { status: 400 })
        }
        spotifyEndpoint = `https://api.spotify.com/v1/me/player/seek?position_ms=${position}`
        break
      case 'next':
        spotifyEndpoint = 'https://api.spotify.com/v1/me/player/next'
        method = 'POST'
        break
      case 'previous':
        spotifyEndpoint = 'https://api.spotify.com/v1/me/player/previous'
        method = 'POST'
        break
      case 'volume':
        if (typeof volume !== 'number' || volume < 0 || volume > 100) {
          return NextResponse.json({ error: 'Volume must be between 0 and 100' }, { status: 400 })
        }
        spotifyEndpoint = `https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const response = await fetch(spotifyEndpoint, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body
    })

    if (response.status === 204) {
      return NextResponse.json({ success: true })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Spotify API error:', errorText)
      return NextResponse.json({ 
        error: 'Spotify API error',
        details: errorText 
      }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error controlling Spotify playback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const accessToken = await getValidSpotifyToken(user.id)
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Unable to get valid Spotify access token' }, { status: 401 })
    }

    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (response.status === 204) {
      return NextResponse.json({ isActive: false })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Spotify API error:', errorText)
      return NextResponse.json({ 
        error: 'Spotify API error',
        details: errorText 
      }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error getting Spotify playback state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}