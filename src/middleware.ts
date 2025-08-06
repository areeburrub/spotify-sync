import { NextRequest, NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
const SESSION_COOKIE_NAME = 'spotify-session'

// Simple JWT verification using Web Crypto API (edge runtime compatible)
async function verifyJWTWithWebCrypto(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    
    const [headerB64, payloadB64, signatureB64] = parts
    
    // Decode header and payload
    const header = JSON.parse(atob(headerB64))
    const payload = JSON.parse(atob(payloadB64))
    
    // Check if token is expired
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false
    }
    
    // Create signature verification data
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const secretKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    // Decode the signature from base64url
    const signature = new Uint8Array(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => c.charCodeAt(0))
    )
    
    // Verify signature
    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      signature,
      data
    )
    
    return isValid
  } catch (error) {
    console.log('JWT verification error:', error)
    return false
  }
}

// Define protected and public routes
const protectedRoutes = ['/app']
const publicRoutes = ['/login', '/callback', '/']
const apiRoutes = ['/api/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Skip files with extensions
  ) {
    return NextResponse.next()
  }
  
  // Check if current route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.includes(pathname)
  
  // Get session token from cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  
  console.log('Middleware - Path:', pathname)
  console.log('Middleware - Session cookie found:', !!token)
  if (token) {
    console.log('Middleware - Token (first 20 chars):', token.substring(0, 20))
  }
  
  let isAuthenticated = false
  
  if (token) {
    // Verify JWT token using Web Crypto API (edge runtime compatible)
    isAuthenticated = await verifyJWTWithWebCrypto(token, JWT_SECRET)
    console.log('Middleware - JWT verification result:', isAuthenticated)
  }
  
  console.log('Middleware - Is authenticated:', isAuthenticated)
  
  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
  
  // Redirect authenticated users from login page to dashboard
  if (pathname === '/login' && isAuthenticated) {
    const dashboardUrl = new URL('/app', request.url)
    return NextResponse.redirect(dashboardUrl)
  }
  
  // Redirect root path based on authentication status
  if (pathname === '/') {
    if (isAuthenticated) {
      const dashboardUrl = new URL('/app', request.url)
      return NextResponse.redirect(dashboardUrl)
    } else {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}