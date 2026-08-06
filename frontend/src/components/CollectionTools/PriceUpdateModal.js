import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PriceUpdateModal({ isOpen, onClose, updateAllPrices }) {
  const [forceUpdate, setForceUpdate] = useState(false);
  const [updateFullData, setUpdateFullData] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-6 border-2 border-blue-500 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4">Update All Prices</h2>
        <p className="text-white/60 mb-6">Choose update options:</p>

        <div className="space-y-4 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={forceUpdate}
              onChange={(e) => setForceUpdate(e.target.checked)}
              className="w-5 h-5 mt-0.5 cursor-pointer"
            />
            <div>
              <div className="text-white font-medium">Force Update Existing Cards</div>
              <div className="text-white/60 text-sm">Update all cards even if they already have price data</div>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={updateFullData}
              onChange={(e) => setUpdateFullData(e.target.checked)}
              className="w-5 h-5 mt-0.5 cursor-pointer"
            />
            <div>
              <div className="text-white font-medium">Update Full Card Data</div>
              <div className="text-white/60 text-sm">Fetch complete metadata (set, rarity, colors, images, etc.)</div>
            </div>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              onClose();
              updateAllPrices(forceUpdate, updateFullData);
            }}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
          >
            <RefreshCw size={18} /> Update Prices
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
