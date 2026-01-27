import { useState, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'mtg-shortcuts';

const DEFAULT_SHORTCUTS = {
  'act-add': 'n',
  'act-export-json': 'e',
  'act-search': '/',
};

// Build a normalized shortcut string from a KeyboardEvent
// e.g. Ctrl+Shift+L → "ctrl+shift+l", just "n" → "n"
export function buildShortcutKey(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');

  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  // Don't include bare modifier keys as the main key
  if (['control', 'alt', 'shift', 'meta'].includes(key)) return null;
  parts.push(key);
  return parts.join('+');
}

// Format a shortcut string for display
// e.g. "ctrl+shift+l" → "Ctrl+Shift+L"
export function formatShortcut(shortcut) {
  if (!shortcut) return '';
  return shortcut.split('+').map(part => {
    if (part === 'ctrl') return 'Ctrl';
    if (part === 'alt') return 'Alt';
    if (part === 'shift') return 'Shift';
    if (part === 'meta') return 'Cmd';
    if (part === ' ') return 'Space';
    if (part.length === 1) return part.toUpperCase();
    // Capitalize first letter for special keys like "escape", "enter"
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join('+');
}

function loadShortcuts() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_SHORTCUTS };
}

function saveShortcuts(shortcuts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  } catch {
    // ignore storage errors
  }
}

export default function useKeyboardShortcuts() {
  const [shortcuts, setShortcuts] = useState(loadShortcuts);

  const keyToCommand = useMemo(() => {
    const map = {};
    for (const [commandId, key] of Object.entries(shortcuts)) {
      map[key.toLowerCase()] = commandId;
    }
    return map;
  }, [shortcuts]);

  const setShortcut = useCallback((commandId, key) => {
    setShortcuts(prev => {
      const next = { ...prev };
      // Remove any existing binding for this key (prevent duplicates)
      for (const [id, k] of Object.entries(next)) {
        if (k.toLowerCase() === key.toLowerCase()) {
          delete next[id];
        }
      }
      next[commandId] = key.toLowerCase();
      saveShortcuts(next);
      return next;
    });
  }, []);

  const removeShortcut = useCallback((commandId) => {
    setShortcuts(prev => {
      const next = { ...prev };
      delete next[commandId];
      saveShortcuts(next);
      return next;
    });
  }, []);

  return { shortcuts, keyToCommand, setShortcut, removeShortcut };
}
