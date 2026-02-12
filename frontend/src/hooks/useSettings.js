import { useState, useCallback } from 'react';

const STORAGE_KEY = 'mtg-tracker-settings';

const DEFAULT_SETTINGS = {
  // Display
  pageSize: 20,
  defaultSort: 'name',
  defaultCondition: 'NM',

  // Pricing
  displayCurrency: 'USD',
  cadToUsdRate: 0.73,
  usdToEurRate: 0.92,
  conditionMultipliers: { NM: 1.0, LP: 0.85, MP: 0.70, HP: 0.50, DMG: 0.30 },

  // Feature Toggles
  features: {
    deckBuilder: true,
    wishlist: true,
    commanderRecs: true,
    setCompletion: true,
    comboFinder: true,
  },
};

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Deep merge with defaults so new keys are always present
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        conditionMultipliers: {
          ...DEFAULT_SETTINGS.conditionMultipliers,
          ...(parsed.conditionMultipliers || {}),
        },
        features: {
          ...DEFAULT_SETTINGS.features,
          ...(parsed.features || {}),
        },
      };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export default function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  const updateSettings = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      // Deep merge nested objects
      if (patch.conditionMultipliers) {
        next.conditionMultipliers = { ...prev.conditionMultipliers, ...patch.conditionMultipliers };
      }
      if (patch.features) {
        next.features = { ...prev.features, ...patch.features };
      }
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS };
    saveSettings(defaults);
    setSettings(defaults);
  }, []);

  return { settings, updateSettings, resetSettings };
}
