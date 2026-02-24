import React, { useMemo } from 'react';

// ── Card lists ────────────────────────────────────────────────────────────────
const SPOT_REMOVAL = [
  'Swords to Plowshares', 'Path to Exile', 'Vindicate', 'Anguished Unmaking',
  'Generous Gift', 'Beast Within', 'Chaos Warp', "Nature's Claim", 'Return to Nature',
  "Assassin's Trophy", 'Abrupt Decay', 'Terminate', 'Go for the Throat',
  'Cast Down', 'Murder', 'Reality Shift', 'Rapid Hybridization', 'Pongify',
  'Song of the Dryads', 'Imprisoned in the Moon', 'Darksteel Mutation',
  'Fateful Absence', 'Baleful Mastery', 'Infernal Grasp', 'Deadly Rollick',
  'Dismember', 'Dreadbore', 'Putrefy', 'Decimate', 'Vandalblast', 'By Force',
  'Hull Breach', 'Oblivion Ring', 'Banishing Light', 'Grasp of Fate', 'Cast Out',
  'Detention Sphere', 'Skyclave Apparition', "Hero's Downfall", "Vraska's Contempt",
  'Doom Blade', 'Counterspell', 'Swan Song', 'Arcane Denial', 'Negate',
  'Force of Will', 'Fierce Guardianship', 'Deflecting Swat',
];

const BOARD_WIPES = [
  'Wrath of God', 'Damnation', 'Supreme Verdict', 'Cyclonic Rift', 'Toxic Deluge',
  'Farewell', 'Austere Command', 'Cleansing Nova', 'Blasphemous Act',
  'Vanquish the Horde', 'Crux of Fate', "In Garruk's Wake", 'Plague Wind',
  'Decree of Pain', "Black Sun's Zenith", "Nevinyrral's Disk", 'Oblivion Stone',
  'Devastation Tide', 'Evacuation', 'Languish', 'Kindred Dominance', 'Fumigate',
  'Day of Judgment', 'Rout', 'Merciless Eviction', 'Earthquake', 'Chain Reaction',
  'Living Death', 'Extinction Event', 'Hour of Devastation',
];

const ALL_REMOVAL = [...new Set([...SPOT_REMOVAL, ...BOARD_WIPES])];

const CARD_DRAW = [
  'Rhystic Study', 'Necropotence', 'Sylvan Library', 'Consecrated Sphinx',
  'Mystic Remora', 'Phyrexian Arena', 'Esper Sentinel', 'Painful Truths',
  'Harmonize', 'Opportunity', 'Fact or Fiction', 'Windfall', 'Wheel of Fortune',
  "Night's Whisper", 'Sign in Blood', 'Read the Bones', "Life's Legacy",
  'Greater Good', 'Momentous Fall', "Rishkar's Expertise", 'Dark Confidant',
  'Bloodgift Demon', "Bident of Thassa", 'Coastal Piracy', 'Reconnaissance Mission',
  'Skullclamp', 'Mangara, the Diplomat', "Alhammarret's Archive",
  "Garruk's Packleader", 'Elemental Bond', 'Temur Ascendancy',
  "Lifecrafter's Bestiary", 'Ponder', 'Preordain', 'Brainstorm', 'Opt',
  'Frantic Search', 'Compulsive Research', "Thirst for Knowledge", 'Recurring Insight',
  'Grim Haruspex', 'Deathreap Ritual', "Plumb the Forbidden", "Deadly Dispute",
  "Village Rites", "Return of the Wildspeaker",
];

const RAMP = [
  'Sol Ring', 'Arcane Signet', "Commander's Sphere", 'Worn Powerstone',
  'Thran Dynamo', 'Gilded Lotus', 'Darksteel Ingot', 'Chromatic Lantern',
  'Cultivate', "Kodama's Reach", 'Farseek', 'Rampant Growth', "Nature's Lore",
  'Three Visits', 'Skyshroud Claim', 'Explosive Vegetation', 'Sakura-Tribe Elder',
  'Wood Elves', 'Farhaven Elf', 'Solemn Simulacrum', 'Burnished Hart',
  "Wayfarer's Bauble", 'Expedition Map', 'Weathered Wayfarer',
  "Oracle of Mul Daya", "Azusa, Lost but Seeking", 'Exploration', 'Burgeoning',
  "Dryad of the Ilysian Grove", "Selvala, Heart of the Wilds",
  "Elvish Mystic", "Llanowar Elves", 'Fyndhorn Elves', "Birds of Paradise",
  "Noble Hierarch", 'Land Tax', "Mana Vault", "Mana Crypt", "Chrome Mox",
  "Mox Diamond", "Jeweled Lotus", 'Dark Ritual', 'Cabal Ritual', "Seething Song",
  'Harrow', "Lotus Cobra", "Mirari's Wake", "Zendikar Resurgent", "Caged Sun",
  'Gauntlet of Power', 'Extraplanar Lens', "Doubling Cube",
  "Priest of Titania", 'Elvish Archdruid', "Deathrite Shaman",
];

const STAPLES_BY_COLOR = {
  W: ['Swords to Plowshares', 'Path to Exile', 'Smothering Tithe', "Teferi's Protection", 'Enlightened Tutor', 'Austere Command'],
  U: ['Rhystic Study', 'Cyclonic Rift', 'Counterspell', 'Swan Song', 'Mystic Remora', 'Mystical Tutor'],
  B: ['Demonic Tutor', 'Vampiric Tutor', 'Necropotence', 'Phyrexian Arena', 'Toxic Deluge', 'Reanimate'],
  R: ['Chaos Warp', "Jeska's Will", 'Deflecting Swat', 'Dockside Extortionist', 'Vandalblast'],
  G: ['Cultivate', "Kodama's Reach", 'Sylvan Library', "Nature's Claim", 'Finale of Devastation', 'Skyshroud Claim'],
  C: ['Sol Ring', 'Arcane Signet', 'Command Tower', 'Exotic Orchard'],
};

const COLOR_STYLES = {
  W: { color: '#f5e6a3', label: 'White' },
  U: { color: '#60a5fa', label: 'Blue' },
  B: { color: '#6b7280', label: 'Black' },
  R: { color: '#f87171', label: 'Red' },
  G: { color: '#4ade80', label: 'Green' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function parsePips(manaCost) {
  if (!manaCost) return {};
  const pips = {};
  const matches = manaCost.match(/\{([^}]+)\}/g) || [];
  matches.forEach(symbol => {
    const v = symbol.replace(/[{}]/g, '');
    ['W', 'U', 'B', 'R', 'G'].forEach(c => {
      if (v === c) {
        pips[c] = (pips[c] || 0) + 1;
      } else if (v.length === 3 && v[1] === '/' && (v[0] === c || v[2] === c)) {
        pips[c] = (pips[c] || 0) + 0.5;
      }
    });
  });
  return pips;
}

function statusFor(count, good, warn) {
  if (count >= good) return { label: 'Good',     cls: 'bg-green-500/20 text-green-300'  };
  if (count >= warn) return { label: 'Low',      cls: 'bg-yellow-500/20 text-yellow-300' };
  return               { label: 'Critical', cls: 'bg-red-500/20 text-red-300'    };
}

// ── Component ─────────────────────────────────────────────────────────────────
function DeckAnalysis({ deck }) {
  const allCards = useMemo(() => [
    ...(deck.mainDeck || []),
    deck.commander,
    deck.partnerCommander,
  ].filter(Boolean), [deck]);

  const removalCards = useMemo(() => allCards.filter(c => ALL_REMOVAL.includes(c.name)),  [allCards]);
  const drawCards    = useMemo(() => allCards.filter(c => CARD_DRAW.includes(c.name)),    [allCards]);
  const rampCards    = useMemo(() => allCards.filter(c => RAMP.includes(c.name)),          [allCards]);

  const missingStaples = useMemo(() => {
    const identity = new Set([
      ...(deck.commander?.colorIdentity || []),
      ...(deck.partnerCommander?.colorIdentity || []),
      'C',
    ]);
    const inDeck = new Set(allCards.map(c => c.name));
    const missing = [];
    identity.forEach(color => {
      (STAPLES_BY_COLOR[color] || []).forEach(staple => {
        if (!inDeck.has(staple)) missing.push({ name: staple, color });
      });
    });
    return missing;
  }, [deck, allCards]);

  const pipDist = useMemo(() => {
    const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    allCards.filter(c => !(c.types || []).includes('Land')).forEach(card => {
      Object.entries(parsePips(card.manaCost)).forEach(([color, n]) => {
        if (pips[color] !== undefined) pips[color] += n;
      });
    });
    return pips;
  }, [allCards]);

  const totalPips = Object.values(pipDist).reduce((s, v) => s + v, 0);

  const landCount = useMemo(
    () => (deck.mainDeck || []).filter(c => (c.types || []).includes('Land')).length,
    [deck]
  );
  const landStatus =
    landCount >= 36 && landCount <= 38 ? { label: 'Good (36–38)',  cls: 'text-green-400' } :
    landCount >= 33 && landCount <= 41 ? { label: 'Borderline',    cls: 'text-yellow-400' } :
                                         { label: 'Too few/many',  cls: 'text-red-400'    };

  const categories = [
    { label: 'Removal',   count: removalCards.length, cards: removalCards, good: 10, warn: 6, target: '10+ recommended' },
    { label: 'Card Draw', count: drawCards.length,    cards: drawCards,    good: 8,  warn: 5, target: '8+ recommended'  },
    { label: 'Ramp',      count: rampCards.length,    cards: rampCards,    good: 10, warn: 6, target: '10+ recommended' },
  ];

  return (
    <div className="space-y-6">
      {/* Warnings */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
        <h3 className="text-lg font-bold text-white mb-4">Deck Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map(cat => {
            const status = statusFor(cat.count, cat.good, cat.warn);
            const shown  = cat.cards.slice(0, 5);
            const extra  = cat.cards.length - shown.length;
            return (
              <div key={cat.label} className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-sm font-medium">{cat.label}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${status.cls}`}>{status.label}</span>
                </div>
                <div className="text-4xl font-bold text-white mb-1">{cat.count}</div>
                <div className="text-white/40 text-xs mb-3">{cat.target}</div>
                <div className="space-y-0.5">
                  {shown.map((c, i) => (
                    <div key={i} className="text-white/60 text-xs truncate">{c.name}</div>
                  ))}
                  {extra > 0 && <div className="text-white/40 text-xs">+{extra} more</div>}
                  {cat.cards.length === 0 && <div className="text-white/30 text-xs italic">None detected</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Missing staples */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
        <h3 className="text-lg font-bold text-white mb-3">Missing Staples</h3>
        {missingStaples.length === 0 ? (
          <div className="text-green-400 text-sm">All key staples included!</div>
        ) : (
          <>
            <div className="text-white/50 text-xs mb-2">Consider adding:</div>
            <div className="flex flex-wrap gap-2">
              {missingStaples.map((s, i) => (
                <span key={i} className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs text-white/80">
                  {s.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mana pip distribution + land count */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30">
        <h3 className="text-lg font-bold text-white mb-4">Mana Requirements</h3>
        <div className="space-y-2.5 mb-4">
          {Object.entries(pipDist)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([color, pips]) => {
              const pct  = totalPips > 0 ? Math.round((pips / totalPips) * 100) : 0;
              const meta = COLOR_STYLES[color];
              return (
                <div key={color}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/80">{meta.label}</span>
                    <span className="text-white/60">{Math.round(pips)} pips <span className="text-white/40">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                  </div>
                </div>
              );
            })}
          {totalPips === 0 && <div className="text-white/40 text-sm">No colored mana costs found.</div>}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/20">
          <span className="text-white/70 text-sm">Total Lands</span>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${landStatus.cls}`}>{landCount}</span>
            <span className="text-white/40 text-xs">{landStatus.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeckAnalysis;
