'use client'

import { useSession, signOut, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

const CALENDAR_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0HJDIw8tveChxs7xbgXWJMvnT3kvW2u74hX-2nHjPlqr3y_gyptoAT0T6NRCKPATg7xmkWIzNd?gv=true'

export const dynamic = 'force-dynamic'

export default function Dashboard() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [showBookingSuccess, setShowBookingSuccess] = useState(false)
  const isMounted = useRef(true)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [requiresGoogleAuth, setRequiresGoogleAuth] = useState(false)
  const [connectInProgress, setConnectInProgress] = useState(false)
  const [connectError, setConnectError] = useState('')

  useEffect(() => () => {
    isMounted.current = false
  }, [])

  const loadCalendarData = useCallback(async () => {
    setCalendarLoading(true)
    setCalendarError('')

    let requireGoogleAuth = false

    try {
      const response = await fetch('/api/calendar/events', { cache: 'no-store' })
      let payload = {}

      try {
        payload = await response.json()
      } catch {
        payload = {}
      }

      if (!response.ok) {
        const message = payload?.error ?? 'Unable to load calendar data'
        requireGoogleAuth = Boolean(payload?.requireGoogleAuth)

        if (isMounted.current) {
          // Always show the error message, don't hide it
          setCalendarError(message)
          // Only set requiresGoogleAuth if explicitly told AND the message doesn't indicate expired tokens
          if (requireGoogleAuth && !message.includes('expired') && !message.includes('authorization')) {
            setRequiresGoogleAuth(true)
          }
        }

        throw new Error(message)
      }

      if (!isMounted.current) return

      setRequiresGoogleAuth(false)
      setUpcomingEvents(payload?.upcomingEvents ?? [])
      setRecentActivity(payload?.recentActivity ?? [])
    } catch (error) {
      if (!isMounted.current) return
      console.error('[dashboard] calendar fetch error', error)

      if (!requireGoogleAuth) {
        setCalendarError(error.message ?? 'Failed to load calendar data')
      }
    } finally {
      if (isMounted.current) {
        setCalendarLoading(false)
      }
    }
  }, [])

  const formatEventDate = useCallback((start, end) => {
    if (!start) {
      return 'Time to be determined'
    }

    const isAllDay = !start.includes('T')
    const startDate = new Date(start)
    const endDate = end ? new Date(end) : null
    const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

    if (isAllDay) {
      if (endDate && end && end !== start) {
        return `${dateFormatter.format(startDate)} - ${dateFormatter.format(endDate)}`
      }

      return dateFormatter.format(startDate)
    }

    const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    const startString = `${dateFormatter.format(startDate)} · ${timeFormatter.format(startDate)}`

    if (endDate && end?.includes('T')) {
      return `${startString} - ${timeFormatter.format(endDate)}`
    }

    return startString
  }, [])

  const formatRelativeTime = useCallback((value) => {
    if (!value) {
      return 'Unknown'
    }

    const timestamp = new Date(value).getTime()
    if (Number.isNaN(timestamp)) {
      return 'Unknown'
    }

    const diff = Date.now() - timestamp
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    const week = 7 * day

    if (diff < minute) return 'Just now'
    if (diff < hour) {
      const minutes = Math.floor(diff / minute)
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    }
    if (diff < day) {
      const hours = Math.floor(diff / hour)
      return `${hours} hour${hours === 1 ? '' : 's'} ago`
    }
    if (diff < week) {
      const days = Math.floor(diff / day)
      return `${days} day${days === 1 ? '' : 's'} ago`
    }

    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
  }, [])

  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (!session) router.push('/en/auth') // Not authenticated
  }, [session, status, router])

  // Force session refresh when returning from Google OAuth
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (status === 'loading') return
    
    const params = new URLSearchParams(window.location.search)
    if (params.has('googleConnected')) {
      console.log('[dashboard] Detected return from Google OAuth')
      console.log('[dashboard] Current session:', session)
      console.log('[dashboard] Current providers:', session?.user?.providers)
      
      // Clean up URL first
      const url = new URL(window.location)
      url.searchParams.delete('googleConnected')
      window.history.replaceState({}, '', url.toString())
      
      // Force session update to get latest providers
      if (update) {
        update().then((newSession) => {
          console.log('[dashboard] Session updated after Google OAuth')
          console.log('[dashboard] New session:', newSession)
          console.log('[dashboard] New providers:', newSession?.user?.providers)
          
          // Force a full page reload to ensure everything updates
          setTimeout(() => {
            window.location.reload()
          }, 500)
        })
      }
    }
  }, [status, session, update])

  useEffect(() => {
    if (status !== 'authenticated') return

    console.log('[dashboard] Checking Google link status')
    console.log('[dashboard] Session:', session)
    console.log('[dashboard] Providers:', session?.user?.providers)
    
    const googleLinked = Array.isArray(session?.user?.providers) && session.user.providers.includes('google')
    console.log('[dashboard] Google linked:', googleLinked)

    if (!googleLinked) {
      if (isMounted.current) {
        setRequiresGoogleAuth(true)
        setCalendarError('')
        setUpcomingEvents([])
        setRecentActivity([])
      }
      return
    }

    console.log('[dashboard] Loading calendar data...')
    loadCalendarData()
  }, [status, session, loadCalendarData])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (requiresGoogleAuth) return

    const bookingFlag = window.localStorage.getItem('bookingRefresh')
    if (bookingFlag) {
      setShowBookingSuccess(true)
      window.localStorage.removeItem('bookingRefresh')
      loadCalendarData()
    }
  }, [loadCalendarData, requiresGoogleAuth])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (requiresGoogleAuth) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('booking') === 'success') {
      setShowBookingSuccess(true)
      router.replace('/en/dashboard')
      loadCalendarData()
    }
  }, [router, loadCalendarData, requiresGoogleAuth])

  useEffect(() => {
    if (!showBookingSuccess) return

    const timeout = setTimeout(() => setShowBookingSuccess(false), 5000)
    return () => clearTimeout(timeout)
  }, [showBookingSuccess])

  // Reset connection state when Google gets linked
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.providers?.includes('google')) {
      setConnectInProgress(false)
      setConnectError('')
      setRequiresGoogleAuth(false)
      
      // Clean up URL if we have OAuth callback parameters or googleConnected flag
      if (typeof window !== 'undefined') {
        const url = new URL(window.location)
        const hasOAuthParams = url.searchParams.has('code') || 
                              url.searchParams.has('state') || 
                              url.searchParams.has('error') ||
                              url.searchParams.has('googleConnected')
        
        if (hasOAuthParams) {
          // Remove OAuth parameters from URL
          url.searchParams.delete('code')
          url.searchParams.delete('state')
          url.searchParams.delete('error')
          url.searchParams.delete('error_description')
          url.searchParams.delete('googleConnected')
          
          // Update URL without reloading
          window.history.replaceState({}, '', url.toString())
          
          // Force a calendar data refresh
          loadCalendarData()
        }
      }
    }
  }, [status, session?.user?.providers, loadCalendarData])

  const handleConnectGoogle = useCallback(async () => {
    setConnectError('')
    setConnectInProgress(true)

    try {
      const callbackUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/en/dashboard?googleConnected=true`
        : '/en/dashboard?googleConnected=true'

      // Initiate Google sign-in with redirect
      await signIn('google', {
        redirect: true,
        callbackUrl
      })
    } catch (error) {
      console.error('[dashboard] connect google error', error)
      setConnectError('Google OAuth is not available. Please check the setup documentation in GOOGLE_OAUTH_SETUP.md')
      setConnectInProgress(false)
    }
  }, [])

  const handleDebugSession = useCallback(async () => {
    console.log('[dashboard] === DEBUG SESSION ===')
    console.log('[dashboard] Current status:', status)
    console.log('[dashboard] Current session:', session)
    console.log('[dashboard] Providers:', session?.user?.providers)
    
    try {
      // Check what's in the database
      const response = await fetch('/api/auth/session-debug')
      const data = await response.json()
      console.log('[dashboard] Session debug data:', data)
      
      // Force session update
      if (update) {
        console.log('[dashboard] Forcing session update...')
        const newSession = await update()
        console.log('[dashboard] Updated session:', newSession)
      }
    } catch (error) {
      console.error('[dashboard] Debug error:', error)
    }
  }, [status, session, update])

  const handleReconnectGoogle = useCallback(async () => {
    if (!confirm('This will disconnect your current Google account and reconnect with fresh tokens. Continue?')) {
      return
    }

    setConnectError('')
    setConnectInProgress(true)

    try {
      // First, disconnect the old Google account
      console.log('[dashboard] Disconnecting old Google account...')
      const disconnectResponse = await fetch('/api/auth/disconnect-google', {
        method: 'POST'
      })
      
      if (!disconnectResponse.ok) {
        throw new Error('Failed to disconnect Google account')
      }

      const disconnectData = await disconnectResponse.json()
      console.log('[dashboard] Disconnect result:', disconnectData)

      // Force session update to remove Google from providers
      if (update) {
        await update()
      }

      // Wait a moment for the session to update
      await new Promise(resolve => setTimeout(resolve, 500))

      // Now reconnect with fresh tokens
      console.log('[dashboard] Reconnecting Google...')
      const callbackUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/en/dashboard?googleConnected=true`
        : '/en/dashboard?googleConnected=true'

      await signIn('google', {
        redirect: true,
        callbackUrl
      })
    } catch (error) {
      console.error('[dashboard] Reconnect error:', error)
      setConnectError('Failed to reconnect Google. Please try again.')
      setConnectInProgress(false)
    }
  }, [update])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/en' })
  }

  const googleLinked = Array.isArray(session.user?.providers) && session.user.providers.includes('google')
  const needsGoogleConnection = requiresGoogleAuth || !googleLinked

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">DocNearMe</h1>
                <p className="text-xs text-gray-500">Healthcare Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-gray-900">{session.user?.name || 'User'}</span>
                <span className="text-xs text-gray-500">{session.user?.email}</span>
              </div>
              <button
                onClick={handleDebugSession}
                className="hidden md:inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Debug
              </button>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all shadow-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert Messages */}
        <div className="space-y-4 mb-6">
          {showBookingSuccess && (
            <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-900">Appointment booked successfully!</p>
                  <p className="text-xs text-green-700 mt-0.5">Your upcoming appointments have been refreshed.</p>
                </div>
              </div>
            </div>
          )}
          
          {calendarError?.includes('expired') && !needsGoogleConnection && (
            <div className="rounded-xl border border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 px-6 py-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-yellow-900">Your Google authorization has expired</p>
                    <p className="text-xs text-yellow-700 mt-0.5">Please reconnect your account to continue syncing appointments.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReconnectGoogle}
                  disabled={connectInProgress}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {connectInProgress ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reconnect Google
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {needsGoogleConnection && (
            <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Connect your Google account to sync appointments</p>
                    <p className="text-xs text-blue-700 mt-0.5">Once linked, your bookings will appear automatically in the dashboard.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={connectInProgress}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {connectInProgress ? 'Connecting...' : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Connect Google Calendar
                    </>
                  )}
                </button>
              </div>
              {connectError && (
                <div className="mt-3 ml-8 text-xs text-red-600 font-medium">
                  {connectError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Welcome Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {session.user?.name?.split(' ')[0] || 'User'}! 👋
              </h2>
              <p className="text-gray-600 text-lg">
                Manage your healthcare journey all in one place
              </p>
            </div>
            <div className="hidden lg:block">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center">
                <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {needsGoogleConnection ? (
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connectInProgress}
              className="group relative bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
            >
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {connectInProgress ? 'Connecting...' : 'Connect Google'}
                  </h3>
                  <p className="text-sm text-gray-500">Link your calendar</p>
                </div>
              </div>
            </button>
          ) : (
            <>
              <Link
                href="/en/booking"
                className="group relative bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Book Appointment</h3>
                    <p className="text-sm text-gray-500">Schedule new visit</p>
                  </div>
                </div>
              </Link>
              
              <a
                href={CALENDAR_URL}
                target="_blank"
                rel="noreferrer"
                className="group relative bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-green-600 transition-colors">Open Calendar</h3>
                    <p className="text-sm text-gray-500">View full schedule</p>
                  </div>
                </div>
              </a>
            </>
          )}
          
          <button className="group relative bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">Upload Records</h3>
                <p className="text-sm text-gray-500">Add medical files</p>
              </div>
            </div>
          </button>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Appointments (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming Appointments */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Upcoming Appointments
                    </h3>
                    <p className="text-sm text-blue-100 mt-0.5">Live sync from your Google Calendar</p>
                  </div>
                  {!needsGoogleConnection && (
                    <button
                      type="button"
                      onClick={() => loadCalendarData()}
                      disabled={calendarLoading}
                      className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors disabled:opacity-60"
                    >
                      <svg className={`w-4 h-4 mr-1.5 ${calendarLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {calendarLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6">
                {needsGoogleConnection ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Google Calendar</h4>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">Link your Google account to automatically sync and display your upcoming appointments here.</p>
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      disabled={connectInProgress}
                      className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-60"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      </svg>
                      {connectInProgress ? 'Connecting...' : 'Connect Google Calendar'}
                    </button>
                  </div>
                ) : (
                  <>
                    {calendarError && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-start">
                          <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-900 mb-1">⚠️ {calendarError}</p>
                            {calendarError.includes('expired') || calendarError.includes('authorization') ? (
                              <button
                                type="button"
                                onClick={handleReconnectGoogle}
                                disabled={connectInProgress}
                                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-60 mt-2"
                              >
                                {connectInProgress ? 'Reconnecting...' : 'Reconnect Google Account'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}

                    {calendarLoading && upcomingEvents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="mt-4 text-gray-600 font-medium">Loading your appointments...</p>
                      </div>
                    ) : null}

                    {!calendarLoading && !calendarError && upcomingEvents.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-600 font-medium">No upcoming appointments</p>
                        <p className="text-sm text-gray-500 mt-1">Book your first appointment to get started</p>
                      </div>
                    ) : null}

                    {upcomingEvents.length > 0 && (
                      <div className="space-y-4">
                        {upcomingEvents.map((event, index) => (
                          <div key={event.id} className="group relative bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all duration-200">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-600 rounded-l-xl"></div>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                                    <span className="text-lg font-bold text-blue-600">{index + 1}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-base font-semibold text-gray-900 mb-1">{event.summary}</h4>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                      <span className="flex items-center">
                                        <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {formatEventDate(event.start, event.end)}
                                      </span>
                                      {event.location && (
                                        <span className="flex items-center">
                                          <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </svg>
                                          {event.location}
                                        </span>
                                      )}
                                    </div>
                                    {event.description && (
                                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{event.description}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {event.htmlLink && (
                                <a
                                  href={event.htmlLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  View in Calendar
                                </a>
                              )}
                              {event.hangoutLink && (
                                <a
                                  href={event.hangoutLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Join Meeting
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Info Cards (1/3 width) */}
          <div className="space-y-6">
            {/* Medical History */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Medical History
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-600">Last Check-up</span>
                  <span className="text-sm text-gray-900 font-semibold">September 15, 2025</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-600">Blood Type</span>
                  <span className="text-sm text-white bg-red-500 px-3 py-1 rounded-full font-bold">O+</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-gray-600">Allergies</span>
                  <span className="text-sm text-gray-900 font-semibold">None reported</span>
                </div>
                <button className="mt-6 w-full inline-flex items-center justify-center px-4 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all shadow-md">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Full History
                </button>
              </div>
            </div>

            {/* Insurance Information */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Insurance
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-600">Provider</span>
                  <span className="text-sm text-gray-900 font-semibold">HealthGuard Insurance</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-600">Policy Number</span>
                  <span className="text-sm text-gray-900 font-mono font-semibold">HG-123456789</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-gray-600">Coverage Type</span>
                  <span className="text-sm text-white bg-green-500 px-3 py-1 rounded-full font-bold">Family Plan</span>
                </div>
                <button className="mt-6 w-full inline-flex items-center justify-center px-4 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all shadow-md">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Update Insurance Info
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recent Activity
                </h3>
                <p className="text-sm text-orange-100 mt-0.5">Latest calendar updates</p>
              </div>
              <div className="p-6">
                {needsGoogleConnection ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">Connect Google to view your recent updates</p>
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                    >
                      Connect Google Calendar
                    </button>
                  </div>
                ) : (
                  <>
                    {calendarLoading && recentActivity.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-10 h-10 border-3 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-600">Loading activity...</p>
                      </div>
                    ) : null}

                    {calendarError && recentActivity.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-red-600 font-medium">Unable to load recent activity</p>
                        <p className="text-xs text-gray-500 mt-1">Try refreshing the appointments section</p>
                      </div>
                    ) : null}

                    {recentActivity.length > 0 && (
                      <div className="space-y-3">
                        {recentActivity.map((event) => (
                          <div key={event.id} className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200 hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">{event.summary}</h4>
                                <p className="text-xs text-gray-500 mb-2">Updated {formatRelativeTime(event.updated)}</p>
                                {event.description && (
                                  <p className="text-xs text-gray-600 line-clamp-2">{event.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                  <span className="text-xs text-gray-600 flex items-center">
                                    <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatEventDate(event.start, event.end)}
                                  </span>
                                  {event.htmlLink && (
                                    <a
                                      href={event.htmlLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center"
                                    >
                                      View details
                                      <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  )}
                                </div>
                              </div>
                              {event.organizer && (
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold text-blue-600">{event.organizer.charAt(0).toUpperCase()}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!calendarLoading && !calendarError && recentActivity.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-gray-600">No recent updates</p>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
