import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import UserAvatar from './avatars/UserAvatar';

export default function UserMenu({ user, onProfile, onSettings, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const [panelStyle, setPanelStyle] = useState({});

  const handleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const margin = 8;
      const width = 224; // matches className's w-56
      // Align under the button by default, but clamp so the panel never
      // overflows past the left edge of the viewport on narrow screens.
      let right = window.innerWidth - rect.right;
      if (right + width > window.innerWidth - margin) {
        right = window.innerWidth - width - margin;
      }
      right = Math.max(margin, right);
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        right,
        zIndex: 9999
      });
    }
    setIsOpen(!isOpen);
  };

  const handleMenuClick = (callback) => {
    callback();
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition text-white"
        title="User Menu"
      >
        <UserAvatar avatarUrl={user.avatarUrl} username={user.username} size="sm" />
        <span className="text-sm font-medium hidden sm:inline max-w-[150px] truncate">
          {user.displayName || user.username}
        </span>
        <ChevronDown size={16} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
          <div
            style={panelStyle}
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-56 z-[9999]"
          >
            {/* User Info */}
            <div className="p-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <UserAvatar avatarUrl={user.avatarUrl} username={user.username} size="md" />
                <div>
                  <p className="font-semibold text-white text-sm">
                    {user.displayName || user.username}
                  </p>
                  <p className="text-xs text-slate-400">@{user.username}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2 space-y-1">
              <button
                onClick={() => handleMenuClick(onProfile)}
                className="w-full text-left px-3 py-2 text-white hover:bg-slate-800 rounded transition flex items-center gap-3 text-sm"
              >
                <User size={16} />
                My Profile
              </button>
              <button
                onClick={() => handleMenuClick(onSettings)}
                className="w-full text-left px-3 py-2 text-white hover:bg-slate-800 rounded transition flex items-center gap-3 text-sm"
              >
                <Settings size={16} />
                Account Settings
              </button>
              <div className="border-t border-slate-700 my-2"></div>
              <button
                onClick={() => handleMenuClick(onLogout)}
                className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-600/10 rounded transition flex items-center gap-3 text-sm"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
