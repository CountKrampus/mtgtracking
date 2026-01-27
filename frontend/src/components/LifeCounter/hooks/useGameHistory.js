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

  // Set state and add to history
  const setState = useCallback((newState) => {
    const resolvedState = typeof newState === 'function' ? newState(state) : newState;

    // If we're not at the end of history, truncate future states
    if (currentIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, currentIndexRef.current + 1);
    }

    // Add new state to history
    historyRef.current.push(resolvedState);

    // Trim history if it exceeds max size
    if (historyRef.current.length > MAX_HISTORY_SIZE) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY_SIZE);
      currentIndexRef.current = historyRef.current.length - 1;
    } else {
      currentIndexRef.current = historyRef.current.length - 1;
    }

    setStateInternal(resolvedState);
  }, [state]);

  // Undo to previous state
  const undo = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current -= 1;
      const previousState = historyRef.current[currentIndexRef.current];
      setStateInternal(previousState);
      return previousState;
    }
    return state;
  }, [state]);

  // Redo to next state
  const redo = useCallback(() => {
    if (currentIndexRef.current < historyRef.current.length - 1) {
      currentIndexRef.current += 1;
      const nextState = historyRef.current[currentIndexRef.current];
      setStateInternal(nextState);
      return nextState;
    }
    return state;
  }, [state]);

  // Check if undo is available
  const canUndo = currentIndexRef.current > 0;

  // Check if redo is available
  const canRedo = currentIndexRef.current < historyRef.current.length - 1;

  // Clear history and reset to current state
  const clearHistory = useCallback(() => {
    historyRef.current = [state];
    currentIndexRef.current = 0;
  }, [state]);

  // Reset history with new initial state
  const resetHistory = useCallback((newInitialState) => {
    historyRef.current = [newInitialState];
    currentIndexRef.current = 0;
    setStateInternal(newInitialState);
  }, []);

  // Get current history info
  const getHistoryInfo = useCallback(() => ({
    currentIndex: currentIndexRef.current,
    historyLength: historyRef.current.length,
    canUndo,
    canRedo
  }), [canUndo, canRedo]);

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
