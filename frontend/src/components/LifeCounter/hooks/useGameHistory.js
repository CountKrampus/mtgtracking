import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY_SIZE = 50;

/**
 * Hook for managing undo/redo history stack
 * @param {any} initialState - The initial state to track
 * @returns {Object} - { state, setState, undo, redo, canUndo, canRedo, clearHistory }
 */
function useGameHistory(initialState) {
  const [state, setStateInternal] = useState(initialState);
  const historyRef = useRef([initialState]);
  const currentIndexRef = useRef(0);

  // Synchronous mirror of `state`. Two reasons:
  //  1. Functional updates resolved in the same tick (two dispatches in one
  //     handler) previously resolved against the LAST RENDER's state, so the
  //     first action could be silently overwritten by the second.
  //  2. It lets setState/undo/redo have stable identities ([] deps) instead
  //     of changing every render, which downstream memoized components rely
  //     on to skip re-renders.
  const stateRef = useRef(initialState);

  // Set state and add to history
  const setState = useCallback((newState) => {
    const resolvedState = typeof newState === 'function' ? newState(stateRef.current) : newState;

    // If we're not at the end of history, truncate future states
    if (currentIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1);
    }

    // Add new state to history
    historyRef.current.push(resolvedState);

    // Trim history if it exceeds max size
    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY_SIZE);
    }
    currentIndexRef.current = historyRef.current.length - 1;

    stateRef.current = resolvedState;
    setStateInternal(resolvedState);
  }, []);

  // Undo to previous state
  const undo = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current -= 1;
      const previousState = historyRef.current[currentIndexRef.current];
      stateRef.current = previousState;
      setStateInternal(previousState);
      return previousState;
    }
    return stateRef.current;
  }, []);

  // Redo to next state
  const redo = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current += 1;
      const nextState = historyRef.current[currentIndexRef.current];
      stateRef.current = nextState;
      setStateInternal(nextState);
      return nextState;
    }
    return stateRef.current;
  }, []);

  // Check if undo is available (refs are mutated before setState, so these
  // are correct on the render that follows any history change)
  const canUndo = currentIndexRef.current > 0;
  const canRedo = currentIndexRef.current < historyRef.current.length - 1;

  // Clear history and reset to current state
  const clearHistory = useCallback(() => {
    historyRef.current = [stateRef.current];
    currentIndexRef.current = 0;
  }, []);

  // Reset history with new initial state
  const resetHistory = useCallback((newInitialState) => {
    historyRef.current = [newInitialState];
    currentIndexRef.current = 0;
    stateRef.current = newInitialState;
    setStateInternal(newInitialState);
  }, []);

  // Get current history info
  const getHistoryInfo = useCallback(() => ({
    currentIndex: currentIndexRef.current,
    historyLength: historyRef.current.length,
    canUndo: currentIndexRef.current > 0,
    canRedo: currentIndexRef.current < historyRef.current.length - 1
  }), []);

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    resetHistory,
    getHistoryInfo
  };
}

export default useGameHistory;
