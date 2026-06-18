import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

export default function ColumnContextMenu({
  isOpen,
  position,
  columns,
  visibleColumns,
  onToggle,
  onClose
}) {
  const menuRef = useRef(null);

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

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-[9999]"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
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
    </div>,
    document.body
  );
}
