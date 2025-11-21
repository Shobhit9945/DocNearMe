'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const DASHBOARD_ROUTE = '/ja/dashboard'

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
}

// Static Japanese translations
const translations = {
  title: '医療ポータルにアクセス',
  createTitle: 'アカウント作成',
  googleSignIn: 'Googleで続行',
  orContinue: 'またはメールで続行',
  fullName: 'フルネーム',
  email: 'メールアドレス',
  password: 'パスワード',
  confirmPassword: 'パスワード確認',
  signIn: 'サインイン',
  createAccount: 'アカウント作成',
  noAccount: 'アカウントをお持ちでない場合',
  hasAccount: 'すでにアカウントをお持ちの場合',
  signUp: 'サインアップ',
  signInLink: 'サインイン',
  loading: '読み込み中...',
  errors: {
    passwordMismatch: 'パスワードが一致しません',
    invalidCredentials: 'メールアドレスまたはパスワードが正しくありません',
    googleNotConfigured: 'Google サインインが設定されていません',
    internalError: '内部サーバーエラー'
  }
}

const formatAuthError = (value) => {
  if (!value) return translations.errors.internalError

  const map = {
    CredentialsSignin: translations.errors.invalidCredentials,
    'Please sign in with Google for this account': translations.errors.invalidCredentials,
    'Invalid email or password': translations.errors.invalidCredentials,
    Configuration: translations.errors.googleNotConfigured
  }

  return map[value] ?? value
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { status, update } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(DASHBOARD_ROUTE)
    }
  }, [status, router])

  const completeSignIn = (destination) => {
    const fallback = DASHBOARD_ROUTE

    if (typeof window !== 'undefined') {
      try {
        if (!destination) {
          window.location.replace(fallback)
          return
        }

        const parsed = new URL(destination, window.location.origin)

        if (parsed.origin === window.location.origin) {
          window.location.replace(parsed.href)
          return
        }
      } catch (error) {
        console.error('[auth] completeSignIn navigation error', error)
      }

      window.location.replace(fallback)
      return
    }

    router.replace(destination ?? fallback)
    router.refresh()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const callbackUrl = DASHBOARD_ROUTE

      if (isLogin) {
        const result = await signIn('credentials', {
          redirect: false,
          email: formData.email,
          password: formData.password,
          callbackUrl
        })

        if (result?.error) {
          setError(formatAuthError(result.error))
          return
        }

        if (typeof update === 'function') {
          await update()
        }

        completeSignIn(result?.url ?? callbackUrl)
        return
      }

      if (formData.password !== formData.confirmPassword) {
        setError(translations.errors.passwordMismatch)
        return
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.message ?? translations.errors.internalError)
      }

      const result = await signIn('credentials', {
        redirect: false,
        email: formData.email,
        password: formData.password,
        callbackUrl
      })

      if (result?.error) {
        setError(formatAuthError(result.error))
        return
      }

      if (typeof update === 'function') {
        await update()
      }

      completeSignIn(result?.url ?? callbackUrl)
    } catch (err) {
      setError(err.message ?? translations.errors.internalError)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const result = await signIn('google', { 
        redirect: false,
        callbackUrl: DASHBOARD_ROUTE 
      })
      
      if (result?.error) {
        if (result.error === 'Configuration') {
          setError(translations.errors.googleNotConfigured)
        } else {
          setError(translations.errors.googleNotConfigured)
        }
        return
      }
      
      if (result?.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Google sign-in error:', error)
      setError(translations.errors.googleNotConfigured)
    }
  }

  const handleModeToggle = () => {
    setIsLogin((prev) => !prev)
    setError('')
  }

  const updateField = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }))
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (status === 'authenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  const buttonText = isLogin ? translations.signIn : translations.createAccount

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {isLogin ? translations.title : translations.createTitle}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isLogin ? translations.noAccount + ' ' : translations.hasAccount + ' '}
            <button
              type="button"
              onClick={handleModeToggle}
              className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
            >
              {isLogin ? translations.signUp : translations.signInLink}
            </button>
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-xl rounded-lg">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  {translations.fullName}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required={!isLogin}
                  value={formData.name}
                  onChange={updateField('name')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={translations.fullName}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {translations.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={updateField('email')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={translations.email}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {translations.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                value={formData.password}
                onChange={updateField('password')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={translations.password}
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  {translations.confirmPassword}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required={!isLogin}
                  value={formData.confirmPassword}
                  onChange={updateField('confirmPassword')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={translations.confirmPassword}
                />
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? translations.loading : buttonText}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{translations.orContinue}</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="ml-2">{translations.googleSignIn}</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/ja"
              className="text-sm text-blue-600 hover:text-blue-500 transition-colors"
            >
              ← ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}