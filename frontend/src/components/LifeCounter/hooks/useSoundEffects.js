import { useCallback, useRef, useState, useMemo } from 'react';

/**
 * Hook for managing sound effects using the Web Audio API
 * @param {boolean} externalEnabled - Optional external control for enabled state
 * @param {number} externalVolume - Optional external control for volume (0-1)
 */
function useSoundEffects(externalEnabled, externalVolume) {
  const [internalEnabled, setEnabled] = useState(true);
  const [internalVolume, setInternalVolume] = useState(0.5);
  const audioContextRef = useRef(null);

  // Use external values if provided
  const enabled = externalEnabled !== undefined ? externalEnabled : internalEnabled;
  const volume = externalVolume !== undefined ? externalVolume : internalVolume;

  // Initialize audio context
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play a simple tone
  const playTone = useCallback((frequency, duration = 0.1, type = 'sine') => {
    if (!enabled) return;

    try {
      const ctx = getAudioContext();

      // Resume if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
      console.error('Sound effect error:', error);
    }
  }, [enabled, volume, getAudioContext]);

  // Pre-defined sound effects - memoized to prevent re-renders
  const sounds = useMemo(() => ({
    // Life gain - pleasant ascending tone
    lifeGain: () => {
      playTone(523, 0.1, 'sine'); // C5
      setTimeout(() => playTone(659, 0.15, 'sine'), 50); // E5
    },

    // Life loss - descending tone
    lifeLoss: () => {
      playTone(392, 0.1, 'sine'); // G4
      setTimeout(() => playTone(330, 0.15, 'sine'), 50); // E4
    },

    // Damage - harsh sound
    damage: () => {
      playTone(220, 0.15, 'sawtooth'); // A3
    },

    // Poison - eerie sound
    poison: () => {
      playTone(185, 0.2, 'triangle'); // F#3
    },

    // Elimination - dramatic
    elimination: () => {
      playTone(130, 0.3, 'sawtooth'); // C3
      setTimeout(() => playTone(98, 0.4, 'sawtooth'), 150); // G2
    },

    // Turn change - bell-like
    turnChange: () => {
      playTone(880, 0.15, 'sine'); // A5
    },

    // Dice roll - multiple clicks
    diceRoll: () => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => playTone(800 + Math.random() * 400, 0.03, 'square'), i * 30);
      }
    },

    // Click - simple feedback
    click: () => {
      playTone(1000, 0.02, 'square');
    },

    // Success - happy sound
    success: () => {
      playTone(523, 0.1, 'sine'); // C5
      setTimeout(() => playTone(659, 0.1, 'sine'), 75); // E5
      setTimeout(() => playTone(784, 0.15, 'sine'), 150); // G5
    },

    // Warning - attention sound
    warning: () => {
      playTone(440, 0.1, 'square'); // A4
      setTimeout(() => playTone(440, 0.1, 'square'), 150);
    },

    // Timer tick
    tick: () => {
      playTone(1200, 0.02, 'sine');
    },

    // Timer warning (low time)
    timerWarning: () => {
      playTone(880, 0.05, 'square');
      setTimeout(() => playTone(880, 0.05, 'square'), 100);
    }
  }), [playTone]);

  // Toggle sound effects
  const toggle = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  // Set volume (0-1)
  const setVol = useCallback((v) => {
    setInternalVolume(Math.max(0, Math.min(1, v)));
  }, []);

  // Play sound by name - convenience function
  const playSound = useCallback((soundName) => {
    if (!enabled) return;

    const soundFn = sounds[soundName];
    if (soundFn && typeof soundFn === 'function') {
      soundFn();
    } else {
      console.warn(`Unknown sound: ${soundName}`);
    }
  }, [enabled, sounds]);

  return {
    enabled,
    volume,
    toggle,
    setEnabled,
    setVolume: setVol,
    sounds,
    playTone,
    playSound
  };
}

export default useSoundEffects;
