import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

export default function FinancePanel({ isOpen, onClose }) {
  const [financeData, setFinanceData] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const response = await axios.get(`${API_URL}/finance`);
        setFinanceData(response.data);
      } catch (error) {
        console.error('Error fetching finance data:', error);
      }
    })();
  }, [isOpen]);

  if (!isOpen || !financeData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-lg border border-slate-700 sm:max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Portfolio Finance</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-slate-400 text-sm">Collection Value</p>
            <p className="text-white font-bold text-xl">${financeData.collectionValue.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-slate-400 text-sm">Buylist Value</p>
            <p className="text-green-400 font-bold text-xl">${financeData.buylistValue.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-slate-400 text-sm">Sell Value</p>
            <p className="text-yellow-400 font-bold text-xl">${financeData.sellValue.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/50 p-3 rounded">
            <p className="text-slate-400 text-sm">Spread (Collection - Buylist)</p>
            <p className={`font-bold text-xl ${financeData.spread > 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${financeData.spread.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
