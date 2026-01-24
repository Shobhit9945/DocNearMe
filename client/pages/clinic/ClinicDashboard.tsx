import React from 'react';
import { Users, Calendar, Star, TrendingUp, Clock, Bell, CheckCircle2 } from 'lucide-react';

export default function ClinicDashboard() {
  const stats = [
    { label: '本日の予約 (Appointments Today)', value: '12', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: '今週の新規患者 (New Patients)', value: '34', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '平均評価 (Average Rating)', value: '4.8', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: '今月の売上目安 (Revenue)', value: '¥1.2M', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  const upcoming = [
    {
      time: '09:30',
      name: 'Sakura Yamamoto',
      type: 'General Consultation',
      status: 'Confirmed',
    },
    {
      time: '10:00',
      name: 'Haruto Sato',
      type: 'Dermatology',
      status: 'Pending',
    },
    {
      time: '11:15',
      name: 'Emily Tanaka',
      type: 'Follow-up',
      status: 'Confirmed',
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード (Dashboard)</h1>
          <p className="text-gray-500">おかえりなさい。今日の予定を確認しましょう。</p>
        </div>
        <div className="hidden md:flex items-center gap-3 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>営業時間 09:00-18:00 (Clinic Hours)</span>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">本日の予約 (Today)</h2>
            <span className="text-sm text-blue-600">すべて表示 (View all)</span>
          </div>
          <div className="space-y-4">
            {upcoming.map((item) => (
              <div key={`${item.time}-${item.name}`} className="flex items-center justify-between border border-gray-100 rounded-lg p-4">
                <div>
                  <p className="text-sm text-gray-500">{item.time}</p>
                  <p className="font-semibold text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">{item.type}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.status === 'Confirmed' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {item.status === 'Confirmed' ? '確定 (Confirmed)' : '保留 (Pending)'}
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Bell className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-gray-900">本日のタスク (Tasks)</h2>
          </div>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
              2件の予約が未確認です (2 pending confirmations)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
              来週の診療時間を更新してください (Update next week's hours)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
              写真を追加すると予約率が上がります (Add photos to improve bookings)
            </li>
          </ul>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">簡単な操作のみ。必要な情報だけ表示しています。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
