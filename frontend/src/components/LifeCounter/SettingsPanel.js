import React from 'react';
import { Settings, X, Volume2, VolumeX, Maximize, Minimize, Palette, Clock, Crown } from 'lucide-react';

function SettingsPanel({
  isOpen,
  onClose,
  // Object-based settings (preferred)
  settings,
  onSettingsChange,
  // Individual props (legacy support)
  soundEnabled: propSoundEnabled,
  onToggleSound,
  soundVolume: propSoundVolume,
  onSetVolume,
  isFullscreen,
  onToggleFullscreen,
  fullscreenSupported = true,
  autoMonarch: propAutoMonarch,
  onToggleAutoMonarch,
  theme: propTheme,
  onSetTheme,
  timerEnabled: propTimerEnabled,
  onToggleTimer,
  defaultTimerMinutes: propDefaultTimerMinutes,
  onSetDefaultTimer
}) {
  // Use object-based settings if provided, otherwise use individual props
  const soundEnabled = settings?.soundEnabled ?? propSoundEnabled ?? true;
  const soundVolume = settings?.soundVolume ?? propSoundVolume ?? 0.5;
  const autoMonarch = settings?.autoMonarch ?? propAutoMonarch ?? false;
  const theme = settings?.theme ?? propTheme ?? 'dark';
  const timerEnabled = settings?.timerEnabled ?? propTimerEnabled ?? false;
  const defaultTimerMinutes = settings?.timerMinutes ?? propDefaultTimerMinutes ?? 10;

  // Helper to update settings
  const updateSetting = (key, value) => {
    if (onSettingsChange && settings) {
      onSettingsChange({ ...settings, [key]: value });
    }
  };

  const handleToggleSound = () => {
    if (onSettingsChange && settings) {
      updateSetting('soundEnabled', !soundEnabled);
    } else if (onToggleSound) {
      onToggleSound();
    }
  };

  const handleSetVolume = (value) => {
    if (onSettingsChange && settings) {
      updateSetting('soundVolume', value);
    } else if (onSetVolume) {
      onSetVolume(value);
    }
  };

  const handleToggleAutoMonarch = () => {
    if (onSettingsChange && settings) {
      updateSetting('autoMonarch', !autoMonarch);
    } else if (onToggleAutoMonarch) {
      onToggleAutoMonarch();
    }
  };

  const handleSetTheme = (value) => {
    if (onSettingsChange && settings) {
      updateSetting('theme', value);
    } else if (onSetTheme) {
      onSetTheme(value);
    }
  };

  const handleToggleTimer = () => {
    if (onSettingsChange && settings) {
      updateSetting('timerEnabled', !timerEnabled);
    } else if (onToggleTimer) {
      onToggleTimer();
    }
  };

  const handleSetDefaultTimer = (value) => {
    if (onSettingsChange && settings) {
      updateSetting('timerMinutes', value);
    } else if (onSetDefaultTimer) {
      onSetDefaultTimer(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-white/20 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings size={24} className="text-gray-400" />
            Settings
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Sound Settings */}
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-2">
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            Sound Effects
          </h4>

          <div className="flex items-center justify-between mb-3">
            <span className="text-white/60">Enable sounds</span>
            <button
              onClick={handleToggleSound}
              className={`w-12 h-6 rounded-full transition relative ${
                soundEnabled ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                  soundEnabled ? 'left-6' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {soundEnabled && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/60 text-sm">Volume</span>
                <span className="text-white/60 text-sm">{Math.round(soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={soundVolume * 100}
                onChange={(e) => handleSetVolume(parseInt(e.target.value) / 100)}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Display Settings */}
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-2">
            <Maximize size={18} />
            Display
          </h4>

          <div className="flex items-center justify-between mb-3">
            <span className="text-white/60">Fullscreen mode</span>
            {fullscreenSupported ? (
              <button
                onClick={onToggleFullscreen}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-2 ${
                  isFullscreen
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                {isFullscreen ? 'Exit' : 'Enter'}
              </button>
            ) : (
              <span className="text-white/40 text-sm">Not supported</span>
            )}
          </div>
        </div>

        {/* Game Settings */}
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-2">
            <Crown size={18} />
            Game Options
          </h4>

          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-white/60 block">Auto-Monarch on turn</span>
              <span className="text-white/40 text-xs">Remind when Monarch draws</span>
            </div>
            <button
              onClick={handleToggleAutoMonarch}
              className={`w-12 h-6 rounded-full transition relative ${
                autoMonarch ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                  autoMonarch ? 'left-6' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Timer Settings */}
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-2">
            <Clock size={18} />
            Chess Clock
          </h4>

          <div className="flex items-center justify-between mb-3">
            <span className="text-white/60">Enable timer</span>
            <button
              onClick={handleToggleTimer}
              className={`w-12 h-6 rounded-full transition relative ${
                timerEnabled ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                  timerEnabled ? 'left-6' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {timerEnabled && (
            <div>
              <span className="text-white/60 text-sm block mb-2">Default time per player</span>
              <div className="flex gap-2">
                {[5, 10, 15, 20, 30].map(mins => (
                  <button
                    key={mins}
                    onClick={() => handleSetDefaultTimer(mins)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      defaultTimerMinutes === mins
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Settings */}
        <div className="bg-white/5 rounded-xl p-4">
          <h4 className="text-white/80 font-semibold mb-3 flex items-center gap-2">
            <Palette size={18} />
            Theme
          </h4>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'default', name: 'Default', bg: 'bg-gradient-to-br from-gray-900 to-gray-800' },
              { id: 'dark', name: 'Dark', bg: 'bg-gray-950' },
              { id: 'purple', name: 'Purple', bg: 'bg-gradient-to-br from-purple-900 to-gray-900' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => handleSetTheme(t.id)}
                className={`p-3 rounded-xl transition ${
                  theme === t.id ? 'ring-2 ring-white' : ''
                } ${t.bg}`}
              >
                <span className="text-white text-sm font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default SettingsPanel;
