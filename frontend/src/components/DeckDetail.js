import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import ManaCurveChart from './ManaCurveChart';
import DeckAnalysis from './DeckAnalysis';
import DeckHandSimulator from './DeckHandSimulator';

const API_URL = 'http://localhost:5000/api';

// ── CMC helpers ───────────────────────────────────────────────────────────────
function parseCmcFromManaCost(manaCost) {
  if (!manaCost) return 0;
  let cmc = 0;
  const matches = manaCost.match(/\{([^}]+)\}/g) || [];
  matches.forEach(symbol => {
    const value = symbol.replace(/[{}]/g, '');
    if (/^\d+$/.test(value)) cmc += parseInt(value);
    else if (value !== 'X') cmc += 1;
  });
  return cmc;
}

function getCardCmcBucket(card) {
  const cmc = parseCmcFromManaCost(card.manaCost);
  return cmc >= 7 ? '7+' : cmc.toString();
}

// ── Card categories ───────────────────────────────────────────────────────────
const CATEGORY_ORDER = ['Planeswalker', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land', 'Other'];

const CATEGORY_STYLES = {
  Planeswalker: { text: 'text-amber-400',  border: 'border-amber-500/40',  bg: 'bg-amber-500/10'  },
  Creature:     { text: 'text-green-400',  border: 'border-green-500/40',  bg: 'bg-green-500/10'  },
  Instant:      { text: 'text-blue-400',   border: 'border-blue-500/40',   bg: 'bg-blue-500/10'   },
  Sorcery:      { text: 'text-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/10'    },
  Enchantment:  { text: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' },
  Artifact:     { text: 'text-gray-300',   border: 'border-gray-500/40',   bg: 'bg-gray-500/10'   },
  Land:         { text: 'text-yellow-500', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' },
  Other:        { text: 'text-white/60',   border: 'border-white/20',      bg: 'bg-white/5'       },
};

// ── Color / type chart helpers ────────────────────────────────────────────────
const COLOR_META = {
  W: { color: '#f5e6a3', label: 'White'     },
  U: { color: '#60a5fa', label: 'Blue'      },
  B: { color: '#6b7280', label: 'Black'     },
  R: { color: '#f87171', label: 'Red'       },
  G: { color: '#4ade80', label: 'Green'     },
  C: { color: '#9ca3af', label: 'Colorless' },
};

const TYPE_META = {
  Creature:     { color: '#4ade80' },
  Instant:      { color: '#60a5fa' },
  Sorcery:      { color: '#f87171' },
  Artifact:     { color: '#9ca3af' },
  Enchantment:  { color: '#c084fc' },
  Planeswalker: { color: '#fbbf24' },
  Land:         { color: '#ca8a04' },
};

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function PieChart({ distribution, meta }) {
  const entries = Object.entries(distribution).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return <div className="text-white/40 text-center text-sm py-4">No data</div>;

  let startAngle = 0;
  const segments = entries.map(([key, value]) => {
    const angle = (value / total) * 360;
    const endAngle = startAngle + angle;
    let path;
    if (angle >= 359.99) {
      path = `M 50 10 A 40 40 0 1 1 49.999 10 Z`;
    } else {
      const s = polarToXY(50, 50, 40, startAngle);
      const e = polarToXY(50, 50, 40, endAngle);
      path = `M 50 50 L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A 40 40 0 ${angle > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`;
    }
    startAngle = endAngle;
    return { key, value, path, color: meta[key]?.color || '#888', label: meta[key]?.label || key };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
        {segments.map(s => (
          <path key={s.key} d={s.path} fill={s.color} stroke="rgba(0,0,0,0.4)" strokeWidth="0.8" />
        ))}
      </svg>
      <div className="space-y-1 flex-1 min-w-0">
        {segments.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-sm">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-white/80 truncate">{s.label}</span>
            <span className="text-white/50 ml-auto flex-shrink-0">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Salty cards ───────────────────────────────────────────────────────────────
const SALTY_CARDS = {
  'Cyclonic Rift': 3, 'Armageddon': 3, 'Winter Orb': 3, 'Static Orb': 3,
  'Stasis': 3, 'Blood Moon': 3, 'Back to Basics': 3, 'Vorinclex, Voice of Hunger': 3,
  'Iona, Shield of Emeria': 3, 'Jin-Gitaxias, Core Augur': 3, 'Expropriate': 3,
  "Thassa's Oracle": 3, 'Demonic Consultation': 3, 'Tergrid, God of Fright': 3,
  'Grand Arbiter Augustin IV': 3, 'Narset, Parter of Veils': 3, 'Hullbreacher': 3,
  'Opposition Agent': 3, 'Drannith Magistrate': 3, 'Rule of Law': 3,
  'Smothering Tithe': 2, 'Rhystic Study': 2, 'Dockside Extortionist': 2,
  'Fierce Guardianship': 2, 'Deflecting Swat': 2, 'Force of Will': 2,
  'Mana Drain': 2, 'Counterspell': 2, 'Pact of Negation': 2,
  'Craterhoof Behemoth': 2, 'Tooth and Nail': 2, 'Triumph of the Hordes': 2,
  'Vorinclex, Monstrous Raider': 2, 'Omniscience': 2, 'Enter the Infinite': 2,
  'Time Stretch': 2, 'Time Warp': 2, 'Extra Turn': 2, 'Seedborn Muse': 2,
  'Consecrated Sphinx': 2, 'Necropotence': 2, 'Ad Nauseam': 2,
  'Sol Ring': 1, 'Mana Crypt': 1, 'Mana Vault': 1, 'Chrome Mox': 1,
  'Mox Diamond': 1, 'Jeweled Lotus': 1, 'Ancient Tomb': 1, "Gaea's Cradle": 1,
  'Strip Mine': 1, 'Wasteland': 1, 'Beast Within': 1,
  'Path to Exile': 1, 'Swords to Plowshares': 1, 'Esper Sentinel': 1,
  'Mystic Remora': 1, 'Demonic Tutor': 1, 'Vampiric Tutor': 1, 'Worldly Tutor': 1,
  'Enlightened Tutor': 1, 'Imperial Seal': 1, 'Gamble': 1,
};

const POWER_INDICATORS = {
  fastMana: ['Sol Ring', 'Mana Crypt', 'Mana Vault', 'Chrome Mox', 'Mox Diamond',
             'Jeweled Lotus', 'Ancient Tomb', "Gaea's Cradle", 'Lotus Petal',
             'Dark Ritual', 'Cabal Ritual', 'Simian Spirit Guide'],
  tutors: ['Demonic Tutor', 'Vampiric Tutor', 'Worldly Tutor', 'Enlightened Tutor',
           'Mystical Tutor', 'Imperial Seal', 'Gamble', 'Diabolic Intent',
           'Finale of Devastation', "Green Sun's Zenith", 'Chord of Calling',
           'Survival of the Fittest', 'Natural Order', 'Birthing Pod'],
  comboPieces: ["Thassa's Oracle", 'Demonic Consultation', 'Tainted Pact',
                'Laboratory Maniac', 'Jace, Wielder of Mysteries', 'Doomsday',
                'Isochron Scepter', 'Dramatic Reversal', 'Paradox Engine',
                'Basalt Monolith', 'Rings of Brighthearth', 'Power Artifact',
                'Walking Ballista', 'Heliod, Sun-Crowned', 'Spike Feeder',
                'Kiki-Jiki, Mirror Breaker', 'Splinter Twin', 'Zealous Conscripts'],
  efficientRemoval: ['Swords to Plowshares', 'Path to Exile', 'Abrupt Decay',
                     "Assassin's Trophy", 'Force of Will', 'Pact of Negation',
                     'Fierce Guardianship', 'Deflecting Swat', 'Mana Drain'],
  powerhouses: ['Rhystic Study', 'Smothering Tithe', 'Dockside Extortionist',
                'Consecrated Sphinx', 'Necropotence', 'Ad Nauseam', 'Sylvan Library',
                'Mystic Remora', 'Esper Sentinel', 'Seedborn Muse', 'Prophet of Kruphix'],
};

// ── Component ─────────────────────────────────────────────────────────────────
function DeckDetail({ deck, ownership, validation, loading, onBack, onRefresh, onEdit }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newDeckName, setNewDeckName] = useState(deck.name);
  const [deckStats, setDeckStats] = useState(null);
  const [valueHistory, setValueHistory] = useState([]);
  const [changelog, setChangelog] = useState([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [selectedCmc, setSelectedCmc] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (!deck._id) return;
    const token = localStorage.getItem('authToken');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${API_URL}/decks/${deck._id}/stats`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDeckStats(data); })
      .catch(() => {});

    fetch(`${API_URL}/decks/${deck._id}/value-history`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setValueHistory(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch(`${API_URL}/decks/${deck._id}/changelog`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => setChangelog(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [deck._id]);

  // ── Salt Score ────────────────────────────────────────────────────────────
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
    if (deck.commander && SALTY_CARDS[deck.commander.name]) {
      totalSalt += SALTY_CARDS[deck.commander.name];
      saltyCardsInDeck.push({ name: deck.commander.name, salt: SALTY_CARDS[deck.commander.name] });
    }
    return { score: totalSalt, cards: saltyCardsInDeck.sort((a, b) => b.salt - a.salt) };
  }, [deck]);

  // ── Power Level ───────────────────────────────────────────────────────────
  const powerLevel = useMemo(() => {
    if (!deck.mainDeck) return { level: 1, breakdown: {} };
    const allCards = deck.mainDeck.map(c => c.name);
    if (deck.commander) allCards.push(deck.commander.name);
    let score = 0;
    const breakdown = {
      fastMana: 0, tutors: 0, comboPieces: 0, efficientRemoval: 0, powerhouses: 0,
      avgCmc: deck.statistics?.avgManaCost || 3.5,
      deckValue: ownership?.summary?.totalValue || 0,
    };
    allCards.forEach(cardName => {
      if (POWER_INDICATORS.fastMana.includes(cardName)) breakdown.fastMana++;
      if (POWER_INDICATORS.tutors.includes(cardName)) breakdown.tutors++;
      if (POWER_INDICATORS.comboPieces.includes(cardName)) breakdown.comboPieces++;
      if (POWER_INDICATORS.efficientRemoval.includes(cardName)) breakdown.efficientRemoval++;
      if (POWER_INDICATORS.powerhouses.includes(cardName)) breakdown.powerhouses++;
    });
    score += Math.min(breakdown.fastMana * 0.5, 2);
    score += Math.min(breakdown.tutors * 0.4, 2);
    score += Math.min(breakdown.comboPieces * 0.6, 2);
    score += Math.min(breakdown.efficientRemoval * 0.3, 1);
    score += Math.min(breakdown.powerhouses * 0.3, 1.5);
    if (breakdown.avgCmc < 2.5) score += 1;
    else if (breakdown.avgCmc < 3) score += 0.5;
    if (breakdown.deckValue > 1000) score += 0.5;
    if (breakdown.deckValue > 2500) score += 0.5;
    return { level: Math.min(10, Math.max(1, Math.round(3 + score))), breakdown };
  }, [deck, ownership]);

  // ── Interactive Mana Curve: cards at selected CMC ─────────────────────────
  const cardsAtSelectedCmc = useMemo(() => {
    if (selectedCmc === null || !deck.mainDeck) return [];
    return deck.mainDeck.filter(card => getCardCmcBucket(card) === selectedCmc);
  }, [selectedCmc, deck.mainDeck]);

  // ── Categorized deck list ─────────────────────────────────────────────────
  const categorizedDeck = useMemo(() => {
    if (!deck.mainDeck) return {};
    const cats = {};
    deck.mainDeck.forEach(card => {
      let category = 'Other';
      for (const cat of CATEGORY_ORDER) {
        if (cat === 'Other') break;
        if ((card.types || []).includes(cat)) { category = cat; break; }
      }
      if (!cats[category]) cats[category] = [];
      cats[category].push(card);
    });
    return cats;
  }, [deck.mainDeck]);

  const toggleCategory = (cat) =>
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddToCollection = async (card) => {
    try {
      await axios.post(`${API_URL}/cards`, {
        name: card.name, set: 'Unknown', quantity: 1, condition: 'NM',
        price: card.price, colors: card.colors, types: card.types,
        manaCost: card.manaCost, scryfallId: card.scryfallId, imageUrl: card.imageUrl,
      });
      alert(`Added ${card.name} to collection!`);
      onRefresh();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleSaveRename = async () => {
    if (!newDeckName.trim()) { alert('Deck name cannot be empty'); return; }
    try {
      await axios.put(`${API_URL}/decks/${deck._id}`, { ...deck, name: newDeckName });
      setIsEditingName(false);
      onRefresh();
    } catch (error) {
      alert('Error renaming deck: ' + error.message);
    }
  };

  const handleCancelRename = () => { setNewDeckName(deck.name); setIsEditingName(false); };

  // ── Export helpers ────────────────────────────────────────────────────────
  const buildExportText = (format) => {
    const lines = [];
    if (format === 'mtgo' || format === 'arena') {
      if (deck.commander) lines.push(`1 ${deck.commander.name}`);
      if (deck.partnerCommander) lines.push(`1 ${deck.partnerCommander.name}`);
      lines.push('');
      (deck.mainDeck || []).forEach(card => {
        lines.push(`${card.quantity || 1} ${card.name}`);
      });
    } else if (format === 'text') {
      lines.push(`// ${deck.name}`);
      if (deck.commander) lines.push(`// Commander: ${deck.commander.name}`);
      lines.push('');
      (deck.mainDeck || []).forEach(card => {
        lines.push(`${card.quantity || 1} ${card.name}`);
      });
    } else if (format === 'proxy') {
      (deck.mainDeck || []).forEach(card => {
        for (let i = 0; i < (card.quantity || 1); i++) {
          lines.push(card.name);
        }
      });
    }
    return lines.join('\n');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
  };

  // Mongoose Maps serialize as plain objects over JSON, but guard anyway
  const toPlainObj = (val) =>
    val instanceof Map ? Object.fromEntries(val) : (val || {});

  const colorDist = toPlainObj(deck.statistics?.colorDistribution);
  const typeDist  = toPlainObj(deck.statistics?.typeDistribution);
  const typeDistTotal = Object.values(typeDist).reduce((s, v) => s + v, 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
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
            <button onClick={handleSaveRename} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">Save</button>
            <button onClick={handleCancelRename} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{deck.name}</h2>
            <button onClick={() => setIsEditingName(true)} className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition">Rename</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {onEdit && (
            <button onClick={onEdit} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm font-semibold">
              Edit Deck
            </button>
          )}
          <button
            onClick={() => setShowExport(e => !e)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition text-sm"
          >
            Export
          </button>
          <button onClick={onBack} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition text-sm">
            ← Back
          </button>
        </div>
      </div>

      {/* Export panel */}
      {showExport && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
          <h3 className="text-base font-bold text-white mb-3">Export Deck</h3>
          <div className="flex flex-wrap gap-2">
            {[
              { format: 'mtgo',  label: 'MTGO / Text' },
              { format: 'arena', label: 'MTG Arena' },
              { format: 'proxy', label: 'Proxy List (1 per line)' },
            ].map(({ format, label }) => (
              <button
                key={format}
                onClick={() => copyToClipboard(buildExportText(format))}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-sm transition"
              >
                Copy {label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <textarea
              readOnly
              value={buildExportText('mtgo')}
              className="w-full h-40 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white/80 text-xs font-mono resize-none focus:outline-none"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-white/60">Loading deck details...</div>
      ) : (
        <>
          {/* Commander Display */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <h3 className="text-lg font-bold text-white mb-3">Commander</h3>
            <div className="flex gap-4">
              {deck.commander?.imageUrl && (
                <img src={deck.commander.imageUrl} alt={deck.commander.name} className="w-48 rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="text-xl font-bold text-white">{deck.commander?.name}</div>
                <div className="text-white/60 mb-2">{deck.commander?.manaCost}</div>
                {deck.commander?.typeLine && <div className="text-white/80 mb-3 italic">{deck.commander.typeLine}</div>}
                {deck.commander?.oracleText && (
                  <div className="text-white/90 mb-3 whitespace-pre-line bg-white/5 p-3 rounded">{deck.commander.oracleText}</div>
                )}
                {deck.commander?.power && deck.commander?.toughness && (
                  <div className="text-white/80 font-bold mb-2">{deck.commander.power}/{deck.commander.toughness}</div>
                )}
                {deck.commander?.flavorText && (
                  <div className="text-white/60 italic text-sm mt-2 border-t border-white/20 pt-2">{deck.commander.flavorText}</div>
                )}
              </div>
            </div>

            {deck.partnerCommander && (
              <div className="flex gap-4 mt-6 pt-6 border-t border-white/20">
                {deck.partnerCommander?.imageUrl && (
                  <img src={deck.partnerCommander.imageUrl} alt={deck.partnerCommander.name} className="w-48 rounded-lg flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="text-xl font-bold text-white">{deck.partnerCommander.name}</div>
                  <div className="text-white/60 mb-2">{deck.partnerCommander.manaCost}</div>
                  {deck.partnerCommander?.typeLine && <div className="text-white/80 mb-3 italic">{deck.partnerCommander.typeLine}</div>}
                  {deck.partnerCommander?.oracleText && (
                    <div className="text-white/90 mb-3 whitespace-pre-line bg-white/5 p-3 rounded">{deck.partnerCommander.oracleText}</div>
                  )}
                  {deck.partnerCommander?.power && deck.partnerCommander?.toughness && (
                    <div className="text-white/80 font-bold mb-2">{deck.partnerCommander.power}/{deck.partnerCommander.toughness}</div>
                  )}
                  {deck.partnerCommander?.flavorText && (
                    <div className="text-white/60 italic text-sm mt-2 border-t border-white/20 pt-2">{deck.partnerCommander.flavorText}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Validation */}
          {validation && (validation.errors?.length > 0 || validation.warnings?.length > 0) && (
            <div className="bg-red-600/20 border border-red-600/50 rounded-lg p-4 mb-6">
              {validation.errors?.map((error, idx) => <div key={idx} className="text-red-200">❌ {error}</div>)}
              {validation.warnings?.map((warning, idx) => <div key={idx} className="text-yellow-200">⚠️ {warning}</div>)}
            </div>
          )}

          {/* Row: Interactive Mana Curve + Ownership */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Interactive Mana Curve */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
              <h3 className="text-lg font-bold text-white mb-4">
                Mana Curve
                {selectedCmc !== null && (
                  <span className="ml-2 text-sm font-normal text-yellow-400">
                    — CMC {selectedCmc} ({cardsAtSelectedCmc.length} card{cardsAtSelectedCmc.length !== 1 ? 's' : ''})
                  </span>
                )}
              </h3>
              <ManaCurveChart
                manaCurve={deck.statistics?.manaCurve}
                selectedCmc={selectedCmc}
                onCmcClick={(cmc) => setSelectedCmc(cmc)}
              />
              <div className="mt-4 text-white/60 text-sm text-center">
                Avg CMC: {deck.statistics?.avgManaCost?.toFixed(2) || '0.00'}
                {selectedCmc === null && (
                  <span className="ml-2 text-white/30 text-xs">(click a bar to see cards)</span>
                )}
              </div>

              {/* CMC card list */}
              {selectedCmc !== null && cardsAtSelectedCmc.length > 0 && (
                <div className="mt-3 border-t border-white/20 pt-3 space-y-1 max-h-44 overflow-y-auto">
                  {cardsAtSelectedCmc.map((card, idx) => {
                    const owned = ownership?.ownedCards?.find(c => c.scryfallId === card.scryfallId);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {owned
                          ? <span className="text-green-400 text-xs flex-shrink-0">✓</span>
                          : <span className="text-red-400 text-xs flex-shrink-0">✗</span>}
                        <span className="text-white truncate">{card.name}</span>
                        <span className="text-white/40 text-xs ml-auto flex-shrink-0">{card.manaCost}</span>
                      </div>
                    );
                  })}
                </div>
              )}
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
                    <div className="flex justify-between font-bold">
                      <span className="text-white">Owned Value:</span>
                      <span className="text-purple-400">${ownership.summary.ownedValue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row: Color Distribution + Type Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Color Pie Chart */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
              <h3 className="text-lg font-bold text-white mb-4">Color Distribution</h3>
              <PieChart distribution={colorDist} meta={COLOR_META} />
            </div>

            {/* Card Type Distribution */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
              <h3 className="text-lg font-bold text-white mb-4">Card Type Breakdown</h3>
              <div className="space-y-2.5">
                {Object.entries(typeDist)
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const pct = typeDistTotal > 0 ? Math.round((count / typeDistTotal) * 100) : 0;
                    const color = TYPE_META[type]?.color || '#888';
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white/80">{type}</span>
                          <span className="text-white/60">
                            {count} <span className="text-white/40">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Row: Power Level + Salt Score */}
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
                <div className="flex justify-between"><span className="text-white/60">Fast Mana:</span><span className="text-white">{powerLevel.breakdown.fastMana} cards</span></div>
                <div className="flex justify-between"><span className="text-white/60">Tutors:</span><span className="text-white">{powerLevel.breakdown.tutors} cards</span></div>
                <div className="flex justify-between"><span className="text-white/60">Combo Pieces:</span><span className="text-white">{powerLevel.breakdown.comboPieces} cards</span></div>
                <div className="flex justify-between"><span className="text-white/60">Efficient Removal:</span><span className="text-white">{powerLevel.breakdown.efficientRemoval} cards</span></div>
                <div className="flex justify-between"><span className="text-white/60">Powerhouses:</span><span className="text-white">{powerLevel.breakdown.powerhouses} cards</span></div>
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
                      }`}>+{card.salt}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/40 text-center text-sm">No salty cards detected! Your playgroup will thank you.</div>
              )}
            </div>
          </div>

          {/* Game Performance */}
          {deckStats !== null && (
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Game Performance</h3>
              {deckStats.gamesPlayed > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-400">{deckStats.gamesPlayed}</div>
                      <div className="text-white/60 text-sm">Games Played</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${deckStats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {deckStats.winRate}%
                      </div>
                      <div className="text-white/60 text-sm">Win Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-400">{deckStats.avgPlacement}</div>
                      <div className="text-white/60 text-sm">Avg. Placement</div>
                    </div>
                  </div>
                  {(deckStats.bestMatchups?.length > 0 || deckStats.worstMatchups?.length > 0) && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <div className="text-white/70 text-sm font-semibold mb-2">Best Matchups</div>
                        <div className="space-y-1">
                          {deckStats.bestMatchups.map((m, i) => (
                            <div key={i} className="flex justify-between items-center text-sm bg-green-500/10 rounded px-2 py-1">
                              <span className="text-white truncate mr-2">{m.commanderName || 'Unknown'}</span>
                              <span className="text-green-400 font-semibold flex-shrink-0">{m.winRate}% ({m.wins}-{m.losses})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-white/70 text-sm font-semibold mb-2">Worst Matchups</div>
                        <div className="space-y-1">
                          {deckStats.worstMatchups.map((m, i) => (
                            <div key={i} className="flex justify-between items-center text-sm bg-red-500/10 rounded px-2 py-1">
                              <span className="text-white truncate mr-2">{m.commanderName || 'Unknown'}</span>
                              <span className="text-red-400 font-semibold flex-shrink-0">{m.winRate}% ({m.wins}-{m.losses})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-white/40 text-center text-sm py-4">
                  Play some games with this deck selected to see stats here.
                </div>
              )}
            </div>
          )}

          {/* Value History Sparkline */}
          {valueHistory.length >= 2 && (() => {
            const vals = valueHistory.map(d => d.value);
            const minV = Math.min(...vals);
            const maxV = Math.max(...vals);
            const range = maxV - minV || 1;
            const W = 200, H = 50;
            const points = valueHistory.map((d, i) => ({
              x: (i / (valueHistory.length - 1)) * W,
              y: H - ((d.value - minV) / range) * (H - 8) - 4,
            }));
            const trend = vals[vals.length - 1] - vals[0];
            return (
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">Value History</h3>
                  <span className={`text-sm font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend >= 0 ? '+' : ''}${trend.toFixed(2)}
                  </span>
                </div>
                <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                  <polyline
                    points={points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                    fill="none"
                    stroke={trend >= 0 ? '#4ade80' : '#f87171'}
                    strokeWidth="2"
                  />
                </svg>
                <div className="flex justify-between text-white/40 text-xs mt-1">
                  <span>${minV.toFixed(2)}</span>
                  <span>${maxV.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}

          {/* Deck Evolution */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white">Deck Evolution</h3>
              <button
                onClick={() => setShowChangelog(prev => !prev)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded text-sm transition"
              >
                {showChangelog ? 'Hide History' : 'Show History'}
              </button>
            </div>
            {showChangelog && (
              changelog.length === 0 ? (
                <div className="text-white/40 text-sm text-center py-2">No changes recorded yet. Edit this deck to start tracking.</div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {changelog.map((entry, i) => (
                    <div key={i}>
                      <div className="text-white/50 text-xs mb-1">{new Date(entry.createdAt).toLocaleDateString()}</div>
                      <div className="space-y-0.5">
                        {entry.changes.map((change, j) => (
                          <div key={j} className={`flex items-center gap-2 text-sm ${change.type === 'add' ? 'text-green-400' : 'text-red-400'}`}>
                            <span className="font-bold">{change.type === 'add' ? '+' : '−'}</span>
                            <span>{change.quantity > 1 ? `${change.quantity}x ` : ''}{change.cardName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Missing Cards */}
          {ownership?.missingCards?.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Missing Cards ({ownership.missingCards.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {ownership.missingCards.map((card, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-red-600/10 border border-red-600/30 rounded-lg">
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

          {/* Deck Analysis */}
          <DeckAnalysis deck={deck} />

          {/* Hand Simulator */}
          <DeckHandSimulator deck={deck} />

          {/* Categorized Deck List */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
            <h3 className="text-lg font-bold text-white mb-4">
              Deck List ({deck.mainDeck?.length || 0} cards)
            </h3>
            <div className="space-y-2">
              {CATEGORY_ORDER.filter(cat => categorizedDeck[cat]?.length > 0).map(cat => {
                const cards = categorizedDeck[cat];
                const style = CATEGORY_STYLES[cat];
                const isCollapsed = collapsedCategories[cat];
                return (
                  <div key={cat} className={`rounded-lg border ${style.border} overflow-hidden`}>
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(cat)}
                      className={`w-full flex items-center justify-between px-3 py-2 ${style.bg} hover:brightness-110 transition`}
                    >
                      <span className={`font-semibold text-sm ${style.text}`}>
                        {cat === 'Other' ? 'Other' : `${cat}s`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 text-sm">{cards.length}</span>
                        <span className="text-white/40 text-xs">{isCollapsed ? '▶' : '▼'}</span>
                      </div>
                    </button>

                    {/* Card rows */}
                    {!isCollapsed && (
                      <div className="divide-y divide-white/5">
                        {cards.map((card, idx) => {
                          const owned = ownership?.ownedCards?.find(c => c.scryfallId === card.scryfallId);
                          return (
                            <div
                              key={idx}
                              className={`flex justify-between items-center px-3 py-1.5 text-sm ${owned ? 'bg-green-600/5' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {owned
                                  ? <span className="text-green-400 text-xs flex-shrink-0">✓</span>
                                  : <span className="text-red-400 text-xs flex-shrink-0">✗</span>}
                                <span className="text-white truncate">{card.name}</span>
                                <span className="text-white/30 text-xs flex-shrink-0">{card.manaCost}</span>
                              </div>
                              <div className="text-white/50 text-xs flex-shrink-0 ml-2">
                                {owned ? `Own ${owned.collectionQuantity}` : 'Need'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
