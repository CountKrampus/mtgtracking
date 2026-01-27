import { useState, useCallback } from 'react';

// MTG game phases in order
const GAME_PHASES = ['upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];

/**
 * Hook for managing turn tracking state
 * @param {number} playerCount - Number of players in the game
 * @returns {Object} Turn tracking state and actions
 */
function useTurnTracking(playerCount = 4) {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [turnNumber, setTurnNumber] = useState(1);
  const [stormCount, setStormCount] = useState(0);
  const [passedPriority, setPassedPriority] = useState([]);
  const [currentPhase, setCurrentPhase] = useState('upkeep');
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Move to next player's turn
  const nextTurn = useCallback(() => {
    setCurrentPlayerIndex(prev => {
      const next = (prev + 1) % playerCount;
      // If we've gone back to player 0, increment turn number
      if (next === 0) {
        setTurnNumber(t => t + 1);
      }
      return next;
    });
    // Reset storm count at start of each turn
    setStormCount(0);
    setPassedPriority([]);
    // Reset phase to upkeep at start of new turn
    setPhaseIndex(0);
    setCurrentPhase('upkeep');
  }, [playerCount]);

  // Move to previous player (undo turn pass)
  const previousTurn = useCallback(() => {
    setCurrentPlayerIndex(prev => {
      const next = prev === 0 ? playerCount - 1 : prev - 1;
      // If we go back to the last player, decrement turn number
      if (prev === 0 && turnNumber > 1) {
        setTurnNumber(t => t - 1);
      }
      return next;
    });
    setPassedPriority([]);
  }, [playerCount, turnNumber]);

  // Set specific player as current
  const setCurrentPlayer = useCallback((index) => {
    if (index >= 0 && index < playerCount) {
      setCurrentPlayerIndex(index);
    }
  }, [playerCount]);

  // Increment storm count
  const incrementStorm = useCallback(() => {
    setStormCount(prev => prev + 1);
  }, []);

  // Decrement storm count
  const decrementStorm = useCallback(() => {
    setStormCount(prev => Math.max(0, prev - 1));
  }, []);

  // Reset storm count
  const resetStorm = useCallback(() => {
    setStormCount(0);
  }, []);

  // Mark player as having passed priority
  const passPriority = useCallback((playerIndex) => {
    setPassedPriority(prev => {
      if (!prev.includes(playerIndex)) {
        return [...prev, playerIndex];
      }
      return prev;
    });
  }, []);

  // Reset all priority passes
  const resetPriority = useCallback(() => {
    setPassedPriority([]);
  }, []);

  // Advance to next phase, returns the new phase name
  const advancePhase = useCallback(() => {
    const nextIndex = (phaseIndex + 1) % GAME_PHASES.length;
    setPhaseIndex(nextIndex);
    setCurrentPhase(GAME_PHASES[nextIndex]);
    return GAME_PHASES[nextIndex];
  }, [phaseIndex]);

  // Reset phase to upkeep (called at start of turn)
  const resetPhase = useCallback(() => {
    setPhaseIndex(0);
    setCurrentPhase('upkeep');
  }, []);

  // Set a specific phase directly
  const setPhase = useCallback((phase) => {
    const index = GAME_PHASES.indexOf(phase);
    if (index !== -1) {
      setPhaseIndex(index);
      setCurrentPhase(phase);
    }
  }, []);

  // Reset all turn tracking state
  const resetTurnTracking = useCallback(() => {
    setCurrentPlayerIndex(0);
    setTurnNumber(1);
    setStormCount(0);
    setPassedPriority([]);
    setPhaseIndex(0);
    setCurrentPhase('upkeep');
  }, []);

  // Skip eliminated players when advancing turns
  const nextTurnSkipEliminated = useCallback((eliminatedIndices = []) => {
    setCurrentPlayerIndex(prev => {
      let next = (prev + 1) % playerCount;
      let attempts = 0;

      // Skip eliminated players
      while (eliminatedIndices.includes(next) && attempts < playerCount) {
        next = (next + 1) % playerCount;
        attempts++;
      }

      // Check if we completed a round
      if (next <= prev || attempts >= playerCount - 1) {
        setTurnNumber(t => t + 1);
      }

      return next;
    });
    setStormCount(0);
    setPassedPriority([]);
    // Reset phase to upkeep at start of new turn
    setPhaseIndex(0);
    setCurrentPhase('upkeep');
  }, [playerCount]);

  return {
    // State
    currentPlayerIndex,
    turnNumber,
    stormCount,
    passedPriority,
    currentPhase,

    // Actions
    nextTurn,
    previousTurn,
    setCurrentPlayer,
    incrementStorm,
    decrementStorm,
    resetStorm,
    passPriority,
    resetPriority,
    resetTurnTracking,
    nextTurnSkipEliminated,
    advancePhase,
    resetPhase,
    setPhase,

    // Computed
    allPassedPriority: passedPriority.length >= playerCount,

    // Constants
    GAME_PHASES
  };
}

export default useTurnTracking;
