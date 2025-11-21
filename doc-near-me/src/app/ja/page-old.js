'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import SimpleLanguageSwitcher from '../../components/SimpleLanguageSwitcher'
import SimpleTestimonialsCarousel from '../../components/SimpleTestimonialsCarousel'

export default function HomePage() {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const handleGetStarted = () => {
    router.push('/ja/auth')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Government-style Header */}
      <header className="bg-white border-b-4 border-blue-600 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-3 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">DocNearMe</h1>
                <p className="text-sm text-gray-600">公式医療ディレクトリ</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <nav className="hidden md:flex space-x-8">
                <a href="#about" className="text-gray-700 hover:text-blue-600 transition-colors duration-200">概要</a>
                <a href="#services" className="text-gray-700 hover:text-blue-600 transition-colors duration-200">サービス</a>
                <a href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors duration-200">お問い合わせ</a>
              </nav>
              <SimpleLanguageSwitcher />
              <button 
                onClick={handleGetStarted}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-md transition-all duration-200 transform hover:scale-105 shadow-md"
              >
                ポータルアクセス
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                全国の医療専門家に信頼されています
              </div>
            </div>
            
            <h1 className={`text-4xl md:text-6xl font-bold text-gray-900 mb-6 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              公式医療
              <span className="text-blue-600 block">プロバイダーディレクトリ</span>
            </h1>
            
            <p className={`text-xl text-gray-700 mb-8 max-w-4xl mx-auto leading-relaxed transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              コミュニティの認証された医療専門家にアクセス。政府認定のディレクトリにより、必要な時にライセンスを持つ開業医から質の高い医療を受けることが保証されます。
            </p>
            
            <div className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-600 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <button 
                onClick={handleGetStarted}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                医療ポータルにアクセス
              </button>
              <button className="bg-white hover:bg-gray-50 text-blue-600 border-2 border-blue-600 font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-200 transform hover:scale-105 shadow-md">
                ディレクトリを見る
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-20" id="services">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              政府認定医療サービス
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              当プラットフォームは、完全な政府監視とコンプライアンスにより、ライセンスを持つ医療専門家への安全で認証されたアクセスを提供します。
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group text-center p-8 bg-gray-50 rounded-lg hover:bg-blue-50 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-lg">
              <div className="bg-blue-600 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">認証済み・ライセンス取得済み</h3>
              <p className="text-gray-600 leading-relaxed">
                すべての医療プロバイダーは政府認証済みで、現在のライセンスを保持しています。定期的なコンプライアンスチェックにより、継続的な認証が保証されます。
              </p>
            </div>
            
            <div className="group text-center p-8 bg-gray-50 rounded-lg hover:bg-blue-50 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-lg">
              <div className="bg-blue-600 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">セキュアアクセス</h3>
              <p className="text-gray-600 leading-relaxed">
                エンタープライズグレードのセキュリティが個人の健康情報を保護します。HIPAA準拠のデータ処理と暗号化された通信。
              </p>
            </div>
            
            <div className="group text-center p-8 bg-gray-50 rounded-lg hover:bg-blue-50 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-lg">
              <div className="bg-blue-600 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">迅速な対応</h3>
              <p className="text-gray-600 leading-relaxed">
                最も必要な時に医療専門家に迅速にアクセス。緊急プロトコルと優先スケジューリングが利用可能。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Carousel */}
      <SimpleTestimonialsCarousel />

      {/* CTA Section */}
      <div className="bg-blue-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            今日から医療ポータルにアクセス
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            安全で信頼できる医療アクセスのために政府認定プラットフォームを信頼する何千もの市民に参加してください。
          </p>
          <button 
            onClick={handleGetStarted}
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg text-lg"
          >
            今すぐポータルにアクセス
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12" id="contact">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold">DocNearMe</h3>
                  <p className="text-sm text-gray-400">公式医療ディレクトリ</p>
                </div>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                政府認定の医療プロバイダーディレクトリにより、ライセンスを持つ医療専門家への安全で認証されたアクセスを保証します。
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">サービス</h4>
              <ul className="space-y-2 text-gray-400">
                <li><button className="hover:text-white transition-colors text-left">医師を探す</button></li>
                <li><button className="hover:text-white transition-colors text-left">予約を取る</button></li>
                <li><button className="hover:text-white transition-colors text-left">緊急医療</button></li>
                <li><button className="hover:text-white transition-colors text-left">健康記録</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">サポート</h4>
              <ul className="space-y-2 text-gray-400">
                <li><button className="hover:text-white transition-colors text-left">ヘルプセンター</button></li>
                <li><button className="hover:text-white transition-colors text-left">お問い合わせ</button></li>
                <li><button className="hover:text-white transition-colors text-left">プライバシーポリシー</button></li>
                <li><button className="hover:text-white transition-colors text-left">利用規約</button></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-500 text-sm">
              © 2025 DocNearMe - 公式政府医療ディレクトリ。全著作権所有。
            </p>
            <p className="text-gray-600 text-xs mt-2">
              HIPAA準拠 • 政府認定 • セキュア＆プライベート
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
