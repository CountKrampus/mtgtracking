import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';

export default function DuplicateThreadWarning({ duplicates, onSelect, onContinue }) {
  const [selectedId, setSelectedId] = useState(null);
  const [reason, setReason] = useState('');

  return (
    <div className="bg-yellow-900 border-l-4 border-yellow-600 p-4 mb-6 rounded">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-3">Similar Threads Found</h3>
          <div className="space-y-2 mb-4">
            {duplicates.map(dup => (
              <label key={dup._id} className="flex items-center p-2 hover:bg-yellow-800 rounded cursor-pointer">
                <input
                  type="radio"
                  checked={selectedId === dup._id}
                  onChange={() => setSelectedId(dup._id)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium text-white">{dup.title}</div>
                  <div className="text-xs text-yellow-200">
                    {Math.round(dup.similarity * 100)}% match
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onSelect(selectedId, reason)}
              disabled={!selectedId}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-sm"
            >
              Request Merge
            </button>
            <button
              onClick={onContinue}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
