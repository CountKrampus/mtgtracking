import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import useGameState from './hooks/useGameState';
import useTurnTracking from './hooks/useTurnTracking';
import useFullscreen from './hooks/useFullscreen';
import useSoundEffects from './hooks/useSoundEffects';
import useBackendSync from './hooks/useBackendSync';
import { LogCreators } from './GameLog';

const STORAGE_KEY = 'mtg-life-counter';
const SAVE_EXPIRY_HOURS = 24;

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
  const [settings, setSettings] = useState({
    soundEnabled: true,
    soundVolume: 0.5,
    autoMonarch: false,
    timerMinutes: 10,
    theme: 'dark'
  });

  // Refs
  const gameEndedRef = useRef(false);

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
    changePoison,
    changeCommanderDamage,
    changeCounter,
    changeMana,
    updatePlayer,
    resetGame,
    setRingProgress,
    setCitysBlessing,
    undo,
    redo,
    canUndo,
    canRedo,
    initializePlayers,
    loadGameState
  } = useGameState('commander');

  // Use turn tracking hook
  const {
    currentPlayerIndex,
    turnNumber,
    stormCount,
    currentPhase,
    nextTurn,
    previousTurn,
    setCurrentPlayer,
    incrementStorm,
    decrementStorm,
    resetStorm,
    resetTurnTracking,
    nextTurnSkipEliminated,
    advancePhase,
    setPhase
  } = useTurnTracking(playerCount);

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

  // Auto-save game state
  useEffect(() => {
    if (gamePhase === 'game' && players.length > 0) {
      const saveData = {
        players,
        gameFormat,
        playerCount,
        turnNumber,
        currentPlayerIndex,
        stormCount,
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    }
  }, [players, gameFormat, playerCount, gamePhase, turnNumber, currentPlayerIndex, stormCount]);

  // Add log entry helper
  const addLogEntry = useCallback((entry) => {
    setGameLog(prev => [...prev, { ...entry, id: Date.now() }]);
  }, []);

  // Handle starting a new game
  const handleStartGame = useCallback(() => {
    initializePlayers(playerCount, playerNames, setupGameFormat);
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
  }, [playerCount, playerNames, setupGameFormat, initializePlayers, resetTurnTracking, settings.soundEnabled, playSound]);

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

  // Handle life change
  const handleLifeChange = (playerId, amount) => {
    changeLife(playerId, amount);
    const player = players.find(p => p.id === playerId);
    if (player) {
      addLogEntry(LogCreators.lifeChange(player.name, player.life, player.life + amount));
    }
    if (settings.soundEnabled) {
      playSound(amount > 0 ? 'lifeGain' : 'lifeLoss');
    }
  };

  // Handle poison change
  const handlePoisonChange = (playerId, amount) => {
    changePoison(playerId, amount);
    const player = players.find(p => p.id === playerId);
    if (player) {
      addLogEntry(LogCreators.poison(player.name, player.poison + amount));
    }
    if (settings.soundEnabled) {
      playSound('poison');
    }
  };

  // Handle commander damage change
  const handleCommanderDamageChange = (targetPlayerId, sourcePlayerId, amount) => {
    changeCommanderDamage(targetPlayerId, sourcePlayerId, amount);
    const target = players.find(p => p.id === targetPlayerId);
    const source = players.find(p => p.id === sourcePlayerId);
    if (target && source) {
      const currentDamage = target.commanderDamage?.[sourcePlayerId] || 0;
      const newTotal = currentDamage + amount;
      addLogEntry(LogCreators.commanderDamage(target.name, source.name, amount, newTotal));
    }
    if (settings.soundEnabled) {
      playSound('damage');
    }
  };

  // Handle counters change
  const handleCountersChange = (playerId, counterType, amount) => {
    // Special handling for removal (-9999 signals removal)
    if (amount === -9999) {
      // For custom counters, we'll just set to 0 for now
      changeCounter(playerId, counterType, 0);
      const player = players.find(p => p.id === playerId);
      if (player) {
        addLogEntry(LogCreators.counterChange(player.name, counterType, 0, `Counter '${counterType}' removed`));
      }
      return;
    }

    // Normal counter change
    changeCounter(playerId, counterType, amount);
    const player = players.find(p => p.id === playerId);
    if (player) {
      const currentCount = player.counters?.[counterType] || 0;
      const newCount = Math.max(0, currentCount + amount); // Prevent negative counters
      addLogEntry(LogCreators.counterChange(player.name, counterType, newCount, `${amount > 0 ? '+' : ''}${amount}`));
    }
    if (settings.soundEnabled) {
      playSound(amount > 0 ? 'counterAdd' : 'counterRemove');
    }
  };

  // Handle mana change
  const handleManaChange = (playerId, color, amount) => {
    changeMana(playerId, color, amount);
    const player = players.find(p => p.id === playerId);
    if (player) {
      const currentMana = player.manaPool?.[color] || 0;
      const newMana = Math.max(0, currentMana + amount); // Prevent negative mana
      addLogEntry(LogCreators.manaChange(player.name, color, newMana, `${amount > 0 ? '+' : ''}${amount}`));
    }
    if (settings.soundEnabled) {
      playSound(amount > 0 ? 'manaAdd' : 'manaRemove');
    }
  };

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
    const startingLife = gameFormat === 'commander' ? 40 : 20;
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
      players: sortedPlayers.map((p, idx) => ({
        name: p.name,
        finalLife: p.life,
        isWinner: winner === p.id,
        placement: idx + 1
      })),
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
  }, [players, gameFormat, turnNumber, gameLog, gameStartTime, saveGame, addLogEntry, settings.soundEnabled, playSound]);

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
  }, [players, nextTurnSkipEliminated, currentPlayerIndex, turnNumber, addLogEntry, settings.soundEnabled, playSound]);

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
          setGameFormat={setSetupGameFormat}
          playerCount={playerCount}
          setPlayerCount={setPlayerCount}
          playerNames={playerNames}
          setPlayerNames={setPlayerNames}
          playerColors={playerColors}
          setPlayerColors={setPlayerColors}
          playerBackgrounds={playerBackgrounds}
          setPlayerBackgrounds={setPlayerBackgrounds}
          onStartGame={handleStartGame}
        />
      </div>
    );
  }

  // Use landscape layout for 2 players if enabled
  if (useLandscapeLayout && playerCount === 2 && players.length === 2) {
    return (
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
    );
  }

  // Game screen
  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button
          onClick={onBack}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back
        </button>

        {/* Undo/Redo Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition flex items-center gap-1 ${
              canUndo
                ? 'bg-blue-600/80 hover:bg-blue-600 text-white'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-2 rounded-lg transition flex items-center gap-1 ${
              canRedo
                ? 'bg-blue-600/80 hover:bg-blue-600 text-white'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
        </div>

        {/* Tool Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowToolsPanel(true)}
            className="p-2 bg-orange-600/80 hover:bg-orange-600 text-white rounded-lg transition"
            title="Tools (Dice, Timer, Log)"
          >
            <Wrench size={16} />
          </button>
          <button
            onClick={() => setShowTriggerReminders(true)}
            className="p-2 bg-yellow-600/80 hover:bg-yellow-600 text-white rounded-lg transition"
            title="Trigger Reminders"
          >
            <Bell size={16} />
          </button>
          <button
            onClick={() => setShowSettingsPanel(true)}
            className="p-2 bg-gray-600/80 hover:bg-gray-600 text-white rounded-lg transition"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          {fullscreenSupported && (
            <button
              onClick={toggleFullscreen}
              className={`p-2 rounded-lg transition ${
                isFullscreen ? 'bg-green-600/80 hover:bg-green-600' : 'bg-white/10 hover:bg-white/20'
              } text-white`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <Maximize size={16} />
            </button>
          )}
          {playerCount === 2 && (
            <button
              onClick={() => setUseLandscapeLayout(true)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
              title="Landscape Layout"
            >
              <Users size={16} />
            </button>
          )}
        </div>

        <div className="text-white/60 text-sm hidden md:block">
          {gameFormat === 'commander' ? 'Commander' : 'Standard'} -
          {' '}{players.filter(p => !p.isEliminated).length}/{playerCount} players
        </div>

        {/* Game Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowGameHistory(true)}
            className="p-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg transition"
            title="Game History"
          >
            <History size={16} />
          </button>
          <button
            onClick={() => setShowStatsDashboard(true)}
            className="p-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition"
            title="Statistics"
          >
            <BarChart3 size={16} />
          </button>
          <button
            onClick={() => setShowShareGame(true)}
            className="p-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg transition"
            title="Share Game"
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={() => setShowEndGameModal(true)}
            className="p-2 bg-yellow-600/80 hover:bg-yellow-600 text-white rounded-lg transition"
            title="End Game"
          >
            <Trophy size={16} />
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition"
            title="Reset Game"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Turn Tracker Toggle */}
      <button
        onClick={() => setShowTurnTracker(!showTurnTracker)}
        className="w-full mb-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 text-sm flex items-center justify-center gap-1 transition"
      >
        {showTurnTracker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        Turn Tracker
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
          onIncrementStorm={incrementStorm}
          onDecrementStorm={decrementStorm}
          onResetStorm={resetStorm}
          currentPhase={currentPhase}
          onAdvancePhase={handleAdvancePhase}
          onSetPhase={handleSetPhase}
          compact={playerCount > 4}
        />
      )}

      {/* Game Mechanics Toggle */}
      <button
        onClick={() => setShowGameMechanics(!showGameMechanics)}
        className="w-full mb-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 text-sm flex items-center justify-center gap-1 transition"
      >
        {showGameMechanics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <Sparkles size={14} />
        Game Mechanics
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
      <div className={`grid ${getGridClasses()} gap-4`}>
        {players.map((player, index) => (
          <PlayerCard
            key={player.id}
            player={player}
            gameFormat={gameFormat}
            players={players}
            onLifeChange={(amount) => handleLifeChange(player.id, amount)}
            onPoisonChange={(amount) => handlePoisonChange(player.id, amount)}
            onCommanderDamageClick={() => setCommanderDamageModal(player.id)}
            onCountersChange={(playerId, counterType, amount) => handleCountersChange(playerId, counterType, amount)}
            onManaChange={(playerId, color, amount) => handleManaChange(playerId, color, amount)}
            onCommanderDamageChange={(targetPlayerId, sourcePlayerId, amount) => handleCommanderDamageChange(targetPlayerId, sourcePlayerId, amount)}
            compact={playerCount > 4}
            isCurrentPlayer={index === currentPlayerIndex}
            isMonarch={monarch === player.id}
            hasInitiative={initiative === player.id}
            backgroundImage={playerBackgrounds[index] || null}
          />
        ))}
      </div>

      {/* Commander Damage Modal */}
      {commanderDamageModal !== null && (
        <CommanderDamage
          player={players.find(p => p.id === commanderDamageModal)}
          allPlayers={players}
          onDamageChange={handleCommanderDamageChange}
          onClose={() => setCommanderDamageModal(null)}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/20">
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
      )}

      {/* End Game Modal */}
      {showEndGameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-white/20">
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
  );
}

export default LifeCounter;
