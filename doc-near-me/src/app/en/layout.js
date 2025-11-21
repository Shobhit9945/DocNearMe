import '../globals.css'
import { Inter } from 'next/font/google'
import AuthSessionProvider from '../../components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'DocNearMe - Official Healthcare Directory',
  description: 'Government-certified healthcare provider directory',
}

export default function EnLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  )
}