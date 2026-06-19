import React, { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  showDebugInfo: false,
  priceUpdateInterval: 24,
  maxCardsPerPage: 50,
  defaultCondition: 'NM',
};

const CONDITION_OPTIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];

function ToggleButton({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center justify-center w-10 h-10 rounded border-2 transition-colors ${
        value
          ? 'bg-purple-600 border-purple-500'
          : 'bg-white/10 border-gray-600'
      }`}
    >
      {value && <Check size={18} className="text-white" />}
    </button>
  );
}

function SettingRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-4 px-4 bg-gray-800/50 rounded border border-gray-700/50 hover:border-gray-600/50 transition-colors">
      <label className="text-gray-300 font-medium">{label}</label>
      <div>{children}</div>
    </div>
  );
}

export default function SettingsTab() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState('');

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('admin_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load admin settings:', error);
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  const handleSettingChange = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem('admin_settings', JSON.stringify(settings));
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error('Failed to save admin settings:', error);
      setSaveStatus('Error saving settings');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }, [settings]);

  const handleReset = useCallback(() => {
    if (window.confirm('Reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem('admin_settings', JSON.stringify(DEFAULT_SETTINGS));
      setSaveStatus('Reset to defaults!');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Admin Settings</h2>
      </div>

      {/* Maintenance Mode Warning */}
      {settings.maintenanceMode && (
        <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-300 text-sm">
          Remember to enable real maintenance mode on the server
        </div>
      )}

      {/* Settings Cards */}
      <div className="space-y-3 mb-8">
        {/* Maintenance Mode */}
        <SettingRow label="Maintenance Mode">
          <ToggleButton
            value={settings.maintenanceMode}
            onChange={val => handleSettingChange('maintenanceMode', val)}
          />
        </SettingRow>

        {/* Show Debug Info */}
        <SettingRow label="Show Debug Info">
          <ToggleButton
            value={settings.showDebugInfo}
            onChange={val => handleSettingChange('showDebugInfo', val)}
          />
        </SettingRow>

        {/* Price Update Interval */}
        <SettingRow label="Auto-update interval (hours)">
          <input
            type="number"
            min="1"
            max="168"
            value={settings.priceUpdateInterval}
            onChange={e => handleSettingChange('priceUpdateInterval', parseInt(e.target.value) || 24)}
            className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          />
        </SettingRow>

        {/* Max Cards Per Page */}
        <SettingRow label="Max Cards Per Page">
          <input
            type="number"
            min="10"
            max="500"
            value={settings.maxCardsPerPage}
            onChange={e => handleSettingChange('maxCardsPerPage', parseInt(e.target.value) || 50)}
            className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-center focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          />
        </SettingRow>

        {/* Default Condition */}
        <SettingRow label="Default Condition">
          <select
            value={settings.defaultCondition}
            onChange={e => handleSettingChange('defaultCondition', e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
          >
            {CONDITION_OPTIONS.map(condition => (
              <option key={condition} value={condition}>
                {condition}
              </option>
            ))}
          </select>
        </SettingRow>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 items-center">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors"
        >
          Save
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded transition-colors"
        >
          Reset to Defaults
        </button>
        {saveStatus && (
          <span className={`text-sm font-medium ${saveStatus.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
            {saveStatus}
          </span>
        )}
      </div>
    </div>
  );
}
