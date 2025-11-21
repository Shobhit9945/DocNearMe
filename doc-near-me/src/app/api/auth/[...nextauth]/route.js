import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import prisma from '../../../../../lib/prisma'

const isProduction = process.env.NODE_ENV === 'production'
const requiredEnvVars = ['NEXTAUTH_SECRET']

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const providers = []

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid profile email https://www.googleapis.com/auth/calendar.readonly'
        }
      }
    })
  )
} else {
  console.warn('[NextAuth] Google OAuth credentials missing. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local')
}

providers.push(
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Please enter your email and password')
      }

      const email = credentials.email.trim().toLowerCase()
      const password = credentials.password

      if (password.length < 8) {
        throw new Error('Invalid email or password')
      }

      try {
        const user = await prisma.user.findUnique({
          where: { email }
        })

        if (!user?.password) {
          throw new Error('Invalid email or password')
        }

        const isValid = await bcrypt.compare(password, user.password)

        if (!isValid) {
          throw new Error('Invalid email or password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? undefined
        }
      } catch (error) {
        console.error('[auth][credentials] authorize error', error)
        throw new Error('Invalid email or password')
      }
    }
  })
)

const ensureProvider = (currentProviders, provider) => {
  if (!provider) {
    return Array.isArray(currentProviders) ? currentProviders : []
  }

  const providersList = Array.isArray(currentProviders) ? currentProviders : []

  if (providersList.includes(provider)) {
    return providersList
  }

  return [...providersList, provider]
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 7
  },
  cookies: {
    sessionToken: {
      name: isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction
      }
    }
  },
  providers,
  pages: {
    signIn: '/en/auth'
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const emailVerified = profile?.email_verified ?? profile?.emailVerified
        if (emailVerified === false) {
          throw new Error('Google account email must be verified')
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }
      
      // Always fetch the latest providers from database to ensure consistency
      if (token.id) {
        try {
          const accounts = await prisma.account.findMany({
            where: { userId: token.id },
            select: { provider: true }
          })
          token.providers = accounts.map(acc => acc.provider)
        } catch (error) {
          console.error('[auth] Failed to fetch user accounts', error)
          token.providers = Array.isArray(token.providers) ? token.providers : []
        }
      }
      
      // Also add the current account provider if it's a new login
      if (account?.provider) {
        token.providers = ensureProvider(token.providers, account.provider)
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id
      }
      if (session.user) {
        session.user.providers = Array.isArray(token.providers) ? token.providers : []
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      try {
        const parsedUrl = new URL(url, baseUrl)
        if (parsedUrl.origin === baseUrl) {
          return parsedUrl.href
        }
      } catch (error) {
        console.error('[auth] redirect callback error', error)
      }
      return baseUrl
    }
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
