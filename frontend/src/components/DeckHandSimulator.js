import React, { useState, useCallback } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildLibrary(deck) {
  const cards = [];
  if (deck.commander) cards.push({ ...deck.commander, _uid: 'cmd' });
  if (deck.partnerCommander) cards.push({ ...deck.partnerCommander, _uid: 'cmd2' });
  (deck.mainDeck || []).forEach((card, i) => {
    for (let q = 0; q < (card.quantity || 1); q++) {
      cards.push({ ...card, _uid: `${i}-${q}` });
    }
  });
  return cards;
}

const isLand = (card) => (card.types || []).includes('Land');

// ── Opening Hand Simulator ────────────────────────────────────────────────────
function OpeningHand({ deck }) {
  const [library,        setLibrary]        = useState([]);
  const [hand,           setHand]           = useState([]);
  const [mulliganCount,  setMulliganCount]  = useState(0);
  const [phase,          setPhase]          = useState('idle'); // idle|hand|choosing_bottom|kept
  const [selectedBottom, setSelectedBottom] = useState([]);

  const startGame = useCallback(() => {
    const lib = shuffle(buildLibrary(deck));
    setLibrary(lib.slice(7));
    setHand(lib.slice(0, 7));
    setMulliganCount(0);
    setSelectedBottom([]);
    setPhase('hand');
  }, [deck]);

  const takeMulligan = () => {
    const newLib = shuffle([...library, ...hand]);
    setLibrary(newLib.slice(7));
    setHand(newLib.slice(0, 7));
    setMulliganCount(c => c + 1);
    setSelectedBottom([]);
    setPhase('hand');
  };

  const keepHand = () => {
    if (mulliganCount === 0) setPhase('kept');
    else setPhase('choosing_bottom');
  };

  const toggleBottom = (idx) => {
    if (selectedBottom.includes(idx)) {
      setSelectedBottom(selectedBottom.filter(i => i !== idx));
    } else if (selectedBottom.length < mulliganCount) {
      setSelectedBottom([...selectedBottom, idx]);
    }
  };

  const confirmBottom = () => {
    if (selectedBottom.length !== mulliganCount) return;
    const kept     = hand.filter((_, i) => !selectedBottom.includes(i));
    const bottomed = hand.filter((_, i) =>  selectedBottom.includes(i));
    setHand(kept);
    setLibrary(prev => [...prev, ...bottomed]);
    setSelectedBottom([]);
    setPhase('kept');
  };

  const landCount = hand.filter(isLand).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 text-sm">
          {phase !== 'idle' && (
            <>
              <span className="text-white/60">Hand: <span className="text-white font-bold">{hand.length}</span></span>
              <span className="text-yellow-400 font-semibold">{landCount} land{landCount !== 1 ? 's' : ''}</span>
              <span className="text-blue-400">{hand.length - landCount} spell{hand.length - landCount !== 1 ? 's' : ''}</span>
              {mulliganCount > 0 && <span className="text-orange-400 font-bold">Mulligan #{mulliganCount}</span>}
            </>
          )}
        </div>
        <button
          onClick={startGame}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition"
        >
          {phase === 'idle' ? 'Draw Opening Hand' : 'Reset'}
        </button>
      </div>

      {phase === 'idle' && (
        <div className="text-white/40 text-center py-10 text-sm">
          Click "Draw Opening Hand" to simulate a starting hand.
        </div>
      )}

      {phase !== 'idle' && (
        <>
          {phase === 'choosing_bottom' && (
            <div className="text-center text-white/80 text-sm mb-3">
              Select <span className="text-yellow-400 font-bold">{mulliganCount}</span> card{mulliganCount !== 1 ? 's' : ''} to put on the bottom ({selectedBottom.length}/{mulliganCount})
            </div>
          )}
          {phase === 'kept' && (
            <div className="text-center text-green-400 font-semibold text-sm mb-3">
              Hand kept — {hand.length} cards.
            </div>
          )}

          {/* Cards */}
          <div
            className="grid gap-2 mb-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(hand.length, 7)}, minmax(0, 1fr))` }}
          >
            {hand.map((card, idx) => {
              const toBottom = selectedBottom.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => phase === 'choosing_bottom' && toggleBottom(idx)}
                  disabled={phase !== 'choosing_bottom'}
                  className={`relative rounded-lg overflow-hidden border-2 transition text-left ${
                    toBottom        ? 'border-red-500 opacity-50' :
                    isLand(card)    ? 'border-yellow-500/60'      : 'border-white/20'
                  } ${phase === 'choosing_bottom' ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
                >
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.name} className="w-full rounded" />
                  ) : (
                    <div className={`p-2 h-28 flex flex-col justify-between text-xs ${isLand(card) ? 'bg-yellow-900/30' : 'bg-white/10'}`}>
                      <div className="font-semibold text-white leading-tight line-clamp-2">{card.name}</div>
                      <div className="text-white/50">{card.manaCost}</div>
                    </div>
                  )}
                  {toBottom && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-900/70 rounded">
                      <span className="text-red-200 font-bold text-xs">BOTTOM</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          {phase === 'choosing_bottom' && (
            <div className="flex justify-center">
              <button
                onClick={confirmBottom}
                disabled={selectedBottom.length !== mulliganCount}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition"
              >
                Confirm — Keep {hand.length - mulliganCount} cards
              </button>
            </div>
          )}

          {phase === 'hand' && (
            <div className="flex justify-center gap-3">
              <button onClick={keepHand} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition">
                Keep Hand
              </button>
              <button onClick={takeMulligan} className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold transition">
                Mulligan → {hand.length - 1}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Goldfish Simulator ────────────────────────────────────────────────────────
function Goldfish({ deck }) {
  const [started,            setStarted]            = useState(false);
  const [library,            setLibrary]            = useState([]);
  const [hand,               setHand]               = useState([]);
  const [landsOnField,       setLandsOnField]       = useState([]);
  const [nonlandsOnField,    setNonlandsOnField]    = useState([]);
  const [graveyard,          setGraveyard]          = useState([]);
  const [turn,               setTurn]               = useState(1);
  const [landsPlayedThisTurn,setLandsPlayedThisTurn] = useState(0);

  const startGame = useCallback(() => {
    const lib = shuffle(buildLibrary(deck));
    setLibrary(lib.slice(7));
    setHand(lib.slice(0, 7));
    setLandsOnField([]);
    setNonlandsOnField([]);
    setGraveyard([]);
    setTurn(1);
    setLandsPlayedThisTurn(0);
    setStarted(true);
  }, [deck]);

  const drawCard = (lib, h) => {
    if (lib.length === 0) return { lib, hand: h };
    return { lib: lib.slice(1), hand: [...h, lib[0]] };
  };

  const handleDraw = () => {
    const result = drawCard(library, hand);
    setLibrary(result.lib);
    setHand(result.hand);
  };

  const playCard = (idx) => {
    const card = hand[idx];
    const newHand = hand.filter((_, i) => i !== idx);
    if (isLand(card)) {
      if (landsPlayedThisTurn >= 1) return; // can't play another land
      setLandsOnField(f => [...f, card]);
      setLandsPlayedThisTurn(n => n + 1);
    } else {
      setNonlandsOnField(f => [...f, card]);
    }
    setHand(newHand);
  };

  const discardCard = (idx) => {
    setGraveyard(g => [...g, hand[idx]]);
    setHand(hand.filter((_, i) => i !== idx));
  };

  const nextTurn = () => {
    const result = drawCard(library, hand);
    setLibrary(result.lib);
    setHand(result.hand);
    setTurn(t => t + 1);
    setLandsPlayedThisTurn(0);
  };

  if (!started) {
    return (
      <div className="text-center py-10">
        <p className="text-white/60 text-sm mb-4">Simulate drawing and playing cards turn by turn.</p>
        <button onClick={startGame} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition">
          Start Goldfish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-purple-400 font-bold">Turn {turn}</span>
          <span className="text-white/60">Library: <span className="text-white">{library.length}</span></span>
          <span className="text-white/60">Hand: <span className="text-white">{hand.length}</span></span>
          <span className="text-white/60">Grave: <span className="text-white">{graveyard.length}</span></span>
          {landsPlayedThisTurn > 0 && <span className="text-yellow-400 text-xs">Land played</span>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleDraw} disabled={library.length === 0} className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white rounded text-sm transition">
            Draw
          </button>
          <button onClick={nextTurn} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition">
            Next Turn →
          </button>
          <button onClick={startGame} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded text-sm transition">
            Reset
          </button>
        </div>
      </div>

      {/* Battlefield */}
      {(landsOnField.length > 0 || nonlandsOnField.length > 0) && (
        <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
          <div className="text-green-400 text-xs font-semibold mb-2 uppercase tracking-wide">Battlefield</div>
          {landsOnField.length > 0 && (
            <div className="mb-2">
              <div className="text-white/50 text-xs mb-1">Lands ({landsOnField.length})</div>
              <div className="flex flex-wrap gap-1">
                {landsOnField.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 bg-yellow-900/40 border border-yellow-600/30 rounded text-xs text-yellow-300">{c.name}</span>
                ))}
              </div>
            </div>
          )}
          {nonlandsOnField.length > 0 && (
            <div>
              <div className="text-white/50 text-xs mb-1">Permanents ({nonlandsOnField.length})</div>
              <div className="flex flex-wrap gap-1">
                {nonlandsOnField.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-900/40 border border-blue-600/30 rounded text-xs text-blue-300">{c.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hand */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-white/60 text-xs font-semibold uppercase tracking-wide">Hand</div>
          <div className="text-white/30 text-xs">Left-click to play · Right-click to discard</div>
        </div>
        {hand.length === 0 ? (
          <div className="text-white/30 text-sm italic py-2">Empty hand</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hand.map((card, idx) => {
              const land = isLand(card);
              const blocked = land && landsPlayedThisTurn >= 1;
              return (
                <button
                  key={idx}
                  onClick={() => !blocked && playCard(idx)}
                  onContextMenu={(e) => { e.preventDefault(); discardCard(idx); }}
                  title={`${card.name}${card.manaCost ? ' ' + card.manaCost : ''}\nLeft-click: play | Right-click: discard${blocked ? '\n(Already played a land this turn)' : ''}`}
                  className={`px-2 py-1 rounded text-xs font-medium border transition ${
                    land
                      ? 'bg-yellow-900/40 border-yellow-600/40 text-yellow-300'
                      : 'bg-white/10 border-white/20 text-white hover:brightness-110'
                  } ${blocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {card.name}
                  {card.manaCost && <span className="text-white/40 ml-1">{card.manaCost}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
function DeckHandSimulator({ deck }) {
  const [tab, setTab] = useState('hand');

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/30 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Simulators</h3>
        <div className="flex gap-2">
          {[['hand', 'Opening Hand'], ['goldfish', 'Goldfish']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-1 rounded text-sm transition ${
                tab === id ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'hand' ? <OpeningHand deck={deck} /> : <Goldfish deck={deck} />}
    </div>
  );
}

export default DeckHandSimulator;
