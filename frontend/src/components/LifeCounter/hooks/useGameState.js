import { useCallback, useMemo } from 'react';
import useGameHistory from './useGameHistory';

// Action types
export const ACTIONS = {
  SET_LIFE: 'SET_LIFE',
  CHANGE_LIFE: 'CHANGE_LIFE',
  SET_POISON: 'SET_POISON',
  CHANGE_POISON: 'CHANGE_POISON',
  SET_COMMANDER_DAMAGE: 'SET_COMMANDER_DAMAGE',
  CHANGE_COMMANDER_DAMAGE: 'CHANGE_COMMANDER_DAMAGE',
  SET_COUNTER: 'SET_COUNTER',
  CHANGE_COUNTER: 'CHANGE_COUNTER',
  SET_MANA: 'SET_MANA',
  CHANGE_MANA: 'CHANGE_MANA',
  CLEAR_MANA_POOL: 'CLEAR_MANA_POOL',
  SET_RING_PROGRESS: 'SET_RING_PROGRESS',
  SET_CITYS_BLESSING: 'SET_CITYS_BLESSING',
  SET_PLAYER_COLOR: 'SET_PLAYER_COLOR',
  SET_ELIMINATED: 'SET_ELIMINATED',
  UPDATE_PLAYER: 'UPDATE_PLAYER',
  RESET_GAME: 'RESET_GAME',
  SET_PLAYERS: 'SET_PLAYERS'
};

// Default player state structure
export const createDefaultPlayer = (id, name, startingLife = 40, color = '#6366f1') => ({
  id,
  name,
  life: startingLife,
  poison: 0,
  commanderDamage: {},
  isEliminated: false,
  eliminationReason: null,
  // Enhanced state from Phase 1
  counters: {
    energy: 0,
    experience: 0,
    custom: {}
  },
  manaPool: {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0
  },
  ringProgress: 0, // 0-4 for Ring tempts you
  citysBlessing: false,
  color,
  timer: {
    remaining: 0,
    isRunning: false
  }
});

// Default player colors
export const PLAYER_COLORS = [
  { name: 'Purple', value: '#9333ea' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Orange', value: '#ea580c' }
];

// Reducer function for game state
function gameReducer(state, action) {
  const { players, gameFormat } = state;

  switch (action.type) {
    case ACTIONS.SET_PLAYERS:
      return { ...state, players: action.payload };

    case ACTIONS.CHANGE_LIFE: {
      const { playerId, amount } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId && !p.isEliminated) {
            const newLife = p.life + amount;
            return checkElimination({ ...p, life: newLife }, gameFormat);
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_LIFE: {
      const { playerId, value } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return checkElimination({ ...p, life: value }, gameFormat);
          }
          return p;
        })
      };
    }

    case ACTIONS.CHANGE_POISON: {
      const { playerId, amount } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId && !p.isEliminated) {
            const newPoison = Math.max(0, Math.min(10, p.poison + amount));
            return checkElimination({ ...p, poison: newPoison }, gameFormat);
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_POISON: {
      const { playerId, value } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            const newPoison = Math.max(0, Math.min(10, value));
            return checkElimination({ ...p, poison: newPoison }, gameFormat);
          }
          return p;
        })
      };
    }

    case ACTIONS.CHANGE_COMMANDER_DAMAGE: {
      const { targetPlayerId, sourcePlayerId, amount } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === targetPlayerId && !p.isEliminated) {
            const currentDamage = p.commanderDamage?.[sourcePlayerId] || 0;
            const newDamage = Math.max(0, currentDamage + amount);
            const updated = {
              ...p,
              commanderDamage: {
                ...p.commanderDamage,
                [sourcePlayerId]: newDamage
              }
            };
            return checkElimination(updated, gameFormat);
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_COMMANDER_DAMAGE: {
      const { targetPlayerId, sourcePlayerId, value } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === targetPlayerId) {
            const updated = {
              ...p,
              commanderDamage: {
                ...p.commanderDamage,
                [sourcePlayerId]: Math.max(0, value)
              }
            };
            return checkElimination(updated, gameFormat);
          }
          return p;
        })
      };
    }

    case ACTIONS.CHANGE_COUNTER: {
      const { playerId, counterType, amount } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            if (counterType === 'energy' || counterType === 'experience') {
              return {
                ...p,
                counters: {
                  ...p.counters,
                  [counterType]: Math.max(0, (p.counters?.[counterType] || 0) + amount)
                }
              };
            } else {
              // Custom counter
              return {
                ...p,
                counters: {
                  ...p.counters,
                  custom: {
                    ...p.counters?.custom,
                    [counterType]: Math.max(0, (p.counters?.custom?.[counterType] || 0) + amount)
                  }
                }
              };
            }
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_COUNTER: {
      const { playerId, counterType, value } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            if (counterType === 'energy' || counterType === 'experience') {
              return {
                ...p,
                counters: {
                  ...p.counters,
                  [counterType]: Math.max(0, value)
                }
              };
            } else {
              return {
                ...p,
                counters: {
                  ...p.counters,
                  custom: {
                    ...p.counters?.custom,
                    [counterType]: Math.max(0, value)
                  }
                }
              };
            }
          }
          return p;
        })
      };
    }

    case ACTIONS.CHANGE_MANA: {
      const { playerId, manaType, amount } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return {
              ...p,
              manaPool: {
                ...p.manaPool,
                [manaType]: Math.max(0, (p.manaPool?.[manaType] || 0) + amount)
              }
            };
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_MANA: {
      const { playerId, manaType, value } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return {
              ...p,
              manaPool: {
                ...p.manaPool,
                [manaType]: Math.max(0, value)
              }
            };
          }
          return p;
        })
      };
    }

    case ACTIONS.CLEAR_MANA_POOL: {
      const { playerId } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return {
              ...p,
              manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
            };
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_RING_PROGRESS: {
      const { playerId, value } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return { ...p, ringProgress: Math.max(0, Math.min(4, value)) };
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_CITYS_BLESSING: {
      const { playerId, value } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return { ...p, citysBlessing: value };
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_PLAYER_COLOR: {
      const { playerId, color } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return { ...p, color };
          }
          return p;
        })
      };
    }

    case ACTIONS.SET_ELIMINATED: {
      const { playerId, isEliminated, reason } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return { ...p, isEliminated, eliminationReason: reason };
          }
          return p;
        })
      };
    }

    case ACTIONS.UPDATE_PLAYER: {
      const { playerId, updates } = action.payload;
      return {
        ...state,
        players: players.map(p => {
          if (p.id === playerId) {
            return { ...p, ...updates };
          }
          return p;
        })
      };
    }

    case ACTIONS.RESET_GAME: {
      const { startingLife } = action.payload;
      return {
        ...state,
        players: players.map(p => ({
          ...p,
          life: startingLife,
          poison: 0,
          commanderDamage: {},
          isEliminated: false,
          eliminationReason: null,
          counters: { energy: 0, experience: 0, custom: {} },
          manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
          ringProgress: 0,
          citysBlessing: false
        }))
      };
    }

    default:
      return state;
  }
}

// Check for elimination conditions
function checkElimination(player, gameFormat) {
  if (player.isEliminated) return player;

  // Check life total
  if (player.life <= 0) {
    return { ...player, isEliminated: true, eliminationReason: 'life' };
  }

  // Check poison counters
  if (player.poison >= 10) {
    return { ...player, isEliminated: true, eliminationReason: 'poison' };
  }

  // Check commander damage (21 from any single commander)
  if (gameFormat === 'commander') {
    for (const damage of Object.values(player.commanderDamage || {})) {
      if (damage >= 21) {
        return { ...player, isEliminated: true, eliminationReason: 'commander' };
      }
    }
  }

  return player;
}

/**
 * Custom hook for managing game state with undo/redo capability
 */
function useGameState(initialGameFormat = 'commander') {
  const initialState = {
    players: [],
    gameFormat: initialGameFormat
  };

  const {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    resetHistory
  } = useGameHistory(initialState);

  // Dispatch action to update state
  const dispatch = useCallback((action) => {
    setState(currentState => gameReducer(currentState, action));
  }, [setState]);

  // Initialize players
  const initializePlayers = useCallback((playerCount, playerNames, gameFormat) => {
    const startingLife = gameFormat === 'commander' ? 40 : 20;
    const newPlayers = Array.from({ length: playerCount }, (_, i) =>
      createDefaultPlayer(
        i + 1,
        playerNames[i] || `Player ${i + 1}`,
        startingLife,
        PLAYER_COLORS[i % PLAYER_COLORS.length].value
      )
    );

    resetHistory({
      players: newPlayers,
      gameFormat
    });
  }, [resetHistory]);

  // Load saved game state
  const loadGameState = useCallback((savedState) => {
    // Ensure saved players have the new state structure
    const migratedPlayers = savedState.players.map(p => ({
      ...createDefaultPlayer(p.id, p.name, p.life),
      ...p,
      counters: p.counters || { energy: 0, experience: 0, custom: {} },
      manaPool: p.manaPool || { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      ringProgress: p.ringProgress || 0,
      citysBlessing: p.citysBlessing || false,
      color: p.color || PLAYER_COLORS[(p.id - 1) % PLAYER_COLORS.length].value
    }));

    resetHistory({
      players: migratedPlayers,
      gameFormat: savedState.gameFormat
    });
  }, [resetHistory]);

  // Convenience action creators
  const actions = useMemo(() => ({
    changeLife: (playerId, amount) => dispatch({
      type: ACTIONS.CHANGE_LIFE,
      payload: { playerId, amount }
    }),
    setLife: (playerId, value) => dispatch({
      type: ACTIONS.SET_LIFE,
      payload: { playerId, value }
    }),
    changePoison: (playerId, amount) => dispatch({
      type: ACTIONS.CHANGE_POISON,
      payload: { playerId, amount }
    }),
    setPoison: (playerId, value) => dispatch({
      type: ACTIONS.SET_POISON,
      payload: { playerId, value }
    }),
    changeCommanderDamage: (targetPlayerId, sourcePlayerId, amount) => dispatch({
      type: ACTIONS.CHANGE_COMMANDER_DAMAGE,
      payload: { targetPlayerId, sourcePlayerId, amount }
    }),
    setCommanderDamage: (targetPlayerId, sourcePlayerId, value) => dispatch({
      type: ACTIONS.SET_COMMANDER_DAMAGE,
      payload: { targetPlayerId, sourcePlayerId, value }
    }),
    changeCounter: (playerId, counterType, amount) => dispatch({
      type: ACTIONS.CHANGE_COUNTER,
      payload: { playerId, counterType, amount }
    }),
    setCounter: (playerId, counterType, value) => dispatch({
      type: ACTIONS.SET_COUNTER,
      payload: { playerId, counterType, value }
    }),
    changeMana: (playerId, manaType, amount) => dispatch({
      type: ACTIONS.CHANGE_MANA,
      payload: { playerId, manaType, amount }
    }),
    setMana: (playerId, manaType, value) => dispatch({
      type: ACTIONS.SET_MANA,
      payload: { playerId, manaType, value }
    }),
    clearManaPool: (playerId) => dispatch({
      type: ACTIONS.CLEAR_MANA_POOL,
      payload: { playerId }
    }),
    setRingProgress: (playerId, value) => dispatch({
      type: ACTIONS.SET_RING_PROGRESS,
      payload: { playerId, value }
    }),
    setCitysBlessing: (playerId, value) => dispatch({
      type: ACTIONS.SET_CITYS_BLESSING,
      payload: { playerId, value }
    }),
    setPlayerColor: (playerId, color) => dispatch({
      type: ACTIONS.SET_PLAYER_COLOR,
      payload: { playerId, color }
    }),
    setEliminated: (playerId, isEliminated, reason = null) => dispatch({
      type: ACTIONS.SET_ELIMINATED,
      payload: { playerId, isEliminated, reason }
    }),
    updatePlayer: (playerId, updates) => dispatch({
      type: ACTIONS.UPDATE_PLAYER,
      payload: { playerId, updates }
    }),
    resetGame: (startingLife) => dispatch({
      type: ACTIONS.RESET_GAME,
      payload: { startingLife }
    })
  }), [dispatch]);

  return {
    // State
    players: state.players,
    gameFormat: state.gameFormat,

    // Actions
    ...actions,
    dispatch,

    // History
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,

    // Initialization
    initializePlayers,
    loadGameState
  };
}

export default useGameState;
