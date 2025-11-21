'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Calendar, Clock, Shield, Star, ArrowRight, CheckCircle, Users, Heart, MapPin, Search, Phone, Award, Zap, Globe } from 'lucide-react'
import SimpleLanguageSwitcher from '../../components/SimpleLanguageSwitcher'

gsap.registerPlugin(ScrollTrigger)

export default function HomePage() {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  
  const heroRef = useRef(null)
  const featuresRef = useRef(null)
  const statsRef = useRef(null)
  const testimonialsRef = useRef(null)

  const testimonials = [
    { name: "田中 花子", role: "2児の母", rating: 5, text: "数分で完璧な小児科医を見つけることができました。予約システムがとてもスムーズで専門的でした。" },
    { name: "佐藤 医師", role: "一般開業医", text: "医療従事者として、このプラットフォームが最高の専門基準を維持しながら患者との接続を合理化することを評価しています。" },
    { name: "鈴木 太郎", role: "会社員", rating: 5, text: "即座予約機能で数時間節約できました。昼休み中に当日の予約を取ることができました。" }
  ]

  const stats = [
    { number: "50,000+", label: "認証済み医師", icon: Users },
    { number: "250万+", label: "満足した患者", icon: Heart },
    { number: "1,200+", label: "医療施設", icon: MapPin },
    { number: "24時間", label: "サポート対応", icon: Phone }
  ]

  useEffect(() => {
    // Ensure animations only run on client side
    if (typeof window === 'undefined') return

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      // Hero animations
      const tl = gsap.timeline()
      tl.fromTo('.hero-badge', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" })
        .fromTo('.hero-title', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out" }, "-=0.4")
        .fromTo('.hero-subtitle', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.6")
        .fromTo('.hero-search', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }, "-=0.4")
        .fromTo('.hero-buttons', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.4")

      // Features animation
      gsap.set('.feature-card', { opacity: 0, y: 60 })
      ScrollTrigger.create({
        trigger: featuresRef.current,
        start: 'top 80%',
        onEnter: () => {
          gsap.to('.feature-card', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: "power3.out"
          })
        }
      })

      // Stats animation
      gsap.set('.stat-item', { opacity: 0, scale: 0.8 })
      ScrollTrigger.create({
        trigger: statsRef.current,
        start: 'top 80%',
        onEnter: () => {
          gsap.to('.stat-item', {
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: "back.out(1.7)"
          })
        }
      })

      // Floating elements
      gsap.to('.floating-card', {
        y: -20,
        duration: 3,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.5
      })
    }, 100)

    // Testimonial rotation
    const testimonialInterval = setInterval(() => {
      setCurrentTestimonial(prev => (prev + 1) % testimonials.length)
    }, 5000)

    return () => {
      clearTimeout(timer)
      clearInterval(testimonialInterval)
      ScrollTrigger.getAll().forEach(trigger => trigger.kill())
    }
  }, [testimonials.length])

  const handleGetStarted = () => {
    router.push('/ja/auth')
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('このブラウザではジオロケーションがサポートされていません')
      return
    }

    setIsLoadingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        // Use reverse geocoding to get city name
        fetch(`https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=YOUR_API_KEY`)
          .then(response => response.json())
          .then(data => {
            if (data.results && data.results[0]) {
              const location = data.results[0].components.city || data.results[0].components.town || data.results[0].components.county
              setSearchLocation(location || `${latitude}, ${longitude}`)
            }
          })
          .catch(() => {
            setSearchLocation(`${latitude}, ${longitude}`)
          })
          .finally(() => {
            setIsLoadingLocation(false)
          })
      },
      (error) => {
        console.error('Error getting location:', error)
        setIsLoadingLocation(false)
        alert('現在地を取得できませんでした。手動で入力してください。')
      }
    )
  }

  const handleSearch = () => {
    if (searchQuery.trim() || searchLocation.trim()) {
      // For now, navigate to the booking page with search parameters
      const params = new URLSearchParams()
      if (searchQuery.trim()) params.append('q', searchQuery)
      if (searchLocation.trim()) params.append('location', searchLocation)
      
      // Create a simple search results page or redirect to auth with search context
      router.push(`/ja/auth?${params.toString()}`)
    } else {
      alert('検索キーワードまたは場所を入力してください')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50">
      {/* Modern Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">DocNearMe</h1>
                <p className="text-xs text-gray-500">医療をシンプルに</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">機能</a>
              <a href="#how-it-works" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">使い方</a>
              <a href="#testimonials" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">レビュー</a>
              <SimpleLanguageSwitcher />
              <button 
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                開始する
              </button>
            </nav>

            {/* Mobile menu button */}
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                <div className={`w-full h-0.5 bg-gray-600 transition-transform ${showMenu ? 'rotate-45 translate-y-1.5' : ''}`}></div>
                <div className={`w-full h-0.5 bg-gray-600 transition-opacity ${showMenu ? 'opacity-0' : ''}`}></div>
                <div className={`w-full h-0.5 bg-gray-600 transition-transform ${showMenu ? '-rotate-45 -translate-y-1.5' : ''}`}></div>
              </div>
            </button>
          </div>

          {/* Mobile menu */}
          {showMenu && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="flex flex-col space-y-4">
                <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">機能</a>
                <a href="#how-it-works" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">使い方</a>
                <a href="#testimonials" className="text-gray-700 hover:text-blue-600 transition-colors font-medium">レビュー</a>
                <SimpleLanguageSwitcher />
                <button 
                  onClick={handleGetStarted}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-2.5 px-6 rounded-xl self-start"
                >
                  開始する
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative py-20 lg:py-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-200/30 rounded-full blur-3xl floating-card"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl floating-card"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl floating-card"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Trust Badge */}
            <div className="hero-badge inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-green-200">
              <CheckCircle className="w-4 h-4 mr-2" />
              50,000以上の医療従事者に信頼されています
            </div>

            {/* Main Title */}
            <h1 className="hero-title text-5xl lg:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 bg-clip-text text-transparent leading-tight block">
                医療を
              </span>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                シンプルに
              </span>
            </h1>

            {/* Subtitle */}
            <p className="hero-subtitle text-xl lg:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              認証済み医療従事者と即座に繋がりましょう。予約取得、医療記録アクセス、健康管理をすべて一箇所で。
            </p>

            {/* Search Bar */}
            <div className="hero-search bg-white rounded-2xl shadow-xl p-2 mb-8 max-w-2xl mx-auto border border-gray-200">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="医師、専門分野、症状を検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-0 focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-500 rounded-xl"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div className="flex-1 relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="場所..."
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border-0 focus:ring-0 focus:outline-none text-gray-900 placeholder-gray-500 rounded-xl"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    onClick={getCurrentLocation}
                    disabled={isLoadingLocation}
                    className="absolute right-3 top-3 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                    title="現在地を使用"
                  >
                    {isLoadingLocation ? (
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                <button 
                  onClick={handleSearch}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
                >
                  <Search className="w-5 h-5" />
                  <span>検索</span>
                </button>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="hero-buttons flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <span>予約する</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2">
                <Award className="w-5 h-5" />
                <span>医師を探す</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section ref={statsRef} className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="stat-item text-center">
                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.number}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} id="features" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              より良い医療のための
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent block">
                すべてがここに
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              即座予約から安全な診察まで、あなたに相応しい完全な医療プラットフォームを構築しました。
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="feature-card group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">即座予約</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                リアルタイム空き状況で数秒で予約完了。もう電話待ちやバタバタすることはありません。
              </p>
              <div className="flex items-center text-blue-600 font-semibold text-sm">
                <span>詳細を見る</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>

            <div className="feature-card group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="bg-gradient-to-br from-green-500 to-green-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">認証済み医師</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                すべての医療従事者は資格、免許、患者レビューで徹底的に認証されています。
              </p>
              <div className="flex items-center text-green-600 font-semibold text-sm">
                <span>認証を確認</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>

            <div className="feature-card group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">24時間サポート</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                緊急時、質問、予約管理のサポートを24時間体制で提供しています。
              </p>
              <div className="flex items-center text-purple-600 font-semibold text-sm">
                <span>今すぐサポート</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>

            <div className="feature-card group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">スマートマッチング</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                あなたの場所、保険、病歴に基づくAI搭載の医師推薦システム。
              </p>
              <div className="flex items-center text-orange-600 font-semibold text-sm">
                <span>マッチングを試す</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>

            <div className="feature-card group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Heart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">健康記録</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                すべての医療記録、処方箋、健康データへの安全で一元化されたアクセス。
              </p>
              <div className="flex items-center text-pink-600 font-semibold text-sm">
                <span>記録にアクセス</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>

            <div className="feature-card group bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">遠隔医療</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                自宅の快適さから医師とのビデオ診察。高品質、安全な接続。
              </p>
              <div className="flex items-center text-indigo-600 font-semibold text-sm">
                <span>診察を開始</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              使い方
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              必要な医療を受けることがこれほど簡単になったことはありません。わずか3つの簡単なステップ。
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-12">
            <div className="text-center relative">
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-blue-600" />
              </div>
              <div className="absolute top-10 left-1/2 transform translate-x-8 hidden lg:block">
                <ArrowRight className="w-6 h-6 text-gray-300" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">1. 検索・比較</h3>
              <p className="text-gray-600 leading-relaxed">
                専門分野、場所、空き状況、患者レビューで医師を検索。プロフィールを比較してニーズに最適な医師を選択。
              </p>
            </div>

            <div className="text-center relative">
              <div className="bg-gradient-to-br from-green-100 to-green-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-10 h-10 text-green-600" />
              </div>
              <div className="absolute top-10 left-1/2 transform translate-x-8 hidden lg:block">
                <ArrowRight className="w-6 h-6 text-gray-300" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">2. 即座予約</h3>
              <p className="text-gray-600 leading-relaxed">
                お好みの時間枠を選択して即座に予約。確認、道順、準備指示をすぐに受け取ります。
              </p>
            </div>

            <div className="text-center">
              <div className="bg-gradient-to-br from-purple-100 to-purple-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">3. 医療を受ける</h3>
              <p className="text-gray-600 leading-relaxed">
                対面またはビデオ通話で診察を受ける。フォローアップケア、処方箋、健康記録すべて一箇所でアクセス。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={testimonialsRef} id="testimonials" className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              ユーザーの声
            </h2>
            <p className="text-xl text-gray-600">
              患者と医療従事者の両方から信頼されています
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12 text-center">
              <div className="flex justify-center mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
                ))}
              </div>
              <blockquote className="text-xl lg:text-2xl text-gray-700 mb-8 leading-relaxed font-medium">
                &ldquo;{testimonials[currentTestimonial].text}&rdquo;
              </blockquote>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold text-gray-900 text-lg">{testimonials[currentTestimonial].name}</div>
                  <div className="text-gray-500">{testimonials[currentTestimonial].role}</div>
                </div>
              </div>
            </div>

            {/* Testimonial indicators */}
            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-colors duration-300 ${
                    index === currentTestimonial ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            始める準備はできましたか？
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-3xl mx-auto">
            DocNearMeで健康管理を簡素化した数千人の仲間に加わりましょう
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={handleGetStarted}
              className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
            >
              <span>無料で開始</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="border-2 border-white text-white hover:bg-white hover:text-blue-600 font-semibold py-4 px-8 rounded-xl text-lg transition-all duration-200 transform hover:scale-105">
              デモを予約
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">DocNearMe</h3>
                  <p className="text-sm text-gray-400">医療をシンプルに</p>
                </div>
              </div>
              <p className="text-gray-400 mb-6 max-w-md leading-relaxed">
                安全でユーザーフレンドリーなプラットフォームを通じて、患者と認証済み医療従事者を繋げています。あなたの健康、シンプルに。
              </p>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
                  <span className="text-sm font-bold">f</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
                  <span className="text-sm font-bold">t</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
                  <span className="text-sm font-bold">in</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-lg">プラットフォーム</h4>
              <ul className="space-y-3 text-gray-400">
                <li><button className="hover:text-white transition-colors text-left">医師を探す</button></li>
                <li><button className="hover:text-white transition-colors text-left">予約する</button></li>
                <li><button className="hover:text-white transition-colors text-left">遠隔医療</button></li>
                <li><button className="hover:text-white transition-colors text-left">健康記録</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-lg">サポート</h4>
              <ul className="space-y-3 text-gray-400">
                <li><button className="hover:text-white transition-colors text-left">ヘルプセンター</button></li>
                <li><button className="hover:text-white transition-colors text-left">お問い合わせ</button></li>
                <li><button className="hover:text-white transition-colors text-left">プライバシーポリシー</button></li>
                <li><button className="hover:text-white transition-colors text-left">利用規約</button></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-500 text-sm mb-4 md:mb-0">
                © 2025 DocNearMe. すべての権利予約済み。
              </p>
              <div className="flex items-center space-x-6 text-sm text-gray-400">
                <span className="flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  HIPAA準拠
                </span>
                <span className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  認証済み安全
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}