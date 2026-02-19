import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Upload, RefreshCw, BookOpen, Star, Layers, TrendingUp, TrendingDown } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

// Reusable horizontal bar component
const HorizontalBar = ({ label, value, total, color, formatLabel }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-24 text-white/70 truncate flex-shrink-0 text-right">{label}</div>
      <div className="flex-1 bg-white/10 rounded-full h-4 overflow-hidden">
        <div
          className={`h-4 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-16 text-white/80 text-right flex-shrink-0">
        {formatLabel ? formatLabel(value) : value.toLocaleString()}
      </div>
      <div className="w-10 text-white/40 text-right flex-shrink-0 text-xs">
        {pct.toFixed(0)}%
      </div>
    </div>
  );
};

// SVG line chart for value over time
const ValueLineChart = ({ data, formatPrice }) => {
  const [tooltip, setTooltip] = useState(null);

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-white/40 text-sm">
        {data && data.length === 1 ? 'Visit again tomorrow to see your value trend.' : 'No history yet. Value snapshots are saved daily when you view stats.'}
      </div>
    );
  }

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const W = 600;
  const H = 120;
  const PAD = { top: 10, right: 10, bottom: 20, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xStep = chartW / (data.length - 1);
  const points = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + chartH - ((d.value - minVal) / range) * chartH,
    date: new Date(d.createdAt),
    value: d.value
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${PAD.top + chartH} L ${points[0].x} ${PAD.top + chartH} Z`;

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: PAD.top + chartH - t * chartH,
    val: minVal + t * range
  }));

  // X-axis: show first, last, and a few in between
  const xLabelIndices = [0];
  if (data.length > 2) xLabelIndices.push(Math.floor(data.length / 2));
  xLabelIndices.push(data.length - 1);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
        {/* Y gridlines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <text x={PAD.left - 4} y={t.y + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="9">
              {formatPrice(t.val)}
            </text>
          </g>
        ))}
        {/* X labels */}
        {xLabelIndices.map(i => (
          <text key={i} x={points[i].x} y={H - 2} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">
            {points[i].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
        {/* Area fill */}
        <path d={areaD} fill="rgba(139,92,246,0.15)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
        {/* Points (hover targets) */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#8b5cf6"
            stroke="#1e1b4b"
            strokeWidth="1.5"
            className="cursor-pointer"
            onMouseEnter={() => setTooltip({ x: p.x, y: p.y, date: p.date, value: p.value, W })}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
        {/* Tooltip */}
        {tooltip && (() => {
          const boxW = 110;
          const bx = tooltip.x + boxW > tooltip.W ? tooltip.x - boxW - 4 : tooltip.x + 4;
          return (
            <g>
              <rect x={bx} y={tooltip.y - 28} width={boxW} height={24} rx="4" fill="rgba(30,27,75,0.95)" stroke="rgba(139,92,246,0.5)" strokeWidth="1" />
              <text x={bx + boxW / 2} y={tooltip.y - 18} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                {formatPrice(tooltip.value)}
              </text>
              <text x={bx + boxW / 2} y={tooltip.y - 8} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9">
                {tooltip.date.toLocaleDateString()}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

// Value bucket histogram
const ValueHistogram = ({ buckets }) => {
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {buckets.map((b, i) => {
        const h = (b.count / maxCount) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-white/60 text-xs">{b.count > 0 ? b.count : ''}</div>
            <div
              className="w-full bg-purple-500/70 rounded-t transition-all hover:bg-purple-400"
              style={{ height: `${Math.max(h, b.count > 0 ? 4 : 0)}%` }}
              title={`${b.label}: ${b.count} cards`}
            />
            <div className="text-white/50 text-xs text-center leading-tight">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const Dashboard = ({
  cards,
  totalCards,
  totalValue,
  ignoredValue,
  portfolioGain = 0,
  portfolioCost = 0,
  setCurrentView,
  onAddCard,
  onImport,
  onUpdatePrices,
  fileInputRef,
  isImporting,
  formatPrice
}) => {
  const fp = formatPrice || ((v) => `$${v.toFixed(2)}`);
  const avgValue = totalCards > 0 ? (totalValue / totalCards) : 0;
  const [valueHistory, setValueHistory] = useState([]);
  const [priceChanges, setPriceChanges] = useState({ gainers: [], losers: [] });
  const [mostPlayedDecks, setMostPlayedDecks] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_URL}/stats/value-history`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setValueHistory(Array.isArray(data) ? data : []))
      .catch(() => setValueHistory([]));

    fetch(`${API_URL}/stats/price-changes`, { headers })
      .then(r => r.ok ? r.json() : { gainers: [], losers: [] })
      .then(data => setPriceChanges(data && data.gainers ? data : { gainers: [], losers: [] }))
      .catch(() => setPriceChanges({ gainers: [], losers: [] }));

    fetch(`${API_URL}/lifecounter/stats`, { headers })
      .then(r => r.ok ? r.json() : {})
      .then(data => setMostPlayedDecks(Array.isArray(data.mostPlayedDecks) ? data.mostPlayedDecks : []))
      .catch(() => setMostPlayedDecks([]));
  }, []);

  const recentCards = useMemo(() => {
    return [...cards]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [cards]);

  const topValueCards = useMemo(() => {
    return [...cards]
      .sort((a, b) => (b.price * b.quantity) - (a.price * a.quantity))
      .slice(0, 10);
  }, [cards]);

  const topOwnedCards = useMemo(() => {
    return [...cards]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
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

  const typeDistribution = useMemo(() => {
    const counts = {};
    cards.forEach(card => {
      if (card.types && card.types.length > 0) {
        card.types.forEach(t => {
          counts[t] = (counts[t] || 0) + card.quantity;
        });
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [cards]);

  const rarityDistribution = useMemo(() => {
    const counts = { C: 0, U: 0, R: 0, M: 0 };
    cards.forEach(card => {
      const r = (card.rarity || '').charAt(0).toUpperCase();
      if (counts[r] !== undefined) counts[r] += card.quantity;
    });
    return counts;
  }, [cards]);

  const setDistribution = useMemo(() => {
    const counts = {};
    cards.forEach(card => {
      const s = card.set || 'Unknown';
      counts[s] = (counts[s] || 0) + card.quantity;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [cards]);

  const conditionDistribution = useMemo(() => {
    const counts = { NM: 0, LP: 0, MP: 0, HP: 0, DMG: 0 };
    cards.forEach(card => {
      if (counts[card.condition] !== undefined) counts[card.condition] += card.quantity;
    });
    return counts;
  }, [cards]);

  const valueDistribution = useMemo(() => {
    const buckets = [
      { label: '$0–1', min: 0, max: 1, count: 0 },
      { label: '$1–5', min: 1, max: 5, count: 0 },
      { label: '$5–20', min: 5, max: 20, count: 0 },
      { label: '$20–50', min: 20, max: 50, count: 0 },
      { label: '$50+', min: 50, max: Infinity, count: 0 },
    ];
    cards.forEach(card => {
      const p = card.price || 0;
      const bucket = buckets.find(b => p >= b.min && p < b.max);
      if (bucket) bucket.count += card.quantity;
    });
    return buckets;
  }, [cards]);

  const colorTotal = Object.values(colorDistribution).reduce((s, v) => s + v, 0) || 1;
  const typeTotal = typeDistribution.reduce((s, [, v]) => s + v, 0) || 1;
  const rarityTotal = Object.values(rarityDistribution).reduce((s, v) => s + v, 0) || 1;
  const setTotal = setDistribution.reduce((s, [, v]) => s + v, 0) || 1;
  const condTotal = Object.values(conditionDistribution).reduce((s, v) => s + v, 0) || 1;

  const colorConfig = {
    W: { name: 'White', bg: 'bg-yellow-200', text: 'text-yellow-900', bar: 'bg-yellow-300' },
    U: { name: 'Blue', bg: 'bg-blue-500', text: 'text-blue-100', bar: 'bg-blue-500' },
    B: { name: 'Black', bg: 'bg-gray-800', text: 'text-gray-200', bar: 'bg-gray-600' },
    R: { name: 'Red', bg: 'bg-red-500', text: 'text-red-100', bar: 'bg-red-500' },
    G: { name: 'Green', bg: 'bg-green-500', text: 'text-green-100', bar: 'bg-green-500' },
    C: { name: 'Colorless', bg: 'bg-gray-400', text: 'text-gray-900', bar: 'bg-gray-400' },
  };

  const rarityConfig = {
    C: { name: 'Common', bar: 'bg-gray-400' },
    U: { name: 'Uncommon', bar: 'bg-blue-400' },
    R: { name: 'Rare', bar: 'bg-yellow-400' },
    M: { name: 'Mythic', bar: 'bg-orange-500' },
  };

  const conditionConfig = {
    NM: { name: 'Near Mint', bar: 'bg-green-500' },
    LP: { name: 'Light Play', bar: 'bg-teal-400' },
    MP: { name: 'Mod. Play', bar: 'bg-yellow-400' },
    HP: { name: 'Heavy Play', bar: 'bg-orange-400' },
    DMG: { name: 'Damaged', bar: 'bg-red-500' },
  };

  const typeColors = ['bg-purple-500', 'bg-blue-500', 'bg-teal-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-pink-500'];

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
          <div className="text-3xl font-bold text-white">{fp(totalValue)}</div>
          {ignoredValue > 0 && (
            <div className="text-xs text-orange-400 mt-1" title="Value from cards with ignored tags/locations">
              ({fp(ignoredValue)} excluded)
            </div>
          )}
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
          <div className="text-sm text-white/60">Avg. Card Value</div>
          <div className="text-3xl font-bold text-white">{fp(avgValue)}</div>
        </div>
      </div>

      {/* Portfolio P&L (only shown when purchasePrice data exists) */}
      {portfolioCost > 0 && (() => {
        const returnPct = (portfolioGain / portfolioCost) * 100;
        const gainPositive = portfolioGain >= 0;
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
              <div className="text-sm text-white/60">Portfolio Cost</div>
              <div className="text-2xl font-bold text-white">{fp(portfolioCost)}</div>
              <div className="text-xs text-white/40 mt-1">Based on purchase prices</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
              <div className="text-sm text-white/60">Portfolio Gain / Loss</div>
              <div className={`text-2xl font-bold ${gainPositive ? 'text-green-400' : 'text-red-400'}`}>
                {gainPositive ? '+' : ''}{fp(portfolioGain)}
              </div>
              <div className={`text-xs mt-1 ${gainPositive ? 'text-green-400/70' : 'text-red-400/70'}`}>
                {gainPositive ? '+' : ''}{returnPct.toFixed(1)}% return
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Color Distribution + Top 10 Most Valuable */}
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
              <div className="space-y-2 mt-4">
                {Object.entries(colorDistribution).map(([color, count]) => (
                  <HorizontalBar
                    key={color}
                    label={colorConfig[color].name}
                    value={count}
                    total={colorTotal}
                    color={colorConfig[color].bar}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top 10 Most Valuable */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Star size={18} className="text-yellow-400" /> Top 10 Most Valuable
          </h2>
          {topValueCards.length === 0 ? (
            <p className="text-white/50 text-sm">No cards in collection yet.</p>
          ) : (
            <div className="space-y-1.5">
              {topValueCards.map((card, i) => (
                <div key={card._id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition">
                  <span className="text-white/40 text-xs font-mono w-5 text-right flex-shrink-0">{i + 1}.</span>
                  {card.scryfallId && (
                    <img
                      src={`${API_URL.replace('/api', '')}/api/images/${card.scryfallId}`}
                      alt=""
                      className="w-6 h-8 rounded object-cover bg-gray-800 flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-medium truncate">{card.name}</div>
                    <div className="text-white/40 text-xs truncate">{card.set || 'Unknown Set'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-green-400 font-semibold text-xs">{fp(card.price * card.quantity)}</div>
                    {card.quantity > 1 && (
                      <div className="text-white/30 text-xs">{card.quantity}x {fp(card.price)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Value Over Time */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-purple-400" /> Collection Value Over Time
        </h2>
        <ValueLineChart data={valueHistory} formatPrice={fp} />
        {valueHistory.length > 1 && (() => {
          const first = valueHistory[0].value;
          const last = valueHistory[valueHistory.length - 1].value;
          const diff = last - first;
          const pct = first > 0 ? (diff / first) * 100 : 0;
          return (
            <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
              <span>{valueHistory.length} days tracked</span>
              <span className={diff >= 0 ? 'text-green-400' : 'text-red-400'}>
                {diff >= 0 ? '+' : ''}{fp(diff)} ({pct.toFixed(1)}%) over period
              </span>
            </div>
          );
        })()}
      </div>

      {/* Gainers / Losers Widget */}
      {(priceChanges.gainers.length > 0 || priceChanges.losers.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Gainers */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-400" /> Top Gainers (30 days)
            </h2>
            {priceChanges.gainers.length === 0 ? (
              <p className="text-white/50 text-sm">No gainers yet. Run price updates over multiple days.</p>
            ) : (
              <div className="space-y-2">
                {priceChanges.gainers.map(item => (
                  <div key={item.cardId} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition">
                    {item.scryfallId && (
                      <img
                        src={`${API_URL.replace('/api', '')}/api/images/${item.scryfallId}`}
                        alt=""
                        className="w-6 h-8 rounded object-cover bg-gray-800 flex-shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-medium truncate">{item.name}</div>
                      <div className="text-white/40 text-xs">{fp(item.oldPrice)} → {fp(item.newPrice)}</div>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-green-500/20 text-green-400 flex-shrink-0">
                      +{item.changePct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Losers */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingDown size={18} className="text-red-400" /> Biggest Losers (30 days)
            </h2>
            {priceChanges.losers.length === 0 ? (
              <p className="text-white/50 text-sm">No losers yet. Run price updates over multiple days.</p>
            ) : (
              <div className="space-y-2">
                {priceChanges.losers.map(item => (
                  <div key={item.cardId} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition">
                    {item.scryfallId && (
                      <img
                        src={`${API_URL.replace('/api', '')}/api/images/${item.scryfallId}`}
                        alt=""
                        className="w-6 h-8 rounded object-cover bg-gray-800 flex-shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-medium truncate">{item.name}</div>
                      <div className="text-white/40 text-xs">{fp(item.oldPrice)} → {fp(item.newPrice)}</div>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-red-500/20 text-red-400 flex-shrink-0">
                      {item.changePct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Type Distribution + Rarity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Distribution */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Layers size={18} className="text-blue-400" /> Type Distribution
          </h2>
          {typeDistribution.length === 0 ? (
            <p className="text-white/50 text-sm">No type data yet. Update card data to populate.</p>
          ) : (
            <div className="space-y-2">
              {typeDistribution.map(([type, count], i) => (
                <HorizontalBar
                  key={type}
                  label={type}
                  value={count}
                  total={typeTotal}
                  color={typeColors[i % typeColors.length]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Rarity Breakdown */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Rarity Breakdown</h2>
          {rarityTotal === 0 ? (
            <p className="text-white/50 text-sm">No rarity data yet.</p>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="flex rounded-lg overflow-hidden h-6 mb-4">
                {Object.entries(rarityDistribution).map(([r, count]) => {
                  const pct = (count / rarityTotal) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={r}
                      className={`${rarityConfig[r].bar} flex items-center justify-center transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${rarityConfig[r].name}: ${count} (${pct.toFixed(1)}%)`}
                    >
                      {pct > 10 && <span className="text-xs font-bold text-white/90">{r}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                {Object.entries(rarityDistribution).map(([r, count]) => (
                  <HorizontalBar
                    key={r}
                    label={rarityConfig[r].name}
                    value={count}
                    total={rarityTotal}
                    color={rarityConfig[r].bar}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Set Distribution + Condition Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Set Distribution */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Top Sets by Card Count</h2>
          {setDistribution.length === 0 ? (
            <p className="text-white/50 text-sm">No cards in collection yet.</p>
          ) : (
            <div className="space-y-2">
              {setDistribution.map(([set, count], i) => (
                <HorizontalBar
                  key={set}
                  label={set}
                  value={count}
                  total={setTotal}
                  color={typeColors[i % typeColors.length]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Condition Overview */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Condition Overview</h2>
          {condTotal === 0 ? (
            <p className="text-white/50 text-sm">No cards in collection yet.</p>
          ) : (
            <>
              {/* Stacked bar */}
              <div className="flex rounded-lg overflow-hidden h-6 mb-4">
                {Object.entries(conditionDistribution).map(([cond, count]) => {
                  const pct = (count / condTotal) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={cond}
                      className={`${conditionConfig[cond].bar} flex items-center justify-center transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${conditionConfig[cond].name}: ${count} (${pct.toFixed(1)}%)`}
                    >
                      {pct > 10 && <span className="text-xs font-bold text-white/90">{cond}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                {Object.entries(conditionDistribution).map(([cond, count]) => (
                  <HorizontalBar
                    key={cond}
                    label={conditionConfig[cond].name}
                    value={count}
                    total={condTotal}
                    color={conditionConfig[cond].bar}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Value Distribution Histogram (full width) */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Value Distribution</h2>
        {totalCards === 0 ? (
          <p className="text-white/50 text-sm">No cards in collection yet.</p>
        ) : (
          <ValueHistogram buckets={valueDistribution} />
        )}
      </div>

      {/* Most Played Decks */}
      {mostPlayedDecks.length > 0 && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Star size={18} className="text-amber-400" /> Most Played Decks
          </h2>
          <div className="space-y-3">
            {mostPlayedDecks.slice(0, 3).map((d, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                <span className="text-white/40 text-xs font-mono w-5 text-right flex-shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{d.commanderName || 'Unknown Commander'}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  <div>
                    <div className="text-purple-300 font-semibold text-sm">{d.gamesPlayed} games</div>
                    <div className={`text-xs ${d.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{d.winRate}% WR</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 10 Most Owned + Recent Additions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Most Owned */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Top 10 Most Owned</h2>
          {topOwnedCards.length === 0 ? (
            <p className="text-white/50 text-sm">No cards in collection yet.</p>
          ) : (
            <div className="space-y-1.5">
              {topOwnedCards.map((card, i) => (
                <div key={card._id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition">
                  <span className="text-white/40 text-xs font-mono w-5 text-right flex-shrink-0">{i + 1}.</span>
                  {card.scryfallId && (
                    <img
                      src={`${API_URL.replace('/api', '')}/api/images/${card.scryfallId}`}
                      alt=""
                      className="w-6 h-8 rounded object-cover bg-gray-800 flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-medium truncate">{card.name}</div>
                    <div className="text-white/40 text-xs truncate">{card.set || 'Unknown Set'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-purple-300 font-semibold text-sm">{card.quantity}x</div>
                    <div className="text-white/40 text-xs">{fp(card.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Additions */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Additions</h2>
          {recentCards.length === 0 ? (
            <p className="text-white/50 text-sm">No cards added yet. Use the Add Card or Import button to get started!</p>
          ) : (
            <div className="space-y-2">
              {recentCards.map(card => (
                <div key={card._id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition">
                  {card.scryfallId && (
                    <img
                      src={`${API_URL.replace('/api', '')}/api/images/${card.scryfallId}`}
                      alt=""
                      className="w-8 h-11 rounded object-cover bg-gray-800 flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-sm font-medium truncate">{card.name}</div>
                    <div className="text-white/50 text-xs truncate">{card.set || 'Unknown Set'}</div>
                    <div className="text-green-400 text-xs font-medium">{fp(card.price || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
