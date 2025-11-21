import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../[...nextauth]/route'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    return NextResponse.json({
      user: session.user,
      providers: session.user?.providers ?? [],
      hasGoogle: (session.user?.providers ?? []).includes('google')
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}