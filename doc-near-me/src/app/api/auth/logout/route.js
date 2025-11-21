import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'Use next-auth signOut on the client to terminate the session.'
    },
    { status: 410 }
  )
}
