import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'This endpoint has been deprecated. Please use NextAuth credentials sign-in instead.'
    },
    { status: 410 }
  )
}
