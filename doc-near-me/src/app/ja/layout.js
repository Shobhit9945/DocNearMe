import '../globals.css'
import { Inter } from 'next/font/google'
import AuthSessionProvider from '../../components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'DocNearMe - 公式医療ディレクトリ',
  description: '政府認定の医療プロバイダーディレクトリ',
}

export default function JaLayout({ children }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  )
}