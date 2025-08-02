import { NextAuthOptions } from 'next-auth'
import SpotifyProvider from 'next-auth/providers/spotify'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

const scopes = [
  'user-read-email',
  'user-read-private',
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ')

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: scopes
        }
      }
    })
  ],
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "database"
  },
  callbacks: {
    async session({ session, user }) {
      // With database sessions, we need to get the access token from the Account table
      if (user && session.user) {
        try {
          const account = await prisma.account.findFirst({
            where: {
              userId: user.id,
              provider: 'spotify'
            }
          })
          
          if (account && account.access_token) {
            (session as any).accessToken = account.access_token
          }
        } catch (error) {
          console.error("Error fetching account:", error)
        }
      }
      
      return session
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      console.log("SignIn event:", { user, account, profile })
    },
    async signOut({ session, token }) {
      console.log("SignOut event")
    }
  },
}