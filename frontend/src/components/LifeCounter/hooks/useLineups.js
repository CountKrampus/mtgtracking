import { useState, useCallback } from 'react';

const LINEUPS_KEY = 'mtg-life-counter-lineups';
const MAX_LINEUPS = 8;

function readLineups() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LINEUPS_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Auto-name a lineup from its player names, e.g. "Alice & Bob +2",
// falling back to a size-based name when everything is still "Player N".
export function makeLineupName(names, playerCount) {
  const real = (names || [])
    .slice(0, playerCount)
    .map(n => (n || '').trim())
    .filter(n => n && !/^Player \d+$/.test(n));
  if (real.length === 0) return `Pod of ${playerCount}`;
  const head = real.slice(0, 2).join(' & ');
  const extra = real.length > 2 ? ` +${real.length - 2}` : '';
  return `${head}${extra}`.slice(0, 40);
}

/**
 * Saved player lineups (names, colors, backgrounds) so a recurring pod can
 * be reloaded with one tap instead of re-typing every name.
 */
function useLineups() {
  const [lineups, setLineups] = useState(readLineups);

  const persist = useCallback((next) => {
    setLineups(next);
    try {
      localStorage.setItem(LINEUPS_KEY, JSON.stringify(next));
    } catch {
      // storage full or blocked — keep the in-memory list for this session
    }
  }, []);

  const saveLineup = useCallback(({ names, colors, backgrounds, playerCount }) => {
    const lineup = {
      id: Date.now() + Math.random(),
      name: makeLineupName(names, playerCount),
      playerCount,
      names: Array.from({ length: 6 }, (_, i) => (names && names[i]) || `Player ${i + 1}`),
      colors: Array.from({ length: 6 }, (_, i) => (colors && colors[i]) || null),
      backgrounds: Array.from({ length: 6 }, (_, i) => (backgrounds && backgrounds[i]) || ''),
      savedAt: Date.now()
    };
    // Read through (not from state) so a save after an external change can't
    // clobber entries written since mount.
    const next = [...readLineups(), lineup].slice(-MAX_LINEUPS);
    persist(next);
    return lineup;
  }, [persist]);

  const deleteLineup = useCallback((id) => {
    persist(readLineups().filter(l => l.id !== id));
  }, [persist]);

  return { lineups, saveLineup, deleteLineup };
}

export default useLineups;
