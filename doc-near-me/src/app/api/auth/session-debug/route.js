import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../[...nextauth]/route'
import prisma from '../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated', session },
        { status: 401 }
      )
    }

    // Fetch user's linked accounts from database
    const accounts = await prisma.account.findMany({
      where: { userId: session.user.id },
      select: {
        provider: true,
        providerAccountId: true
      }
    })

    return NextResponse.json({
      session,
      accounts,
      providers: accounts.map(acc => acc.provider),
      sessionProviders: session.user.providers,
      debug: {
        userId: session.user.id,
        accountCount: accounts.length,
        hasGoogle: accounts.some(acc => acc.provider === 'google'),
        sessionHasGoogle: session.user.providers?.includes('google')
      }
    })
  } catch (error) {
    console.error('[session-debug] Error:', error)
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
