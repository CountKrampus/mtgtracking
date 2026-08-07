import React from 'react';
import { X, Search } from 'lucide-react';

export default function MobileFilterSheet({
  isOpen, onClose,
  searchTerm, setSearchTerm,
  filterCondition, setFilterCondition,
  filterSet, setFilterSet,
  filterColor, setFilterColor,
  filterType, setFilterType,
  filterSpecial, setFilterSpecial,
  filterRarity, setFilterRarity,
  filterTag, setFilterTag,
  filterLocation, setFilterLocation,
  sets, availableTags, locations,
  onClear,
}) {
  if (!isOpen) return null;

  const selectClass = "w-full px-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-400 appearance-none";
  const labelClass = "block text-white/60 text-sm mb-1 font-medium";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div
        className="fixed bottom-16 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl max-h-[calc(88vh-4rem)] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <span className="text-white font-semibold text-lg">Filters</span>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className={labelClass}>Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-white/40" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Card name, set, tags..."
                className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-base placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Condition</label>
            <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className={selectClass}>
              <option value="all">All Conditions</option>
              {['NM', 'LP', 'MP', 'HP', 'DMG'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Set</label>
            <select value={filterSet} onChange={(e) => setFilterSet(e.target.value)} className={selectClass}>
              <option value="all">All Sets</option>
              {sets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Color</label>
            <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)} className={selectClass}>
              <option value="all">All Colors</option>
              {['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectClass}>
              <option value="all">All Types</option>
              {['Artifact','Battle','Creature','Enchantment','Instant','Land','Planeswalker','Sorcery','Tribal'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Special</label>
            <select value={filterSpecial} onChange={(e) => setFilterSpecial(e.target.value)} className={selectClass}>
              <option value="all">All Cards</option>
              <option value="tokens">Tokens Only</option>
              <option value="non-tokens">Non-Tokens Only</option>
              <option value="foil">Foil Only</option>
              <option value="non-foil">Non-Foil Only</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Rarity</label>
            <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)} className={selectClass}>
              <option value="all">All Rarities</option>
              <option value="C">Common (C)</option>
              <option value="U">Uncommon (U)</option>
              <option value="R">Rare (R)</option>
              <option value="M">Mythic (M)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Tags</label>
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className={selectClass}>
              <option value="all">All Tags</option>
              {(availableTags || []).map((t) => {
                const name = t.name || t;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>

          <div>
            <label className={labelClass}>Location</label>
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className={selectClass}>
              <option value="all">All Locations</option>
              {(locations || []).map((l) => (
                <option key={l._id} value={l.name}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 px-4 py-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={() => { onClear(); onClose(); }}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition font-medium min-h-[44px]"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition font-semibold min-h-[44px]"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
