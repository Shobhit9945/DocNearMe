import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../[...nextauth]/route'
import prisma from '../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Delete the Google account from database
    const deleted = await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: 'google'
      }
    })

    console.log('[disconnect-google] Deleted', deleted.count, 'Google accounts for user', session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Google account disconnected',
      deletedCount: deleted.count
    })
  } catch (error) {
    console.error('[disconnect-google] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
