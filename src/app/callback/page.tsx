'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      // Check for OAuth errors
      if (error) {
        setError(`Authentication failed: ${error}`)
        setStatus('error')
        return
      }

      // Check for required parameters
      if (!code || !state) {
        setError('Missing required parameters')
        setStatus('error')
        return
      }

      try {
        // Send code to our callback API
        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        })

        if (response.ok) {
          setStatus('success')
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            router.push('/app')
          }, 2000)
        } else {
          const errorData = await response.json()
          setError(errorData.error || 'Authentication failed')
          setStatus('error')
        }
      } catch (err) {
        setError('Network error occurred')
        setStatus('error')
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-blue-600 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Authenticating...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Authentication Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we connect your Spotify account.'}
            {status === 'success' && 'Your Spotify account has been connected. Redirecting to dashboard...'}
            {status === 'error' && error}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status === 'loading' && (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          )}
          {status === 'success' && (
            <div className="text-green-500 text-4xl">✓</div>
          )}
          {status === 'error' && (
            <div className="text-center">
              <div className="text-red-500 text-4xl mb-4">✗</div>
              <button
                onClick={() => router.push('/login')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-blue-600 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
            <CardDescription>Please wait while we process your authentication.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </CardContent>
        </Card>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}