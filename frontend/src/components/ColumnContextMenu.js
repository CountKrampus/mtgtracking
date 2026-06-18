import React, { useEffect, useRef, useState } from 'react';

export default function ColumnContextMenu({
  isOpen,
  position,
  columns,
  visibleColumns,
  onToggle,
  onClose
}) {
  const menuRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      // Use requestAnimationFrame to ensure DOM is painted before measuring
      requestAnimationFrame(() => {
        const rect = menuRef.current.getBoundingClientRect();
        const menuWidth = Math.max(rect.width, 250); // Use actual width, fallback to 250
        const menuHeight = Math.max(rect.height, 50); // Use actual height, fallback to 50

        const padding = 10;
        let x = position.x;
        let y = position.y;

        // Adjust if menu would go off right edge
        if (x + menuWidth + padding > window.innerWidth) {
          x = window.innerWidth - menuWidth - padding;
        }

        // Adjust if menu would go off bottom edge
        if (y + menuHeight + padding > window.innerHeight) {
          y = window.innerHeight - menuHeight - padding;
        }

        // Clamp to left edge
        if (x < padding) {
          x = padding;
        }

        // Clamp to top edge
        if (y < padding) {
          y = padding;
        }

        setAdjustedPosition({ x, y });
      });
    }
  }, [isOpen, position, menuRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50"
      style={{
        top: `${adjustedPosition.y}px`,
        left: `${adjustedPosition.x}px`,
        minWidth: '200px'
      }}
    >
      <div className="p-3 max-h-96 overflow-y-auto">
        <h3 className="text-sm font-semibold text-white mb-2 px-2">Show/Hide Columns</h3>
        <div className="space-y-1">
          {columns.map(col => (
            <label
              key={col.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer text-sm text-white"
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(col.id)}
                onChange={() => onToggle(col.id)}
                disabled={col.alwaysVisible}
                className={`${col.alwaysVisible ? 'cursor-not-allowed opacity-50' : ''}`}
              />
              <span>{col.label}</span>
              {col.alwaysVisible && <span className="text-xs text-slate-500">(always visible)</span>}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
