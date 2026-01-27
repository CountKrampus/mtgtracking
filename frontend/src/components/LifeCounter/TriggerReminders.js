import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Bell, Volume2, VolumeX, Mic, Trash2, Clock } from 'lucide-react';

// Common trigger presets organized by phase
const TRIGGER_PRESETS = [
  // Upkeep triggers
  { name: 'Phyrexian Arena', phase: 'upkeep', text: 'Lose 1 life, draw a card', category: 'draw' },
  { name: 'Bitterblossom', phase: 'upkeep', text: 'Lose 1 life, create 1/1 Faerie Rogue', category: 'token' },
  { name: 'Mystic Remora', phase: 'upkeep', text: 'Pay cumulative upkeep or sacrifice', category: 'draw' },
  { name: 'Mana Vault', phase: 'upkeep', text: 'Untap and take 1 damage, or leave tapped', category: 'mana' },
  { name: 'Propaganda', phase: 'upkeep', text: 'Opponents pay 2 per attacking creature', category: 'tax' },
  { name: 'Ghostly Prison', phase: 'upkeep', text: 'Opponents pay 2 per attacking creature', category: 'tax' },
  { name: 'Carpet of Flowers', phase: 'upkeep', text: 'Add mana equal to opponent islands', category: 'mana' },
  { name: 'Stasis', phase: 'upkeep', text: 'Pay U or sacrifice Stasis', category: 'stax' },
  { name: 'Mana Crypt', phase: 'upkeep', text: 'Flip coin - take 3 damage on tails', category: 'mana' },
  { name: 'Dark Confidant', phase: 'upkeep', text: 'Reveal top card, lose life = CMC, add to hand', category: 'draw' },
  { name: "Luminarch Ascension", phase: 'upkeep', text: 'Check if you took damage - add counter if not', category: 'token' },
  { name: 'Awakening Zone', phase: 'upkeep', text: 'Create 0/1 Eldrazi Spawn token', category: 'token' },
  { name: 'From Beyond', phase: 'upkeep', text: 'Create 1/1 Eldrazi Scion token', category: 'token' },

  // Draw step triggers
  { name: 'Sylvan Library', phase: 'draw', text: 'Draw 2 extra, put back or pay 4 life each', category: 'draw' },
  { name: 'Consecrated Sphinx', phase: 'draw', text: 'Draw 2 when opponent draws', category: 'draw' },

  // Main phase triggers
  { name: 'Land Drop', phase: 'main', text: 'Play a land this turn', category: 'mana' },

  // Combat triggers
  { name: 'Attack Triggers', phase: 'combat', text: 'Check for attack triggers', category: 'combat' },
  { name: "Marisi's Twinclaws", phase: 'combat', text: 'Goad creatures when dealing combat damage', category: 'combat' },

  // End step triggers
  { name: 'Necropotence', phase: 'end', text: 'Add exiled cards to hand', category: 'draw' },
  { name: 'Discard to Hand Size', phase: 'end', text: 'Discard down to 7 cards', category: 'cleanup' },
  { name: 'Tendershoot Dryad', phase: 'end', text: 'Create 1/1 Saproling token (each upkeep actually)', category: 'token' },
  { name: "Yawgmoth's Bargain", phase: 'end', text: 'Pay 1 life to draw cards', category: 'draw' },
  { name: 'Graveyard Triggers', phase: 'end', text: 'Check for end step graveyard effects', category: 'graveyard' },
  { name: 'Purphoros Trigger', phase: 'end', text: 'Deal 2 damage when creatures enter', category: 'damage' },

  // Any phase (opponent triggers)
  { name: 'Rhystic Study', phase: 'any', text: 'Opponent casts a spell - pay 1 or draw', category: 'draw' },
  { name: 'Smothering Tithe', phase: 'any', text: 'Opponent draws - pay 2 or create Treasure', category: 'mana' },
  { name: 'Esper Sentinel', phase: 'any', text: 'First noncreature spell - pay X or draw', category: 'draw' },
  { name: "Thassa's Oracle", phase: 'any', text: 'Check devotion when entering', category: 'win' },
  { name: 'Dockside Extortionist', phase: 'any', text: 'Count opponent artifacts/enchantments', category: 'mana' },
  { name: "Opposition Agent", phase: 'any', text: 'Control opponents when they search', category: 'stax' },
  { name: 'Aven Mindcensor', phase: 'any', text: 'Opponents can only search top 4', category: 'stax' },
  { name: 'Notion Thief', phase: 'any', text: 'Draw instead of opponents', category: 'draw' },
  { name: 'Drannith Magistrate', phase: 'any', text: 'Opponents cant cast from outside hand', category: 'stax' }
];

const PHASE_COLORS = {
  upkeep: 'bg-yellow-600',
  draw: 'bg-blue-600',
  main: 'bg-green-600',
  main1: 'bg-green-600',
  main2: 'bg-green-600',
  combat: 'bg-red-600',
  end: 'bg-purple-600',
  any: 'bg-gray-600'
};

const PHASE_LABELS = {
  upkeep: 'Upkeep',
  draw: 'Draw',
  main: 'Main',
  main1: 'Main 1',
  main2: 'Main 2',
  combat: 'Combat',
  end: 'End Step',
  any: 'Any Phase'
};

function TriggerReminders({
  isOpen,
  onClose,
  players,
  currentPlayerIndex,
  onTriggerFired // callback when a trigger should show toast
}) {
  const [reminders, setReminders] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReminder, setNewReminder] = useState({
    name: '',
    phase: 'upkeep',
    text: '',
    playerId: 'all', // 'all' or specific player id
    recurring: true
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);

  // Load reminders from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mtg-trigger-reminders');
    if (saved) {
      try {
        setReminders(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load reminders:', e);
      }
    }

    const soundPref = localStorage.getItem('mtg-trigger-sound');
    if (soundPref !== null) setSoundEnabled(soundPref === 'true');

    const voicePref = localStorage.getItem('mtg-trigger-voice');
    if (voicePref !== null) setVoiceEnabled(voicePref === 'true');
  }, []);

  // Save reminders to localStorage
  useEffect(() => {
    localStorage.setItem('mtg-trigger-reminders', JSON.stringify(reminders));
  }, [reminders]);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('mtg-trigger-sound', soundEnabled.toString());
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('mtg-trigger-voice', voiceEnabled.toString());
  }, [voiceEnabled]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      // Filter to English voices and sort by name
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      setAvailableVoices(englishVoices.length > 0 ? englishVoices : voices);

      // Load saved voice preference
      const savedVoiceName = localStorage.getItem('mtg-trigger-voice-name');
      if (savedVoiceName) {
        const found = voices.find(v => v.name === savedVoiceName);
        if (found) setSelectedVoice(found);
      } else if (englishVoices.length > 0) {
        // Auto-select a good default (prefer female/natural sounding voices)
        const preferred = englishVoices.find(v =>
          v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Google UK English Female') ||
          v.name.includes('Microsoft Zira') ||
          v.name.includes('Female')
        ) || englishVoices[0];
        setSelectedVoice(preferred);
      }
    };

    loadVoices();
    // Voices may load async
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // Save selected voice
  useEffect(() => {
    if (selectedVoice) {
      localStorage.setItem('mtg-trigger-voice-name', selectedVoice.name);
    }
  }, [selectedVoice]);

  // Play sound effect
  const playSound = useCallback((type = 'trigger') => {
    if (!soundEnabled) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different sounds for different trigger types
      if (type === 'trigger') {
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
        oscillator.type = 'sine';
      } else if (type === 'warning') {
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.type = 'triangle';
      }

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.error('Sound playback failed:', e);
    }
  }, [soundEnabled]);

  // Voice readout
  const speakReminder = useCallback((text, playerName = null) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance();
    // Add "Reminder:" prefix and pause for clarity
    utterance.text = playerName
      ? `Reminder for ${playerName}. ${text}`
      : `Reminder. ${text}`;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1.0; // Full volume

    // Use selected voice if available
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled, selectedVoice]);

  // Add a new reminder
  const addReminder = () => {
    if (!newReminder.name.trim()) return;

    const reminder = {
      id: Date.now(),
      ...newReminder,
      enabled: true
    };

    setReminders([...reminders, reminder]);
    setNewReminder({
      name: '',
      phase: 'upkeep',
      text: '',
      playerId: 'all',
      recurring: true
    });
    setShowAddForm(false);
  };

  // Add from preset
  const addFromPreset = (preset) => {
    const reminder = {
      id: Date.now(),
      name: preset.name,
      phase: preset.phase,
      text: preset.text,
      playerId: 'all',
      recurring: true,
      enabled: true
    };

    setReminders([...reminders, reminder]);
    setShowPresets(false);
  };

  // Toggle reminder enabled state
  const toggleReminder = (id) => {
    setReminders(reminders.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    ));
  };

  // Delete a reminder
  const deleteReminder = (id) => {
    setReminders(reminders.filter(r => r.id !== id));
  };

  // Fire a trigger (for external use)
  const fireTrigger = useCallback((reminder, playerName = null) => {
    playSound('trigger');
    speakReminder(reminder.text || reminder.name, playerName);

    if (onTriggerFired) {
      onTriggerFired({
        ...reminder,
        playerName,
        timestamp: Date.now()
      });
    }
  }, [playSound, speakReminder, onTriggerFired]);

  // Get reminders for a specific phase
  const getRemindersForPhase = useCallback((phase) => {
    return reminders.filter(r => {
      if (!r.enabled) return false;
      if (r.phase === 'any') return true;
      if (r.phase === phase) return true;
      // Match 'main' triggers for both main1 and main2
      if (r.phase === 'main' && (phase === 'main1' || phase === 'main2')) return true;
      return false;
    });
  }, [reminders]);

  // Expose methods for parent component
  useEffect(() => {
    window.triggerReminders = {
      getRemindersForPhase,
      fireTrigger,
      playSound,
      speakReminder
    };

    return () => {
      delete window.triggerReminders;
    };
  }, [getRemindersForPhase, fireTrigger, playSound, speakReminder]);

  if (!isOpen) return null;

  const currentPlayer = players[currentPlayerIndex];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-white/20 max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell size={24} className="text-yellow-400" />
            Trigger Reminders
          </h3>
          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition ${
                soundEnabled ? 'bg-green-600/50 text-green-400' : 'bg-white/10 text-white/40'
              }`}
              title={soundEnabled ? 'Sound On' : 'Sound Off'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Voice Toggle */}
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-lg transition ${
                voiceEnabled ? 'bg-blue-600/50 text-blue-400' : 'bg-white/10 text-white/40'
              }`}
              title={voiceEnabled ? 'Voice On' : 'Voice Off'}
            >
              <Mic size={18} />
            </button>

            {/* Voice Selector Toggle */}
            {voiceEnabled && availableVoices.length > 0 && (
              <button
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-xs rounded-lg transition"
                title="Change Voice"
              >
                {selectedVoice?.name?.split(' ').slice(0, 2).join(' ') || 'Voice'}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <X size={20} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* Voice Selector */}
        {showVoiceSelector && voiceEnabled && availableVoices.length > 0 && (
          <div className="bg-blue-900/30 rounded-lg p-3 mb-4 border border-blue-500/30">
            <div className="text-blue-300 text-xs font-semibold mb-2">Select Voice</div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {availableVoices.map((voice, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedVoice(voice);
                    // Test the voice
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance('Trigger reminder active');
                    utterance.voice = voice;
                    utterance.rate = 0.9;
                    window.speechSynthesis.speak(utterance);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition ${
                    selectedVoice?.name === voice.name
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {voice.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowVoiceSelector(false)}
              className="mt-2 w-full py-1 bg-white/10 hover:bg-white/20 text-white/60 text-xs rounded transition"
            >
              Done
            </button>
          </div>
        )}

        {/* Current Player Info */}
        {currentPlayer && (
          <div className="bg-white/5 rounded-lg p-3 mb-4 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full"
              style={{ backgroundColor: currentPlayer.color }}
            />
            <div>
              <div className="text-white/60 text-xs">Current Turn</div>
              <div className="text-white font-semibold">{currentPlayer.name}</div>
            </div>
          </div>
        )}

        {/* Add Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Custom Trigger
          </button>
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            <Clock size={18} /> Presets
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white/5 rounded-lg p-4 mb-4">
            <h4 className="text-white/80 text-sm font-semibold mb-3">Add Custom Trigger</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newReminder.name}
                onChange={(e) => setNewReminder({ ...newReminder, name: e.target.value })}
                placeholder="Trigger name (e.g., Rhystic Study)"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                value={newReminder.text}
                onChange={(e) => setNewReminder({ ...newReminder, text: e.target.value })}
                placeholder="Reminder text (e.g., Pay 1 or draw)"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex gap-2">
                <select
                  value={newReminder.phase}
                  onChange={(e) => setNewReminder({ ...newReminder, phase: e.target.value })}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="upkeep">Upkeep</option>
                  <option value="draw">Draw Step</option>
                  <option value="main">Main Phase</option>
                  <option value="combat">Combat</option>
                  <option value="end">End Step</option>
                  <option value="any">Any Phase</option>
                </select>
                <select
                  value={newReminder.playerId}
                  onChange={(e) => setNewReminder({ ...newReminder, playerId: e.target.value })}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Players</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addReminder}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition"
                >
                  Add Trigger
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Presets */}
        {showPresets && (
          <div className="bg-white/5 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
            <h4 className="text-white/80 text-sm font-semibold mb-3">Quick Add Presets</h4>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGER_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => addFromPreset(preset)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-left transition"
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs text-white ${PHASE_COLORS[preset.phase]}`}>
                      {PHASE_LABELS[preset.phase]}
                    </span>
                    <span className="text-white text-sm font-medium truncate">{preset.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reminders List */}
        <div className="flex-1 overflow-y-auto">
          {reminders.length === 0 ? (
            <div className="text-center text-white/40 py-8">
              No triggers set up yet. Add a custom trigger or use a preset.
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map(reminder => (
                <div
                  key={reminder.id}
                  className={`p-3 rounded-lg flex items-center gap-3 transition ${
                    reminder.enabled ? 'bg-white/10' : 'bg-white/5 opacity-50'
                  }`}
                >
                  {/* Phase Badge */}
                  <span className={`px-2 py-1 rounded text-xs text-white font-medium ${PHASE_COLORS[reminder.phase]}`}>
                    {PHASE_LABELS[reminder.phase]}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">{reminder.name}</div>
                    {reminder.text && (
                      <div className="text-white/60 text-sm truncate">{reminder.text}</div>
                    )}
                  </div>

                  {/* Player Badge */}
                  {reminder.playerId !== 'all' && (
                    <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">
                      {players.find(p => p.id === reminder.playerId)?.name || 'Unknown'}
                    </span>
                  )}

                  {/* Actions */}
                  <button
                    onClick={() => toggleReminder(reminder.id)}
                    className={`p-2 rounded-lg transition ${
                      reminder.enabled ? 'bg-green-600/50 hover:bg-green-600' : 'bg-white/10 hover:bg-white/20'
                    }`}
                    title={reminder.enabled ? 'Disable' : 'Enable'}
                  >
                    <Bell size={16} className={reminder.enabled ? 'text-green-400' : 'text-white/40'} />
                  </button>

                  <button
                    onClick={() => {
                      fireTrigger(reminder, currentPlayer?.name);
                    }}
                    className="p-2 bg-yellow-600/50 hover:bg-yellow-600 rounded-lg transition"
                    title="Test Trigger"
                  >
                    <Volume2 size={16} className="text-yellow-400" />
                  </button>

                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="p-2 hover:bg-red-600/50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-4 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default TriggerReminders;
