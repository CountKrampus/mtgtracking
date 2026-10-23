import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, RotateCcw, Clock, Undo2, Redo2, ChevronDown, ChevronUp, Sparkles,
         Wrench, Settings, History, BarChart3, Share2, Users, Trophy, Maximize, Bell } from 'lucide-react';
import GameSetup from './GameSetup';
import PlayerCard from './PlayerCard';
import CommanderDamage from './CommanderDamage';
import TurnTracker from './TurnTracker';
import GameMechanics from './GameMechanics';
import ToolsPanel from './ToolsPanel';
import SettingsPanel from './SettingsPanel';
import PartnerDamage from './PartnerDamage';
import GameHistory from './GameHistory';
import StatsDashboard from './StatsDashboard';
import ShareGame from './ShareGame';
import TwoPlayerLandscape from './layouts/TwoPlayerLandscape';
import TriggerReminders from './TriggerReminders';
import Toast, { useToast } from './Toast';
import PlayersContext from './PlayersContext';
import useGameState from './hooks/useGameState';
import useTurnTracking from './hooks/useTurnTracking';
import useFullscreen from './hooks/useFullscreen';
import useSoundEffects from './hooks/useSoundEffects';
import useBackendSync from './hooks/useBackendSync';
import { LogCreators } from './GameLog';

const STORAGE_KEY = 'mtg-life-counter';
const SAVE_EXPIRY_HOURS = 24;
const SNAPSHOTS_KEY = 'mtg-life-counter-snapshots';
const MAX_SNAPSHOTS = 10;

// Storm count milestones that trigger a toast + log entry + sound
const STORM_MILESTONES = [5, 10, 15, 20, 25];

function loadSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY)) || [];
  } catch {
    return [];
  }
}

function LifeCounter({ onBack }) {
  const [gamePhase, setGamePhase] = useState('setup'); // 'setup' | 'game' | 'resume'
  const [playerCount, setPlayerCount] = useState(4);
  const [playerNames, setPlayerNames] = useState(
    Array.from({ length: 6 }, (_, i) => `Player ${i + 1}`)
  );
  const [playerColors, setPlayerColors] = useState([]);
  const [playerBackgrounds, setPlayerBackgrounds] = useState([]);
  const [commanderDamageModal, setCommanderDamageModal] = useState(null); // player id or null
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [savedGame, setSavedGame] = useState(null);
  const [setupGameFormat, setSetupGameFormat] = useState('commander');
  // Custom starting life + per-player handicaps (Game Setup screen)
  const [setupStartingLife, setSetupStartingLife] = useState(40);
  const [setupHandicaps, setSetupHandicaps] = useState(() => Array(6).fill(''));
  const [showTurnTracker, setShowTurnTracker] = useState(true);
  const [showGameMechanics, setShowGameMechanics] = useState(false);
  const [monarch, setMonarch] = useState(null); // player id or null
  const [initiative, setInitiative] = useState(null); // player id or null
  const [dayNight, setDayNight] = useState(null); // 'day' | 'night' | null

  // Phase 4, 5, 6 state
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showPartnerDamage, setShowPartnerDamage] = useState(null); // player id or null
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [showStatsDashboard, setShowStatsDashboard] = useState(false);
  const [showShareGame, setShowShareGame] = useState(false);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [partnerDamage, setPartnerDamage] = useState({}); // { playerId: { opponentId: { c1: n, c2: n } } }
  const [gameLog, setGameLog] = useState([]);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [useLandscapeLayout, setUseLandscapeLayout] = useState(false);
  const [showTriggerReminders, setShowTriggerReminders] = useState(false);
  const [snapshots, setSnapshots] = useState(loadSnapshots);
  const [settings, setSettings] = useState(() => {
    const defaults = {
      soundEnabled: true,
      soundVolume: 0.5,
      autoMonarch: false,
      timerMinutes: 10,
      theme: 'dark',
      hapticsEnabled: false,
      keepScreenAwake: false,
    };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('mtg-life-counter-settings') || '{}') };
    } catch {
      return defaults;
    }
  });

  // Refs
  const gameEndedRef = useRef(false);
  const playerDecksRef = useRef([]);

  // Hooks
  const { isFullscreen, toggleFullscreen, isSupported: fullscreenSupported } = useFullscreen();
  const { playSound } = useSoundEffects(settings.soundEnabled, settings.soundVolume);
  const { saveGame, loading: syncLoading } = useBackendSync();
  const { toasts, addToast, removeToast } = useToast();

  // Use the new game state hook with undo/redo
  const {
    players,
    gameFormat,
    changeLife,
    setLife,
    changePoison,
    changeCommanderDamage,
    changeCounter,
    removeCounter,
    changeMana,
    updatePlayer,
    resetGame,
    setRingProgress,
    setCitysBlessing,
    addPlaneswalker,
    changePlaneswalkerLoyalty,
    removePlaneswalker,
    undo,
    redo,
    canUndo,
    canRedo,
    initializePlayers,
    loadGameState,
    startingLife
  } = useGameState('commander');

  // Use turn tracking hook
  const {
    currentPlayerIndex,
    turnNumber,
    stormCount,
    currentPhase,
    previousTurn,
    setCurrentPlayer,
    incrementStorm,
    decrementStorm,
    resetStorm,
    resetTurnTracking,
    nextTurnSkipEliminated,
    advancePhase,
    setPhase,
    restoreTurnState
  } = useTurnTracking(playerCount);

  // Live mirrors of the values handlers read most often. Keeping them in
  // refs lets those handlers have stable identities (constant useCallback
  // deps), which is what allows React.memo(PlayerCard) to skip re-rendering
  // every card on every life change.
  const playersRef = useRef(players);
  playersRef.current = players;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    try {
      localStorage.setItem('mtg-life-counter-settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Could not save life counter settings:', error);
    }
  }, [settings]);

  const triggerHaptic = useCallback((pattern) => {
    if (!settingsRef.current.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }, []);

  const wakeLockRef = useRef(null);
  const wakeLockRequestRef = useRef(false);
  useEffect(() => {
    if (gamePhase !== 'game' || !settings.keepScreenAwake ||
      typeof navigator === 'undefined' || !navigator.wakeLock?.request) return undefined;
    let disposed = false;
    const acquireWakeLock = async () => {
      if (document.visibilityState !== 'visible' || wakeLockRef.current || wakeLockRequestRef.current) return;
      wakeLockRequestRef.current = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed) {
          await lock.release();
          return;
        }
        wakeLockRef.current = lock;
        lock.addEventListener('release', () => {
          if (wakeLockRef.current === lock) wakeLockRef.current = null;
        }, { once: true });
      } catch (error) {
        console.warn('Could not keep the screen awake:', error);
        addToast({
          type: 'warning',
          title: 'Screen wake lock unavailable',
          message: 'Could not keep the screen awake on this device.',
        });
      } finally {
        wakeLockRequestRef.current = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') acquireWakeLock();
    };
    acquireWakeLock();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(error => console.warn('Could not release screen wake lock:', error));
        wakeLockRef.current = null;
      }
    };
  }, [gamePhase, settings.keepScreenAwake, addToast]);

  // Check for saved game on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const savedAt = new Date(parsed.savedAt);
        const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceSave < SAVE_EXPIRY_HOURS) {
          setSavedGame(parsed);
          setGamePhase('resume');
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Auto-save game state — debounced so rapid life taps don't do a
  // synchronous localStorage write on every change, with a flush whenever the
  // tab is hidden/closed or the screen unmounts so no latest state is lost.
  const pendingSaveRef = useRef(null);
  const saveTimerRef = useRef(null);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pendingSaveRef.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingSaveRef.current));
      pendingSaveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (gamePhase !== 'game' || players.length === 0) return undefined;
    pendingSaveRef.current = {
      players,
      gameFormat,
      playerCount,
      turnNumber,
      currentPlayerIndex,
      stormCount,
      startingLife,
      savedAt: Date.now()
    };
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      flushSave();
    }, 400);
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [players, gameFormat, playerCount, gamePhase, turnNumber, currentPlayerIndex, stormCount, startingLife, flushSave]);

  // Flush pending auto-save on tab hide/close and on unmount (leaving the
  // game screen) so the resume prompt always sees the latest state.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', onHide);
      flushSave();
    };
  }, [flushSave]);

  // Add log entry helper
  const addLogEntry = useCallback((entry) => {
    // Preserve the unique id createLogEntry() already generates (Date.now() + Math.random());
    // overwriting it with a plain Date.now() caused key collisions whenever two entries were
    // logged within the same millisecond (e.g. a planeswalker loyalty change and its resulting
    // destruction, logged back-to-back in the same handler).
    setGameLog(prev => [...prev, { id: Date.now() + Math.random(), ...entry }]);
  }, []);

  const changeSetupFormat = useCallback((format) => {
    setSetupGameFormat(format);
    // Keep the starting-life field in step with the format's default until
    // the user overrides it
    setSetupStartingLife(format === 'commander' ? 40 : 20);
  }, []);

  // Handle starting a new game
  const handleStartGame = useCallback((playerDecks = []) => {
    playerDecksRef.current = playerDecks;
    initializePlayers(playerCount, playerNames, setupGameFormat, {
      startingLife: setupStartingLife,
      handicaps: setupHandicaps.map(v => {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
      })
    });
    resetTurnTracking();
    setGameStartTime(Date.now());
    setGameLog([LogCreators.gameStart(setupGameFormat, playerCount)]);
    setPartnerDamage({});
    setMonarch(null);
    setInitiative(null);
    setDayNight(null);
    gameEndedRef.current = false;
    setGamePhase('game');
    if (settings.soundEnabled) playSound('success');
  }, [playerCount, playerNames, setupGameFormat, setupStartingLife, setupHandicaps, initializePlayers, resetTurnTracking, settings.soundEnabled, playSound]);

  // Resume saved game
  const handleResume = () => {
    if (savedGame) {
      loadGameState(savedGame);
      setPlayerCount(savedGame.playerCount);
      setGamePhase('game');
      setSavedGame(null);
    }
  };

  // Start new game (discard saved)
  const handleNewGame = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedGame(null);
    setGamePhase('setup');
  };

  // Handle life change — stable identity: reads players/settings through
  // refs so memoized PlayerCards can skip re-renders on unrelated changes.
  const handleLifeChange = useCallback((playerId, amount) => {
    changeLife(playerId, amount);
    const player = playersRef.current.find(p => p.id === playerId);
    if (player) {
      addLogEntry(LogCreators.lifeChange(player.name, player.life, player.life + amount));
    }
    if (settingsRef.current.soundEnabled) {
      playSound(amount > 0 ? 'lifeGain' : 'lifeLoss');
    }
    triggerHaptic(8);
  }, [changeLife, addLogEntry, playSound, triggerHaptic]);

  // Set an exact life total from the direct entry pad on the life number
  const handleSetLife = useCallback((playerId, value) => {
    const player = playersRef.current.find(p => p.id === playerId);
    if (!player || player.life === value) return;
    setLife(playerId, value);
    addLogEntry(LogCreators.lifeChange(player.name, player.life, value));
    if (settingsRef.current.soundEnabled) {
      playSound(value > player.life ? 'lifeGain' : 'lifeLoss');
    }
    triggerHaptic(12);
  }, [setLife, addLogEntry, playSound, triggerHaptic]);

  const handleIncrementStorm = () => {
    const newCount = stormCount + 1;
    incrementStorm();
    if (STORM_MILESTONES.includes(newCount)) {
      addToast({
        type: 'warning',
        title: `⚡ Storm Count: ${newCount}!`,
        message: `${newCount} spells cast this turn — the storm is building.`,
        duration: 5000
      });
      addLogEntry(LogCreators.stormMilestone(newCount));
      if (settings.soundEnabled) {
        playSound('warning');
      }
    }
  };

  // Handle poison change
  const handlePoisonChange = useCallback((playerId, amount) => {
    changePoison(playerId, amount);
    const player = playersRef.current.find(p => p.id === playerId);
    if (player) {
      // Mirror the reducer's 0-10 clamp so the log can't print impossible
      // values (the old entry used the raw, unclamped sum)
      const newPoison = Math.max(0, Math.min(10, player.poison + amount));
      addLogEntry(LogCreators.poison(player.name, newPoison));
    }
    if (settingsRef.current.soundEnabled) {
      playSound('poison');
    }
    const nextPoison = player ? Math.max(0, Math.min(10, player.poison + amount)) : 0;
    triggerHaptic(nextPoison >= 9 ? [20, 35, 20] : 10);
  }, [changePoison, addLogEntry, playSound, triggerHaptic]);

  // Handle commander damage change
  const handleCommanderDamageChange = useCallback((targetPlayerId, sourcePlayerId, amount) => {
    changeCommanderDamage(targetPlayerId, sourcePlayerId, amount);
    const target = playersRef.current.find(p => p.id === targetPlayerId);
    const source = playersRef.current.find(p => p.id === sourcePlayerId);
    if (target && source) {
      const currentDamage = target.commanderDamage?.[sourcePlayerId] || 0;
      // Mirror the reducer's 0-floor clamp so the log can't print a negative
      // total, and report the life the reducer will land on (commander
      // damage is real damage — it reduces life too)
      const newTotal = Math.max(0, currentDamage + amount);
      const newLife = target.life - (newTotal - currentDamage);
      addLogEntry(LogCreators.commanderDamage(target.name, source.name, amount, newTotal, newLife));
    }
    if (settingsRef.current.soundEnabled) {
      playSound('damage');
    }
    triggerHaptic(14);
  }, [changeCommanderDamage, addLogEntry, playSound, triggerHaptic]);

  // Handle counters change
  const handleCountersChange = useCallback((playerId, counterType, amount) => {
    // Special handling for removal (-9999 signals removal)
    if (amount === -9999) {
      // Actually delete the counter. (The old code dispatched a +0 change,
      // which the reducer clamps — a no-op — so the counter never cleared
      // even though the log claimed it did.)
      removeCounter(playerId, counterType);
      const player = playersRef.current.find(p => p.id === playerId);
      if (player) {
        addLogEntry(LogCreators.counterChange(player.name, counterType, 0, `Counter '${counterType}' removed`));
      }
      return;
    }

    // Normal counter change
    changeCounter(playerId, counterType, amount);
    const player = playersRef.current.find(p => p.id === playerId);
    if (player) {
      const currentCount = player.counters?.[counterType] ?? player.counters?.custom?.[counterType] ?? 0;
      const newCount = Math.max(0, currentCount + amount); // Prevent negative counters
      addLogEntry(LogCreators.counterChange(player.name, counterType, newCount, `${amount > 0 ? '+' : ''}${amount}`));
    }
    if (settingsRef.current.soundEnabled) {
      playSound(amount > 0 ? 'counterAdd' : 'counterRemove');
    }
  }, [removeCounter, changeCounter, addLogEntry, playSound]);

  // Handle adding a planeswalker
  const handlePlaneswalkerAdd = useCallback((playerId, planeswalker) => {
    addPlaneswalker(playerId, planeswalker);
    const player = playersRef.current.find(p => p.id === playerId);
    if (player) {
      addLogEntry(LogCreators.planeswalkerAdded(player.name, planeswalker.name, planeswalker.loyalty));
    }
  }, [addPlaneswalker, addLogEntry]);

  // Handle planeswalker loyalty change (auto-destroys at 0 loyalty)
  const handlePlaneswalkerLoyaltyChange = useCallback((playerId, planeswalkerId, amount) => {
    const player = playersRef.current.find(p => p.id === playerId);
    const pw = player?.planeswalkers?.find(p => p.id === planeswalkerId);
    if (!player || !pw) return;

    const newLoyalty = pw.loyalty + amount;
    changePlaneswalkerLoyalty(playerId, planeswalkerId, amount);
    addLogEntry(LogCreators.planeswalkerLoyalty(player.name, pw.name, pw.loyalty, newLoyalty));
    if (settingsRef.current.soundEnabled) {
      playSound(amount > 0 ? 'lifeGain' : 'lifeLoss');
    }

    if (newLoyalty <= 0) {
      removePlaneswalker(playerId, planeswalkerId);
      addLogEntry(LogCreators.planeswalkerDied(player.name, pw.name));
      addToast({
        type: 'warning',
        title: `${pw.name} destroyed`,
        message: `${player.name}'s ${pw.name} was destroyed (loyalty reached 0).`,
        duration: 5000
      });
      if (settingsRef.current.soundEnabled) playSound('elimination');
    }
  }, [changePlaneswalkerLoyalty, removePlaneswalker, addLogEntry, addToast, playSound]);

  // Handle removing a planeswalker manually
  const handlePlaneswalkerRemove = useCallback((playerId, planeswalkerId) => {
    const player = playersRef.current.find(p => p.id === playerId);
    const pw = player?.planeswalkers?.find(p => p.id === planeswalkerId);
    removePlaneswalker(playerId, planeswalkerId);
    if (player && pw) {
      addLogEntry(LogCreators.planeswalkerRemoved(player.name, pw.name));
    }
  }, [removePlaneswalker, addLogEntry]);

  // Handle saving a manual game snapshot (checkpoint) — complements the
  // continuous single-slot auto-save with multiple named, restorable points.
  const handleSaveSnapshot = (label) => {
    const snapshot = {
      id: Date.now() + Math.random(),
      label: label || `Turn ${turnNumber}`,
      savedAt: Date.now(),
      players,
      gameFormat,
      playerCount,
      turnNumber,
      currentPlayerIndex,
      stormCount,
      startingLife,
    };
    setSnapshots(prev => {
      const next = [...prev, snapshot].slice(-MAX_SNAPSHOTS);
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
      return next;
    });
    addLogEntry(LogCreators.snapshotSaved(snapshot.label, turnNumber));
    if (settings.soundEnabled) playSound('success');
  };

  // Handle restoring a manual snapshot
  const handleRestoreSnapshot = (snapshot) => {
    loadGameState(snapshot);
    setPlayerCount(snapshot.playerCount);
    restoreTurnState({
      currentPlayerIndex: snapshot.currentPlayerIndex,
      turnNumber: snapshot.turnNumber,
      stormCount: snapshot.stormCount,
    });
    addLogEntry(LogCreators.snapshotRestored(snapshot.label, snapshot.turnNumber));
    if (settings.soundEnabled) playSound('success');
  };

  // Handle deleting a manual snapshot
  const handleDeleteSnapshot = (snapshotId) => {
    setSnapshots(prev => {
      const next = prev.filter(s => s.id !== snapshotId);
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Handle mana change
  const handleManaChange = useCallback((playerId, color, amount) => {
    changeMana(playerId, color, amount);
    const player = playersRef.current.find(p => p.id === playerId);
    if (player) {
      const currentMana = player.manaPool?.[color] || 0;
      const newMana = Math.max(0, currentMana + amount); // Prevent negative mana
      addLogEntry(LogCreators.manaChange(player.name, color, newMana, `${amount > 0 ? '+' : ''}${amount}`));
    }
    if (settingsRef.current.soundEnabled) {
      playSound(amount > 0 ? 'manaAdd' : 'manaRemove');
    }
  }, [changeMana, addLogEntry, playSound]);

  // Handle player status change
  const handleSetPlayerStatus = (playerId, statusType, value) => {
    const player = players.find(p => p.id === playerId);
    if (player) {
      let updateObj = {};
      
      switch (statusType) {
        case 'phyrexianPoison':
          updateObj = { hasPhyrexianPoison: value };
          break;
        case 'transformed':
          updateObj = { hasTransformed: value };
          break;
        case 'daybound':
          updateObj = { hasDaybound: value };
          break;
        case 'nightbound':
          updateObj = { hasNightbound: value };
          break;
        case 'hexproof':
          updateObj = { hasHexproof: value };
          break;
        case 'shroud':
          updateObj = { hasShroud: value };
          break;
        case 'protection':
          updateObj = { hasProtection: value };
          break;
        case 'vigilance':
          updateObj = { hasVigilance: value };
          break;
        case 'doubleStrike':
          updateObj = { hasDoubleStrike: value };
          break;
        case 'trample':
          updateObj = { hasTrample: value };
          break;
        default:
          return;
      }
      
      updatePlayer(playerId, updateObj);
      
      addLogEntry({
        type: 'mechanic',
        message: `${player.name} ${value ? 'gained' : 'lost'} ${statusType.replace(/([A-Z])/g, ' $1').trim()} status`,
        timestamp: Date.now()
      });
    }
    if (settings.soundEnabled) {
      playSound(value ? 'statusGain' : 'statusLost');
    }
  };


  // Reset game
  const handleReset = () => {
    resetGame(startingLife);
    resetTurnTracking();
    setGameLog([LogCreators.gameStart(gameFormat, playerCount)]);
    setGameStartTime(Date.now());
    setPartnerDamage({});
    setMonarch(null);
    setInitiative(null);
    setDayNight(null);
    gameEndedRef.current = false;
    setShowResetConfirm(false);
    if (settings.soundEnabled) playSound('success');
  };

  // Handle ending the game and saving to backend
  const handleEndGame = useCallback(async (winner) => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;

    const duration = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;

    // Create placements based on life totals and elimination status
    const sortedPlayers = [...players].sort((a, b) => {
      if (a.isEliminated && !b.isEliminated) return 1;
      if (!a.isEliminated && b.isEliminated) return -1;
      return b.life - a.life;
    });

    const gameData = {
      startedAt: gameStartTime ? new Date(gameStartTime) : new Date(),
      endedAt: new Date(),
      players: sortedPlayers.map((p, idx) => {
        const slotIndex = playerNames.findIndex(name => name === p.name);
        const deckInfo = playerDecksRef.current[slotIndex >= 0 ? slotIndex : idx] || null;
        return {
          name: p.name,
          finalLife: p.life,
          isWinner: winner === p.id,
          placement: idx + 1,
          deckId: deckInfo?._id || null,
          commanderName: deckInfo?.commander?.name || ''
        };
      }),
      format: gameFormat,
      winner: winner ? players.find(p => p.id === winner)?.name : null,
      turns: turnNumber,
      duration,
      gameLog: gameLog.map(entry => `[${entry.type}] ${entry.message}`)
    };

    await saveGame(gameData);
    addLogEntry(LogCreators.gameEnd(winner ? players.find(p => p.id === winner)?.name : null));

    if (settings.soundEnabled) playSound('success');
    setShowEndGameModal(false);
  }, [players, gameFormat, turnNumber, gameLog, gameStartTime, saveGame, addLogEntry, settings.soundEnabled, playSound, playerNames]);

  // Handle partner damage change
  const handlePartnerDamageChange = useCallback((targetPlayerId, sourcePlayerId, partnerId, amount) => {
    setPartnerDamage(prev => {
      const target = prev[targetPlayerId] || {};
      const source = target[sourcePlayerId] || { c1: 0, c2: 0 };
      const newDamage = Math.max(0, (source[partnerId] || 0) + amount);

      return {
        ...prev,
        [targetPlayerId]: {
          ...target,
          [sourcePlayerId]: {
            ...source,
            [partnerId]: newDamage
          }
        }
      };
    });
    if (settings.soundEnabled) playSound(amount > 0 ? 'damage' : 'lifeGain');
  }, [settings.soundEnabled, playSound]);

  // Handle loading a shared game
  const handleLoadSharedGame = useCallback((gameData) => {
    if (gameData.players && gameData.format) {
      loadGameState({
        players: gameData.players,
        gameFormat: gameData.format,
        playerCount: gameData.players.length
      });
      setPlayerCount(gameData.players.length);
      setGamePhase('game');
      setGameStartTime(Date.now());
      setGameLog([LogCreators.gameStart(gameData.format, gameData.players.length)]);
      addLogEntry({ type: 'system', message: 'Loaded shared game' });
    }
  }, [loadGameState, addLogEntry]);

  // Handle next turn, skipping eliminated players
  const handleNextTurn = useCallback(() => {
    const eliminatedIndices = players
      .map((p, i) => p.isEliminated ? i : -1)
      .filter(i => i >= 0);
    nextTurnSkipEliminated(eliminatedIndices);

    // Find next active player for log
    let nextIndex = (currentPlayerIndex + 1) % players.length;
    while (eliminatedIndices.includes(nextIndex) && nextIndex !== currentPlayerIndex) {
      nextIndex = (nextIndex + 1) % players.length;
    }
    const nextPlayer = players[nextIndex];
    if (nextPlayer) {
      addLogEntry(LogCreators.turnChange(nextPlayer.name, turnNumber + 1));
    }

    if (settings.soundEnabled) {
      playSound('turnChange');
    }
    triggerHaptic([12, 25, 12]);

    // Fire upkeep triggers for the new turn (phase resets to upkeep automatically)
    // Use setTimeout to ensure phase state has updated
    setTimeout(() => {
      const triggerSystem = window.triggerReminders;
      if (!triggerSystem) return;

      const triggers = triggerSystem.getRemindersForPhase('upkeep');
      if (triggers && triggers.length > 0) {
        triggers.forEach(trigger => {
          if (trigger.playerId === 'all' || trigger.playerId === nextPlayer?.id) {
            // fireTrigger handles sound, voice, and toast via onTriggerFired callback
            triggerSystem.fireTrigger(trigger, nextPlayer?.name);
          }
        });
      }
    }, 100);
  }, [players, nextTurnSkipEliminated, currentPlayerIndex, turnNumber, addLogEntry, settings.soundEnabled, playSound, triggerHaptic]);

  // Handle undo with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gamePhase !== 'game') return;

      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gamePhase, canUndo, canRedo, undo, redo]);

  // Fire trigger reminders when phase changes
  const handlePhaseChange = useCallback((newPhase) => {
    if (gamePhase !== 'game') return;

    // Get triggers for this phase via window.triggerReminders
    const triggerSystem = window.triggerReminders;
    if (!triggerSystem) return;

    const triggers = triggerSystem.getRemindersForPhase(newPhase);
    const currentPlayer = players[currentPlayerIndex];

    if (triggers && triggers.length > 0) {
      triggers.forEach(trigger => {
        // Check player scope - fire if trigger is for all players or for current player
        if (trigger.playerId === 'all' || trigger.playerId === currentPlayer?.id) {
          // fireTrigger handles sound, voice, and toast via onTriggerFired callback
          triggerSystem.fireTrigger(trigger, currentPlayer?.name);
        }
      });
    }
  }, [gamePhase, players, currentPlayerIndex]);

  // Handle phase advance with trigger firing
  const handleAdvancePhase = useCallback(() => {
    const newPhase = advancePhase();
    handlePhaseChange(newPhase);
  }, [advancePhase, handlePhaseChange]);

  // Handle direct phase set with trigger firing
  const handleSetPhase = useCallback((phase) => {
    setPhase(phase);
    handlePhaseChange(phase);
  }, [setPhase, handlePhaseChange]);

  // Stable per-player callback set: identities depend only on the stable
  // handlers above, so React.memo(PlayerCard) can skip untouched cards on
  // every life change instead of re-rendering the whole grid.
  const playerCallbacks = useMemo(() => {
    const map = {};
    for (let id = 1; id <= 6; id++) {
      map[id] = {
        onLifeChange: (amount) => handleLifeChange(id, amount),
        onPoisonChange: (amount) => handlePoisonChange(id, amount),
        onSetLife: (value) => handleSetLife(id, value),
        onCommanderDamageClick: () => setCommanderDamageModal(id)
      };
    }
    return map;
  }, [handleLifeChange, handlePoisonChange, handleSetLife]);

  // Stable () => players[] getter for memoized children (commander damage
  // grid) — reading through the ref keeps its identity constant.
  const getPlayers = useCallback(() => playersRef.current, []);

  // Get grid classes based on player count
  const getGridClasses = () => {
    switch (playerCount) {
      case 2:
        return 'grid-cols-1 md:grid-cols-2';
      case 3:
        return 'grid-cols-1 md:grid-cols-3';
      case 4:
        return 'grid-cols-2';
      case 5:
      case 6:
        return 'grid-cols-2 md:grid-cols-3';
      default:
        return 'grid-cols-2';
    }
  };

  // Modals rendered by BOTH the landscape and grid layouts. The landscape
  // early-return previously rendered neither, so its CMD and Reset buttons
  // silently set state with no visible UI consuming it.
  const commanderDamageModalEl = commanderDamageModal !== null && (
    <CommanderDamage
      player={players.find(p => p.id === commanderDamageModal)}
      allPlayers={players}
      onDamageChange={handleCommanderDamageChange}
      onClose={() => setCommanderDamageModal(null)}
    />
  );

  const resetConfirmModalEl = showResetConfirm && (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 sm:max-w-sm w-full shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-white mb-4">Reset Game?</h3>
        <p className="text-white/60 mb-6">
          This will reset all life totals, poison counters, commander damage, and turn tracking.
          Player names will be preserved.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowResetConfirm(false)}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleReset}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold transition"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );

  // Resume prompt screen
  if (gamePhase === 'resume' && savedGame) {
    const savedAt = new Date(savedGame.savedAt);
    const activePlayers = savedGame.players.filter(p => !p.isEliminated).length;

    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-6 text-center flex items-center justify-center gap-2">
            <Clock size={28} /> Saved Game Found
          </h2>

          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <div className="text-white/60 text-sm mb-2">Game saved:</div>
            <div className="text-white font-semibold">
              {savedAt.toLocaleString()}
            </div>
            <div className="text-white/60 text-sm mt-3">
              {savedGame.gameFormat === 'commander' ? 'Commander' : 'Standard'} -
              {' '}{savedGame.playerCount} players ({activePlayers} active)
            </div>
            {savedGame.turnNumber && (
              <div className="text-white/60 text-sm mt-1">
                Turn {savedGame.turnNumber}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleResume}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg transition"
            >
              Resume Game
            </button>
            <button
              onClick={handleNewGame}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
            >
              Start New Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Setup screen
  if (gamePhase === 'setup') {
    return (
      <div>
        <button
          onClick={onBack}
          className="mb-6 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back to Collection
        </button>
        <GameSetup
          gameFormat={setupGameFormat}
          setGameFormat={changeSetupFormat}
          playerCount={playerCount}
          setPlayerCount={setPlayerCount}
          playerNames={playerNames}
          setPlayerNames={setPlayerNames}
          playerColors={playerColors}
          setPlayerColors={setPlayerColors}
          playerBackgrounds={playerBackgrounds}
          setPlayerBackgrounds={setPlayerBackgrounds}
          startingLife={setupStartingLife}
          setStartingLife={setSetupStartingLife}
          handicaps={setupHandicaps}
          setHandicaps={setSetupHandicaps}
          onStartGame={handleStartGame}
        />
      </div>
    );
  }

  // Use landscape layout for 2 players if enabled
  if (useLandscapeLayout && playerCount === 2 && players.length === 2) {
    return (
      <>
        <TwoPlayerLandscape
          players={players}
          gameFormat={gameFormat}
          onLifeChange={handleLifeChange}
          onPoisonChange={handlePoisonChange}
          onCommanderDamageClick={(playerId) => setCommanderDamageModal(playerId)}
          currentPlayerIndex={currentPlayerIndex}
          monarch={monarch}
          initiative={initiative}
          onBack={onBack}
          onReset={() => setShowResetConfirm(true)}
          onToggleLayout={() => setUseLandscapeLayout(false)}
        />
        {commanderDamageModalEl}
        {resetConfirmModalEl}
      </>
    );
  }

  // Game screen
  return (
    <PlayersContext.Provider value={players}>
    <div className="mx-auto max-w-screen-2xl space-y-4 pb-6">
      {/* Header */}
      <div className="sticky top-0 z-30 -mx-3 space-y-2 border-b border-white/10 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur-xl sm:static sm:mx-0 sm:space-y-0 sm:rounded-2xl sm:border sm:bg-slate-950/70 sm:p-3">
        <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-bold tracking-tight text-white">Life Counter</h1>
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
              {gameFormat === 'commander' ? 'EDH' : 'Standard'}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-white/50">
            Turn {turnNumber} <span className="px-1 text-white/20">·</span>
            {players.filter(p => !p.isEliminated).length}/{playerCount} active
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5" aria-label="History controls">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              canUndo ? 'text-white/75 hover:bg-white/10 hover:text-white' : 'cursor-not-allowed text-white/25'
            }`}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
              canRedo ? 'text-white/75 hover:bg-white/10 hover:text-white' : 'cursor-not-allowed text-white/25'
            }`}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 size={18} />
          </button>
        </div>
        </div>

        <div className="flex items-center justify-start gap-1 overflow-x-auto overscroll-x-contain pb-0.5 sm:gap-1.5" aria-label="Game and session actions">
          <button
            onClick={() => setShowToolsPanel(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-orange-200 transition hover:bg-orange-400/15 hover:text-orange-100"
            title="Tools (Dice, Timer, Log)"
            aria-label="Tools: dice, timer, and log"
          >
            <Wrench size={18} /><span>Tools</span>
          </button>
          <button
            onClick={() => setShowTriggerReminders(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-yellow-200 transition hover:bg-yellow-400/15 hover:text-yellow-100"
            title="Trigger Reminders"
            aria-label="Trigger reminders"
          >
            <Bell size={18} /><span>Triggers</span>
          </button>
          <button
            onClick={() => setShowSettingsPanel(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={18} /><span>Settings</span>
          </button>
          {fullscreenSupported && (
            <button
              onClick={toggleFullscreen}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium transition ${
                isFullscreen ? 'bg-emerald-400/15 text-emerald-200' : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <Maximize size={18} /><span>{isFullscreen ? 'Exit full' : 'Full screen'}</span>
            </button>
          )}
          {playerCount === 2 && (
            <button
              onClick={() => setUseLandscapeLayout(true)}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white"
              title="Landscape Layout"
              aria-label="Switch to two-player landscape layout"
            >
              <Users size={18} /><span>Layout</span>
            </button>
          )}

          <button
            onClick={() => setShowGameHistory(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15 hover:text-sky-100"
            title="Game History"
            aria-label="Game history"
          >
            <History size={18} /><span>History</span>
          </button>
          <button
            onClick={() => setShowStatsDashboard(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/15 hover:text-emerald-100"
            title="Statistics"
            aria-label="Statistics"
          >
            <BarChart3 size={18} /><span>Stats</span>
          </button>
          <button
            onClick={() => setShowShareGame(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-violet-200 transition hover:bg-violet-400/15 hover:text-violet-100"
            title="Share Game"
            aria-label="Share game"
          >
            <Share2 size={18} /><span>Share</span>
          </button>
          <button
            onClick={() => setShowEndGameModal(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-amber-200 transition hover:bg-amber-400/15 hover:text-amber-100"
            title="End Game"
            aria-label="End game"
          >
            <Trophy size={18} /><span>End</span>
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2 text-xs font-medium text-rose-200 transition hover:bg-rose-400/15 hover:text-rose-100"
            title="Reset Game"
            aria-label="Reset game"
          >
            <RotateCcw size={18} /><span>Reset</span>
          </button>
        </div>
      </div>

      {/* Turn Tracker Toggle */}
      <button
        onClick={() => setShowTurnTracker(!showTurnTracker)}
        className="flex min-h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/70 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
      >
        <span className="flex items-center gap-2"><Clock size={16} className="text-indigo-300" /> Turn Tracker</span>
        <span className="flex items-center gap-2 text-xs font-medium text-white/40">
          Turn {turnNumber}
          {showTurnTracker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Turn Tracker */}
      {showTurnTracker && (
        <TurnTracker
          currentPlayerIndex={currentPlayerIndex}
          turnNumber={turnNumber}
          stormCount={stormCount}
          players={players}
          onNextTurn={handleNextTurn}
          onPreviousTurn={previousTurn}
          onSetCurrentPlayer={setCurrentPlayer}
          onIncrementStorm={handleIncrementStorm}
          onDecrementStorm={decrementStorm}
          onResetStorm={resetStorm}
          currentPhase={currentPhase}
          onAdvancePhase={handleAdvancePhase}
          onSetPhase={handleSetPhase}
          compact
        />
      )}

      {/* Game Mechanics Toggle */}
      <button
        onClick={() => setShowGameMechanics(!showGameMechanics)}
        className="flex min-h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white/70 transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
      >
        <span className="flex items-center gap-2"><Sparkles size={15} className="text-fuchsia-300" /> Game Mechanics</span>
        {showGameMechanics ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      </button>

      {/* Game Mechanics Panel */}
      {showGameMechanics && (
        <GameMechanics
          players={players}
          monarch={monarch}
          initiative={initiative}
          dayNight={dayNight}
          onSetMonarch={setMonarch}
          onSetInitiative={setInitiative}
          onSetDayNight={setDayNight}
          onSetRingProgress={setRingProgress}
          onSetCitysBlessing={setCitysBlessing}
          onSetPlayerStatus={handleSetPlayerStatus}
          compact={playerCount > 4}
        />
      )}

      {/* Player Grid */}
      <div className={`grid ${getGridClasses()} gap-3 sm:gap-4`}>
        {players.map((player, index) => {
          const cb = playerCallbacks[player.id];
          return (
            <PlayerCard
              key={player.id}
              player={player}
              gameFormat={gameFormat}
              getPlayers={getPlayers}
              onLifeChange={cb.onLifeChange}
              onPoisonChange={cb.onPoisonChange}
              onCommanderDamageClick={cb.onCommanderDamageClick}
              onSetLife={cb.onSetLife}
              onCountersChange={handleCountersChange}
              onManaChange={handleManaChange}
              onCommanderDamageChange={handleCommanderDamageChange}
              onPlaneswalkerAdd={handlePlaneswalkerAdd}
              onPlaneswalkerLoyaltyChange={handlePlaneswalkerLoyaltyChange}
              onPlaneswalkerRemove={handlePlaneswalkerRemove}
              compact={playerCount > 4}
              isCurrentPlayer={index === currentPlayerIndex}
              isMonarch={monarch === player.id}
              hasInitiative={initiative === player.id}
              backgroundImage={playerBackgrounds[index] || null}
            />
          );
        })}
      </div>

      {/* Commander Damage Modal */}
      {commanderDamageModalEl}

      {/* Reset Confirmation Modal */}
      {resetConfirmModalEl}

      {/* End Game Modal */}
      {showEndGameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
          <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 sm:max-w-md w-full shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy size={24} className="text-yellow-400" />
              End Game
            </h3>
            <p className="text-white/60 mb-4">
              Select the winner to save the game to history, or end without a winner.
            </p>

            <div className="space-y-2 mb-4">
              {players.filter(p => !p.isEliminated).map(player => (
                <button
                  key={player.id}
                  onClick={() => handleEndGame(player.id)}
                  disabled={syncLoading}
                  className="w-full py-3 bg-yellow-600/80 hover:bg-yellow-600 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  <Trophy size={18} />
                  {player.name} Wins!
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEndGameModal(false)}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEndGame(null)}
                disabled={syncLoading}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-semibold transition"
              >
                No Winner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tools Panel */}
      {showToolsPanel && (
        <ToolsPanel
          isOpen={showToolsPanel}
          onClose={() => setShowToolsPanel(false)}
          players={players}
          currentPlayerIndex={currentPlayerIndex}
          gameLog={gameLog}
          onAddLog={addLogEntry}
          onLifeChange={handleLifeChange}
          snapshots={snapshots}
          onSaveSnapshot={handleSaveSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={handleDeleteSnapshot}
          soundEnabled={settings.soundEnabled}
          playSound={playSound}
        />
      )}

      {/* Settings Panel */}
      {showSettingsPanel && (
        <SettingsPanel
          isOpen={showSettingsPanel}
          onClose={() => setShowSettingsPanel(false)}
          settings={settings}
          onSettingsChange={setSettings}
          keepScreenAwakeSupported={typeof navigator !== 'undefined' && Boolean(navigator.wakeLock?.request)}
          hapticsSupported={typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          fullscreenSupported={fullscreenSupported}
        />
      )}

      {/* Trigger Reminders Modal */}
      <TriggerReminders
        isOpen={showTriggerReminders}
        onClose={() => setShowTriggerReminders(false)}
        players={players}
        currentPlayerIndex={currentPlayerIndex}
        onTriggerFired={(trigger) => {
          addToast({
            type: 'trigger',
            title: trigger.name,
            message: trigger.text || 'Reminder triggered',
            playerName: trigger.playerName,
            duration: 6000
          });
        }}
      />

      {/* Toast Notifications */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Partner Damage Modal */}
      {showPartnerDamage !== null && (
        <PartnerDamage
          player={players.find(p => p.id === showPartnerDamage)}
          allPlayers={players}
          partnerDamage={partnerDamage[showPartnerDamage] || {}}
          onPartnerDamageChange={handlePartnerDamageChange}
          onClose={() => setShowPartnerDamage(null)}
        />
      )}

      {/* Game History Modal */}
      <GameHistory
        isOpen={showGameHistory}
        onClose={() => setShowGameHistory(false)}
      />

      {/* Statistics Dashboard */}
      <StatsDashboard
        isOpen={showStatsDashboard}
        onClose={() => setShowStatsDashboard(false)}
      />

      {/* Share Game Modal */}
      <ShareGame
        isOpen={showShareGame}
        onClose={() => setShowShareGame(false)}
        gameState={{
          players,
          gameFormat,
          turnNumber,
          currentPlayerIndex,
          monarch,
          initiative,
          dayNight
        }}
        onLoadGame={handleLoadSharedGame}
      />
    </div>
    </PlayersContext.Provider>
  );
}

export default LifeCounter;
