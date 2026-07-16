import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function ColumnContextMenu({
  isOpen,
  position,
  columns,
  visibleColumns,
  onToggle,
  onClose,
  onEdit // Opens the full column settings modal
}) {
  const menuRef = useRef(null);
  const [expandedGroups, setExpandedGroups] = useState({});

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

  const groups = columns.reduce((acc, col) => {
    const groupName = col.group || 'Other';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(col);
    return acc;
  }, {});

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-[9999]"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        minWidth: '220px'
      }}
    >
      <div className="p-3 max-h-96 overflow-y-auto">
        <h3 className="text-sm font-semibold text-white mb-2 px-2 flex justify-between items-center">
          Show/Hide Columns
          <button
            type="button"
            onClick={onEdit}
            className="text-sm text-blue-400 hover:underline"
          >
            Edit
          </button>
        </h3>
        <div className="space-y-1">
          {Object.entries(groups).map(([groupName, groupColumns]) => {
            const visibleCount = groupColumns.filter(col => visibleColumns.includes(col.id)).length;
            const isExpanded = !!expandedGroups[groupName];
            return (
              <div key={groupName}>
                <button
                  type="button"
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-slate-700 rounded text-sm text-white"
                >
                  <span className="flex items-center gap-1.5">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {groupName}
                  </span>
                  <span className="text-xs text-slate-400">{visibleCount}/{groupColumns.length}</span>
                </button>
                {isExpanded && (
                  <div className="pl-4">
                    {groupColumns.map(col => (
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
