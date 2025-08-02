import { prisma } from '@/lib/prisma'

export async function refreshSpotifyToken(userId: string): Promise<string | null> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: 'spotify'
      }
    })

    if (!account || !account.refresh_token) {
      console.error('No refresh token found for user:', userId)
      return null
    }

    // Check if token is still valid (expires_at is in seconds, not milliseconds)
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = account.expires_at || 0
    
    // If token expires in more than 5 minutes, return current token
    if (expiresAt > now + 300) {
      return account.access_token
    }

    console.log('Refreshing Spotify access token for user:', userId)

    // Refresh the token
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to refresh Spotify token:', response.status, errorText)
      
      // If refresh fails, try to return the current token anyway (might still work)
      console.log('Attempting to use existing token as fallback')
      return account.access_token
    }

    const tokenData = await response.json()

    // Update the account with new token info
    const updatedAccount = await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokenData.access_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
        // Only update refresh_token if a new one is provided
        ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token })
      }
    })

    console.log('Successfully refreshed Spotify token for user:', userId)
    return updatedAccount.access_token

  } catch (error) {
    console.error('Error refreshing Spotify token:', error)
    return null
  }
}

export async function getValidSpotifyToken(userId: string): Promise<string | null> {
  try {
    // First try to refresh/get current token
    const token = await refreshSpotifyToken(userId)
    
    if (!token) {
      console.error('Failed to get valid Spotify token for user:', userId)
      return null
    }

    return token
  } catch (error) {
    console.error('Error getting valid Spotify token:', error)
    return null
  }
}