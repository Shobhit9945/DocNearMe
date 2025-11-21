import { NextResponse } from 'next/server'

export async function GET() {
  const hasGoogleCredentials = !!(
    process.env.GOOGLE_CLIENT_ID && 
    process.env.GOOGLE_CLIENT_SECRET
  )

  return NextResponse.json({
    googleOAuthConfigured: hasGoogleCredentials,
    message: hasGoogleCredentials 
      ? 'Google OAuth is configured'
      : 'Google OAuth credentials missing. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local'
  })
}