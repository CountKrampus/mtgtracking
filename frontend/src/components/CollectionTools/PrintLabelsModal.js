import React from 'react';

export default function PrintLabelsModal({ showPrintLabels, setShowPrintLabels, locations, qrDataUrls, locationStats, formatPrice }) {
  if (!showPrintLabels) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/90 flex flex-col z-50 print:bg-white">
        <div className="bg-gray-900 p-4 flex justify-between items-center print:hidden">
          <h2 className="text-xl font-bold text-white">Print Location Labels ({locations.length})</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">
              Print
            </button>
            <button onClick={() => setShowPrintLabels(false)} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg">
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 print:p-0 flex justify-center">
          <div className="print-content bg-white p-4 print:p-2" style={{ width: '8.5in' }}>
            <div className="grid grid-cols-3 gap-3">
              {locations.map(loc => (
                <div key={loc._id} className="label-item border border-gray-300 rounded p-2 flex items-center gap-2" style={{ height: '1in' }}>
                  {qrDataUrls[loc.name] && (
                    <img src={qrDataUrls[loc.name]} alt="QR" style={{ width: 70, height: 70 }} />
                  )}
                  <div className="flex-1 overflow-hidden">
                    <div className="font-bold text-sm truncate text-black">{loc.name}</div>
                    <div className="text-xs text-gray-600">{locationStats[loc.name]?.cardCount || 0} cards</div>
                    <div className="text-xs text-gray-600">{formatPrice(locationStats[loc.name]?.totalValue || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
