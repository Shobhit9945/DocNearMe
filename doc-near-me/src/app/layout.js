import './globals.css'
import { Inter } from 'next/font/google'
import AuthSessionProvider from '../components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'DocNearMe - Official Healthcare Directory',
  description: 'Government-certified healthcare provider directory',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Tailwind CSS v4 CDN for browser usage */}
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" defer></script>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className + ' min-h-screen bg-gray-50'}>
        <AuthSessionProvider>
          <main className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 flex flex-col">
            {children}
          </main>
        </AuthSessionProvider>
      </body>
    </html>
  )
}
