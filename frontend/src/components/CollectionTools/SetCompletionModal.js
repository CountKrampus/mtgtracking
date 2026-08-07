import React, { useState, useEffect } from 'react';
import { X, BarChart3, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function SetCompletionModal({ isOpen, onClose, cards }) {
  const [completionData, setCompletionData] = useState([]);
  const [loadingSetCompletion, setLoadingSetCompletion] = useState(false);

  const getSetCompletionData = async () => {
    setLoadingSetCompletion(true);

    try {
      const cardsBySet = {};
      cards.forEach(card => {
        if (card.setCode) {
          const code = card.setCode.toLowerCase();
          if (!cardsBySet[code]) {
            cardsBySet[code] = {
              setCode: code,
              setName: card.set,
              ownedCards: new Set(),
              totalOwned: 0
            };
          }
          cardsBySet[code].ownedCards.add(card.name);
          cardsBySet[code].totalOwned += card.quantity;
        }
      });

      const completion = [];
      const setCodes = Object.keys(cardsBySet);

      for (const code of setCodes.slice(0, 20)) {
        try {
          const setResponse = await axios.get(`https://api.scryfall.com/sets/${code}`);
          const setInfo = setResponse.data;

          completion.push({
            setCode: code.toUpperCase(),
            setName: setInfo.name,
            icon: setInfo.icon_svg_uri,
            ownedUnique: cardsBySet[code].ownedCards.size,
            totalInSet: setInfo.card_count,
            totalOwned: cardsBySet[code].totalOwned,
            releasedAt: setInfo.released_at,
            setType: setInfo.set_type
          });

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.log(`Could not fetch set info for ${code}`);
        }
      }

      completion.sort((a, b) => (b.ownedUnique / b.totalInSet) - (a.ownedUnique / a.totalInSet));

      setCompletionData(completion);
    } catch (error) {
      console.error('Error getting set completion data:', error);
    } finally {
      setLoadingSetCompletion(false);
    }
  };

  useEffect(() => {
    if (isOpen) getSetCompletionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setCompletionData([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-teal-500">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="text-teal-500" size={24} /> Set Completion Tracker
            </h2>
            <p className="text-white/60 mt-1">
              Your progress toward completing each set
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-white/60 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loadingSetCompletion ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw size={48} className="text-teal-500 animate-spin mb-4" />
              <p className="text-white/60">Fetching set information...</p>
            </div>
          ) : completionData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/60">No set data available. Make sure your cards have set codes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completionData.map((set) => {
                const percentage = Math.round((set.ownedUnique / set.totalInSet) * 100);
                return (
                  <div key={set.setCode} className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {set.icon && (
                          <img src={set.icon} alt={set.setCode} className="w-6 h-6 invert" loading="lazy" />
                        )}
                        <div>
                          <h3 className="text-white font-semibold">{set.setName}</h3>
                          <p className="text-white/40 text-xs">{set.setCode} • {set.setType}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{percentage}%</p>
                        <p className="text-white/60 text-sm">{set.ownedUnique} / {set.totalInSet} cards</p>
                      </div>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          percentage === 100 ? 'bg-green-500' :
                          percentage >= 75 ? 'bg-teal-500' :
                          percentage >= 50 ? 'bg-blue-500' :
                          percentage >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-white/40 text-xs mt-2">
                      {set.totalOwned} total copies owned
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5">
          <p className="text-white/40 text-xs text-center">
            Showing up to 20 sets from your collection • Sorted by completion percentage
          </p>
        </div>
      </div>
    </div>
  );
}
