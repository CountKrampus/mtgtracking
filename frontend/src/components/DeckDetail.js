import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import ManaCurveChart from './ManaCurveChart';
import DeckAnalysis from './DeckAnalysis';
import DeckHandSimulator from './DeckHandSimulator';
import { API_URL } from '../config';

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
  ramp: ['Rampant Growth', 'Cultivate', 'Kodama\'s Reach', 'Farseek', 'Nature\'s Lore',
         'Three Visits', 'Sakura-Tribe Elder', 'Llanowar Elves', 'Elvish Mystic',
         'Birds of Paradise', 'Arbor Elf', 'Wood Elves', 'Skyshroud Claim',
         'Explosive Vegetation', 'Signet', 'Talisman'], // last two match by substring below, not exact name
  draw: ['Sylvan Library', 'Phyrexian Arena', 'Mystic Remora', 'Rhystic Study',
         'Fact or Fiction', 'Blue Sun\'s Zenith', 'Harmonize', 'Night\'s Whisper',
         'Sign in Blood', 'Read the Bones', 'Divination', 'Concentrate',
         'Windfall', 'Faithless Looting', 'Guardian Project'],
};

// ── Manabase / Deck Health score helpers (ported from backend/utils/deckAnalysis.js;
// kept in sync per the existing SALTY_CARDS/POWER_INDICATORS duplication convention) ──
const BASIC_LAND_COLORS = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };

// Nonbasic lands and mana rocks that produce specific colors. Not exhaustive
// (same spirit as SALTY_CARDS/POWER_INDICATORS above) - covers the most common
// Commander staples. Cards that produce colorless-only mana (Sol Ring, Mana
// Crypt, Mana Vault, etc.) are deliberately absent - they live in
// POWER_INDICATORS.fastMana instead, a different classification for a
// different purpose, and must never be treated as a color source here.
const COLOR_SOURCES = {
  // True duals / original duals
  'Tundra': ['W', 'U'], 'Underground Sea': ['U', 'B'], 'Badlands': ['B', 'R'],
  'Taiga': ['R', 'G'], 'Savannah': ['G', 'W'], 'Scrubland': ['W', 'B'],
  'Volcanic Island': ['U', 'R'], 'Bayou': ['B', 'G'], 'Plateau': ['R', 'W'],
  'Tropical Island': ['G', 'U'],
  // Shocklands
  'Hallowed Fountain': ['W', 'U'], 'Watery Grave': ['U', 'B'], 'Blood Crypt': ['B', 'R'],
  'Stomping Ground': ['R', 'G'], 'Temple Garden': ['G', 'W'], 'Godless Shrine': ['W', 'B'],
  'Steam Vents': ['U', 'R'], 'Overgrown Tomb': ['B', 'G'], 'Sacred Foundry': ['R', 'W'],
  'Breeding Pool': ['G', 'U'],
  // Fetchlands (count toward both colors they can fetch, since which basic/dual
  // they actually grab varies by deck - a simplification, not a precise model)
  'Flooded Strand': ['W', 'U'], 'Polluted Delta': ['U', 'B'], 'Bloodstained Mire': ['B', 'R'],
  'Wooded Foothills': ['R', 'G'], 'Windswept Heath': ['G', 'W'], 'Marsh Flats': ['W', 'B'],
  'Scalding Tarn': ['U', 'R'], 'Verdant Catacombs': ['B', 'G'], 'Arid Mesa': ['R', 'W'],
  'Misty Rainforest': ['G', 'U'],
  // Universal fixers
  'Command Tower': ['W', 'U', 'B', 'R', 'G'], 'Exotic Orchard': ['W', 'U', 'B', 'R', 'G'],
  'Path of Ancestry': ['W', 'U', 'B', 'R', 'G'], 'Arcane Signet': ['W', 'U', 'B', 'R', 'G'],
  'Fellwar Stone': ['W', 'U', 'B', 'R', 'G'], 'Chromatic Lantern': ['W', 'U', 'B', 'R', 'G'],
  // Signets (two-color rocks)
  'Azorius Signet': ['W', 'U'], 'Dimir Signet': ['U', 'B'], 'Rakdos Signet': ['B', 'R'],
  'Gruul Signet': ['R', 'G'], 'Selesnya Signet': ['G', 'W'], 'Orzhov Signet': ['W', 'B'],
  'Izzet Signet': ['U', 'R'], 'Golgari Signet': ['B', 'G'], 'Boros Signet': ['R', 'W'],
  'Simic Signet': ['G', 'U'],
};

// COLOR_SOURCES mixes actual lands (duals/shocks/fetches/Command Tower/Exotic
// Orchard/Path of Ancestry) with mana rocks that happen to fix color
// (Signets/Arcane Signet/Fellwar Stone/Chromatic Lantern) - both belong in
// that table since it's about "what colors does this produce," but only the
// former group counts toward land count. Listed separately here rather than
// tagging COLOR_SOURCES entries, since land-vs-rock and color-production are
// two independent questions about the same card.
const NONBASIC_LAND_NAMES = new Set([
  'Tundra', 'Underground Sea', 'Badlands', 'Taiga', 'Savannah', 'Scrubland',
  'Volcanic Island', 'Bayou', 'Plateau', 'Tropical Island',
  'Hallowed Fountain', 'Watery Grave', 'Blood Crypt', 'Stomping Ground', 'Temple Garden',
  'Godless Shrine', 'Steam Vents', 'Overgrown Tomb', 'Sacred Foundry', 'Breeding Pool',
  'Flooded Strand', 'Polluted Delta', 'Bloodstained Mire', 'Wooded Foothills', 'Windswept Heath',
  'Marsh Flats', 'Scalding Tarn', 'Verdant Catacombs', 'Arid Mesa', 'Misty Rainforest',
  'Command Tower', 'Exotic Orchard', 'Path of Ancestry',
]);

function isLandCard(card) {
  return (card.types || []).includes('Land')
    || Object.prototype.hasOwnProperty.call(BASIC_LAND_COLORS, card.name)
    || NONBASIC_LAND_NAMES.has(card.name);
}

// Frank Karsten's published mana-source-count research (ChannelFireball,
// widely used as the community-standard reference), scaled from his 60-card
// baseline (14/18/21+ sources for single/double/triple-pip) to Commander's
// 99-card singleton format by the commonly-cited ~1.6x factor.
const KARSTEN_TARGETS = { 1: 22, 2: 29, 3: 34 };

function calculateManabaseScore(deck) {
  if (!deck.mainDeck) return { grade: 'N/A', bySourceColor: {}, landCount: 0, recommendedLandRange: [36, 38] };

  const allCards = [...deck.mainDeck];
  if (deck.commander) allCards.push(deck.commander);
  if (deck.partnerCommander?.name) allCards.push(deck.partnerCommander);

  let landCount = 0;
  const sourcesByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const pipCountByColor = { W: 0, U: 0, B: 0, R: 0, G: 0 }; // both "is this color played" and "avg pips/card"

  allCards.forEach(card => {
    const quantity = card.quantity || 1;

    if (isLandCard(card)) landCount += quantity;

    const basicColor = BASIC_LAND_COLORS[card.name];
    if (basicColor) sourcesByColor[basicColor] += quantity;

    const fixingColors = COLOR_SOURCES[card.name];
    if (fixingColors) fixingColors.forEach(c => { sourcesByColor[c] += quantity; });

    if (!isLandCard(card) && card.manaCost) {
      const pipMatches = card.manaCost.match(/\{([WUBRG])\}/g) || [];
      pipMatches.forEach(symbol => {
        const color = symbol.replace(/[{}]/g, '');
        pipCountByColor[color] += quantity;
      });
    }
  });

  const bySourceColor = {};
  let worstGradeValue = null;

  // Grade is driven by the single worst-performing color with any pip
  // demand, not an average - a deck's manabase is only as good as its
  // weakest requirement, per the spec. Known tradeoff: a deliberately light
  // splash (1-2 low-pip cards in a color with few dedicated sources) can
  // still drag the whole grade down, even though light splashes are an
  // accepted, low-risk pattern in real deckbuilding. Not fixed here since the
  // spec calls for worst-color grading explicitly; revisit only if this
  // proves misleading in practice against real decks.
  Object.keys(pipCountByColor).forEach(color => {
    if (pipCountByColor[color] === 0) return; // color not actually played - no requirement

    const nonLandCardsOfColor = allCards.filter(c => !isLandCard(c) && (c.manaCost || '').includes(`{${color}}`));
    const cardCountOfColor = nonLandCardsOfColor.reduce((sum, c) => sum + (c.quantity || 1), 0) || 1;
    const avgPipsPerCard = pipCountByColor[color] / cardCountOfColor;

    let target;
    if (avgPipsPerCard >= 3) target = KARSTEN_TARGETS[3];
    else if (avgPipsPerCard >= 2) target = KARSTEN_TARGETS[2];
    else target = KARSTEN_TARGETS[1];

    const sources = sourcesByColor[color];
    bySourceColor[color] = { sources, target };

    const ratio = sources / target;
    worstGradeValue = worstGradeValue === null ? ratio : Math.min(worstGradeValue, ratio);
  });

  let grade;
  if (worstGradeValue === null) grade = 'N/A';
  else if (worstGradeValue >= 1.1) grade = 'A';
  else if (worstGradeValue >= 0.95) grade = 'A-';
  else if (worstGradeValue >= 0.85) grade = 'B+';
  else if (worstGradeValue >= 0.75) grade = 'B';
  else if (worstGradeValue >= 0.65) grade = 'C';
  else if (worstGradeValue >= 0.5) grade = 'D';
  else grade = 'F';

  return { grade, bySourceColor, landCount, recommendedLandRange: [36, 38] };
}

// Reuses isLandCard (not a fresh `(card.types||[]).includes('Land')` check) so
// this function's land count agrees with calculateManabaseScore's - offline-
// imported cards can be missing `types` metadata until "Update Full Card Data"
// is run, and only isLandCard's name-based fallback (BASIC_LAND_COLORS/
// NONBASIC_LAND_NAMES) catches those correctly.
function calculateDeckHealthScore(deck) {
  if (!deck.mainDeck) return { score: 0, breakdown: { curveSmoothness: 0, ramp: 0, draw: 0, removal: 0, landRatio: 0 } };

  const allCards = deck.mainDeck;
  let totalCards = 0, landCards = 0;
  const curveBuckets = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
  let ramp = 0, draw = 0, removal = 0;

  allCards.forEach(card => {
    const quantity = card.quantity || 1;
    totalCards += quantity;
    if (isLandCard(card)) { landCards += quantity; return; }

    const cmc = parseCmcFromManaCost(card.manaCost);
    const bucket = cmc >= 7 ? '7+' : cmc.toString();
    curveBuckets[bucket] += quantity;

    const isRamp = POWER_INDICATORS.ramp.some(name =>
      name === card.name || ((name === 'Signet' || name === 'Talisman') && card.name.includes(name))
    );
    if (isRamp) ramp += quantity;
    if (POWER_INDICATORS.draw.includes(card.name)) draw += quantity;
    if (POWER_INDICATORS.efficientRemoval.includes(card.name)) removal += quantity;
  });

  // Curve smoothness: penalize decks that are too top-heavy (fewer than 30% of
  // nonland cards at CMC 0-2) or too thin early (fewer than 10% at CMC 1-2).
  const nonLandTotal = totalCards - landCards;
  const cheapCards = curveBuckets[0] + curveBuckets[1] + curveBuckets[2];
  const veryCheapCards = curveBuckets[1] + curveBuckets[2];
  let curveSmoothness = 100;
  if (nonLandTotal > 0) {
    const cheapRatio = cheapCards / nonLandTotal;
    const veryCheapRatio = veryCheapCards / nonLandTotal;
    if (cheapRatio < 0.3) curveSmoothness -= (0.3 - cheapRatio) * 200;
    if (veryCheapRatio < 0.1) curveSmoothness -= (0.1 - veryCheapRatio) * 150;
    curveSmoothness = Math.max(0, Math.min(100, Math.round(curveSmoothness)));
  } else {
    curveSmoothness = 0;
  }

  // Ramp/draw/removal: Commander norms are roughly 10/10/10 out of 99 - scale
  // each count to a 0-100 sub-score capped at the norm (more isn't scored
  // higher past the norm; this is a floor-check, not a maximize-everything score).
  const rampScore = Math.min(100, Math.round((ramp / 10) * 100));
  const drawScore = Math.min(100, Math.round((draw / 10) * 100));
  const removalScore = Math.min(100, Math.round((removal / 10) * 100));

  // Land ratio: 36-38 lands out of 99 is the target range (matches
  // calculateManabaseScore's recommendedLandRange) - full marks inside it,
  // tapering off outside.
  let landRatio = 100;
  if (landCards < 36) landRatio = Math.max(0, 100 - (36 - landCards) * 10);
  else if (landCards > 38) landRatio = Math.max(0, 100 - (landCards - 38) * 10);

  const score = Math.round(
    curveSmoothness * 0.3 + rampScore * 0.2 + drawScore * 0.2 + removalScore * 0.15 + landRatio * 0.15
  );

  return { score, breakdown: { curveSmoothness, ramp: rampScore, draw: drawScore, removal: removalScore, landRatio } };
}

const GRADE_TO_PERCENT = { 'A': 100, 'A-': 92, 'B+': 85, 'B': 77, 'C': 65, 'D': 50, 'F': 30, 'N/A': 50 };

function calculateGlobalScore(powerLevel, saltScore, manabaseScore, healthScore) {
  const powerPercent = ((powerLevel?.level || 1) / 10) * 100;
  // Salt inverted and capped at 30 so a single extremely salty deck doesn't
  // zero out the whole average - most decks land well under this.
  const saltPercent = 100 - Math.min(30, saltScore?.score || 0) * (100 / 30);
  const manabasePercent = GRADE_TO_PERCENT[manabaseScore?.grade] ?? 50;
  const healthPercent = healthScore?.score || 0;

  return Math.round(
    powerPercent * 0.25 + saltPercent * 0.15 + manabasePercent * 0.3 + healthPercent * 0.3
  );
}

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
  const [shareCode, setShareCode] = useState(deck.shareCode || null);
  const [isPublic, setIsPublic] = useState(deck.isPublic || false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState('');
  const [addAllProgress, setAddAllProgress] = useState(null);

  useEffect(() => {
    setShareCode(deck.shareCode || null);
    setIsPublic(deck.isPublic || false);
  }, [deck._id]);

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

  // ── Manabase Score ────────────────────────────────────────────────────────
  const manabaseScore = useMemo(() => calculateManabaseScore(deck), [deck]);

  // ── Deck Health Score ─────────────────────────────────────────────────────
  const healthScore = useMemo(() => calculateDeckHealthScore(deck), [deck]);

  // ── Global Score ──────────────────────────────────────────────────────────
  const globalScore = useMemo(
    () => calculateGlobalScore(powerLevel, saltScore, manabaseScore, healthScore),
    [powerLevel, saltScore, manabaseScore, healthScore]
  );

  // ── Smart Deck Score panel: which sub-score's detail view is showing ──────
  const [activeScoreDetail, setActiveScoreDetail] = useState(null); // null | 'power' | 'salt' | 'mana' | 'health'

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

  const handleAddAllMissingToCollection = async () => {
    if (!ownership?.missingCards?.length) return;
    const cards = ownership.missingCards;
    let added = 0;
    setAddAllProgress({ current: 0, total: cards.length, cardName: cards[0].name });
    for (const card of cards) {
      setAddAllProgress(prev => ({ ...prev, cardName: card.name }));
      try {
        await axios.post(`${API_URL}/cards`, {
          name: card.name, set: 'Unknown', quantity: 1, condition: 'NM',
          price: card.price, colors: card.colors, types: card.types,
          manaCost: card.manaCost, scryfallId: card.scryfallId, imageUrl: card.imageUrl,
        });
        added++;
      } catch (err) {
        console.error('Error adding card:', err);
      }
      setAddAllProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }
    setAddAllProgress(null);
    alert(`Added ${added} cards to collection`);
    onRefresh();
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

  // ── Share handlers ────────────────────────────────────────────────────────
  const handleShare = async () => {
    setShareLoading(true);
    setShareError('');
    try {
      const token = localStorage.getItem('mtg_access_token');
      const res = await fetch(`${API_URL}/decks/${deck._id}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setShareCode(data.shareCode);
      } else {
        setShareError(data.message || 'Failed to generate share link');
      }
    } catch (e) {
      setShareError('Network error — could not share deck');
    }
    setShareLoading(false);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/shared/deck/${shareCode}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      });
    } else {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleTogglePublic = async () => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const res = await fetch(`${API_URL}/decks/${deck._id}/visibility`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !isPublic })
      });
      const data = await res.json();
      if (res.ok) setIsPublic(data.isPublic);
      else console.error('Visibility toggle failed:', data.message);
    } catch (e) {
      console.error('Visibility toggle error:', e);
    }
    setShareLoading(false);
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
          {/* Share controls */}
          {!shareCode ? (
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 disabled:opacity-50 text-white rounded-lg text-sm transition"
            >
              {shareLoading ? '...' : '🔗 Share'}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyLink}
                className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 rounded-lg text-sm transition"
              >
                {shareCopied ? '✅ Copied!' : '🔗 Copy Link'}
              </button>
              <button
                onClick={handleTogglePublic}
                disabled={shareLoading}
                className={`px-3 py-1 rounded-lg text-sm border transition disabled:opacity-50 ${
                  isPublic
                    ? 'bg-purple-600/40 border-purple-400/60 text-purple-200'
                    : 'bg-white/10 border-white/20 text-gray-300 hover:border-purple-400/40'
                }`}
                title={isPublic ? 'Listed in Community — click to unlist' : 'Click to list in Community Decks'}
              >
                {isPublic ? '🌐 Public' : '🌐 List Publicly'}
              </button>
            </div>
          )}
          {shareError && <p className="text-red-400 text-xs mt-1">{shareError}</p>}
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

          {/* Smart Deck Score panel */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <div className="text-center mb-4">
              <div className="text-white/60 text-xs uppercase tracking-wide mb-1">Smart Deck Score</div>
              <div className="flex items-center justify-center">
                <span className={`text-5xl font-bold ${
                  globalScore >= 80 ? 'text-green-400' :
                  globalScore >= 60 ? 'text-yellow-400' :
                  globalScore >= 40 ? 'text-orange-400' : 'text-red-400'
                }`}>{globalScore}</span>
                <span className="text-white/40 text-xl ml-1">/100</span>
              </div>
            </div>

            {activeScoreDetail === null ? (
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => setActiveScoreDetail('power')} className="bg-white/5 hover:bg-white/10 rounded p-3 text-center transition">
                  <div className="text-white/50 text-xs mb-1">Power</div>
                  <div className="text-white font-bold text-lg">{powerLevel.level}</div>
                </button>
                <button onClick={() => setActiveScoreDetail('salt')} className="bg-white/5 hover:bg-white/10 rounded p-3 text-center transition">
                  <div className="text-white/50 text-xs mb-1">Salt</div>
                  <div className="text-white font-bold text-lg">{saltScore.score}</div>
                </button>
                <button onClick={() => setActiveScoreDetail('mana')} className="bg-white/5 hover:bg-white/10 rounded p-3 text-center transition">
                  <div className="text-white/50 text-xs mb-1">Mana</div>
                  <div className="text-white font-bold text-lg">{manabaseScore.grade}</div>
                </button>
                <button onClick={() => setActiveScoreDetail('health')} className="bg-white/5 hover:bg-white/10 rounded p-3 text-center transition">
                  <div className="text-white/50 text-xs mb-1">Health</div>
                  <div className="text-white font-bold text-lg">{healthScore.score}</div>
                </button>
              </div>
            ) : (
              <div className="bg-white/5 rounded p-4">
                <button onClick={() => setActiveScoreDetail(null)} className="text-white/60 hover:text-white text-sm mb-3 flex items-center gap-1">
                  ← Back
                </button>

                {activeScoreDetail === 'power' && (
                  <div>
                    <div className="flex items-center justify-center mb-3">
                      <span className={`text-4xl font-bold ${
                        powerLevel.level >= 9 ? 'text-red-500' :
                        powerLevel.level >= 7 ? 'text-orange-500' :
                        powerLevel.level >= 5 ? 'text-yellow-500' :
                        powerLevel.level >= 3 ? 'text-green-500' : 'text-blue-500'
                      }`}>{powerLevel.level}</span>
                      <span className="text-white/40 text-lg ml-1">/10</span>
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
                )}

                {activeScoreDetail === 'salt' && (
                  <div>
                    <div className="text-center mb-3">
                      <span className={`text-4xl font-bold ${
                        saltScore.score >= 20 ? 'text-red-500' :
                        saltScore.score >= 10 ? 'text-orange-500' :
                        saltScore.score >= 5 ? 'text-yellow-500' : 'text-green-500'
                      }`}>{saltScore.score}</span>
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
                )}

                {activeScoreDetail === 'mana' && (
                  <div>
                    <div className="text-center mb-3">
                      <span className="text-4xl font-bold text-white">{manabaseScore.grade}</span>
                    </div>
                    <div className="text-white/60 text-sm mb-2">
                      Lands: {manabaseScore.landCount} (recommended {manabaseScore.recommendedLandRange[0]}-{manabaseScore.recommendedLandRange[1]})
                    </div>
                    {Object.keys(manabaseScore.bySourceColor).length > 0 ? (
                      <div className="space-y-2 text-sm">
                        {Object.entries(manabaseScore.bySourceColor).map(([color, data]) => (
                          <div key={color} className="flex justify-between">
                            <span className="text-white/60">{color} sources:</span>
                            <span className="text-white">{data.sources} / {data.target} target</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-white/40 text-center text-sm">No colored mana requirements found.</div>
                    )}
                  </div>
                )}

                {activeScoreDetail === 'health' && (
                  <div>
                    <div className="text-center mb-3">
                      <span className="text-4xl font-bold text-white">{healthScore.score}</span>
                      <span className="text-white/40 text-lg ml-1">/100</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-white/60">Curve Smoothness:</span><span className="text-white">{healthScore.breakdown.curveSmoothness}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Ramp:</span><span className="text-white">{healthScore.breakdown.ramp}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Draw:</span><span className="text-white">{healthScore.breakdown.draw}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Removal:</span><span className="text-white">{healthScore.breakdown.removal}</span></div>
                      <div className="flex justify-between"><span className="text-white/60">Land Ratio:</span><span className="text-white">{healthScore.breakdown.landRatio}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
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

          {/* Deck Analysis */}
          <DeckAnalysis deck={deck} />

          {/* Hand Simulator */}
          <DeckHandSimulator deck={deck} />

          {/* Add all missing cards to collection */}
          {ownership?.missingCards && ownership.missingCards.length > 0 && (
            <button
              onClick={handleAddAllMissingToCollection}
              disabled={!!addAllProgress}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded mb-4 font-semibold"
            >
              + Add all {ownership.missingCards.length} missing cards to collection
            </button>
          )}

          {/* Add-all-missing progress modal */}
          {addAllProgress && (
            <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
              <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-8 border-2 border-green-500 max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-white mb-6 text-center">Adding Cards to Collection</h2>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-white/80 mb-2">
                    <span>Progress</span>
                    <span>{addAllProgress.current} / {addAllProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-300 flex items-center justify-center"
                      style={{ width: `${(addAllProgress.current / addAllProgress.total) * 100}%` }}
                    >
                      <span className="text-xs font-bold text-white">
                        {Math.round((addAllProgress.current / addAllProgress.total) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4 text-center">
                  <div className="text-sm text-white/60 mb-1">Currently adding:</div>
                  <div className="text-lg font-semibold text-white">{addAllProgress.cardName}</div>
                </div>

                <div className="flex justify-center mt-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                </div>
              </div>
            </div>
          )}

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
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className="text-white/50 text-xs">
                                  {owned ? `Own ${owned.collectionQuantity}` : 'Need'}
                                </span>
                                {!owned && (
                                  <button
                                    onClick={() => handleAddToCollection(card)}
                                    className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold transition"
                                    title="Add this card to your collection"
                                  >
                                    + Add
                                  </button>
                                )}
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
