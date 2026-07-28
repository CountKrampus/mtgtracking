import React, { useState, useEffect } from 'react';
import { X, Layers, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { API_URL } from '../config';

function ConditionBadge({ condition }) {
  const colors = {
    NM: 'bg-green-500/20 text-green-300',
    LP: 'bg-blue-500/20 text-blue-300',
    MP: 'bg-yellow-500/20 text-yellow-300',
    HP: 'bg-orange-500/20 text-orange-300',
    DMG: 'bg-red-500/20 text-red-300',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[condition] || 'bg-gray-500/20 text-gray-300'}`}>
      {condition}
    </span>
  );
}

function CardRow({ card, onHover, onLeave }) {
  return (
    <div
      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5 transition-colors group"
      onMouseEnter={() => onHover(card)}
      onMouseLeave={onLeave}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-white text-sm truncate cursor-default">{card.name}</span>
        <span className="text-gray-500 text-xs hidden sm:block shrink-0">{card.set}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ConditionBadge condition={card.condition} />
        <span className="text-green-400 text-sm font-medium w-14 text-right">
          ${(card.price || 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div data-testid="comparison-loading" className="animate-pulse space-y-3 p-6">
      <div className="h-8 bg-white/10 rounded w-1/2 mx-auto" />
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="space-y-2">
          <div className="h-5 bg-white/10 rounded w-2/3" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-white/10 rounded" />
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-5 bg-white/10 rounded w-2/3" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-white/10 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

function BalanceBadge({ balance }) {
  if (balance > 0) {
    return (
      <span data-testid="balance-badge" className="text-green-400 flex items-center gap-1 font-semibold">
        <TrendingUp size={16} />
        +${balance.toFixed(2)} in your favor
      </span>
    );
  }
  if (balance < 0) {
    return (
      <span data-testid="balance-badge" className="text-red-400 flex items-center gap-1 font-semibold">
        <TrendingDown size={16} />
        ${Math.abs(balance).toFixed(2)} in their favor
      </span>
    );
  }
  return (
    <span data-testid="balance-badge" className="text-gray-400 flex items-center gap-1 font-semibold">
      <Minus size={16} />
      Even trade
    </span>
  );
}

export default function CollectionComparison({ targetUsername, onClose }) {
  const { authFetch } = useAuthContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    authFetch(`${API_URL}/users/${targetUsername}/compare`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.message || 'Something went wrong.');
        } else {
          setData(body);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Network error. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [targetUsername, authFetch]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 bg-gray-900/95 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-gray-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <Layers size={20} className="text-blue-400" />
            <h2 className="text-white font-semibold text-lg">
              Compare Collections
            </h2>
            {!loading && !error && data && (
              <span className="text-gray-400 text-sm">
                vs <span className="text-white font-medium">{data.targetUser.username}</span>
              </span>
            )}
          </div>
          <button
            data-testid="comparison-close"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Close comparison"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        {loading && <LoadingSkeleton />}

        {!loading && error && (
          <div
            data-testid="comparison-error"
            className="flex flex-col items-center justify-center py-16 px-6 text-center"
          >
            <div className="text-4xl mb-4">
              {error.toLowerCase().includes('private') ? '🔒' : '❌'}
            </div>
            <p className="text-gray-300 text-lg">{error}</p>
            <button
              onClick={onClose}
              className="mt-6 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="px-6 pb-6">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500/30 flex items-center justify-center text-xs text-blue-300 font-bold">
                    {(data.targetUser.avatarUrl
                      ? null
                      : data.targetUser.username[0].toUpperCase())}
                  </div>
                  <span className="text-gray-300">{data.targetUser.username}</span>
                  {data.targetUser.reputation > 0 && (
                    <span className="text-yellow-400 text-xs">★ {data.targetUser.reputation}</span>
                  )}
                </div>
              </div>
              <BalanceBadge balance={data.balance} />
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column: they have, you don't */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-blue-400 font-semibold text-sm uppercase tracking-wide">
                    {data.targetUser.username} has, you don't
                  </h3>
                  <span className="text-green-400 font-medium text-sm">
                    ${data.theirTotal.toFixed(2)}
                  </span>
                </div>
                {data.theyHaveYouDont.length === 0 ? (
                  <p className="text-gray-500 text-sm italic py-4 text-center">
                    No unique cards found.
                  </p>
                ) : (
                  <div className="space-y-0.5 max-h-96 overflow-y-auto pr-1">
                    {data.theyHaveYouDont.map((card) => (
                      <CardRow
                        key={card._id || card.scryfallId}
                        card={card}
                        onHover={setHoverCard}
                        onLeave={() => setHoverCard(null)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right column: you have, they don't */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-purple-400 font-semibold text-sm uppercase tracking-wide">
                    You have, they don't
                  </h3>
                  <span className="text-green-400 font-medium text-sm">
                    ${data.yourTotal.toFixed(2)}
                  </span>
                </div>
                {data.youHaveTheyDont.length === 0 ? (
                  <p className="text-gray-500 text-sm italic py-4 text-center">
                    No unique cards found.
                  </p>
                ) : (
                  <div className="space-y-0.5 max-h-96 overflow-y-auto pr-1">
                    {data.youHaveTheyDont.map((card) => (
                      <CardRow
                        key={card._id || card.scryfallId}
                        card={card}
                        onHover={setHoverCard}
                        onLeave={() => setHoverCard(null)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hover image preview (fixed center) */}
      {hoverCard && (hoverCard.imageUrl || hoverCard.scryfallId) && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] pointer-events-none"
          style={{ marginLeft: 280 }}
        >
          <img
            src={
              hoverCard.imageUrl ||
              `https://api.scryfall.com/cards/${hoverCard.scryfallId}?format=image`
            }
            alt={hoverCard.name}
            className="w-48 rounded-xl shadow-2xl border border-white/20"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}
