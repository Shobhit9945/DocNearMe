import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search as SearchIcon, Calendar, User } from 'lucide-react';

export function TopNav() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const items = [
    { path: '/', label: 'Home', Icon: Home },
    { path: '/search', label: 'Search', Icon: SearchIcon },
    { path: '/appointment', label: 'Appointment', Icon: Calendar },
    { path: '/profile', label: 'Profile', Icon: User },
  ];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div className="hidden md:flex items-center justify-between w-full bg-white border-b border-gray-100 px-4 py-3">
      <div className="flex items-center gap-4">
        <img src="/dnm.png" alt="logo" className="w-10 h-10 object-contain" />
        <div className="text-lg font-extrabold text-[#002D55]">DocNearMe</div>
      </div>

      <div className="flex-1 mx-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clinics, specialists, services..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3A12DB]"
            />
          </div>
        </div>
      </div>

      <nav className="hidden lg:flex items-center gap-4">
        {items.map((it) => {
          const active = location.pathname === it.path;
          return (
            <Link
              key={it.path}
              to={it.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors ${
                active ? 'bg-[#F5FAFF] text-[#1648CE]' : 'text-[#6B7280]'
              }`}
            >
              <it.Icon className="w-5 h-5" />
              <span className="hidden lg:inline-block text-sm">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative" ref={menuRef}>
        

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50">
            <Link to="/profile" className="block px-3 py-2 hover:bg-gray-50">Profile</Link>
            <Link to="/settings" className="block px-3 py-2 hover:bg-gray-50">Settings</Link>
            <button className="w-full text-left px-3 py-2 hover:bg-gray-50">Sign out</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TopNav;
