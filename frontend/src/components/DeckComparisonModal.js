import React, { useState, useMemo } from 'react';
import { X, GitCompare } from 'lucide-react';

function CardListRow({ card, deckAName, deckBName, onPreview }) {
  return (
    <button
      onClick={() => onPreview(card)}
      className="w-full flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-white/5 transition-colors text-left"
    >
      <span className="text-white text-sm truncate">{card.name}</span>
      <span className="flex gap-1 flex-shrink-0">
        {card.inA && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300" title={deckAName}>A</span>
        )}
        {card.inB && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300" title={deckBName}>B</span>
        )}
      </span>
    </button>
  );
}

const CMC_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7+'];

function ManaCurveOverlay({ curveA, curveB }) {
  const a = curveA instanceof Map ? Object.fromEntries(curveA) : (curveA || {});
  const b = curveB instanceof Map ? Object.fromEntries(curveB) : (curveB || {});
  const maxCount = Math.max(...CMC_ORDER.map(cmc => Math.max(a[cmc] || 0, b[cmc] || 0)), 1);

  return (
    <div className="flex items-end justify-around h-32 gap-2">
      {CMC_ORDER.map(cmc => {
        const countA = a[cmc] || 0;
        const countB = b[cmc] || 0;
        return (
          <div key={cmc} className="flex flex-col items-center gap-1 flex-1">
            <div className="flex items-end gap-0.5 h-24 w-full justify-center">
              <div
                className="w-2.5 rounded-t bg-blue-500"
                style={{ height: `${(countA / maxCount) * 100}%`, minHeight: countA > 0 ? '4px' : '0' }}
                title={`Deck A: ${countA} at CMC ${cmc}`}
              />
              <div
                className="w-2.5 rounded-t bg-purple-500"
                style={{ height: `${(countB / maxCount) * 100}%`, minHeight: countB > 0 ? '4px' : '0' }}
                title={`Deck B: ${countB} at CMC ${cmc}`}
              />
            </div>
            <div className="text-xs text-white/60">{cmc}</div>
          </div>
        );
      })}
    </div>
  );
}

const COLOR_META = {
  W: { color: '#f5e6a3', label: 'White'     },
  U: { color: '#60a5fa', label: 'Blue'      },
  B: { color: '#6b7280', label: 'Black'     },
  R: { color: '#f87171', label: 'Red'       },
  G: { color: '#4ade80', label: 'Green'     },
  C: { color: '#9ca3af', label: 'Colorless' },
};

function ColorPipComparison({ colorsA, colorsB, nameA, nameB }) {
  const a = colorsA instanceof Map ? Object.fromEntries(colorsA) : (colorsA || {});
  const b = colorsB instanceof Map ? Object.fromEntries(colorsB) : (colorsB || {});
  const totalA = Object.values(a).reduce((s, v) => s + v, 0) || 1;
  const totalB = Object.values(b).reduce((s, v) => s + v, 0) || 1;

  return (
    <div className="space-y-2">
      {Object.keys(COLOR_META).map(key => {
        const countA = a[key] || 0;
        const countB = b[key] || 0;
        if (countA === 0 && countB === 0) return null;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[10px] text-black/70"
              style={{ backgroundColor: COLOR_META[key].color }}
            >
              {key}
            </span>
            <div className="flex-1 flex items-center gap-1">
              <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden" title={`${nameA}: ${countA}`}>
                <div className="h-full bg-blue-500/70" style={{ width: `${(countA / totalA) * 100}%` }} />
              </div>
              <span className="text-white/50 w-6 text-right">{countA}</span>
            </div>
            <div className="flex-1 flex items-center gap-1">
              <span className="text-white/50 w-6">{countB}</span>
              <div className="flex-1 h-3 bg-white/5 rounded overflow-hidden" title={`${nameB}: ${countB}`}>
                <div className="h-full bg-purple-500/70 ml-auto" style={{ width: `${(countB / totalB) * 100}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Picker step: choose two distinct decks before the comparison renders.
function DeckPicker({ decks, deckAId, deckBId, onSelectA, onSelectB, onCompare }) {
  const canCompare = deckAId && deckBId && deckAId !== deckBId;

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        Pick two of your decks to compare their mana curve, colors, and card overlap.
      </p>
      <div>
        <label className="block text-sm text-white mb-1">Deck A</label>
        <select
          value={deckAId}
          onChange={(e) => onSelectA(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Select a deck…</option>
          {decks.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm text-white mb-1">Deck B</label>
        <select
          value={deckBId}
          onChange={(e) => onSelectB(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
        >
          <option value="">Select a deck…</option>
          {decks.filter(d => d._id !== deckAId).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
      </div>
      <button
        onClick={onCompare}
        disabled={!canCompare}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
      >
        Compare
      </button>
    </div>
  );
}

function DeckComparisonModal({ decks = [], onClose }) {
  const [deckAId, setDeckAId] = useState('');
  const [deckBId, setDeckBId] = useState('');
  const [comparing, setComparing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [previewCard, setPreviewCard] = useState(null);

  const deckA = useMemo(() => decks.find(d => d._id === deckAId), [decks, deckAId]);
  const deckB = useMemo(() => decks.find(d => d._id === deckBId), [decks, deckBId]);

  const comparison = useMemo(() => {
    if (!deckA || !deckB) return null;

    const byName = new Map(); // name -> { name, imageUrl, inA: bool, inB: bool }

    (deckA.mainDeck || []).forEach(card => {
      if (!card?.name) return;
      const entry = byName.get(card.name) || { name: card.name, imageUrl: card.imageUrl, inA: false, inB: false };
      entry.inA = true;
      if (!entry.imageUrl) entry.imageUrl = card.imageUrl;
      byName.set(card.name, entry);
    });

    (deckB.mainDeck || []).forEach(card => {
      if (!card?.name) return;
      const entry = byName.get(card.name) || { name: card.name, imageUrl: card.imageUrl, inA: false, inB: false };
      entry.inB = true;
      if (!entry.imageUrl) entry.imageUrl = card.imageUrl;
      byName.set(card.name, entry);
    });

    const all = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    const shared = all.filter(c => c.inA && c.inB);
    const onlyA = all.filter(c => c.inA && !c.inB);
    const onlyB = all.filter(c => !c.inA && c.inB);

    return { all, shared, onlyA, onlyB };
  }, [deckA, deckB]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCompare size={22} className="text-blue-400" />
            Compare Decks
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {!comparing || !deckA || !deckB ? (
          <DeckPicker
            decks={decks}
            deckAId={deckAId}
            deckBId={deckBId}
            onSelectA={setDeckAId}
            onSelectB={setDeckBId}
            onCompare={() => setComparing(true)}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-white font-semibold">{deckA.name} <span className="text-white/40">vs</span> {deckB.name}</h3>
              <button
                onClick={() => { setComparing(false); }}
                className="text-xs text-white/50 hover:text-white transition"
              >
                Change decks
              </button>
            </div>

            {/* Commander header row */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[140px] flex items-center gap-2">
                {deckA.commander?.imageUrl && (
                  <img src={deckA.commander.imageUrl} alt={deckA.commander.name} className="w-12 h-16 object-cover rounded flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-white/40 text-xs">Deck A</div>
                  <div className="text-white text-sm font-medium truncate">{deckA.commander?.name || '—'}</div>
                </div>
              </div>
              <div className="flex-1 min-w-[140px] flex items-center gap-2">
                {deckB.commander?.imageUrl && (
                  <img src={deckB.commander.imageUrl} alt={deckB.commander.name} className="w-12 h-16 object-cover rounded flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-white/40 text-xs">Deck B</div>
                  <div className="text-white text-sm font-medium truncate">{deckB.commander?.name || '—'}</div>
                </div>
              </div>
            </div>

            {/* Stats: mana curve + colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-3">
                <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">Mana Curve</h4>
                <div className="flex items-center gap-3 text-xs mb-1">
                  <span className="flex items-center gap-1 text-blue-300"><span className="w-2 h-2 rounded-full bg-blue-500" />{deckA.name}</span>
                  <span className="flex items-center gap-1 text-purple-300"><span className="w-2 h-2 rounded-full bg-purple-500" />{deckB.name}</span>
                </div>
                <ManaCurveOverlay curveA={deckA.statistics?.manaCurve} curveB={deckB.statistics?.manaCurve} />
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">Colors</h4>
                <ColorPipComparison
                  colorsA={deckA.statistics?.colorDistribution}
                  colorsB={deckB.statistics?.colorDistribution}
                  nameA={deckA.name}
                  nameB={deckB.name}
                />
              </div>
            </div>

            {/* Filter toggle */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: `All (${comparison.all.length})` },
                { key: 'shared', label: `Shared (${comparison.shared.length})` },
                { key: 'onlyA', label: `Only ${deckA.name} (${comparison.onlyA.length})` },
                { key: 'onlyB', label: `Only ${deckB.name} (${comparison.onlyB.length})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    filter === key ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Card list */}
            <div className="space-y-0.5 max-h-96 overflow-y-auto">
              {comparison[filter].length === 0 ? (
                <p className="text-gray-500 text-sm italic py-4 text-center">No cards in this view.</p>
              ) : (
                comparison[filter].map(card => (
                  <CardListRow
                    key={card.name}
                    card={card}
                    deckAName={deckA.name}
                    deckBName={deckB.name}
                    onPreview={setPreviewCard}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {previewCard && (previewCard.imageUrl) && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewCard(null)}
        >
          <img
            src={previewCard.imageUrl}
            alt={previewCard.name}
            className="max-w-xs w-full rounded-xl shadow-2xl border border-white/20"
          />
        </div>
      )}
    </div>
  );
}

export default DeckComparisonModal;
