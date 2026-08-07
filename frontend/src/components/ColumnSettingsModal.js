import React from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

/**
 * Full column settings modal opened via the "Edit" link in ColumnContextMenu.
 * Shows every column grouped and expanded, plus Select All / Reset to Default.
 */
export default function ColumnSettingsModal({
  isOpen,
  columns,
  visibleColumns,
  onToggle,
  onSelectAll,
  onReset,
  onClose
}) {
  if (!isOpen) return null;

  const groups = columns.reduce((acc, col) => {
    const groupName = col.group || 'Other';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(col);
    return acc;
  }, {});

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 sm:p-4 pb-16 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-600 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full sm:mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Column Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={onSelectAll}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            Select All
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
          >
            Reset to Default
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(groups).map(([groupName, groupColumns]) => (
            <div key={groupName}>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">{groupName}</h4>
              <div className="grid grid-cols-2 gap-1">
                {groupColumns.map(col => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700 rounded cursor-pointer text-sm text-white"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.id)}
                      onChange={() => onToggle(col.id)}
                      disabled={col.alwaysVisible}
                      className={`${col.alwaysVisible ? 'cursor-not-allowed opacity-50' : ''}`}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
