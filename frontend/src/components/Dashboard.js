import React, { useMemo } from 'react';
import { Plus, Upload, RefreshCw, BookOpen, Star } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const Dashboard = ({
  cards,
  totalCards,
  totalValue,
  ignoredValue,
  setCurrentView,
  onAddCard,
  onImport,
  onUpdatePrices,
  fileInputRef,
  isImporting
}) => {
  const avgValue = totalCards > 0 ? (totalValue / totalCards).toFixed(2) : '0.00';

  const recentCards = useMemo(() => {
    return [...cards]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [cards]);

  const topValueCards = useMemo(() => {
    return [...cards]
      .sort((a, b) => (b.price * b.quantity) - (a.price * a.quantity))
      .slice(0, 5);
  }, [cards]);

  const colorDistribution = useMemo(() => {
    const counts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    cards.forEach(card => {
      if (card.colors && card.colors.length > 0) {
        card.colors.forEach(c => {
          if (counts[c] !== undefined) counts[c] += card.quantity;
        });
      } else {
        counts.C += card.quantity;
      }
    });
    return counts;
  }, [cards]);

  const colorTotal = Object.values(colorDistribution).reduce((s, v) => s + v, 0) || 1;

  const colorConfig = {
    W: { name: 'White', bg: 'bg-yellow-200', text: 'text-yellow-900' },
    U: { name: 'Blue', bg: 'bg-blue-500', text: 'text-blue-100' },
    B: { name: 'Black', bg: 'bg-gray-800', text: 'text-gray-200' },
    R: { name: 'Red', bg: 'bg-red-500', text: 'text-red-100' },
    G: { name: 'Green', bg: 'bg-green-500', text: 'text-green-100' },
    C: { name: 'Colorless', bg: 'bg-gray-400', text: 'text-gray-900' },
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
          <div className="text-sm text-white/60">Total Cards</div>
          <div className="text-3xl font-bold text-white">{totalCards.toLocaleString()}</div>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
          <div className="text-sm text-white/60">Unique Cards</div>
          <div className="text-3xl font-bold text-white">{cards.length.toLocaleString()}</div>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
          <div className="text-sm text-white/60">Collection Value</div>
          <div className="text-3xl font-bold text-white">${totalValue.toLocaleString()}</div>
          {ignoredValue > 0 && (
            <div className="text-xs text-orange-400 mt-1" title="Value from cards with ignored tags/locations">
              (${ignoredValue.toLocaleString()} excluded)
            </div>
          )}
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
          <div className="text-sm text-white/60">Avg. Card Value</div>
          <div className="text-3xl font-bold text-white">${avgValue}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={onAddCard}
            className="flex items-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition text-sm"
          >
            <Plus size={18} /> Add Card
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition text-sm disabled:bg-gray-600"
          >
            <Upload size={18} /> {isImporting ? 'Importing...' : 'Import Cards'}
          </button>
          <button
            onClick={onUpdatePrices}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition text-sm"
          >
            <RefreshCw size={18} /> Update Prices
          </button>
          <button
            onClick={() => setCurrentView('collection')}
            className="flex items-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition text-sm"
          >
            <BookOpen size={18} /> View Collection
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Color Distribution */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Color Distribution</h2>
          {totalCards === 0 ? (
            <p className="text-white/50 text-sm">No cards in collection yet.</p>
          ) : (
            <>
              <div className="flex rounded-lg overflow-hidden h-8 mb-4">
                {Object.entries(colorDistribution).map(([color, count]) => {
                  const pct = (count / colorTotal) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={color}
                      className={`${colorConfig[color].bg} flex items-center justify-center transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${colorConfig[color].name}: ${count} (${pct.toFixed(1)}%)`}
                    >
                      {pct > 8 && (
                        <span className={`text-xs font-bold ${colorConfig[color].text}`}>
                          {color}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(colorDistribution).map(([color, count]) => (
                  <div key={color} className="flex items-center gap-2 text-sm text-white/70">
                    <div className={`w-3 h-3 rounded-full ${colorConfig[color].bg}`} />
                    <span>{colorConfig[color].name}</span>
                    <span className="ml-auto font-medium text-white">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top 5 Most Valuable */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Star size={18} className="text-yellow-400" /> Most Valuable Cards
          </h2>
          {topValueCards.length === 0 ? (
            <p className="text-white/50 text-sm">No cards in collection yet.</p>
          ) : (
            <div className="space-y-2">
              {topValueCards.map((card, i) => (
                <div key={card._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition">
                  <span className="text-white/40 text-sm font-mono w-5">{i + 1}.</span>
                  {card.scryfallId && (
                    <img
                      src={`${API_URL.replace('/api', '')}/api/images/${card.scryfallId}`}
                      alt=""
                      className="w-8 h-11 rounded object-cover bg-gray-800"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{card.name}</div>
                    <div className="text-white/50 text-xs truncate">{card.set || 'Unknown Set'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-green-400 font-semibold text-sm">
                      ${(card.price * card.quantity).toFixed(2)}
                    </div>
                    {card.quantity > 1 && (
                      <div className="text-white/40 text-xs">{card.quantity}x ${card.price.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Additions */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Additions</h2>
        {recentCards.length === 0 ? (
          <p className="text-white/50 text-sm">No cards added yet. Use the Add Card or Import button to get started!</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {recentCards.map(card => (
              <div key={card._id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                {card.scryfallId && (
                  <img
                    src={`${API_URL.replace('/api', '')}/api/images/${card.scryfallId}`}
                    alt=""
                    className="w-10 h-14 rounded object-cover bg-gray-800 flex-shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium truncate">{card.name}</div>
                  <div className="text-white/50 text-xs truncate">{card.set || 'Unknown Set'}</div>
                  <div className="text-green-400 text-xs font-medium">${card.price?.toFixed(2) || '0.00'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
