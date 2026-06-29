import React, { useRef, useState } from 'react';

const SWIPE_THRESHOLD = 60;   // px before snap open
const ACTION_WIDTH    = 130;  // px of revealed action area

export default function SwipeableRow({ children, actions, disabled = false }) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen]     = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const startOffset = useRef(0);

  const onTouchStart = (e) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startOffset.current = open ? -ACTION_WIDTH : 0;
  };

  const onTouchMove = (e) => {
    if (startX.current === null || disabled) return;
    const delta = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    // Cancel swipe if vertical motion clearly dominates at the start
    if (Math.abs(dy) > Math.abs(delta) && Math.abs(delta) < 10) {
      startX.current = null;
      startY.current = null;
      return;
    }
    const next = Math.min(0, Math.max(-ACTION_WIDTH, startOffset.current + delta));
    setOffset(next);
  };

  const onTouchEnd = () => {
    if (startX.current === null) return;
    const shouldOpen = offset < -SWIPE_THRESHOLD;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -ACTION_WIDTH : 0);
    startX.current = null;
    startY.current = null;
  };

  const onTouchCancel = () => {
    startX.current = null;
    startY.current = null;
    setOffset(open ? -ACTION_WIDTH : 0);
  };

  const close = () => { setOpen(false); setOffset(0); };

  return (
    <div className="relative overflow-hidden rounded-xl" onClick={open ? close : undefined}>
      {/* Action buttons revealed on swipe — positioned at right edge */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ width: ACTION_WIDTH }}
      >
        {actions.map(({ label, icon: Icon, color, onClick }) => (
          <button
            key={label}
            onClick={(e) => { e.stopPropagation(); onClick(); close(); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-medium transition ${color}`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Card content — slides left on swipe */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: startX.current ? 'none' : 'transform 0.2s ease',
          position: 'relative',
          zIndex: 1,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {children}
      </div>
    </div>
  );
}
