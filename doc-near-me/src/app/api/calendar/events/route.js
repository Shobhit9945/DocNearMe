import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import prisma from '../../../../../lib/prisma'
import {
  createOAuth2Client,
  createCalendarClient,
  refreshOAuthAccessToken,
  listUpcomingEvents
} from '../../../../../lib/googleCalendar'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_RESULTS = 20
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_SYNC_CALENDAR_ID ?? 'primary'

const mapEvent = (event) => {
  const start = event.start?.dateTime ?? event.start?.date ?? null
  const end = event.end?.dateTime ?? event.end?.date ?? null

  return {
    id: event.id,
    status: event.status,
    summary: event.summary ?? 'Untitled Appointment',
    description: event.description ?? '',
    start,
    end,
    location: event.location ?? '',
    hangoutLink: event.hangoutLink ?? '',
    htmlLink: event.htmlLink ?? '',
    created: event.created ?? null,
    updated: event.updated ?? null,
    organizer: event.organizer?.email ?? null
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const providers = session.user?.providers ?? []

    if (!providers.includes('google')) {
      return NextResponse.json(
        {
          error: 'Connect your Google account to sync appointments.',
          requireGoogleAuth: true
        },
        { status: 428 }
      )
    }

    const googleAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google'
      }
    })

    if (!googleAccount) {
      return NextResponse.json(
        {
          error: 'Google account not linked. Please sign in with Google to continue.',
          requireGoogleAuth: true
        },
        { status: 428 }
      )
    }

    let accessToken = googleAccount.access_token ?? null
    let refreshToken = googleAccount.refresh_token ?? null
    let expiresAt = googleAccount.expires_at ? googleAccount.expires_at * 1000 : null

    if (!refreshToken) {
      return NextResponse.json(
        {
          error: 'Missing Google authorization. Please reconnect your Google account.',
          requireGoogleAuth: true
        },
        { status: 428 }
      )
    }

    const needsRefresh = !accessToken || !expiresAt || Date.now() >= expiresAt - TOKEN_EXPIRY_BUFFER_MS

    if (needsRefresh) {
      try {
        const refreshed = await refreshOAuthAccessToken(refreshToken)
        accessToken = refreshed.accessToken
        refreshToken = refreshed.refreshToken
        expiresAt = refreshed.expiryDate ?? null

        await prisma.account.update({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: googleAccount.providerAccountId
            }
          },
          data: {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt ? Math.floor(expiresAt / 1000) : null
          }
        })
      } catch (error) {
        console.error('[calendar] Failed to refresh Google access token', error)
        return NextResponse.json(
          {
            error: 'Google authorization expired. Please reconnect your account.',
            requireGoogleAuth: true
          },
          { status: 401 }
        )
      }
    }

    const oauthClient = createOAuth2Client({
      accessToken,
      refreshToken,
      expiryDate: expiresAt ?? undefined
    })

    const calendar = createCalendarClient(oauthClient)

    const now = new Date().toISOString()
    const events = await listUpcomingEvents(calendar, {
      calendarId: CALENDAR_ID,
      timeMin: now,
      maxResults: MAX_RESULTS
    })

    const upcomingEvents = events.map(mapEvent)

    const recentActivity = [...events]
      .filter((event) => event.updated)
      .sort((a, b) => new Date(b.updated) - new Date(a.updated))
      .slice(0, 5)
      .map(mapEvent)

    return NextResponse.json({ upcomingEvents, recentActivity })
  } catch (error) {
    console.error('[calendar] Failed to fetch events', error)
    return NextResponse.json({ error: 'Failed to load calendar data' }, { status: 500 })
  }
}
