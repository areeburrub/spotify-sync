'use server';

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  followers: {
    total: number;
  };
  country: string;
  product: string;
}

export interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  progress_ms: number;
  item: {
    id: string;
    name: string;
    artists: Array<{
      id: string;
      name: string;
    }>;
    album: {
      id: string;
      name: string;
      images: Array<{
        url: string;
        height: number;
        width: number;
      }>;
    };
    duration_ms: number;
    external_urls: {
      spotify: string;
    };
  };
  device: {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number;
  };
}

export async function getCurrentUser(): Promise<SpotifyUser | null> {
  try {
    // This would typically get the access token from your auth system
    // For now, returning mock data
    const mockUser: SpotifyUser = {
      id: "user123",
      display_name: "John Doe",
      email: "john@example.com",
      images: [
        {
          url: "https://i.scdn.co/image/ab6775700000ee85372eebffba16000c7bca8ea8",
          height: 640,
          width: 640
        }
      ],
      followers: {
        total: 42
      },
      country: "US",
      product: "premium"
    };
    
    return mockUser;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

export async function getCurrentPlayback(): Promise<SpotifyCurrentlyPlaying | null> {
  try {
    // This would typically get the access token and make API call
    // For now, returning mock data
    const mockPlayback: SpotifyCurrentlyPlaying = {
      is_playing: true,
      progress_ms: 142000,
      item: {
        id: "track123",
        name: "Blinding Lights",
        artists: [
          {
            id: "artist123",
            name: "The Weeknd"
          }
        ],
        album: {
          id: "album123",
          name: "After Hours",
          images: [
            {
              url: "https://i.scdn.co/image/ab67616d0000b273c02f8bc28d8b0f87b2cce71e",
              height: 640,
              width: 640
            }
          ]
        },
        duration_ms: 200040,
        external_urls: {
          spotify: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b"
        }
      },
      device: {
        id: "device123",
        is_active: true,
        is_private_session: false,
        is_restricted: false,
        name: "MacBook Pro",
        type: "Computer",
        volume_percent: 75
      }
    };
    
    return mockPlayback;
  } catch (error) {
    console.error('Error fetching current playback:', error);
    return null;
  }
}