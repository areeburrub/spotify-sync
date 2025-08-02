const getApiToken = async () => {
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=client_credentials&client_id=${process.env.SPOTIFY_CLIENT_ID}&client_secret=${process.env.SPOTIFY_CLIENT_SECRET}`,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
};

export const spotifyBase = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getApiToken();
    
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            ...options.headers,
        },
    });

    if (!response.ok) {
        throw new Error(`Spotify API error! status: ${response.status}`);
    }

    return response.json();
};