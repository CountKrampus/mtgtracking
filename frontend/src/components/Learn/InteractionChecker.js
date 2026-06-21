import React, { useState } from 'react';
import { Search, Zap, Info } from 'lucide-react';

function highlightShared(text, shared) {
  if (!text || !shared || shared.length === 0) return text;
  const escaped = shared.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part)
      ? <strong key={i} className="text-yellow-300 font-semibold">{part}</strong>
      : part
  );
}

const InteractionChecker = () => {
  const [firstCard, setFirstCard] = useState('');
  const [secondCard, setSecondCard] = useState('');
  const [interactionResult, setInteractionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCheckInteraction = async (e) => {
    e.preventDefault();
    if (!firstCard.trim() || !secondCard.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/interactions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card1: firstCard.trim(), card2: secondCard.trim() })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to check interaction');
      }

      const data = await response.json();
      setInteractionResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Interaction Checker</h1>
        <p className="text-gray-400">
          Understand how two cards interact with each other
        </p>
      </div>

      <form onSubmit={handleCheckInteraction} className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">First Card</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={firstCard}
                onChange={(e) => setFirstCard(e.target.value)}
                placeholder="Enter first card name..."
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Second Card</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={secondCard}
                onChange={(e) => setSecondCard(e.target.value)}
                placeholder="Enter second card name..."
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Checking Interaction...
              </>
            ) : (
              <>
                <Zap size={20} />
                Check Interaction
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-red-200">Error: {error}</p>
        </div>
      )}

      {interactionResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { card: interactionResult.card1, rulings: interactionResult.rulings1 },
              { card: interactionResult.card2, rulings: interactionResult.rulings2 },
            ].map(({ card, rulings }, idx) => (
              <div key={idx} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                <div className="flex gap-3 p-4 border-b border-white/10">
                  {card.image_uri && (
                    <img
                      src={card.image_uri}
                      alt={card.name}
                      className="w-16 h-auto rounded shadow"
                    />
                  )}
                  <div>
                    <h3 className="text-white font-semibold">{card.name}</h3>
                    <p className="text-gray-400 text-xs mt-0.5">{card.type_line}</p>
                    {card.mana_cost && (
                      <p className="text-gray-400 text-xs">{card.mana_cost}</p>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="text-purple-300 text-sm font-medium mb-2">Oracle Text</h4>
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                    {highlightShared(card.oracle_text, interactionResult.sharedKeywords)}
                  </p>

                  {rulings.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-purple-300 text-sm font-medium mb-2">
                        Official Rulings ({rulings.length})
                      </h4>
                      <ul className="space-y-2">
                        {rulings.map((r, i) => (
                          <li key={i} className="text-gray-300 text-xs border-l-2 border-purple-700 pl-3">
                            <span className="text-gray-500 block mb-0.5">{r.published_at}</span>
                            {r.comment}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {interactionResult.sharedKeywords.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h4 className="text-yellow-300 text-sm font-medium mb-2">Shared Mechanics</h4>
              <div className="flex flex-wrap gap-2">
                {interactionResult.sharedKeywords.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-200 text-xs rounded capitalize">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-gray-500 text-xs flex items-center gap-1">
            <Info size={13} />
            Card data and rulings from Scryfall
          </p>
        </div>
      )}

      {!interactionResult && !loading && (
        <div className="text-center py-12">
          <Zap className="mx-auto h-12 w-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">Check Card Interactions</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter two card names to see their oracle text, official rulings, and shared mechanics side by side.
          </p>
        </div>
      )}
    </div>
  );
};

export default InteractionChecker;
