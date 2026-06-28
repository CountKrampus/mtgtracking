import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BookOpen, MessageSquare, Layers, LayoutGrid, Heart, Users, Settings, Globe, X } from 'lucide-react';

const PRIMARY_NAV = [
  { icon: Home,          label: 'Dashboard',  path: '/dashboard' },
  { icon: BookOpen,      label: 'Collection', path: '/collection' },
  { icon: MessageSquare, label: 'Forum',      path: '/forum' },
  { icon: Layers,        label: 'Decks',      path: '/decks' },
];

const MORE_NAV = [
  { icon: Heart,    label: 'Wishlist',        path: '/wishlist' },
  { icon: Users,    label: 'Life Counter',    path: '/lifecounter' },
  { icon: Globe,    label: 'Community Decks', path: '/community-decks' },
  { icon: Settings, label: 'Settings',        path: '/settings' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const go = (path) => { navigate(path); setShowMore(false); };

  return (
    <>
      {showMore && (
        <div
          className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
        />
      )}

      {showMore && (
        <div
          className="sm:hidden fixed bottom-16 left-0 right-0 z-50 bg-gray-900/97 border-t border-white/10 rounded-t-2xl p-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-semibold text-base">More</span>
            <button
              onClick={() => setShowMore(false)}
              className="p-2 text-white/60 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MORE_NAV.map(({ icon: Icon, label, path }) => (
              <button
                key={path}
                onClick={() => go(path)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition min-h-[72px] ${
                  isActive(path)
                    ? 'bg-purple-600/30 text-purple-400'
                    : 'hover:bg-white/10 text-white/60'
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {PRIMARY_NAV.map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              onClick={() => go(path)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 min-h-[56px] transition ${
                isActive(path) ? 'text-purple-400' : 'text-white/50 active:text-white/80'
              }`}
            >
              <Icon size={22} strokeWidth={isActive(path) ? 2.5 : 1.75} />
              <span className="text-[10px] leading-none">{label}</span>
            </button>
          ))}
          <button
            onClick={() => setShowMore((p) => !p)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1 min-h-[56px] transition ${
              showMore ? 'text-purple-400' : 'text-white/50 active:text-white/80'
            }`}
          >
            <LayoutGrid size={22} strokeWidth={showMore ? 2.5 : 1.75} />
            <span className="text-[10px] leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
