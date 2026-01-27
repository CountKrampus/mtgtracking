import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Command } from 'lucide-react';
import { buildShortcutKey, formatShortcut } from '../hooks/useKeyboardShortcuts';

const CommandPalette = ({ isOpen, onClose, commands, onSetShortcut, onRemoveShortcut }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingShortcutId, setEditingShortcutId] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setEditingShortcutId(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase();
    return commands.filter(cmd => {
      const label = cmd.label.toLowerCase();
      const category = (cmd.category || '').toLowerCase();
      // Fuzzy: check if all query chars appear in order
      let qi = 0;
      for (let i = 0; i < label.length && qi < lower.length; i++) {
        if (label[i] === lower[qi]) qi++;
      }
      if (qi === lower.length) return true;
      // Also match category
      return category.includes(lower) || label.includes(lower);
    });
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Capture key when editing a shortcut
  useEffect(() => {
    if (!editingShortcutId) return;

    const handleEditKey = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setEditingShortcutId(null);
        return;
      }

      // Build normalized combo string (e.g. "ctrl+shift+l" or just "n")
      // Returns null for bare modifier keys (Ctrl/Alt/Shift/Meta alone)
      const combo = buildShortcutKey(e);
      if (!combo) return;

      onSetShortcut(editingShortcutId, combo);
      setEditingShortcutId(null);
    };

    window.addEventListener('keydown', handleEditKey, true);
    return () => window.removeEventListener('keydown', handleEditKey, true);
  }, [editingShortcutId, onSetShortcut]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen || editingShortcutId) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(filteredCommands.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(filteredCommands.length, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingShortcutId, filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.querySelector(`[data-cmd-index="${selectedIndex}"]`);
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const grouped = {};
  filteredCommands.forEach(cmd => {
    const cat = cmd.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(cmd);
  });

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-gray-900/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Command size={18} className="text-purple-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/40">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/40 text-sm">
              No commands found
            </div>
          ) : (
            Object.entries(grouped).map(([category, cmds]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-xs font-semibold text-white/30 uppercase tracking-wider">
                  {category}
                </div>
                {cmds.map((cmd) => {
                  const idx = flatIndex++;
                  const Icon = cmd.icon;
                  const isSelected = idx === selectedIndex;
                  const isEditing = editingShortcutId === cmd.id;

                  return (
                    <div
                      key={cmd.id || idx}
                      data-cmd-index={idx}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`group w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                        isSelected
                          ? 'bg-purple-600/30 text-white'
                          : 'text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <button
                        className="flex items-center gap-3 flex-1 min-w-0"
                        onClick={() => {
                          if (!isEditing) {
                            cmd.action();
                            onClose();
                          }
                        }}
                      >
                        {Icon && <Icon size={16} className={`flex-shrink-0 ${isSelected ? 'text-purple-400' : 'text-white/40'}`} />}
                        <span className="flex-1 text-left truncate">{cmd.label}</span>
                      </button>

                      {/* Shortcut area */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isEditing ? (
                          <span className="px-2 py-0.5 rounded bg-purple-500/30 border border-purple-400/50 text-[10px] font-mono text-purple-300 animate-pulse">
                            Press key...
                          </span>
                        ) : cmd.shortcut ? (
                          <>
                            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-white/40">
                              {formatShortcut(cmd.shortcut)}
                            </kbd>
                            {onRemoveShortcut && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onRemoveShortcut(cmd.id); }}
                                className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition text-[10px]"
                                title="Remove shortcut"
                              >
                                x
                              </button>
                            )}
                            {onSetShortcut && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingShortcutId(cmd.id); }}
                                className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-white/30 hover:text-purple-400 hover:bg-purple-400/10 transition text-[10px]"
                                title="Change shortcut"
                              >
                                ...
                              </button>
                            )}
                          </>
                        ) : (
                          onSetShortcut && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingShortcutId(cmd.id); }}
                              className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/30 hover:text-purple-400 hover:bg-purple-400/10 transition"
                              title="Set shortcut"
                            >
                              +
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-white/10 px-4 py-2 flex gap-4 text-[10px] text-white/30">
          <span><kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">↵</kbd> Execute</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
