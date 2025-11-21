import { google } from 'googleapis'

function getOAuthClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth client credentials')
  }

  return { clientId, clientSecret }
}

export function createOAuth2Client({ accessToken, refreshToken, expiryDate }) {
  const { clientId, clientSecret } = getOAuthClientCredentials()

  const oauth2Client = new google.auth.OAuth2({
    clientId,
    clientSecret
  })

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate
  })

  return oauth2Client
}

export function createCalendarClient(authClient) {
  return google.calendar({ version: 'v3', auth: authClient })
}

export async function refreshOAuthAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Google refresh token is missing')
  }

  const { clientId, clientSecret } = getOAuthClientCredentials()

  const oauth2Client = new google.auth.OAuth2({
    clientId,
    clientSecret
  })

  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? refreshToken,
    expiryDate: credentials.expiry_date
  }
}

export async function listUpcomingEvents(calendar, { calendarId, timeMin, maxResults = 10 }) {
  const response = await calendar.events.list({
    calendarId,
    timeMin,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime'
  })

  return response.data.items ?? []
}
