import React from 'react';
import ReactDOM from 'react-dom';
import { Trash2 } from 'lucide-react';

/**
 * Renders a styled confirmation modal via React portal into document.body.
 * Avoids z-index issues inside scrollable admin tabs.
 *
 * Props:
 *   title     string   — headline, e.g. "Delete post?"
 *   message   string   — body text shown below the icon, e.g. author + preview
 *   onConfirm () => void
 *   onCancel  () => void
 *   danger    boolean  — true (default) = red; false = blue
 */
export default function ConfirmModal({ title, message, onConfirm, onCancel, danger = true }) {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
            danger ? 'bg-red-900/60' : 'bg-blue-900/60'
          }`}
        >
          <Trash2 size={22} className={danger ? 'text-red-400' : 'text-blue-400'} />
        </div>
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
        {message && <p className="text-gray-400 text-sm mb-6">{message}</p>}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 text-white text-sm rounded-lg transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
