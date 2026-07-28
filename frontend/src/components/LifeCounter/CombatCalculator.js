import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Swords } from 'lucide-react';
import { resolveCombat } from '../../utils/combatMath';

const KEYWORDS = [
  { key: 'firstStrike', label: 'First Strike' },
  { key: 'doubleStrike', label: 'Double Strike' },
  { key: 'deathtouch', label: 'Deathtouch' },
];
const ATTACKER_ONLY_KEYWORDS = [
  { key: 'trample', label: 'Trample' },
  { key: 'lifelink', label: 'Lifelink' },
];

function KeywordToggle({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs font-medium transition ${
        active ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  );
}

function CreatureFields({ creature, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-white/40 text-[10px] mb-0.5">Power</label>
          <input
            type="number"
            min="0"
            value={creature.power}
            onChange={(e) => onChange({ ...creature, power: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-white text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-white/40 text-[10px] mb-0.5">Toughness</label>
          <input
            type="number"
            min="1"
            value={creature.toughness}
            onChange={(e) => onChange({ ...creature, toughness: parseInt(e.target.value) || 1 })}
            className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-white text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {KEYWORDS.map(kw => (
          <KeywordToggle
            key={kw.key}
            label={kw.label}
            active={!!creature[kw.key]}
            onClick={() => onChange({ ...creature, [kw.key]: !creature[kw.key] })}
          />
        ))}
      </div>
    </div>
  );
}

let nextBlockerId = 1;

function CombatCalculator({ players = [], onLifeChange, compact = false }) {
  const [attacker, setAttacker] = useState({
    power: 2, toughness: 2, firstStrike: false, doubleStrike: false,
    deathtouch: false, trample: false, lifelink: false,
  });
  const [blockers, setBlockers] = useState([
    { id: nextBlockerId++, name: 'Blocker 1', power: 2, toughness: 2, firstStrike: false, doubleStrike: false, deathtouch: false },
  ]);
  const [attackingPlayerId, setAttackingPlayerId] = useState(players[0]?.id || '');
  const [defendingPlayerId, setDefendingPlayerId] = useState(players[1]?.id || players[0]?.id || '');
  const [applied, setApplied] = useState(false);

  const addBlocker = () => {
    setBlockers(prev => [
      ...prev,
      { id: nextBlockerId++, name: `Blocker ${prev.length + 1}`, power: 2, toughness: 2, firstStrike: false, doubleStrike: false, deathtouch: false },
    ]);
    setApplied(false);
  };

  const removeBlocker = (id) => {
    setBlockers(prev => prev.filter(b => b.id !== id));
    setApplied(false);
  };

  const updateBlocker = (id, updated) => {
    setBlockers(prev => prev.map(b => (b.id === id ? updated : b)));
    setApplied(false);
  };

  const result = useMemo(
    () => resolveCombat({ attacker, blockers }),
    [attacker, blockers]
  );

  const handleApply = () => {
    if (onLifeChange) {
      if (defendingPlayerId && result.damageToPlayer > 0) {
        onLifeChange(defendingPlayerId, -result.damageToPlayer);
      }
      if (attackingPlayerId && result.lifeGained > 0) {
        onLifeChange(attackingPlayerId, result.lifeGained);
      }
    }
    setApplied(true);
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
        <Swords size={16} className="text-red-400" />
        Combat Damage Calculator
      </div>

      {players.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-white/40 text-[10px] mb-0.5">Attacking player</label>
            <select
              value={attackingPlayerId}
              onChange={(e) => { setAttackingPlayerId(e.target.value); setApplied(false); }}
              className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-white text-sm"
            >
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-white/40 text-[10px] mb-0.5">Defending player</label>
            <select
              value={defendingPlayerId}
              onChange={(e) => { setDefendingPlayerId(e.target.value); setApplied(false); }}
              className="w-full px-2 py-1 bg-black/20 border border-white/10 rounded text-white text-sm"
            >
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="bg-black/20 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/70 text-xs font-semibold">Attacker</span>
        </div>
        <CreatureFields creature={attacker} onChange={(c) => { setAttacker(c); setApplied(false); }} />
        <div className="flex flex-wrap gap-1 mt-2">
          {ATTACKER_ONLY_KEYWORDS.map(kw => (
            <KeywordToggle
              key={kw.key}
              label={kw.label}
              active={!!attacker[kw.key]}
              onClick={() => { setAttacker({ ...attacker, [kw.key]: !attacker[kw.key] }); setApplied(false); }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {blockers.map(b => (
          <div key={b.id} className="bg-black/20 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={b.name}
                onChange={(e) => updateBlocker(b.id, { ...b, name: e.target.value })}
                className="bg-transparent text-white/70 text-xs font-semibold w-24 focus:outline-none"
              />
              <button onClick={() => removeBlocker(b.id)} className="text-red-400 hover:text-red-300">
                <Trash2 size={14} />
              </button>
            </div>
            <CreatureFields creature={b} onChange={(c) => updateBlocker(b.id, c)} />
          </div>
        ))}
        <button
          onClick={addBlocker}
          className="w-full py-1.5 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
        >
          <Plus size={14} /> Add Blocker
        </button>
      </div>

      <div className="bg-black/30 rounded-xl p-3 space-y-2">
        <div className="text-white/70 text-xs font-semibold">Result</div>
        <div className="text-sm text-white/90 space-y-1">
          <div>Attacker: {result.attackerDied ? <span className="text-red-400">Destroyed</span> : <span className="text-green-400">Survives</span>} ({result.attackerDamageTaken} damage taken)</div>
          {result.blockerResults.map(b => (
            <div key={b.id}>
              {b.name}: {b.died ? <span className="text-red-400">Destroyed</span> : <span className="text-green-400">Survives</span>} ({b.damageTaken} damage taken)
            </div>
          ))}
          {result.damageToPlayer > 0 && <div className="text-yellow-400">{result.damageToPlayer} tramples through to the defending player</div>}
          {result.lifeGained > 0 && <div className="text-green-400">Attacker's controller gains {result.lifeGained} life (lifelink)</div>}
        </div>
        <details className="text-white/50 text-xs">
          <summary className="cursor-pointer">Step-by-step log</summary>
          <div className="mt-1 space-y-0.5">
            {result.log.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </details>
      </div>

      {players.length > 0 && (result.damageToPlayer > 0 || result.lifeGained > 0) && (
        <button
          onClick={handleApply}
          disabled={applied}
          className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition"
        >
          {applied ? 'Applied to Life Totals' : 'Apply to Life Totals'}
        </button>
      )}
    </div>
  );
}

export default CombatCalculator;
