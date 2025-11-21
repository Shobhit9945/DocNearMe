'use client'

import { useSession, signOut, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const CALENDAR_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0HJDIw8tveChxs7xbgXWJMvnT3kvW2u74hX-2nHjPlqr3y_gyptoAT0T6NRCKPATg7xmkWIzNd?gv=true'

// Static Japanese translations
const translations = {
  loading: '読み込み中...',
  welcome: 'お帰りなさい',
  welcomeMessage: '医療情報と予約をすべて一箇所で管理',
  signOut: 'サインアウト',
  bookAppointment: '新しい予約',
  uploadRecords: '医療記録のアップロード',
  upcomingAppointments: '今後の予約',
  upcomingAppointmentsDescription: 'Google カレンダーからのライブビュー',
  noAppointments: '今後の予約はありません',
  refresh: '更新',
  refreshing: '更新中...',
  openCalendar: 'カレンダーを開く',
  recentActivity: '最近のアクティビティ',
  noActivity: '最近のアクティビティはありません',
  googleConnection: {
    title: 'Google アカウントを接続して予約を同期',
    description: 'リンク後、予約がダッシュボードに自動的に表示されます',
    connectButton: 'Google カレンダーを接続',
    connecting: '接続中...',
    connectToBook: 'Google を接続して予約',
    needsConnection: 'Google アカウントをリンクして予約と予約同期を有効にしてください',
    errors: {
      notConfigured: 'Google OAuth が設定されていません。環境変数に GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を追加してください',
      connectionFailed: 'Google への接続に失敗しました。もう一度お試しください',
      configurationError: 'Google OAuth が利用できません。設定ドキュメントを確認してください'
    }
  },
  calendar: {
    loadingEvents: '予約を読み込み中...',
    errorLoading: 'カレンダーデータの読み込みに失敗しました',
    timeToBeSet: '時間未定',
    unknownTime: '不明'
  },
  success: {
    appointmentBooked: '予約が正常に完了しました！今後の予約が更新されました'
  }
}

export const dynamic = 'force-dynamic'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [calendarKey, setCalendarKey] = useState(0)
  const [showBookingSuccess, setShowBookingSuccess] = useState(false)
  const isMounted = useRef(true)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [requiresGoogleAuth, setRequiresGoogleAuth] = useState(false)
  const [connectInProgress, setConnectInProgress] = useState(false)
  const [connectError, setConnectError] = useState('')
  const calendarSrc = useMemo(
    () => (calendarKey ? `${CALENDAR_URL}&refresh=${calendarKey}` : CALENDAR_URL),
    [calendarKey]
  )

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
        const message = payload?.error ?? t('calendar.errorLoading')
        requireGoogleAuth = Boolean(payload?.requireGoogleAuth)

        if (isMounted.current) {
          if (requireGoogleAuth) {
            setRequiresGoogleAuth(true)
            setCalendarError('')
          } else {
            setCalendarError(message)
          }
        }

        throw new Error(message)
      }

      if (!isMounted.current) return

      setRequiresGoogleAuth(false)
      setUpcomingEvents(payload?.upcomingEvents ?? [])
      setRecentActivity(payload?.recentActivity ?? [])
      setCalendarKey(Date.now())
    } catch (error) {
      if (!isMounted.current) return
      console.error('[dashboard] calendar fetch error', error)

      if (!requireGoogleAuth) {
        setCalendarError(error.message ?? translations.calendar.errorLoading)
      }
    } finally {
      if (isMounted.current) {
        setCalendarLoading(false)
      }
    }
  }, [])

  const formatEventDate = useCallback((start, end) => {
    if (!start) {
      return translations.calendar.timeToBeSet
    }

    const isAllDay = !start.includes('T')
    const startDate = new Date(start)
    const endDate = end ? new Date(end) : null
    const dateFormatter = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' })

    if (isAllDay) {
      if (endDate && end && end !== start) {
        return `${dateFormatter.format(startDate)} - ${dateFormatter.format(endDate)}`
      }
      return dateFormatter.format(startDate)
    }

    const timeFormatter = new Intl.DateTimeFormat('ja-JP', { hour: 'numeric', minute: '2-digit' })
    const startString = `${dateFormatter.format(startDate)} · ${timeFormatter.format(startDate)}`

    if (endDate && end?.includes('T')) {
      return `${startString} - ${timeFormatter.format(endDate)}`
    }

    return startString
  }, [])

  const formatRelativeTime = useCallback((value) => {
    if (!value) {
      return translations.calendar.unknownTime
    }

    const timestamp = new Date(value).getTime()
    if (Number.isNaN(timestamp)) {
      return translations.calendar.unknownTime
    }

    const diff = Date.now() - timestamp
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    const week = 7 * day

    if (diff < minute) return 'たった今'
    if (diff < hour) {
      const minutes = Math.floor(diff / minute)
      return `${minutes}分前`
    }
    if (diff < day) {
      const hours = Math.floor(diff / hour)
      return `${hours}時間前`
    }
    if (diff < week) {
      const days = Math.floor(diff / day)
      return `${days}日前`
    }

    return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(new Date(value))
  }, [])

  useEffect(() => {
    if (status === 'loading') return // Still loading
    if (!session) router.push('/ja/auth') // Not authenticated
  }, [session, status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    const googleLinked = Array.isArray(session?.user?.providers) && session.user.providers.includes('google')

    if (!googleLinked) {
      if (isMounted.current) {
        setRequiresGoogleAuth(true)
        setCalendarError('')
        setUpcomingEvents([])
        setRecentActivity([])
      }
      return
    }

    loadCalendarData()
  }, [status, session, loadCalendarData])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (requiresGoogleAuth) return

    const bookingFlag = window.localStorage.getItem('bookingRefresh')
    if (bookingFlag) {
      setCalendarKey(Date.now())
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
      setCalendarKey(Date.now())
      setShowBookingSuccess(true)
      router.replace('/ja/dashboard')
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
      
      // Clean up URL if we have OAuth callback parameters
      if (typeof window !== 'undefined') {
        const url = new URL(window.location)
        const hasOAuthParams = url.searchParams.has('code') || 
                              url.searchParams.has('state') || 
                              url.searchParams.has('error')
        
        if (hasOAuthParams) {
          // Remove OAuth parameters from URL
          url.searchParams.delete('code')
          url.searchParams.delete('state')
          url.searchParams.delete('error')
          url.searchParams.delete('error_description')
          
          // Update URL without reloading
          window.history.replaceState({}, '', url.toString())
        }
      }
    }
  }, [status, session?.user?.providers])

  const handleConnectGoogle = useCallback(async () => {
    setConnectError('')
    setConnectInProgress(true)

    try {
      const callbackUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/ja/dashboard`
        : '/ja/dashboard'

      // Try to initiate Google sign-in
      const result = await signIn('google', {
        redirect: false,
        callbackUrl
      })
      
      if (result?.error) {
        if (result.error === 'Configuration') {
          setConnectError(translations.googleConnection.errors.notConfigured)
        } else {
          setConnectError(translations.googleConnection.errors.connectionFailed)
        }
        setConnectInProgress(false)
        return
      }
      
      if (result?.url) {
        // Redirect will happen, don't reset loading state
        window.location.href = result.url
      } else {
        // If no URL, something went wrong
        setConnectError(translations.googleConnection.errors.configurationError)
        setConnectInProgress(false)
      }
    } catch (error) {
      console.error('[dashboard] connect google error', error)
      setConnectError(translations.googleConnection.errors.configurationError)
      setConnectInProgress(false)
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{translations.loading}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/ja' })
  }

  const googleLinked = Array.isArray(session.user?.providers) && session.user.providers.includes('google')
  const needsGoogleConnection = requiresGoogleAuth || !googleLinked

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">DN</span>
              </div>
              <h1 className="ml-3 text-xl font-semibold text-gray-900">DocNearMe</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{translations.welcome}、{session.user?.name || session.user?.email}さん</span>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {translations.signOut}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {showBookingSuccess && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-green-700">
              {translations.success.appointmentBooked}
            </div>
          )}
          {needsGoogleConnection && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{translations.googleConnection.title}</p>
                <p className="text-xs text-blue-700">{translations.googleConnection.description}</p>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={connectInProgress}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {connectInProgress ? translations.googleConnection.connecting : translations.googleConnection.connectButton}
                </button>
                {connectError ? (
                  <p className="text-xs text-red-600 text-left sm:text-right">
                    {connectError}
                  </p>
                ) : null}
              </div>
            </div>
          )}
          <div className="bg-white rounded-lg shadow">
            {/* Welcome Section */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{translations.welcome}、{session.user?.name || session.user?.email}さん!</h2>
              <p className="mt-1 text-sm text-gray-600">
                {translations.welcomeMessage}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:space-x-4">
                {needsGoogleConnection ? (
                  <button
                    type="button"
                    onClick={handleConnectGoogle}
                    disabled={connectInProgress}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-transparent text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {connectInProgress ? translations.googleConnection.connecting : translations.googleConnection.connectToBook}
                  </button>
                ) : (
                  <Link
                    href="/ja/booking"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    {translations.bookAppointment}
                  </Link>
                )}
                <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  {translations.uploadRecords}
                </button>
              </div>
              {needsGoogleConnection ? (
                <p className="mt-3 text-sm text-blue-700">
                  {translations.googleConnection.needsConnection}
                </p>
              ) : null}
            </div>

            {/* Main Dashboard Grid */}
            <div className="p-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Upcoming Appointments */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-200 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{translations.upcomingAppointments}</h3>
                    <p className="text-sm text-gray-500">{translations.upcomingAppointmentsDescription}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => loadCalendarData()}
                      disabled={calendarLoading || needsGoogleConnection}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {calendarLoading ? translations.refreshing : translations.refresh}
                    </button>
                    <a
                      href={CALENDAR_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {translations.openCalendar}
                    </a>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {needsGoogleConnection ? (
                    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-4 text-blue-900">
                      <p className="text-sm font-medium">{translations.googleConnection.title}</p>
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        disabled={connectInProgress}
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {connectInProgress ? translations.googleConnection.connecting : translations.googleConnection.connectButton}
                      </button>
                    </div>
                  ) : (
                    <>
                      {calendarError && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {calendarError}
                        </div>
                      )}

                      {calendarLoading && upcomingEvents.length === 0 ? (
                        <div className="flex items-center justify-center py-6 text-gray-500">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                          <span className="ml-2 text-sm">{translations.calendar.loadingEvents}</span>
                        </div>
                      ) : null}

                      {!calendarLoading && !calendarError && upcomingEvents.length === 0 ? (
                        <p className="text-sm text-gray-600">{translations.noAppointments}</p>
                      ) : null}

                      {upcomingEvents.length > 0 && (
                        <ul className="space-y-3">
                          {upcomingEvents.map((event) => (
                            <li key={event.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{event.summary}</p>
                                  <p className="text-sm text-gray-600">{formatEventDate(event.start, event.end)}</p>
                                </div>
                                {event.location ? (
                                  <p className="text-sm text-gray-500 md:text-right">{event.location}</p>
                                ) : null}
                              </div>
                              {event.description ? (
                                <p className="mt-2 text-sm text-gray-600">{event.description}</p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {event.htmlLink ? (
                                  <a
                                    href={event.htmlLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                  >
                                    Google カレンダーで表示
                                  </a>
                                ) : null}
                                {event.hangoutLink ? (
                                  <a
                                    href={event.hangoutLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                                  >
                                    Google Meet に参加
                                  </a>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <iframe
                        key={calendarKey}
                        title="今後の予約"
                        src={calendarSrc}
                        style={{ border: 0 }}
                        width="100%"
                        height="300"
                        frameBorder="0"
                        className="w-full rounded-md border border-gray-200"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">{translations.recentActivity}</h3>
                  <p className="mt-1 text-sm text-gray-500">Google カレンダーからの最新更新</p>
                </div>
                <div className="p-4 space-y-3">
                  {needsGoogleConnection ? (
                    <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-4 text-blue-900">
                      <p className="text-sm font-medium">Google を接続して、最近の予約更新を表示します。</p>
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        {translations.googleConnection.connectButton}
                      </button>
                    </div>
                  ) : (
                    <>
                      {calendarLoading && recentActivity.length === 0 ? (
                        <div className="flex items-center justify-center py-4 text-gray-500">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                          <span className="ml-2 text-sm">最近のアクティビティを読み込み中…</span>
                        </div>
                      ) : null}

                      {calendarError && recentActivity.length === 0 ? (
                        <p className="text-sm text-red-600">最近のアクティビティを読み込めません。上記で更新してください。</p>
                      ) : null}

                      {recentActivity.length > 0 && (
                        <ul className="space-y-4">
                          {recentActivity.map((event) => (
                            <li key={event.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{event.summary}</p>
                                  <p className="text-xs text-gray-500">{formatRelativeTime(event.updated)}に更新</p>
                                </div>
                                {event.organizer ? (
                                  <p className="text-xs text-gray-500 md:text-right">主催者: {event.organizer}</p>
                                ) : null}
                              </div>
                              {event.description ? (
                                <p className="mt-2 text-sm text-gray-600">{event.description}</p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span>{formatEventDate(event.start, event.end)}</span>
                                {event.htmlLink ? (
                                  <a
                                    href={event.htmlLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded border border-blue-200 bg-white px-2 py-1 font-medium text-blue-600 hover:bg-blue-50"
                                  >
                                    詳細を表示
                                  </a>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {!calendarLoading && !calendarError && recentActivity.length === 0 ? (
                        <p className="text-sm text-gray-600">{translations.noActivity}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}