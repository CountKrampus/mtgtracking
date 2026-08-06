import React from 'react';
import { X } from 'lucide-react';

export default function QRPreviewModal({ showQRPreview, qrPreviewLocation, setShowQRPreview, qrDataUrls, locationStats, formatPrice }) {
  if (!showQRPreview || !qrPreviewLocation) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-sm w-full p-6 border-2 border-purple-500 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">QR Label</h3>
          <button onClick={() => setShowQRPreview(false)} className="text-white/60 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <div className="bg-white rounded-lg p-4 text-center print-content">
          {qrDataUrls[qrPreviewLocation.name] && (
            <img src={qrDataUrls[qrPreviewLocation.name]} alt="QR" className="mx-auto mb-2" />
          )}
          <div className="font-bold text-lg text-black">{qrPreviewLocation.name}</div>
          <div className="text-gray-600 text-sm">
            {locationStats[qrPreviewLocation.name]?.cardCount || 0} cards | {formatPrice(locationStats[qrPreviewLocation.name]?.totalValue || 0)}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => window.print()} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">
            Print
          </button>
          <button onClick={() => setShowQRPreview(false)} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
