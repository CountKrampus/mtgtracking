import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { API_URL } from '../config';

const DAY_OPTIONS = [
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '180d', value: 180 }
];

function PriceChart({ history }) {
  if (history.length < 3) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        Not enough history yet
      </div>
    );
  }

  const w = 380, h = 140, pad = 32;
  const prices = history.map(p => p.price);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || 1;
  const xStep = (w - pad * 2) / (history.length - 1);
  const pt = (i, p) => ({
    x: pad + i * xStep,
    y: h - pad - ((p - minP) / range) * (h - pad * 2)
  });
  const linePath = history
    .map((p, i) => {
      const { x, y } = pt(i, p.price);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 160 }}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text x={pad - 4} y={pad + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)">${maxP.toFixed(2)}</text>
      <text x={pad - 4} y={h - pad} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)">${minP.toFixed(2)}</text>
      <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" />
      {history.map((p, i) => {
        const { x, y } = pt(i, p.price);
        return (
          <circle key={i} cx={x} cy={y} r="3" fill="#a78bfa">
            <title>{`$${p.price.toFixed(2)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

export default function CardDetailPanel({ card, onClose }) {
  const [days, setDays] = useState(30);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!card) return;
    setLoading(true);
    axios
      .get(`${API_URL}/cards/${card._id}/price-history?days=${days}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      })
      .then(res => {
        const pts = (res.data || []).map(p => ({
          price: p.price,
          date: p.date || p.createdAt
        }));
        setHistory(pts);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [card, days]);

  // Dismiss on Escape — stable listener, never re-registers on parent re-render
  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  if (!card) return null;

  // Stats for the selected range
  const prices = history.map(p => p.price);
  const currentPrice = card.price || 0;
  const high = prices.length ? Math.max(...prices) : null;
  const low = prices.length ? Math.min(...prices) : null;
  const startPrice = prices.length ? prices[0] : null;
  const change = startPrice != null ? currentPrice - startPrice : null;
  const changePct = startPrice ? ((change / startPrice) * 100) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9990] bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-[9991] w-96 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">{card.name}</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {card.set || 'Unknown Set'} · {card.condition} · Qty {card.quantity}
            </p>
            {card.isFoil && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-300 text-xs">
                Foil
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current price */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-2xl font-bold text-white">
            ${currentPrice.toFixed(2)}
          </div>
          <div className="text-slate-400 text-xs mt-0.5">Current price (USD)</div>
        </div>

        {/* Day range toggle */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex gap-1 mb-3">
            {DAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  days === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
              Loading…
            </div>
          ) : (
            <PriceChart history={history} />
          )}
        </div>

        {/* Stats row */}
        {prices.length >= 2 && (
          <div className="px-4 pb-4 grid grid-cols-3 gap-3">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-white font-semibold text-sm">${high.toFixed(2)}</div>
              <div className="text-slate-500 text-xs mt-0.5">{days}d High</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-white font-semibold text-sm">${low.toFixed(2)}</div>
              <div className="text-slate-500 text-xs mt-0.5">{days}d Low</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className={`font-semibold text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                {changePct != null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
