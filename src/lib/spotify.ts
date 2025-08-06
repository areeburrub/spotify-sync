import crypto from 'crypto'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1'

export interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

export interface SpotifyUser {
  id: string
  display_name: string | null
  email: string
  images: Array<{
    url: string
    height: number | null
    width: number | null
  }>
}

export interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string }>
  }
  external_urls: {
    spotify: string
  }
}

export interface CurrentlyPlaying {
  is_playing: boolean
  item: SpotifyTrack | null
  progress_ms: number | null
}

// Generate PKCE code verifier and challenge
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  
  return { codeVerifier, codeChallenge }
}

// Generate authorization URL with PKCE
export function getAuthorizationUrl(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    scope: 'user-read-private user-read-email user-read-currently-playing user-read-playback-state user-modify-playback-state streaming',
    show_dialog: 'false',
  })
  
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`
}

// Exchange authorization code for access tokens
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<SpotifyTokenResponse> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
  }
  
  return response.json()
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
  }
  
  return response.json()
}

// Get user profile from Spotify API
export async function getSpotifyUser(accessToken: string): Promise<SpotifyUser> {
  const response = await fetch(`${SPOTIFY_API_BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get user profile: ${error.error?.message || response.statusText}`)
  }
  
  return response.json()
}

// Get currently playing track
export async function getCurrentlyPlaying(accessToken: string): Promise<CurrentlyPlaying | null> {
  const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/currently-playing`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  
  if (response.status === 204) {
    // No content - nothing is playing
    return null
  }
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get currently playing: ${error.error?.message || response.statusText}`)
  }
  
  return response.json()
}

// Encrypt token for database storage using AES-256-CBC
export function encryptToken(token: string): string {
  const key = process.env.ENCRYPTION_KEY || 'fallback-32-character-key-here!!'
  // Create a 32-byte key from the provided key
  const keyBuffer = crypto.createHash('sha256').update(key).digest()
  
  const iv = crypto.randomBytes(16) // 16 bytes for CBC
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv)
  
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return `${iv.toString('hex')}:${encrypted}`
}

// Decrypt token from database using AES-256-CBC
export function decryptToken(encryptedToken: string): string {
  const key = process.env.ENCRYPTION_KEY || 'fallback-32-character-key-here!!'
  // Create a 32-byte key from the provided key
  const keyBuffer = crypto.createHash('sha256').update(key).digest()
  
  const [ivHex, encrypted] = encryptedToken.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}