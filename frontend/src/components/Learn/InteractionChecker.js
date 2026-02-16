import React, { useState } from 'react';
import { Search, Zap, Info, Clock } from 'lucide-react';

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          card1: firstCard.trim(),
          card2: secondCard.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to check interaction');
      }

      const data = await response.json();
      setInteractionResult(data);
    } catch (err) {
      setError(err.message);
      console.error('Error checking interaction:', err);
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              First Card
            </label>
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Second Card
            </label>
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
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-yellow-400" size={24} />
            <h2 className="text-xl font-semibold text-white">
              Interaction Result: {firstCard} + {secondCard}
            </h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-purple-300 mb-2">How They Interact</h3>
              <p className="text-white leading-relaxed">
                {interactionResult.how_they_interact || 'This interaction has various effects depending on the game state.'}
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-purple-300 mb-2">Sequence of Events</h3>
              <ol className="list-decimal list-inside space-y-2 text-white">
                {interactionResult.sequence_of_events?.map((step, index) => (
                  <li key={index} className="ml-4">{step}</li>
                )) || (
                  <>
                    <li>1. {firstCard} enters the battlefield</li>
                    <li>2. {secondCard}'s ability triggers</li>
                    <li>3. The interaction resolves based on game state</li>
                  </>
                )}
              </ol>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-purple-300 mb-2">Important Notes</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-300">
                {interactionResult.notes?.map((note, index) => (
                  <li key={index}>{note}</li>
                )) || (
                  <>
                    <li>Timing matters for this interaction</li>
                    <li>Other cards on the battlefield may affect the outcome</li>
                    <li>Check the official rules for edge cases</li>
                  </>
                )}
              </ul>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-6">
              <Info size={16} />
              <span>Information based on official Magic: The Gathering rules</span>
              <Clock size={16} className="ml-auto" />
              <span>Last updated: {new Date(interactionResult.timestamp || Date.now()).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {!interactionResult && !loading && (
        <div className="text-center py-12">
          <Zap className="mx-auto h-12 w-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">Check Card Interactions</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter two card names to understand how they interact with each other according to the rules of Magic: The Gathering.
          </p>
        </div>
      )}
    </div>
  );
};

export default InteractionChecker;