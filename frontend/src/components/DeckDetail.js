import React, { useState, useMemo } from 'react';
import axios from 'axios';
import ManaCurveChart from './ManaCurveChart';

const API_URL = 'http://localhost:5000/api';

// Salt scores for "annoying" cards (based on EDHREC community feedback)
const SALTY_CARDS = {
  // High salt (3 points)
  'Cyclonic Rift': 3, 'Armageddon': 3, 'Winter Orb': 3, 'Static Orb': 3,
  'Stasis': 3, 'Blood Moon': 3, 'Back to Basics': 3, 'Vorinclex, Voice of Hunger': 3,
  'Iona, Shield of Emeria': 3, 'Jin-Gitaxias, Core Augur': 3, 'Expropriate': 3,
  'Thassa\'s Oracle': 3, 'Demonic Consultation': 3, 'Tergrid, God of Fright': 3,
  'Grand Arbiter Augustin IV': 3, 'Narset, Parter of Veils': 3, 'Hullbreacher': 3,
  'Opposition Agent': 3, 'Drannith Magistrate': 3, 'Rule of Law': 3,
  // Medium salt (2 points)
  'Smothering Tithe': 2, 'Rhystic Study': 2, 'Dockside Extortionist': 2,
  'Fierce Guardianship': 2, 'Deflecting Swat': 2, 'Force of Will': 2,
  'Mana Drain': 2, 'Counterspell': 2, 'Pact of Negation': 2,
  'Craterhoof Behemoth': 2, 'Tooth and Nail': 2, 'Triumph of the Hordes': 2,
  'Vorinclex, Monstrous Raider': 2, 'Omniscience': 2, 'Enter the Infinite': 2,
  'Time Stretch': 2, 'Time Warp': 2, 'Extra Turn': 2, 'Seedborn Muse': 2,
  'Consecrated Sphinx': 2, 'Necropotence': 2, 'Ad Nauseam': 2,
  // Low salt (1 point)
  'Sol Ring': 1, 'Mana Crypt': 1, 'Mana Vault': 1, 'Chrome Mox': 1,
  'Mox Diamond': 1, 'Jeweled Lotus': 1, 'Ancient Tomb': 1, 'Gaea\'s Cradle': 1,
  'Strip Mine': 1, 'Wasteland': 1, 'Cyclonic Rift': 1, 'Beast Within': 1,
  'Path to Exile': 1, 'Swords to Plowshares': 1, 'Esper Sentinel': 1,
  'Mystic Remora': 1, 'Demonic Tutor': 1, 'Vampiric Tutor': 1, 'Worldly Tutor': 1,
  'Enlightened Tutor': 1, 'Imperial Seal': 1, 'Gamble': 1
};

// Cards that indicate higher power level
const POWER_INDICATORS = {
  fastMana: ['Sol Ring', 'Mana Crypt', 'Mana Vault', 'Chrome Mox', 'Mox Diamond',
             'Jeweled Lotus', 'Ancient Tomb', 'Gaea\'s Cradle', 'Lotus Petal',
             'Dark Ritual', 'Cabal Ritual', 'Simian Spirit Guide'],
  tutors: ['Demonic Tutor', 'Vampiric Tutor', 'Worldly Tutor', 'Enlightened Tutor',
           'Mystical Tutor', 'Imperial Seal', 'Gamble', 'Diabolic Intent',
           'Finale of Devastation', 'Green Sun\'s Zenith', 'Chord of Calling',
           'Survival of the Fittest', 'Natural Order', 'Birthing Pod'],
  comboPieces: ['Thassa\'s Oracle', 'Demonic Consultation', 'Tainted Pact',
                'Laboratory Maniac', 'Jace, Wielder of Mysteries', 'Doomsday',
                'Isochron Scepter', 'Dramatic Reversal', 'Paradox Engine',
                'Basalt Monolith', 'Rings of Brighthearth', 'Power Artifact',
                'Walking Ballista', 'Heliod, Sun-Crowned', 'Spike Feeder',
                'Kiki-Jiki, Mirror Breaker', 'Splinter Twin', 'Zealous Conscripts'],
  efficientRemoval: ['Swords to Plowshares', 'Path to Exile', 'Abrupt Decay',
                     'Assassin\'s Trophy', 'Force of Will', 'Pact of Negation',
                     'Fierce Guardianship', 'Deflecting Swat', 'Mana Drain'],
  powerhouses: ['Rhystic Study', 'Smothering Tithe', 'Dockside Extortionist',
                'Consecrated Sphinx', 'Necropotence', 'Ad Nauseam', 'Sylvan Library',
                'Mystic Remora', 'Esper Sentinel', 'Seedborn Muse', 'Prophet of Kruphix']
};

function DeckDetail({ deck, ownership, validation, loading, onBack, onRefresh }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newDeckName, setNewDeckName] = useState(deck.name);

  // Calculate Salt Score
  const saltScore = useMemo(() => {
    if (!deck.mainDeck) return { score: 0, cards: [] };

    let totalSalt = 0;
    const saltyCardsInDeck = [];

    deck.mainDeck.forEach(card => {
      const cardSalt = SALTY_CARDS[card.name] || 0;
      if (cardSalt > 0) {
        totalSalt += cardSalt;
        saltyCardsInDeck.push({ name: card.name, salt: cardSalt });
      }
    });

    // Also check commander
    if (deck.commander && SALTY_CARDS[deck.commander.name]) {
      totalSalt += SALTY_CARDS[deck.commander.name];
      saltyCardsInDeck.push({ name: deck.commander.name, salt: SALTY_CARDS[deck.commander.name] });
    }

    return { score: totalSalt, cards: saltyCardsInDeck.sort((a, b) => b.salt - a.salt) };
  }, [deck]);

  // Calculate Power Level (1-10 scale)
  const powerLevel = useMemo(() => {
    if (!deck.mainDeck) return { level: 1, breakdown: {} };

    const allCards = deck.mainDeck.map(c => c.name);
    if (deck.commander) allCards.push(deck.commander.name);

    let score = 0;
    const breakdown = {
      fastMana: 0,
      tutors: 0,
      comboPieces: 0,
      efficientRemoval: 0,
      powerhouses: 0,
      avgCmc: deck.statistics?.avgManaCost || 3.5,
      deckValue: ownership?.summary?.totalValue || 0
    };

    // Count power indicators
    allCards.forEach(cardName => {
      if (POWER_INDICATORS.fastMana.includes(cardName)) breakdown.fastMana++;
      if (POWER_INDICATORS.tutors.includes(cardName)) breakdown.tutors++;
      if (POWER_INDICATORS.comboPieces.includes(cardName)) breakdown.comboPieces++;
      if (POWER_INDICATORS.efficientRemoval.includes(cardName)) breakdown.efficientRemoval++;
      if (POWER_INDICATORS.powerhouses.includes(cardName)) breakdown.powerhouses++;
    });

    // Calculate score based on indicators
    score += Math.min(breakdown.fastMana * 0.5, 2); // Max 2 points for fast mana
    score += Math.min(breakdown.tutors * 0.4, 2); // Max 2 points for tutors
    score += Math.min(breakdown.comboPieces * 0.6, 2); // Max 2 points for combo pieces
    score += Math.min(breakdown.efficientRemoval * 0.3, 1); // Max 1 point for removal
    score += Math.min(breakdown.powerhouses * 0.3, 1.5); // Max 1.5 points for powerhouses

    // Bonus for low avg CMC (faster deck)
    if (breakdown.avgCmc < 2.5) score += 1;
    else if (breakdown.avgCmc < 3) score += 0.5;

    // Bonus for expensive decks (proxy for optimization)
    if (breakdown.deckValue > 1000) score += 0.5;
    if (breakdown.deckValue > 2500) score += 0.5;

    // Base level is 3 (precon level), add calculated score
    const finalLevel = Math.min(10, Math.max(1, Math.round(3 + score)));

    return { level: finalLevel, breakdown };
  }, [deck, ownership]);

  const handleAddToCollection = async (card) => {
    try {
      await axios.post(`${API_URL}/cards`, {
        name: card.name,
        set: 'Unknown',
        quantity: 1,
        condition: 'NM',
        price: card.price,
        colors: card.colors,
        types: card.types,
        manaCost: card.manaCost,
        scryfallId: card.scryfallId,
        imageUrl: card.imageUrl
      });
      alert(`Added ${card.name} to collection!`);
      onRefresh();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleSaveRename = async () => {
    if (!newDeckName.trim()) {
      alert('Deck name cannot be empty');
      return;
    }

    try {
      await axios.put(`${API_URL}/decks/${deck._id}`, {
        ...deck,
        name: newDeckName
      });
      setIsEditingName(false);
      onRefresh();
    } catch (error) {
      alert('Error renaming deck: ' + error.message);
    }
  };

  const handleCancelRename = () => {
    setNewDeckName(deck.name);
    setIsEditingName(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        {isEditingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              className="flex-1 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-2xl font-bold"
              autoFocus
            />
            <button
              onClick={handleSaveRename}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
            >
              Save
            </button>
            <button
              onClick={handleCancelRename}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{deck.name}</h2>
            <button
              onClick={() => setIsEditingName(true)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition"
            >
              Rename
            </button>
          </div>
        )}
        <button
          onClick={onBack}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
        >
          ← Back to Decks
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/60">Loading deck details...</div>
      ) : (
        <>
          {/* Commander Display */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <h3 className="text-lg font-bold text-white mb-3">Commander</h3>
            <div className="flex gap-4">
              {deck.commander?.imageUrl && (
                <img
                  src={deck.commander.imageUrl}
                  alt={deck.commander.name}
                  className="w-48 rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1">
                <div className="text-xl font-bold text-white">{deck.commander?.name}</div>
                <div className="text-white/60 mb-2">{deck.commander?.manaCost}</div>

                {deck.commander?.typeLine && (
                  <div className="text-white/80 mb-3 italic">{deck.commander.typeLine}</div>
                )}

                {deck.commander?.oracleText && (
                  <div className="text-white/90 mb-3 whitespace-pre-line bg-white/5 p-3 rounded">
                    {deck.commander.oracleText}
                  </div>
                )}

                {deck.commander?.power && deck.commander?.toughness && (
                  <div className="text-white/80 font-bold mb-2">
                    {deck.commander.power}/{deck.commander.toughness}
                  </div>
                )}

                {deck.commander?.flavorText && (
                  <div className="text-white/60 italic text-sm mt-2 border-t border-white/20 pt-2">
                    {deck.commander.flavorText}
                  </div>
                )}
              </div>
            </div>

            {deck.partnerCommander && (
              <div className="flex gap-4 mt-6 pt-6 border-t border-white/20">
                {deck.partnerCommander?.imageUrl && (
                  <img
                    src={deck.partnerCommander.imageUrl}
                    alt={deck.partnerCommander.name}
                    className="w-48 rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <div className="text-xl font-bold text-white">{deck.partnerCommander.name}</div>
                  <div className="text-white/60 mb-2">{deck.partnerCommander.manaCost}</div>

                  {deck.partnerCommander?.typeLine && (
                    <div className="text-white/80 mb-3 italic">{deck.partnerCommander.typeLine}</div>
                  )}

                  {deck.partnerCommander?.oracleText && (
                    <div className="text-white/90 mb-3 whitespace-pre-line bg-white/5 p-3 rounded">
                      {deck.partnerCommander.oracleText}
                    </div>
                  )}

                  {deck.partnerCommander?.power && deck.partnerCommander?.toughness && (
                    <div className="text-white/80 font-bold mb-2">
                      {deck.partnerCommander.power}/{deck.partnerCommander.toughness}
                    </div>
                  )}

                  {deck.partnerCommander?.flavorText && (
                    <div className="text-white/60 italic text-sm mt-2 border-t border-white/20 pt-2">
                      {deck.partnerCommander.flavorText}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Validation */}
          {validation && (validation.errors?.length > 0 || validation.warnings?.length > 0) && (
            <div className="bg-red-600/20 border border-red-600/50 rounded-lg p-4 mb-6">
              {validation.errors?.map((error, idx) => (
                <div key={idx} className="text-red-200">❌ {error}</div>
              ))}
              {validation.warnings?.map((warning, idx) => (
                <div key={idx} className="text-yellow-200">⚠️ {warning}</div>
              ))}
            </div>
          )}

          {/* Statistics & Ownership */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Mana Curve */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
              <h3 className="text-lg font-bold text-white mb-4">Mana Curve</h3>
              <ManaCurveChart manaCurve={deck.statistics?.manaCurve} />
              <div className="mt-4 text-white/60 text-sm text-center">
                Avg CMC: {deck.statistics?.avgManaCost?.toFixed(2) || '0.00'}
              </div>
            </div>

            {/* Ownership */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
              <h3 className="text-lg font-bold text-white mb-4">Collection Ownership</h3>
              {ownership && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/80">Owned Cards:</span>
                    <span className="text-green-400 font-bold">
                      {ownership.summary.ownedCount}/{deck.statistics?.totalCards || 100}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">Missing Cards:</span>
                    <span className="text-red-400 font-bold">{ownership.summary.missingCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">Completion:</span>
                    <span className="text-purple-400 font-bold">{ownership.summary.completionPercentage}%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-purple-500"
                      style={{ width: `${ownership.summary.completionPercentage}%` }}
                    />
                  </div>
                  <div className="pt-3 border-t border-white/20">
                    <div className="flex justify-between">
                      <span className="text-white/80">Owned Value:</span>
                      <span className="text-white font-bold">${ownership.summary.ownedValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/80">Missing Value:</span>
                      <span className="text-white font-bold">${ownership.summary.missingValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-white">Total Deck Value:</span>
                      <span className="text-purple-400">${ownership.summary.totalValue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Power Level & Salt Score */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Power Level */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
              <h3 className="text-lg font-bold text-white mb-4">Power Level</h3>
              <div className="flex items-center justify-center mb-4">
                <div className={`text-6xl font-bold ${
                  powerLevel.level >= 9 ? 'text-red-500' :
                  powerLevel.level >= 7 ? 'text-orange-500' :
                  powerLevel.level >= 5 ? 'text-yellow-500' :
                  powerLevel.level >= 3 ? 'text-green-500' : 'text-blue-500'
                }`}>
                  {powerLevel.level}
                </div>
                <div className="text-white/40 text-2xl ml-1">/10</div>
              </div>
              <div className="flex justify-center mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  powerLevel.level >= 9 ? 'bg-red-500/20 text-red-300' :
                  powerLevel.level >= 7 ? 'bg-orange-500/20 text-orange-300' :
                  powerLevel.level >= 5 ? 'bg-yellow-500/20 text-yellow-300' :
                  powerLevel.level >= 3 ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {powerLevel.level >= 9 ? 'cEDH / Competitive' :
                   powerLevel.level >= 7 ? 'High Power' :
                   powerLevel.level >= 5 ? 'Optimized' :
                   powerLevel.level >= 3 ? 'Casual / Precon' : 'Jank / Meme'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Fast Mana:</span>
                  <span className="text-white">{powerLevel.breakdown.fastMana} cards</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Tutors:</span>
                  <span className="text-white">{powerLevel.breakdown.tutors} cards</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Combo Pieces:</span>
                  <span className="text-white">{powerLevel.breakdown.comboPieces} cards</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Efficient Removal:</span>
                  <span className="text-white">{powerLevel.breakdown.efficientRemoval} cards</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Powerhouses:</span>
                  <span className="text-white">{powerLevel.breakdown.powerhouses} cards</span>
                </div>
              </div>
            </div>

            {/* Salt Score */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
              <h3 className="text-lg font-bold text-white mb-4">Salt Score</h3>
              <div className="flex items-center justify-center mb-4">
                <div className={`text-6xl font-bold ${
                  saltScore.score >= 20 ? 'text-red-500' :
                  saltScore.score >= 10 ? 'text-orange-500' :
                  saltScore.score >= 5 ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {saltScore.score}
                </div>
              </div>
              <div className="flex justify-center mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  saltScore.score >= 20 ? 'bg-red-500/20 text-red-300' :
                  saltScore.score >= 10 ? 'bg-orange-500/20 text-orange-300' :
                  saltScore.score >= 5 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'
                }`}>
                  {saltScore.score >= 20 ? 'Maximum Salt - Prepare for groans' :
                   saltScore.score >= 10 ? 'Pretty Salty - May cause frustration' :
                   saltScore.score >= 5 ? 'Mild Salt - Some annoying cards' : 'Low Salt - Friendly deck'}
                </span>
              </div>
              {saltScore.cards.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  <div className="text-white/60 text-sm mb-2">Salty cards in this deck:</div>
                  {saltScore.cards.map((card, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-white">{card.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        card.salt >= 3 ? 'bg-red-500/30 text-red-300' :
                        card.salt >= 2 ? 'bg-orange-500/30 text-orange-300' : 'bg-yellow-500/30 text-yellow-300'
                      }`}>
                        +{card.salt}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/40 text-center text-sm">
                  No salty cards detected! Your playgroup will thank you.
                </div>
              )}
            </div>
          </div>

          {/* Missing Cards */}
          {ownership?.missingCards?.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Missing Cards ({ownership.missingCards.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {ownership.missingCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 bg-red-600/10 border border-red-600/30 rounded-lg"
                  >
                    <div>
                      <div className="text-white font-medium">{card.name}</div>
                      <div className="text-white/60 text-sm">${card.price?.toFixed(2) || '0.00'}</div>
                    </div>
                    <button
                      onClick={() => handleAddToCollection(card)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition text-sm"
                    >
                      + Add to Collection
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card List */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
            <h3 className="text-lg font-bold text-white mb-4">Deck List ({deck.mainDeck?.length || 0} cards)</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {deck.mainDeck?.map((card, idx) => {
                const owned = ownership?.ownedCards?.find(c => c.scryfallId === card.scryfallId);

                return (
                  <div
                    key={idx}
                    className={`flex justify-between items-center p-2 rounded ${
                      owned ? 'bg-green-600/10' : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {owned ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}
                      <span className="text-white">{card.name}</span>
                      <span className="text-white/40 text-sm">{card.manaCost}</span>
                    </div>
                    <div className="text-white/60 text-sm">
                      {owned ? `Own ${owned.collectionQuantity}` : 'Need'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DeckDetail;
