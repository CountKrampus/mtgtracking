import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import ManaCurveChart from './ManaCurveChart';
import DeckAnalysis from './DeckAnalysis';
import DeckHandSimulator from './DeckHandSimulator';
import { API_URL } from '../config';
import { useWishlist } from '../contexts/WishlistContext';

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
  'Tundra': { colors: ['W', 'U'], cycle: 'trueDual' }, 'Underground Sea': { colors: ['U', 'B'], cycle: 'trueDual' },
  'Badlands': { colors: ['B', 'R'], cycle: 'trueDual' }, 'Taiga': { colors: ['R', 'G'], cycle: 'trueDual' },
  'Savannah': { colors: ['G', 'W'], cycle: 'trueDual' }, 'Scrubland': { colors: ['W', 'B'], cycle: 'trueDual' },
  'Volcanic Island': { colors: ['U', 'R'], cycle: 'trueDual' }, 'Bayou': { colors: ['B', 'G'], cycle: 'trueDual' },
  'Plateau': { colors: ['R', 'W'], cycle: 'trueDual' }, 'Tropical Island': { colors: ['G', 'U'], cycle: 'trueDual' },
  // Shocklands
  'Hallowed Fountain': { colors: ['W', 'U'], cycle: 'shockland' }, 'Watery Grave': { colors: ['U', 'B'], cycle: 'shockland' },
  'Blood Crypt': { colors: ['B', 'R'], cycle: 'shockland' }, 'Stomping Ground': { colors: ['R', 'G'], cycle: 'shockland' },
  'Temple Garden': { colors: ['G', 'W'], cycle: 'shockland' }, 'Godless Shrine': { colors: ['W', 'B'], cycle: 'shockland' },
  'Steam Vents': { colors: ['U', 'R'], cycle: 'shockland' }, 'Overgrown Tomb': { colors: ['B', 'G'], cycle: 'shockland' },
  'Sacred Foundry': { colors: ['R', 'W'], cycle: 'shockland' }, 'Breeding Pool': { colors: ['G', 'U'], cycle: 'shockland' },
  // Fetchlands
  'Flooded Strand': { colors: ['W', 'U'], cycle: 'fetchland' }, 'Polluted Delta': { colors: ['U', 'B'], cycle: 'fetchland' },
  'Bloodstained Mire': { colors: ['B', 'R'], cycle: 'fetchland' }, 'Wooded Foothills': { colors: ['R', 'G'], cycle: 'fetchland' },
  'Windswept Heath': { colors: ['G', 'W'], cycle: 'fetchland' }, 'Marsh Flats': { colors: ['W', 'B'], cycle: 'fetchland' },
  'Scalding Tarn': { colors: ['U', 'R'], cycle: 'fetchland' }, 'Verdant Catacombs': { colors: ['B', 'G'], cycle: 'fetchland' },
  'Arid Mesa': { colors: ['R', 'W'], cycle: 'fetchland' }, 'Misty Rainforest': { colors: ['G', 'U'], cycle: 'fetchland' },
  // Universal fixers
  'Command Tower': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Exotic Orchard': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Path of Ancestry': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Arcane Signet': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Fellwar Stone': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  'Chromatic Lantern': { colors: ['W', 'U', 'B', 'R', 'G'], cycle: 'universalFixer' },
  // Signets (two-color rocks)
  'Azorius Signet': { colors: ['W', 'U'], cycle: 'signet' }, 'Dimir Signet': { colors: ['U', 'B'], cycle: 'signet' },
  'Rakdos Signet': { colors: ['B', 'R'], cycle: 'signet' }, 'Gruul Signet': { colors: ['R', 'G'], cycle: 'signet' },
  'Selesnya Signet': { colors: ['G', 'W'], cycle: 'signet' }, 'Orzhov Signet': { colors: ['W', 'B'], cycle: 'signet' },
  'Izzet Signet': { colors: ['U', 'R'], cycle: 'signet' }, 'Golgari Signet': { colors: ['B', 'G'], cycle: 'signet' },
  'Boros Signet': { colors: ['R', 'W'], cycle: 'signet' }, 'Simic Signet': { colors: ['G', 'U'], cycle: 'signet' },
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

    const fixingEntry = COLOR_SOURCES[card.name];
    if (fixingEntry) fixingEntry.colors.forEach(c => { sourcesByColor[c] += quantity; });

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
  const { addToWishlist } = useWishlist();
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
  const [recCategory, setRecCategory] = useState('ramp'); // 'ramp' | 'draw' | 'removal'
  const [recScope, setRecScope] = useState('owned'); // 'owned' | 'all'
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [manabaseBudget, setManabaseBudget] = useState('');
  const [manabaseCandidates, setManabaseCandidates] = useState([]);
  const [selectedManabaseLands, setSelectedManabaseLands] = useState(new Set()); // Set of card names
  const [loadingManabaseBuilder, setLoadingManabaseBuilder] = useState(false);
  const [builderTab, setBuilderTab] = useState('mana'); // 'mana' | 'power' | 'salt' | 'health'
  const [builderBudget, setBuilderBudget] = useState('');
  const [builderScope, setBuilderScope] = useState('owned'); // 'owned' | 'all'
  const [builderSuggestions, setBuilderSuggestions] = useState([]);
  const [selectedBuilderCards, setSelectedBuilderCards] = useState(new Set());
  const [loadingBuilderSuggestions, setLoadingBuilderSuggestions] = useState(false);
  const [builderFetched, setBuilderFetched] = useState(false);

  const [syncTagsStatus, setSyncTagsStatus] = useState(null); // null | 'loading' | {tagged, alreadyTagged}

  const handleSyncTags = async () => {
    setSyncTagsStatus('loading');
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.post(`${API_URL}/decks/${deck._id}/sync-tags`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncTagsStatus(res.data);
      setTimeout(() => setSyncTagsStatus(null), 4000);
    } catch {
      setSyncTagsStatus(null);
    }
  };

  // Improve Deck
  const [showImproveDeck, setShowImproveDeck] = useState(false);
  const [improveScope, setImproveScope] = useState('all');
  const [improveSuggestions, setImproveSuggestions] = useState([]);
  const [loadingImprove, setLoadingImprove] = useState(false);
  const [selectedSwaps, setSelectedSwaps] = useState(new Set());
  const [applyingSwaps, setApplyingSwaps] = useState(false);

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

  useEffect(() => {
    if (!deck._id) return;
    let cancelled = false;
    const token = localStorage.getItem('mtg_access_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setLoadingRecs(true);
    fetch(`${API_URL}/decks/${deck._id}/recommendations?category=${recCategory}&scope=${recScope}`, { headers })
      .then(r => r.ok ? r.json() : { cards: [] })
      .then(data => { if (!cancelled) setRecommendations(data.cards || []); })
      .catch(() => { if (!cancelled) setRecommendations([]); })
      .finally(() => { if (!cancelled) setLoadingRecs(false); });
    return () => { cancelled = true; };
  }, [deck._id, recCategory, recScope]);

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

  // ── Physical Card Count ──────────────────────────────────────────────────
  // ownership.summary.ownedCount/missingCount count distinct card ENTRIES
  // (e.g. "6x Forest" counts as 1), not physical cards. This counts the full
  // deck-needed quantity for every OWNED entry (owning at least 1 copy of a
  // card counts its whole needed quantity as covered - basics/commons are
  // typically not logged 1-for-1 in the collection, so requiring an exact
  // per-copy match would understate ownership for cards the user genuinely
  // has enough of).
  const physicalOwnership = useMemo(() => {
    if (!ownership) return null;
    const ownedPhysical = ownership.ownedCards.reduce((sum, card) => sum + (card.quantity || 1), 0);
    const totalPhysical = deck.statistics?.totalCards
      || [...ownership.ownedCards, ...ownership.missingCards].reduce((sum, card) => sum + (card.quantity || 1), 0);
    return { owned: ownedPhysical, total: totalPhysical };
  }, [ownership, deck.statistics]);

  // ── Manabase Score ────────────────────────────────────────────────────────
  const manabaseScore = useMemo(() => calculateManabaseScore(deck), [deck]);

  // ── Manabase Builder: live projected score for the currently-selected package ──
  const projectedManabaseScore = useMemo(() => {
    if (selectedManabaseLands.size === 0) return manabaseScore;
    const selectedCards = manabaseCandidates
      .filter(c => selectedManabaseLands.has(c.name))
      .map(c => ({ name: c.name, types: c.types || ['Land'], colors: c.colors }));
    const hypotheticalDeck = { ...deck, mainDeck: [...deck.mainDeck, ...selectedCards] };
    return calculateManabaseScore(hypotheticalDeck);
  }, [deck, manabaseCandidates, selectedManabaseLands, manabaseScore]);

  // ── Deck Health Score ─────────────────────────────────────────────────────
  const healthScore = useMemo(() => calculateDeckHealthScore(deck), [deck]);

  // ── Builder projected scores (for Power / Salt / Health tabs) ─────────────
  const projectedPowerLevel = useMemo(() => {
    if (builderTab !== 'power' || selectedBuilderCards.size === 0) return powerLevel;
    const selectedCards = builderSuggestions.filter(c => selectedBuilderCards.has(c.name));
    const allNames = [
      ...(deck.mainDeck || []).map(c => c.name),
      deck.commander?.name,
      ...selectedCards.map(c => c.name),
    ].filter(Boolean);
    const bd = { fastMana: 0, tutors: 0, comboPieces: 0, efficientRemoval: 0, powerhouses: 0,
      avgCmc: powerLevel.breakdown.avgCmc, deckValue: powerLevel.breakdown.deckValue };
    allNames.forEach(n => {
      if (POWER_INDICATORS.fastMana.includes(n)) bd.fastMana++;
      if (POWER_INDICATORS.tutors.includes(n)) bd.tutors++;
      if (POWER_INDICATORS.comboPieces.includes(n)) bd.comboPieces++;
      if (POWER_INDICATORS.efficientRemoval.includes(n)) bd.efficientRemoval++;
      if (POWER_INDICATORS.powerhouses.includes(n)) bd.powerhouses++;
    });
    let s = Math.min(bd.fastMana * 0.5, 2) + Math.min(bd.tutors * 0.4, 2)
           + Math.min(bd.comboPieces * 0.6, 2) + Math.min(bd.efficientRemoval * 0.3, 1)
           + Math.min(bd.powerhouses * 0.3, 1.5);
    if (bd.avgCmc < 2.5) s += 1; else if (bd.avgCmc < 3) s += 0.5;
    if (bd.deckValue > 1000) s += 0.5;
    if (bd.deckValue > 2500) s += 0.5;
    return { level: Math.min(10, Math.max(1, Math.round(3 + s))), breakdown: bd };
  }, [builderTab, selectedBuilderCards, builderSuggestions, deck, powerLevel]);

  const projectedSaltScore = useMemo(() => {
    if (builderTab !== 'salt' || selectedBuilderCards.size === 0) return saltScore;
    const added = builderSuggestions
      .filter(c => selectedBuilderCards.has(c.name))
      .reduce((sum, c) => sum + (c.salt || 1), 0);
    return { ...saltScore, score: saltScore.score + added };
  }, [builderTab, selectedBuilderCards, builderSuggestions, saltScore]);

  const projectedHealthScore = useMemo(() => {
    if (builderTab !== 'health' || selectedBuilderCards.size === 0) return healthScore;
    const selectedCards = builderSuggestions
      .filter(c => selectedBuilderCards.has(c.name))
      .map(c => ({ name: c.name, manaCost: c.manaCost || '', types: c.types || [], quantity: 1 }));
    const hypotheticalDeck = { ...deck, mainDeck: [...(deck.mainDeck || []), ...selectedCards] };
    return calculateDeckHealthScore(hypotheticalDeck);
  }, [builderTab, selectedBuilderCards, builderSuggestions, deck, healthScore]);

  // ── Global Score ──────────────────────────────────────────────────────────
  const globalScore = useMemo(
    () => calculateGlobalScore(powerLevel, saltScore, manabaseScore, healthScore),
    [powerLevel, saltScore, manabaseScore, healthScore]
  );

  // ── Smart Deck Score panel: which sub-score's detail view is showing ──────
  const [activeScoreDetail, setActiveScoreDetail] = useState(null); // null | 'power' | 'salt' | 'mana' | 'health'

  // Not currently reachable (DeckDetail unmounts/remounts on every deck
  // switch today), but reset defensively in case a future change lets the
  // parent swap `deck` without unmounting this component - otherwise a
  // stale detail view could carry over from the previous deck.
  useEffect(() => {
    setActiveScoreDetail(null);
  }, [deck._id]);

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

  const addRecommendationToDeck = async (scryfallCard) => {
    try {
      const response = await axios.post(`${API_URL}/decks/${deck._id}/add-card`, {
        scryfallId: scryfallCard.id,
        name: scryfallCard.name,
        manaCost: scryfallCard.mana_cost,
        types: (scryfallCard.type_line || '').split('—')[0].trim().split(' ').filter(Boolean),
        colors: scryfallCard.colors || [],
        imageUrl: scryfallCard.image_uris?.normal || scryfallCard.card_faces?.[0]?.image_uris?.normal,
      });
      if (response.status === 200) {
        setRecommendations(prev => prev.filter(c => c.id !== scryfallCard.id));
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error adding recommendation to deck:', error);
      alert('Error adding card to deck');
    }
  };

  const suggestLandPackage = async () => {
    const budget = parseFloat(manabaseBudget);
    if (!budget || budget <= 0) return;
    setLoadingManabaseBuilder(true);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_URL}/decks/${deck._id}/manabase-builder?budget=${budget}`, { headers });
      const data = response.ok ? await response.json() : { suggested: [] };
      setManabaseCandidates(data.suggested || []);
      setSelectedManabaseLands(new Set((data.suggested || []).map(c => c.name)));
    } catch (error) {
      console.error('Error fetching manabase builder suggestions:', error);
      setManabaseCandidates([]);
    } finally {
      setLoadingManabaseBuilder(false);
    }
  };

  const toggleManabaseLand = (name) => {
    setSelectedManabaseLands(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const addSelectedLandsToDeck = async () => {
    const toAdd = manabaseCandidates.filter(c => selectedManabaseLands.has(c.name));
    const failed = [];
    for (const land of toAdd) {
      try {
        await axios.post(`${API_URL}/decks/${deck._id}/add-card`, {
          scryfallId: land.scryfallId,
          name: land.name,
          manaCost: land.manaCost,
          types: land.types || ['Land'],
          colors: land.colors,
          imageUrl: land.imageUrl,
        });
      } catch (error) {
        console.error(`Error adding ${land.name} to deck:`, error);
        failed.push(land.name);
      }
    }
    if (failed.length > 0) {
      alert(`Failed to add: ${failed.join(', ')}. The rest were added successfully.`);
    }
    setManabaseCandidates([]);
    setSelectedManabaseLands(new Set());
    onRefresh?.();
  };

  const fetchBuilderSuggestions = async (tab) => {
    if (tab === 'mana') { suggestLandPackage(); return; }
    const budget = parseFloat(builderBudget) || 0;
    setLoadingBuilderSuggestions(true);
    setBuilderSuggestions([]);
    setSelectedBuilderCards(new Set());
    setBuilderFetched(false);
    try {
      const token = localStorage.getItem('mtg_access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const params = new URLSearchParams({ category: tab, scope: builderScope });
      if (budget > 0) params.set('budget', budget);
      const res = await fetch(`${API_URL}/decks/${deck._id}/card-suggestions?${params}`, { headers });
      const data = res.ok ? await res.json() : { results: [] };
      const suggestions = data.results || [];
      setBuilderSuggestions(suggestions);
      setSelectedBuilderCards(new Set(suggestions.map(c => c.name)));
    } catch (err) {
      console.error('Error fetching builder suggestions:', err);
    } finally {
      setLoadingBuilderSuggestions(false);
      setBuilderFetched(true);
    }
  };

  const toggleBuilderCard = (name) => {
    setSelectedBuilderCards(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const addSelectedBuilderCardsToDeck = async () => {
    const toAdd = builderSuggestions.filter(c => selectedBuilderCards.has(c.name));
    const failed = [];
    for (const card of toAdd) {
      try {
        await axios.post(`${API_URL}/decks/${deck._id}/add-card`, {
          scryfallId: card.scryfallId,
          name: card.name,
          manaCost: card.manaCost,
          types: card.types || [],
          colors: card.colors || [],
          imageUrl: card.imageUrl,
        });
      } catch {
        failed.push(card.name);
      }
    }
    if (failed.length > 0) alert(`Failed to add: ${failed.join(', ')}`);
    setBuilderSuggestions([]);
    setSelectedBuilderCards(new Set());
    onRefresh?.();
  };

  const fetchImproveSuggestions = async (scope) => {
    setLoadingImprove(true);
    setImproveSuggestions([]);
    setSelectedSwaps(new Set());
    try {
      const token = localStorage.getItem('mtg_access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_URL}/decks/${deck._id}/improve-suggestions?scope=${scope}`, { headers });
      const data = res.ok ? await res.json() : { suggestions: [] };
      const suggestions = data.suggestions || [];
      setImproveSuggestions(suggestions);
      setSelectedSwaps(new Set(suggestions.map((_, i) => i)));
    } catch (err) {
      console.error('Error fetching improve suggestions:', err);
    } finally {
      setLoadingImprove(false);
    }
  };

  const applySelectedSwaps = async () => {
    const toApply = improveSuggestions.filter((_, i) => selectedSwaps.has(i));
    if (toApply.length === 0) return;
    setApplyingSwaps(true);
    const failed = [];
    for (const swap of toApply) {
      try {
        const token = localStorage.getItem('mtg_access_token');
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        await fetch(`${API_URL}/decks/${deck._id}/swap-card`, {
          method: 'POST', headers,
          body: JSON.stringify({ removeName: swap.remove.name, addCard: swap.add }),
        });
      } catch {
        failed.push(swap.remove.name);
      }
    }
    if (failed.length > 0) alert(`Failed to swap: ${failed.join(', ')}`);
    setShowImproveDeck(false);
    setImproveSuggestions([]);
    setSelectedSwaps(new Set());
    setApplyingSwaps(false);
    onRefresh?.();
  };

  const addRecommendationToWishlist = (scryfallCard) => {
    // addToWishlist (WishlistContext.js) already catches its own errors and
    // alerts the user - no need to duplicate that handling here.
    addToWishlist(scryfallCard, deck.name);
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
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        {isEditingName ? (
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              className="flex-1 min-w-0 px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white text-2xl font-bold"
              autoFocus
            />
            <button onClick={handleSaveRename} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">Save</button>
            <button onClick={handleCancelRename} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">Cancel</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <h2 className="text-2xl font-bold text-white break-words min-w-0">{deck.name}</h2>
            <button onClick={() => setIsEditingName(true)} className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition flex-shrink-0">Rename</button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {onEdit && (
            <button onClick={onEdit} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm font-semibold">
              Edit Deck
            </button>
          )}
          <button
            onClick={() => { setShowImproveDeck(true); fetchImproveSuggestions(improveScope); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-sm font-semibold"
          >
            ✨ Improve Deck
          </button>
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
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={handleSyncTags}
              disabled={syncTagsStatus === 'loading'}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg transition text-xs font-medium"
              title="Tag all collection cards in this deck with the deck name"
            >
              {syncTagsStatus === 'loading' ? 'Tagging…' : '🏷 Sync Tags'}
            </button>
            {syncTagsStatus && syncTagsStatus !== 'loading' && (
              <span className="text-xs text-teal-400">{syncTagsStatus.tagged} tagged, {syncTagsStatus.alreadyTagged} already had tag</span>
            )}
          </div>
          <button onClick={onBack} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition text-sm">
            ← Back
          </button>
        </div>
      </div>

      {/* Improve Deck modal */}
      {showImproveDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">✨ Improve Deck</h2>
                <p className="text-white/50 text-xs mt-0.5">Suggested swaps based on your deck's weakest areas</p>
              </div>
              <button onClick={() => setShowImproveDeck(false)} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Scope toggle */}
            <div className="px-5 pt-4 pb-2 flex items-center gap-2">
              <span className="text-white/50 text-xs mr-1">Source:</span>
              {['all', 'owned'].map(s => (
                <button
                  key={s}
                  onClick={() => { setImproveScope(s); fetchImproveSuggestions(s); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${improveScope === s ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                >
                  {s === 'owned' ? 'My Collection' : 'All of Magic'}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {loadingImprove ? (
                <div className="text-center py-10 text-white/50 text-sm">Finding improvements…</div>
              ) : improveSuggestions.length === 0 ? (
                <div className="text-center py-10 text-white/50 text-sm">
                  {improveScope === 'owned'
                    ? "You don't own any of the suggested upgrades. Try \"All of Magic\"."
                    : "No suggestions — your deck's ramp, draw, and removal are already in good shape!"}
                </div>
              ) : (
                improveSuggestions.map((swap, i) => (
                  <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${selectedSwaps.has(i) ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={selectedSwaps.has(i)}
                      onChange={() => setSelectedSwaps(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      })}
                      className="accent-emerald-500 flex-shrink-0"
                    />
                    {/* Remove card */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-xs font-semibold uppercase tracking-wide">Remove</span>
                        <span className="text-white text-sm font-medium truncate">{swap.remove.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wide">Add</span>
                        <span className="text-white text-sm font-medium truncate">{swap.add.name}</span>
                        {swap.add.price > 0 && <span className="text-white/40 text-xs">${swap.add.price.toFixed(2)}</span>}
                      </div>
                    </div>
                    {/* Category badge */}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60 flex-shrink-0">{swap.category}</span>
                    {/* Card image */}
                    {swap.add.imageUrl && (
                      <img src={swap.add.imageUrl} alt={swap.add.name} className="w-10 rounded flex-shrink-0 border border-white/10" />
                    )}
                  </label>
                ))
              )}
            </div>

            {/* Footer */}
            {improveSuggestions.length > 0 && (
              <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3">
                <span className="text-white/50 text-xs">{selectedSwaps.size} swap{selectedSwaps.size !== 1 ? 's' : ''} selected</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowImproveDeck(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition">
                    Cancel
                  </button>
                  <button
                    onClick={applySelectedSwaps}
                    disabled={applyingSwaps || selectedSwaps.size === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
                  >
                    {applyingSwaps ? 'Applying…' : `Apply ${selectedSwaps.size} Swap${selectedSwaps.size !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                    <span className="text-white/80">Unique Cards Owned:</span>
                    <span className="text-green-400 font-bold">
                      {ownership.summary.ownedCount}/{ownership.ownedCards.length + ownership.missingCards.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">Physical Cards Owned:</span>
                    <span className="text-green-400 font-bold">
                      {physicalOwnership.owned}/{physicalOwnership.total}
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

          {/* Recommendations */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Recommendations</h3>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex flex-wrap gap-2">
                {['ramp', 'draw', 'removal'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setRecCategory(cat)}
                    className={`px-3 py-1 rounded text-sm font-medium capitalize transition ${
                      recCategory === cat ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRecScope('owned')}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    recScope === 'owned' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  My Collection
                </button>
                <button
                  onClick={() => setRecScope('all')}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    recScope === 'all' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  All of Magic
                </button>
              </div>
            </div>

            {loadingRecs ? (
              <div className="text-white/40 text-center text-sm py-8">Loading recommendations...</div>
            ) : recommendations.length === 0 ? (
              <div className="text-white/40 text-center text-sm py-8">
                No {recCategory} recommendations found for this deck's colors.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {recommendations.map(card => (
                  <div key={card.id} className="bg-white/5 rounded-lg overflow-hidden">
                    {(card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal) ? (
                      <img
                        src={card.image_uris?.normal || card.card_faces[0].image_uris.normal}
                        alt={card.name}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-[2.5/3.5] bg-gray-700 flex items-center justify-center">
                        <span className="text-white/60 text-xs text-center p-2">{card.name}</span>
                      </div>
                    )}
                    <div className="p-2">
                      <h4 className="text-white text-xs font-semibold truncate" title={card.name}>{card.name}</h4>
                      {card.owned ? (
                        <button
                          onClick={() => addRecommendationToDeck(card)}
                          className="w-full mt-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition"
                        >
                          + Add to Deck
                        </button>
                      ) : (
                        <button
                          onClick={() => addRecommendationToWishlist(card)}
                          className="w-full mt-1 px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white text-xs rounded transition"
                        >
                          + Add to Wishlist
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deck Builder Tools */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Deck Builder Tools</h3>

            {/* Tabs */}
            <div className="flex gap-0 border border-white/20 rounded-lg overflow-hidden mb-4">
              {[
                { key: 'mana',   label: 'Mana',   score: manabaseScore.grade },
                { key: 'power',  label: 'Power',  score: powerLevel.level },
                { key: 'salt',   label: 'Salt',   score: saltScore.score },
                { key: 'health', label: 'Health', score: healthScore.score },
              ].map(({ key, label, score }) => (
                <button
                  key={key}
                  onClick={() => {
                    setBuilderTab(key);
                    setBuilderSuggestions([]);
                    setSelectedBuilderCards(new Set());
                    setBuilderFetched(false);
                    if (key === 'mana') { setManabaseCandidates([]); setSelectedManabaseLands(new Set()); }
                  }}
                  className={`flex-1 px-3 py-2 text-sm font-semibold transition flex flex-col items-center ${
                    builderTab === key ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-xs opacity-70">{score}</span>
                </button>
              ))}
            </div>

            {/* Controls: budget + scope + suggest button */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-white/60 text-sm">Budget: $</span>
              <input
                type="number"
                min="0"
                step="1"
                value={builderTab === 'mana' ? manabaseBudget : builderBudget}
                onChange={(e) => builderTab === 'mana' ? setManabaseBudget(e.target.value) : setBuilderBudget(e.target.value)}
                placeholder="50"
                className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm"
              />
              <div className="flex rounded overflow-hidden border border-white/20">
                {['owned', 'all'].map(s => (
                  <button
                    key={s}
                    onClick={() => { setBuilderScope(s); setBuilderFetched(false); setBuilderSuggestions([]); setSelectedBuilderCards(new Set()); }}
                    className={`px-3 py-1 text-xs font-medium transition ${
                      builderScope === s ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {s === 'owned' ? 'My Collection' : 'All of Magic'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchBuilderSuggestions(builderTab)}
                disabled={
                  (builderTab === 'mana' ? loadingManabaseBuilder : loadingBuilderSuggestions)
                  || (builderTab === 'mana' ? !manabaseBudget : false)
                }
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded text-sm font-medium transition"
              >
                {(builderTab === 'mana' ? loadingManabaseBuilder : loadingBuilderSuggestions) ? 'Suggesting…' : 'Suggest Cards'}
              </button>
            </div>

            {/* Mana tab results */}
            {builderTab === 'mana' && manabaseCandidates.length > 0 && (
              <>
                <div className="bg-white/5 rounded p-3 mb-3 flex items-center justify-between">
                  <span className="text-white/60 text-sm">Manabase Score</span>
                  <span className="text-white text-sm font-semibold">
                    {manabaseScore.grade} → <span className="text-green-400">{projectedManabaseScore.grade}</span>
                  </span>
                </div>
                <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
                  {manabaseCandidates.map(card => (
                    <label key={card.name} className="flex items-center gap-3 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedManabaseLands.has(card.name)} onChange={() => toggleManabaseLand(card.name)} />
                      <span className="text-white flex-1 truncate">{card.name}</span>
                      <span className="text-white/40 text-xs capitalize flex-shrink-0">{card.cycle}</span>
                      <span className="text-white/60 flex-shrink-0">${(card.price ?? 0).toFixed(2)}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={addSelectedLandsToDeck}
                  disabled={selectedManabaseLands.size === 0}
                  className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-semibold transition"
                >
                  Add Selected to Deck ({selectedManabaseLands.size})
                </button>
              </>
            )}

            {/* Power / Salt / Health tab results */}
            {builderTab !== 'mana' && builderSuggestions.length > 0 && (
              <>
                <div className="bg-white/5 rounded p-3 mb-3 flex items-center justify-between">
                  <span className="text-white/60 text-sm">
                    {builderTab === 'power' ? 'Power Level' : builderTab === 'salt' ? 'Salt Score' : 'Health Score'}
                  </span>
                  <span className="text-white text-sm font-semibold">
                    {builderTab === 'power' && <>{powerLevel.level} → <span className="text-green-400">{projectedPowerLevel.level}</span></>}
                    {builderTab === 'salt'  && <>{saltScore.score} → <span className="text-orange-400">{projectedSaltScore.score}</span></>}
                    {builderTab === 'health' && <>{healthScore.score} → <span className="text-green-400">{projectedHealthScore.score}</span></>}
                  </span>
                </div>
                <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
                  {builderSuggestions.map(card => (
                    <label key={card.name} className="flex items-center gap-3 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedBuilderCards.has(card.name)} onChange={() => toggleBuilderCard(card.name)} />
                      <span className="text-white flex-1 truncate">{card.name}</span>
                      <span className={`text-xs flex-shrink-0 px-1.5 py-0.5 rounded ${
                        builderTab === 'salt'
                          ? 'bg-orange-500/20 text-orange-300'
                          : builderTab === 'power'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-teal-500/20 text-teal-300'
                      }`}>{card.subcat}</span>
                      <span className="text-white/60 flex-shrink-0">${(card.price ?? 0).toFixed(2)}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={addSelectedBuilderCardsToDeck}
                  disabled={selectedBuilderCards.size === 0}
                  className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-semibold transition"
                >
                  Add Selected to Deck ({selectedBuilderCards.size})
                </button>
              </>
            )}

            {builderTab !== 'mana' && !loadingBuilderSuggestions && builderSuggestions.length === 0 && (
              builderFetched ? (
                builderScope === 'owned' ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-white/50 text-sm">None of the suggested cards are in your collection.</p>
                    <button
                      onClick={() => { setBuilderScope('all'); setBuilderFetched(false); setBuilderSuggestions([]); setSelectedBuilderCards(new Set()); }}
                      className="px-3 py-1.5 bg-purple-600/40 hover:bg-purple-600/60 text-purple-200 rounded-lg text-xs font-medium transition"
                    >
                      Search All of Magic instead →
                    </button>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm text-center py-4">No cards found within your budget. Try a higher budget.</p>
                )
              ) : (
                <p className="text-white/40 text-sm text-center py-4">
                  {builderScope === 'owned'
                    ? 'Click "Suggest Cards" to find upgrades from your collection.'
                    : 'Click "Suggest Cards" to search all of Magic for upgrades.'}
                </p>
              )
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
            <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
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
              Deck List ({physicalOwnership?.total ?? deck.mainDeck?.length ?? 0} cards)
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

          {/* Sideboard */}
          {(deck.sideboard || []).length > 0 && (
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mt-4">
              <h3 className="text-lg font-bold text-white mb-3">Sideboard ({(deck.sideboard || []).reduce((s,c)=>s+(c.quantity||1),0)} cards)</h3>
              <div className="space-y-0.5">
                {(deck.sideboard || []).map((card, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-sm border-b border-white/5 last:border-0">
                    {card.quantity > 1 && <span className="text-white/50 text-xs w-4 text-right">{card.quantity}×</span>}
                    <span className="text-white flex-1 truncate">{card.name}</span>
                    <span className="text-white/30 text-xs">{card.manaCost}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Considering / Maybeboard */}
          {(deck.considering || []).length > 0 && (
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mt-4">
              <h3 className="text-lg font-bold text-white mb-1">Considering ({(deck.considering || []).reduce((s,c)=>s+(c.quantity||1),0)} cards)</h3>
              <p className="text-white/40 text-xs mb-3">Cards being evaluated for inclusion</p>
              <div className="space-y-0.5">
                {(deck.considering || []).map((card, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-sm border-b border-white/5 last:border-0">
                    {card.quantity > 1 && <span className="text-white/50 text-xs w-4 text-right">{card.quantity}×</span>}
                    <span className="text-white flex-1 truncate">{card.name}</span>
                    <span className="text-white/30 text-xs">{card.manaCost}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deck Notes / Primer */}
          <DeckNotesPanel deck={deck} onRefresh={onRefresh} />
        </>
      )}
    </div>
  );
}

function DeckNotesPanel({ deck, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(deck.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNotes(deck.notes || ''); }, [deck.notes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('mtg_access_token');
      await fetch(`${API_URL}/decks/${deck._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...deck, notes }),
      });
      setEditing(false);
      onRefresh?.();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white">Notes / Primer</h3>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded transition">
            {notes ? 'Edit' : '+ Add Notes'}
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setNotes(deck.notes || ''); }} className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded transition">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded transition">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        )}
      </div>
      {editing ? (
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Write your deck primer, strategy notes, combo lines, win conditions…"
          className="w-full h-48 bg-black/30 border border-white/20 rounded-lg p-3 text-white text-sm resize-y focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-white/30"
        />
      ) : notes ? (
        <div className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">{notes}</div>
      ) : (
        <p className="text-white/30 text-sm italic">No notes yet. Click "+ Add Notes" to write a primer or strategy guide.</p>
      )}
    </div>
  );
}

export default DeckDetail;
