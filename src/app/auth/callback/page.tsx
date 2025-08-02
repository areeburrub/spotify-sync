'use client';

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleSpotifyCallback } from "@/_actions/auth";

export default function CallbackPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        router.push(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      if (!code || !state) {
        router.push('/login?error=missing_parameters');
        return;
      }

      try {
        await handleSpotifyCallback(code, state);
        router.push('/dashboard');
      } catch (err) {
        console.error('Callback error:', err);
        setError('Authentication failed. Please try again.');
        setLoading(false);
        setTimeout(() => {
          router.push('/login?error=callback_failed');
        }, 2000);
      }
    };

    processCallback();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <h2 className="text-xl font-semibold mt-4">Authenticating with Spotify...</h2>
          <p className="text-gray-600 mt-2">Please wait while we complete your login.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-600">{error}</h2>
          <p className="text-gray-600 mt-2">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return null;
}