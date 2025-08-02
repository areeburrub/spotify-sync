import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

console.log("Spotify Client ID:", process.env.SPOTIFY_CLIENT_ID)
console.log("NextAuth URL:", process.env.NEXTAUTH_URL)

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }