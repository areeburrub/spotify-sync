# Spotify Sync - OAuth Authentication System

A secure, custom Spotify OAuth authentication system built with Next.js 15, Prisma, and TypeScript.

## Features

- 🔐 **Secure OAuth Flow**: Authorization Code Flow with PKCE for maximum security
- 🍪 **Session Management**: HTTP-only cookies with JWT tokens
- 🔑 **Token Encryption**: Encrypted storage of Spotify access/refresh tokens
- 🛡️ **CSRF Protection**: State parameter validation
- 🔄 **Automatic Token Refresh**: Seamless token renewal
- 🚦 **Route Protection**: Middleware-based authentication
- 📱 **Currently Playing**: Real-time Spotify track display

## Setup Instructions

### 1. Spotify App Configuration

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://localhost:3000/callback`
4. Note your Client ID and Client Secret

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/spotify_sync"

# Spotify OAuth
SPOTIFY_CLIENT_ID="your_spotify_client_id_here"
SPOTIFY_CLIENT_SECRET="your_spotify_client_secret_here"
SPOTIFY_REDIRECT_URI="http://localhost:3000/callback"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-32-chars-min"
ENCRYPTION_KEY="your-32-character-encryption-key!!"

# App
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations (if you have a database set up)
npx prisma db push
```

### 4. Install Dependencies & Run

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` to start using the app!

## How It Works

### Authentication Flow

1. **Login**: User clicks "Continue with Spotify" → redirected to `/api/auth/login`
2. **Authorization**: Server generates PKCE parameters and redirects to Spotify
3. **Callback**: Spotify redirects to `/callback` with authorization code
4. **Token Exchange**: Frontend sends code to `/api/auth/callback` for token exchange
5. **Session Creation**: Server creates encrypted session and sets HTTP-only cookie
6. **Dashboard Access**: User redirected to protected `/app` route

### Security Features

- **PKCE (Proof Key for Code Exchange)**: Prevents authorization code interception
- **State Parameter**: Protects against CSRF attacks  
- **Token Encryption**: Access/refresh tokens encrypted before database storage
- **HTTP-only Cookies**: Session tokens inaccessible to client-side JavaScript
- **Middleware Protection**: Routes automatically protected based on authentication status

### API Routes

- `GET /api/auth/login` - Initiates OAuth flow
- `POST /api/auth/callback` - Handles OAuth callback  
- `POST /api/auth/refresh` - Refreshes expired tokens
- `POST /api/auth/logout` - Clears session and cookies

### Protected Routes

- `/app` - Main dashboard (requires authentication)
- `/` - Redirects based on auth status
- `/login` - Public login page
- `/callback` - OAuth callback handler

### Database Schema

```prisma
model User {
  id              String    @id @default(cuid())
  spotifyId       String    @unique
  email           String    @unique  
  displayName     String?
  images          Json?     // Array of Spotify image objects
  accessToken     String    // Encrypted
  refreshToken    String    // Encrypted
  tokenExpiresAt  DateTime
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  sessions        Session[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique // JWT token
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Custom OAuth implementation (no NextAuth)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Security**: JWT, encryption, PKCE, CSRF protection

## Production Deployment

1. Set up production database
2. Update environment variables for production
3. Ensure `SPOTIFY_REDIRECT_URI` matches your production domain
4. Update Spotify app settings with production redirect URI
5. Use strong, random values for `JWT_SECRET` and `ENCRYPTION_KEY`

## Spotify Scopes

The app requests these permissions:
- `user-read-private` - Access user's profile info  
- `user-read-email` - Access user's email
- `user-read-currently-playing` - Access currently playing track

## License

MIT License - feel free to use this as a starting point for your own projects!
