import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-green-500 to-black">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-6">
            Spotify Sync
          </h1>
          <p className="text-xl text-green-100 mb-8 max-w-2xl mx-auto">
            Connect your Spotify account and sync your music experience. Manage playlists, discover new tracks, and keep your music organized.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-white text-green-600 hover:bg-green-50 font-semibold px-8 py-3 text-lg">
              Get Started
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                Easy Connection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-green-100">
                Connect your Spotify account with just one click using secure OAuth authentication.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                Music Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-green-100">
                Sync and manage your playlists, favorite tracks, and music preferences seamlessly.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Secure & Private
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-green-100">
                Your data is encrypted and stored securely. We respect your privacy and never share your information.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16">
          <p className="text-green-100 text-sm">
            Ready to enhance your music experience?
          </p>
        </div>
      </div>
    </div>
  );
}
