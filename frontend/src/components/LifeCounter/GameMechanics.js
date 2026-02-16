import React from 'react';
import { Crown, Sparkles, Sun, Moon, Circle, Building2, X, Heart } from 'lucide-react';

// Ring tempts you abilities
const RING_ABILITIES = [
  'Your Ring-bearer is legendary and can\'t be blocked by creatures with greater power.',
  'Whenever your Ring-bearer attacks, draw a card, then discard a card.',
  'Whenever your Ring-bearer becomes blocked by a creature, that creature\'s controller sacrifices it at end of combat.',
  'Whenever your Ring-bearer deals combat damage to a player, each opponent loses 3 life.'
];

// Additional game mechanics
const DAY_NIGHT_ABILITIES = {
  day: [
    'Creatures you control get +1/+1',
    'Lands you control produce 1 extra mana of their type',
    'Instant and sorcery spells cost 1 less to cast'
  ],
  night: [
    'Creatures you control get deathtouch',
    'Opponents\' activated abilities cost 1 more to activate',
    'You may look at the top card of your library any time'
  ]
};

function GameMechanics({
  players,
  monarch,
  initiative,
  dayNight, // 'day' | 'night' | null
  onSetMonarch,
  onSetInitiative,
  onSetDayNight,
  onSetRingProgress,
  onSetCitysBlessing,
  onSetPlayerStatus,
  compact = false
}) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Monarch */}
        {monarch !== null && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-600/30 rounded-lg">
            <Crown size={14} className="text-yellow-400" />
            <span className="text-yellow-400 text-xs font-medium">
              {players.find(p => p.id === monarch)?.name || 'Unknown'}
            </span>
          </div>
        )}

        {/* Initiative */}
        {initiative !== null && (
          <div className="flex items-center gap-1 px-2 py-1 bg-cyan-600/30 rounded-lg">
            <Sparkles size={14} className="text-cyan-400" />
            <span className="text-cyan-400 text-xs font-medium">
              {players.find(p => p.id === initiative)?.name || 'Unknown'}
            </span>
          </div>
        )}

        {/* Day/Night */}
        {dayNight && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
            dayNight === 'day' ? 'bg-orange-600/30' : 'bg-indigo-600/30'
          }`}>
            {dayNight === 'day' ? (
              <Sun size={14} className="text-orange-400" />
            ) : (
              <Moon size={14} className="text-indigo-400" />
            )}
            <span className={`text-xs font-medium ${
              dayNight === 'day' ? 'text-orange-400' : 'text-indigo-400'
            }`}>
              {dayNight === 'day' ? 'Day' : 'Night'}
            </span>
          </div>
        )}

        {/* Additional Status Indicators */}
        {players.some(p => p.hasPhyrexianPoison) && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-600/30 rounded-lg">
            <Heart size={14} className="text-red-400" />
            <span className="text-red-400 text-xs font-medium">Phyrexian</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-4">
      <h3 className="text-white/60 text-sm font-semibold mb-3">Game Mechanics</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Monarch */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Crown size={18} className="text-yellow-400" />
            <span className="text-white/80 text-sm font-medium">Monarch</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {players.filter(p => !p.isEliminated).map(player => (
              <button
                key={player.id}
                onClick={() => onSetMonarch(monarch === player.id ? null : player.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  monarch === player.id
                    ? 'bg-yellow-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
                title={monarch === player.id ? 'Is the Monarch' : 'Make Monarch'}
              >
                {player.name.substring(0, 6)}
              </button>
            ))}
          </div>
        </div>

        {/* Initiative */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-cyan-400" />
            <span className="text-white/80 text-sm font-medium">Initiative</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {players.filter(p => !p.isEliminated).map(player => (
              <button
                key={player.id}
                onClick={() => onSetInitiative(initiative === player.id ? null : player.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  initiative === player.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
                title={initiative === player.id ? 'Has the Initiative' : 'Give Initiative'}
              >
                {player.name.substring(0, 6)}
              </button>
            ))}
          </div>
        </div>

        {/* Day/Night */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            {dayNight === 'night' ? (
              <Moon size={18} className="text-indigo-400" />
            ) : (
              <Sun size={18} className="text-orange-400" />
            )}
            <span className="text-white/80 text-sm font-medium">Day/Night</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onSetDayNight(dayNight === 'day' ? null : 'day')}
              className={`flex-1 py-1.5 rounded text-sm font-medium transition ${
                dayNight === 'day'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              <Sun size={14} className="inline mr-1" />
              Day
            </button>
            <button
              onClick={() => onSetDayNight(dayNight === 'night' ? null : 'night')}
              className={`flex-1 py-1.5 rounded text-sm font-medium transition ${
                dayNight === 'night'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              <Moon size={14} className="inline mr-1" />
              Night
            </button>
          </div>
          
          {/* Day/Night Abilities Reference */}
          {dayNight && (
            <div className="mt-2 text-white/40 text-xs">
              <div className="font-medium mb-1">
                {dayNight === 'day' ? 'Day Abilities:' : 'Night Abilities:'}
              </div>
              <div className="space-y-1">
                {DAY_NIGHT_ABILITIES[dayNight].slice(0, 2).map((ability, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span className="text-white/60">•</span>
                    <span className="truncate">{ability}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* City's Blessing */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={18} className="text-emerald-400" />
            <span className="text-white/80 text-sm font-medium">City's Blessing</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {players.filter(p => !p.isEliminated).map(player => (
              <button
                key={player.id}
                onClick={() => onSetCitysBlessing(player.id, !player.citysBlessing)}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  player.citysBlessing
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
                title={player.citysBlessing ? 'Has City\'s Blessing' : 'No City\'s Blessing'}
              >
                {player.name.substring(0, 6)}
              </button>
            ))}
          </div>
        </div>

        {/* Additional Status Trackers */}
        <div className="bg-black/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={18} className="text-red-400" />
            <span className="text-white/80 text-sm font-medium">Special Status</span>
          </div>
          <div className="space-y-2">
            {players.filter(p => !p.isEliminated).map(player => (
              <div key={player.id} className="flex items-center justify-between">
                <span className="text-white/70 text-xs truncate">{player.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onSetPlayerStatus(player.id, 'phyrexianPoison', !player.hasPhyrexianPoison)}
                    className={`px-2 py-1 rounded text-xs transition ${
                      player.hasPhyrexianPoison
                        ? 'bg-red-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                    title={player.hasPhyrexianPoison ? 'Has Phyrexian Poison' : 'No Phyrexian Poison'}
                  >
                    P
                  </button>
                  <button
                    onClick={() => onSetPlayerStatus(player.id, 'transformed', !player.hasTransformed)}
                    className={`px-2 py-1 rounded text-xs transition ${
                      player.hasTransformed
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                    title={player.hasTransformed ? 'Transformed' : 'Not Transformed'}
                  >
                    T
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ring Progress - Per Player */}
      <div className="mt-4 bg-black/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Circle size={18} className="text-amber-400" />
          <span className="text-white/80 text-sm font-medium">The Ring Tempts You</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {players.filter(p => !p.isEliminated).map(player => (
            <div key={player.id} className="bg-white/5 rounded-lg p-2">
              <div className="text-white/70 text-xs mb-1 truncate">{player.name}</div>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(level => (
                  <button
                    key={level}
                    onClick={() => onSetRingProgress(player.id, level + 1 === player.ringProgress ? level : level + 1)}
                    className={`w-6 h-6 rounded-full text-xs font-bold transition ${
                      level < (player.ringProgress || 0)
                        ? 'bg-amber-600 text-white'
                        : 'bg-white/10 text-white/40 hover:bg-white/20'
                    }`}
                    title={RING_ABILITIES[level]}
                  >
                    {level + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Ring Ability Reference */}
        <div className="mt-2 text-white/40 text-xs">
          <div className="grid grid-cols-2 gap-1">
            {RING_ABILITIES.map((ability, index) => (
              <div key={index} className="flex gap-1">
                <span className="text-amber-400">{index + 1}.</span>
                <span className="truncate" title={ability}>{ability}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameMechanics;
