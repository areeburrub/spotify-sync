import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { getCurrentUser, getCurrentPlayback } from "@/_actions/spotify";
import Image from "next/image";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const playback = await getCurrentPlayback();

  const progressPercentage = playback?.item 
    ? (playback.progress_ms / playback.item.duration_ms) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-green-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">Spotify Sync</h1>
            <p className="text-green-400">Dashboard</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <Card className="bg-black/40 border-green-500/20 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-3">
                {user?.images?.[0] && (
                  <Image
                    src={user.images[0].url}
                    alt={user.display_name}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                )}
                <div>
                  <div className="text-lg">{user?.display_name || 'User'}</div>
                  <div className="text-sm text-green-400 font-normal">
                    {user?.product === 'premium' ? 'Premium User' : 'Free User'}
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Followers</span>
                <span className="text-white">{user?.followers?.total || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Country</span>
                <span className="text-white">{user?.country || 'N/A'}</span>
              </div>
              <Button className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold">
                View Profile
              </Button>
            </CardContent>
          </Card>

          {/* Now Playing Card */}
          <Card className="lg:col-span-2 bg-black/40 border-green-500/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                Now Playing
              </CardTitle>
              <CardDescription className="text-green-400">
                {playback?.is_playing ? 'Currently listening' : 'Not playing'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {playback?.item ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Image
                      src={playback.item.album.images[0]?.url || '/placeholder-album.jpg'}
                      alt={playback.item.album.name}
                      width={80}
                      height={80}
                      className="rounded-lg shadow-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {playback.item.name}
                      </h3>
                      <p className="text-gray-400 truncate">
                        {playback.item.artists.map(artist => artist.name).join(', ')}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {playback.item.album.name}
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-green-500 text-green-400 hover:bg-green-500 hover:text-black"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{Math.floor(playback.progress_ms / 60000)}:{String(Math.floor((playback.progress_ms % 60000) / 1000)).padStart(2, '0')}</span>
                      <span>{Math.floor(playback.item.duration_ms / 60000)}:{String(Math.floor((playback.item.duration_ms % 60000) / 1000)).padStart(2, '0')}</span>
                    </div>
                    <Progress 
                      value={progressPercentage} 
                      className="h-1 bg-gray-700 [&>div]:bg-green-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-sm text-gray-400">
                      Playing on <span className="text-green-400">{playback.device?.name}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      Volume: {playback.device?.volume_percent}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                  <p className="text-gray-400">No music playing</p>
                  <p className="text-sm text-gray-600 mt-2">Start playing music on Spotify to see it here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Device Info */}
        {playback?.device && (
          <Card className="mt-6 bg-black/40 border-green-500/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Active Device</CardTitle>
              <CardDescription className="text-green-400">
                Currently connected device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">{playback.device.name}</div>
                    <div className="text-sm text-gray-400">{playback.device.type}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 text-sm">
                    {playback.device.is_active ? 'Active' : 'Inactive'}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {playback.device.volume_percent}% volume
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}