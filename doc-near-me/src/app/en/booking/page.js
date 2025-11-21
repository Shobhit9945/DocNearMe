'use client'

import { useCallback } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const CALENDAR_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0HJDIw8tveChxs7xbgXWJMvnT3kvW2u74hX-2nHjPlqr3y_gyptoAT0T6NRCKPATg7xmkWIzNd?gv=true'

export default function BookingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const handleReturnToDashboard = useCallback(() => {
    try {
      localStorage.setItem('bookingRefresh', Date.now().toString())
    } catch (error) {
      console.error('[booking] Unable to set bookingRefresh flag', error)
    }

    router.push('/en/dashboard?booking=success')
  }, [router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-sm text-blue-700">Preparing booking experience…</p>
        </div>
      </div>
    )
  }

  const googleLinked = Array.isArray(session?.user?.providers) && session.user.providers.includes('google')

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="max-w-md w-full rounded-xl bg-white shadow-lg p-8 space-y-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sign in to continue</h1>
          <p className="text-sm text-gray-600">
            You&apos;ll need to sign in with your Google account before booking an appointment so we can keep everything in sync.
          </p>
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/en/booking' })}
            className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  if (!googleLinked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="max-w-lg w-full rounded-xl bg-white shadow-lg p-8 space-y-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Connect Google to book</h1>
          <p className="text-sm text-gray-600">
            Please link your Google account so we can create and manage appointments directly in your calendar.
          </p>
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/en/booking' })}
            className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Connect Google Calendar
          </button>
          <p className="text-xs text-gray-500">
            Once connected, you&apos;ll be redirected back here to finish booking.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Book an Appointment</h1>
          <p className="text-sm text-gray-600">
            Complete your appointment booking below. Once you finish, click the button to return to your dashboard and see your updated schedule.
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-4">
          <iframe
            title="Book an Appointment"
            src={CALENDAR_URL}
            style={{ border: 0 }}
            width="100%"
            height="600"
            frameBorder="0"
            className="w-full"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-blue-900 font-medium">Done booking?</p>
            <p className="text-sm text-blue-700">
              We&apos;ll take you back to your dashboard and refresh your upcoming appointments.
            </p>
          </div>
          <button
            onClick={handleReturnToDashboard}
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
