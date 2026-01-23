import React from 'react';
import { Users, Calendar, Star, TrendingUp } from 'lucide-react';

export default function ClinicDashboard() {
  const stats = [
    { label: 'Total Patients', value: '1,234', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Appointments Today', value: '12', icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Average Rating', value: '4.8', icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Revenue (Month)', value: '$12.4k', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back, Clinic Admin</p>
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
    </div>
  );
}
