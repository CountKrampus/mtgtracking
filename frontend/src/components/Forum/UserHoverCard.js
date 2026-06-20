import React, { useRef, useEffect, useState } from 'react';

const BADGE_EMOJI = {
  'First Post': '📝',
  'Century': '💬',
  'Thread Starter': '🧵',
  'Deck Builder': '🃏',
  'Collector': '📦',
  'Veteran': '🗓️',
  'Engaged Member': '🌟'
};

function UserHoverCard({ pos, username, displayName, reputation, badges, onClose }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ top: (pos?.y ?? 0) - 20, left: (pos?.x ?? 0) + 12 });

  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const vpw = window.innerWidth;
    const vph = window.innerHeight;
    let left = (pos?.x ?? 0) + 12;
    let top = (pos?.y ?? 0) - 20;
    if (left + width > vpw - 8) left = vpw - width - 8;
    if (top + height > vph - 8) top = vph - height - 8;
    if (top < 8) top = 8;
    setStyle({ top, left });
  }, [pos]);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: style.top, left: style.left, zIndex: 9999 }}
      className="bg-gray-900/95 border border-gray-700 rounded-xl shadow-xl backdrop-blur-sm min-w-[180px] max-w-[240px] p-3 pointer-events-none"
      onMouseLeave={onClose}
    >
      <div className="font-semibold text-white text-sm truncate">
        {displayName || `@${username}`}
      </div>
      {username && displayName && (
        <div className="text-gray-400 text-xs truncate">@{username}</div>
      )}
      {reputation > 0 && (
        <div className="text-amber-400 text-xs font-semibold mt-1">⚡ {reputation} reputation</div>
      )}
      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {badges.slice(0, 5).map((badge, i) => (
            <span key={i} className="text-sm" title={badge.name}>
              {BADGE_EMOJI[badge.name] || '🏅'}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 text-xs text-purple-400 opacity-70">
        View Profile →
      </div>
    </div>
  );
}

export default UserHoverCard;
