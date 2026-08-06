import React, { useState, useEffect } from 'react';
import { X, Zap, Heart, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

export default function ComboFinderModal({ isOpen, onClose, fetchWishlist }) {
  const [comboResults, setComboResults] = useState({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
  const [loadingCombos, setLoadingCombos] = useState(false);
  const [comboTab, setComboTab] = useState('complete');

  const findCombos = async () => {
    setLoadingCombos(true);
    setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
    setComboTab('complete');

    try {
      const response = await axios.get(`${API_URL}/combos/find`);
      setComboResults(response.data);
      if (response.data.found === 0 && response.data.partialFound > 0) {
        setComboTab('partial');
      }
    } catch (error) {
      console.error('Error finding combos:', error);
      setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0, error: error.message });
    } finally {
      setLoadingCombos(false);
    }
  };

  const addToWishlistFromCombo = async (cardName) => {
    try {
      const searchResponse = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(cardName)}`);
      const cardData = searchResponse.data;

      await axios.post(`${API_URL}/wishlist`, {
        name: cardData.name,
        set: cardData.set || 'Unknown',
        imageUrl: cardData.imageUrl,
        currentPrice: cardData.price || 0,
        targetPrice: cardData.price || 0,
        priority: 'medium',
        notes: 'Added from Combo Finder'
      });

      alert(`${cardData.name} added to wishlist!`);
      fetchWishlist();
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      try {
        await axios.post(`${API_URL}/wishlist`, {
          name: cardName,
          set: 'Unknown',
          currentPrice: 0,
          targetPrice: 0,
          priority: 'medium',
          notes: 'Added from Combo Finder'
        });
        alert(`${cardName} added to wishlist!`);
        fetchWishlist();
      } catch (e) {
        alert('Failed to add card to wishlist');
      }
    }
  };

  useEffect(() => {
    if (isOpen) findCombos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
    setComboTab('complete');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-orange-500">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="text-orange-500" size={24} /> Combo Finder
            </h2>
            <p className="text-white/60 mt-1">
              Infinite combos you can assemble from your collection
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-white/60 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tab buttons */}
        {!loadingCombos && !comboResults.error && (
          <div className="px-6 py-3 border-b border-white/10 flex gap-2">
            <button
              onClick={() => setComboTab('complete')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                comboTab === 'complete'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              Complete ({comboResults.found})
            </button>
            <button
              onClick={() => setComboTab('partial')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                comboTab === 'partial'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              Near-Complete ({comboResults.partialFound || 0})
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
          {loadingCombos ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw size={48} className="text-orange-500 animate-spin mb-4" />
              <p className="text-white/60">Searching Commander Spellbook for combos in your collection...</p>
              <p className="text-white/40 text-sm mt-2">This may take a moment on first load</p>
            </div>
          ) : comboResults.error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-2">Error finding combos</p>
              <p className="text-white/60 text-sm">{comboResults.error}</p>
              <button
                onClick={findCombos}
                className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
              >
                Try Again
              </button>
            </div>
          ) : comboTab === 'complete' ? (
            // Complete Combos Tab
            comboResults.combos.length === 0 ? (
              <div className="text-center py-12">
                <Zap size={48} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/60 mb-2">No complete combos found in your collection</p>
                <p className="text-white/40 text-sm">
                  Check the "Near-Complete" tab to see combos you're close to assembling!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {comboResults.combos.map((combo, idx) => (
                  <div key={combo.id || idx} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {combo.cards.map((cardName, cardIdx) => (
                        <span
                          key={cardIdx}
                          className="px-3 py-1 bg-green-600/30 text-green-200 rounded-full text-sm font-medium"
                        >
                          âœ“ {cardName}
                        </span>
                      ))}
                    </div>

                    {combo.produces && combo.produces.length > 0 && (
                      <div className="mb-3">
                        <span className="text-white/60 text-sm">Produces: </span>
                        <span className="text-green-400 text-sm">
                          {Array.isArray(combo.produces)
                            ? combo.produces.map(p => {
                                if (typeof p === 'string') return p;
                                if (p.feature && p.feature.name) return p.feature.name;
                                if (p.name) return p.name;
                                if (p.description) return p.description;
                                return JSON.stringify(p);
                              }).join(', ')
                            : combo.produces}
                        </span>
                      </div>
                    )}

                    {combo.prerequisite && (
                      <div className="mb-2">
                        <span className="text-white/60 text-sm">Prerequisites: </span>
                        <span className="text-white/80 text-sm">{combo.prerequisite}</span>
                      </div>
                    )}

                    {combo.steps && (
                      <div className="mb-2">
                        <span className="text-white/60 text-sm">Steps: </span>
                        <span className="text-white/80 text-sm">{combo.steps}</span>
                      </div>
                    )}

                    {combo.description && !combo.steps && (
                      <p className="text-white/70 text-sm">{combo.description}</p>
                    )}

                    {combo.spellbookUrl && (
                      <a
                        href={combo.spellbookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-orange-400 hover:text-orange-300 text-sm underline"
                      >
                        View on Commander Spellbook â†’
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            // Partial Combos Tab
            (!comboResults.partialCombos || comboResults.partialCombos.length === 0) ? (
              <div className="text-center py-12">
                <Zap size={48} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/60 mb-2">No near-complete combos found</p>
                <p className="text-white/40 text-sm">
                  You need at least 2 pieces of a combo for it to show here.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {comboResults.partialCombos.map((combo, idx) => (
                  <div key={combo.id || idx} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition border border-yellow-600/30">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-yellow-400 text-xs font-medium px-2 py-1 bg-yellow-600/20 rounded">
                        Missing {combo.missingCards.length} card{combo.missingCards.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {combo.cards.map((cardName, cardIdx) => {
                        const isMissing = combo.missingCards.includes(cardName);
                        return (
                          <span
                            key={cardIdx}
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              isMissing
                                ? 'bg-red-600/30 text-red-200 border border-red-500/50'
                                : 'bg-green-600/30 text-green-200'
                            }`}
                          >
                            {isMissing ? 'âœ—' : 'âœ“'} {cardName}
                          </span>
                        );
                      })}
                    </div>

                    {/* Add to Wishlist buttons for missing cards */}
                    {combo.missingCards.length > 0 && (
                      <div className="mb-3 p-3 bg-yellow-600/10 rounded-lg border border-yellow-600/20">
                        <p className="text-yellow-200 text-sm mb-2">Add missing cards to wishlist:</p>
                        <div className="flex flex-wrap gap-2">
                          {combo.missingCards.map((cardName, cardIdx) => (
                            <button
                              key={cardIdx}
                              onClick={() => addToWishlistFromCombo(cardName)}
                              className="px-3 py-1 bg-pink-600 hover:bg-pink-700 text-white text-sm rounded transition flex items-center gap-1"
                            >
                              <Heart size={12} /> {cardName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {combo.produces && combo.produces.length > 0 && (
                      <div className="mb-3">
                        <span className="text-white/60 text-sm">Produces: </span>
                        <span className="text-green-400 text-sm">
                          {Array.isArray(combo.produces)
                            ? combo.produces.map(p => {
                                if (typeof p === 'string') return p;
                                if (p.feature && p.feature.name) return p.feature.name;
                                if (p.name) return p.name;
                                if (p.description) return p.description;
                                return JSON.stringify(p);
                              }).join(', ')
                            : combo.produces}
                        </span>
                      </div>
                    )}

                    {combo.prerequisite && (
                      <div className="mb-2">
                        <span className="text-white/60 text-sm">Prerequisites: </span>
                        <span className="text-white/80 text-sm">{combo.prerequisite}</span>
                      </div>
                    )}

                    {combo.steps && (
                      <div className="mb-2">
                        <span className="text-white/60 text-sm">Steps: </span>
                        <span className="text-white/80 text-sm">{combo.steps}</span>
                      </div>
                    )}

                    {combo.description && !combo.steps && (
                      <p className="text-white/70 text-sm">{combo.description}</p>
                    )}

                    {combo.spellbookUrl && (
                      <a
                        href={combo.spellbookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-orange-400 hover:text-orange-300 text-sm underline"
                      >
                        View on Commander Spellbook â†’
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center">
          <p className="text-white/40 text-xs">
            {comboTab === 'complete'
              ? `Found ${comboResults.found} complete combo${comboResults.found !== 1 ? 's' : ''}`
              : `Found ${comboResults.partialFound || 0} near-complete combo${(comboResults.partialFound || 0) !== 1 ? 's' : ''}`}
          </p>
          <p className="text-white/40 text-xs">
            Data from Commander Spellbook
          </p>
        </div>
      </div>
    </div>
  );
}
