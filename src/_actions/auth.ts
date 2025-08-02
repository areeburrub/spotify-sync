"use server";

import { redirect } from "next/navigation";
import { PrismaClient } from "@/src/generated/prisma";

const prisma = new PrismaClient();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3000/auth/callback";

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export async function spotifyLogin() {
  const state = generateRandomString(16);
  const scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state';

  const authUrl = 'https://accounts.spotify.com/authorize?' +
    'response_type=code' +
    '&client_id=' + encodeURIComponent(SPOTIFY_CLIENT_ID) +
    '&scope=' + encodeURIComponent(scope) +
    '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
    '&state=' + encodeURIComponent(state);

  console.log('Auth URL:', authUrl);

  redirect(authUrl);
}

export async function handleSpotifyCallback(code: string, state: string) {
  if (!code || !state) {
    throw new Error('Missing required parameters: code and state');
  }

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      throw new Error(`Failed to exchange code for tokens: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    
    if (!tokens.access_token) {
      throw new Error('No access token received from Spotify');
    }

    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.text();
      console.error('User profile fetch failed:', errorData);
      throw new Error(`Failed to fetch user profile: ${userResponse.status}`);
    }

    const userProfile = await userResponse.json();
    
    if (!userProfile.id) {
      throw new Error('Invalid user profile data received');
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const user = await prisma.user.upsert({
      where: { spotifyId: userProfile.id },
      update: {
        email: userProfile.email,
        name: userProfile.display_name,
        displayName: userProfile.display_name,
        image: userProfile.images?.[0]?.url,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt,
        updatedAt: new Date()
      },
      create: {
        email: userProfile.email,
        name: userProfile.display_name,
        spotifyId: userProfile.id,
        displayName: userProfile.display_name,
        image: userProfile.images?.[0]?.url,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt
      }
    });

    return user;
  } catch (error) {
    console.error('Spotify callback handling failed:', error);
    throw error;
  }
}

export async function refreshSpotifyToken(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user || !user.refreshToken) {
    throw new Error('User not found or no refresh token available');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken
    })
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || user.refreshToken,
      expiresAt: expiresAt,
      updatedAt: new Date()
    }
  });

  return updatedUser;
}