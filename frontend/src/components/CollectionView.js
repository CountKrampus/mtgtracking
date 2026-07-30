import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Search, Trash2, Edit2, Save, X, RefreshCw, DollarSign, Camera, Settings,
  CheckSquare, Square, MapPin, Layers, Zap, Crown, BarChart3, Heart, Plus, SlidersHorizontal, Bookmark,
  Upload, PlusCircle, ExternalLink, Mic, Bell, WifiOff
} from 'lucide-react';
import { standardTypes } from '../constants';
import { buildScryfallSearchUrl } from '../utils/scryfallDeeplink';
import useVoiceSearch from '../hooks/useVoiceSearch';
import PriceAlertModal from './PriceAlertModal';
import { useCardCollection } from '../contexts/CardCollectionContext';
import { useLocationTag } from '../contexts/LocationTagContext';
import { useWishlist } from '../contexts/WishlistContext';
import useSettings from '../hooks/useSettings';
import useColumnVisibility from '../hooks/useColumnVisibility';
import { useToast } from '../contexts/ToastContext';
import ColumnContextMenu from './ColumnContextMenu';
import ColumnSettingsModal from './ColumnSettingsModal';
import ValueHistoryChart from './ValueHistoryChart';
import MobileFilterSheet from './MobileFilterSheet';
import SwipeableRow from './SwipeableRow';
import { API_URL } from '../config';
import Fuse from 'fuse.js';

const CameraModal = React.lazy(() => import('./CameraModal'));

const PRESETS_STORAGE_KEY = 'mtg-filter-presets';

function MobileCardRow({ card, formatPrice, onEdit, onDelete, onUpdatePrice, onViewDetail }) {
  const swipeActions = [
    {
      label: 'Edit',
      icon: Edit2,
      color: 'bg-blue-600 hover:bg-blue-700',
      onClick: () => onEdit(card),
    },
    {
      label: 'Delete',
      icon: Trash2,
      color: 'bg-red-600 hover:bg-red-700',
      onClick: () => onDelete(card._id),
    },
  ];

  return (
    <SwipeableRow actions={swipeActions}>
      <div
        className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 active:bg-white/20 transition"
        onClick={() => onViewDetail(card)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base leading-tight truncate">{card.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {card.set && <span className="text-white/50 text-xs">{card.set}</span>}
              <span className="px-1.5 py-0.5 bg-white/10 text-white/70 text-[11px] rounded">{card.condition}</span>
              {card.rarity && <span className="text-white/40 text-[11px]">{card.rarity}</span>}
            </div>
            {card.manaCost && (
              <p className="text-white/40 text-xs mt-1 font-mono">{card.manaCost}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-green-400 font-semibold">{formatPrice(card.price)}</p>
            <p className="text-white/40 text-xs mt-0.5">×{card.quantity}</p>
            <p className="text-white/30 text-xs">{formatPrice(card.price * card.quantity)} total</p>
          </div>
        </div>
        {/* Price update button stays visible — swipe reveals edit/delete */}
        <div className="flex justify-between items-center mt-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-white/50 text-[11px]">← Swipe to edit or delete</p>
          <button
            onClick={() => onUpdatePrice(card._id)}
            className="p-2.5 bg-indigo-600/50 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Update price"
          >
            <DollarSign size={15} />
          </button>
        </div>
      </div>
    </SwipeableRow>
  );
}

function FilterPresetsPanel({ currentFilters, onApply, onClose }) {
  const [presets, setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) || '[]'); }
    catch { return []; }
  });
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const save = () => {
    if (!saveName.trim()) return;
    const next = [...presets, { id: Date.now().toString(), name: saveName.trim(), filters: currentFilters }];
    setPresets(next);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
    setSaveName('');
    setShowSaveInput(false);
  };

  const remove = (id) => {
    const next = presets.filter(p => p.id !== id);
    setPresets(next);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="absolute z-50 right-0 top-full mt-1 w-72 bg-gray-900 border border-white/20 rounded-xl shadow-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-semibold text-sm">Filter Presets</span>
        <button onClick={onClose} className="text-white/50 hover:text-white p-1"><X size={14} /></button>
      </div>

      {presets.length === 0 && (
        <p className="text-white/40 text-xs text-center py-3">No saved presets yet.</p>
      )}

      <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
        {presets.map(preset => (
          <div key={preset.id} className="flex items-center gap-2">
            <button
              onClick={() => { onApply(preset.filters); onClose(); }}
              className="flex-1 text-left px-2 py-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm transition truncate"
            >
              {preset.name}
            </button>
            <button
              onClick={() => remove(preset.id)}
              className="p-1 text-white/30 hover:text-red-400 transition flex-shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {showSaveInput ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Preset name..."
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            maxLength={50}
            style={{ fontSize: '16px' }}
            className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          <button onClick={save} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition">Save</button>
          <button onClick={() => setShowSaveInput(false)} className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs transition">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveInput(true)}
          className="w-full px-2 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 hover:text-white rounded-lg text-sm transition text-center"
        >
          + Save current filters as preset
        </button>
      )}
    </div>
  );
}

function CollectionFAB({ onAddCard, onImport, disabled = false }) {
  const [open, setOpen] = useState(false);

  if (disabled) return null;

  return (
    <>
      {open && (
        <div
          className="sm:hidden fixed inset-0 z-[55]"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="sm:hidden fixed bottom-20 right-4 z-[60] flex flex-col-reverse items-end gap-3">
        {open && (
          <>
            <div className="flex items-center gap-2">
              <span className="bg-gray-900/90 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">Import from file</span>
              <button
                aria-label="Import cards from file"
                onClick={() => { setOpen(false); onImport(); }}
                className="w-12 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition"
              >
                <Upload size={20} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-900/90 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">Add card</span>
              <button
                aria-label="Add card"
                onClick={() => { setOpen(false); onAddCard(); }}
                className="w-12 h-12 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-full shadow-lg flex items-center justify-center transition"
              >
                <PlusCircle size={20} />
              </button>
            </div>
          </>
        )}
        <button
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          onClick={() => setOpen(p => !p)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${
            open ? 'bg-gray-700 rotate-45' : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rotate-0'
          }`}
        >
          <Plus size={26} className="text-white" />
        </button>
      </div>
    </>
  );
}

function CollectionView({
  fileInputRef,
  showPriceUpdateModal, setShowPriceUpdateModal, forceUpdate, setForceUpdate, updateFullData, setUpdateFullData,
  isImporting, setIsImporting, importProgress, setImportProgress, importResults, setImportResults,
  showImportResults, setShowImportResults,
  showQRPreview, setShowQRPreview, qrPreviewLocation, setQRPreviewLocation,
  qrDataUrls, setQrDataUrls, showPrintLabels, setShowPrintLabels, generateQR,
  showCommanderRecs, setShowCommanderRecs, commanderRecs, setCommanderRecs,
  loadingCommanders, setLoadingCommanders, commanderColorFilter, setCommanderColorFilter,
  commanderFinderMode, setCommanderFinderMode, finderColors, setFinderColors,
  finderThemes, setFinderThemes, finderCreatureType, setFinderCreatureType,
  getCommanderRecommendations, searchCommandersByPreference, addCommanderToCollection,
  showSetCompletion, setShowSetCompletion, completionData, setCompletionData, loadingSetCompletion, getSetCompletionData,
  showComboFinder, setShowComboFinder, comboResults, setComboResults, loadingCombos, comboTab, setComboTab,
  findCombos, addToWishlistFromCombo,
  showFinancePanel, setShowFinancePanel, financeData, openFinancePanel,
}) {
  const navigate = useNavigate();

  const {
    cards, loading, setLoading, editingId, setEditingId, fetchCards,
    handleSubmit, handleDelete, updateCardPrice, updateAllPrices, updateAllOracleText,
    handleAddTag, handleRemoveTag, handleCardHover, handlePriceCellEnter, handlePriceCellLeave,
    handleBulkImport, hoveredCard, setHoveredCard, hoveredCardPriceHistory,
    setHoveredCardPriceHistory, detailCard, setDetailCard,
    isShowingCachedCards, cacheAge,
  } = useCardCollection();
  const { locations, locationStats, availableTags, fetchAvailableTags } = useLocationTag();
  const { addToWishlist, fetchWishlist } = useWishlist();
  const { settings } = useSettings();
  const { visibleColumns, isColumnVisible, toggleColumn, selectAllColumns, resetColumns, allColumns } = useColumnVisibility();
  const { addToast } = useToast();

  const searchInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCondition, setFilterCondition] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSpecial, setFilterSpecial] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [filterSet, setFilterSet] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [showPresets, setShowPresets] = useState(false);
  const [sortBy, setSortBy] = useState(settings.defaultSort);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = settings.pageSize;
  const [showAddForm, setShowAddForm] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [searchIncludesOracleText, setSearchIncludesOracleText] = useState(true);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [typesInputValue, setTypesInputValue] = useState('');
  const [tagsInputValue, setTagsInputValue] = useState('');
  const [showTagInput, setShowTagInput] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', set: '', setCode: '', collectorNumber: '', rarity: '',
    quantity: 1, condition: settings.defaultCondition, price: 0,
    colors: [], types: [], manaCost: '', scryfallId: '', imageUrl: '',
    isFoil: false, isToken: false, oracleText: '', tags: [], location: '',
  });
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [priceAlertCard, setPriceAlertCard] = useState(null);
  const [bulkUpdateModal, setBulkUpdateModal] = useState(null);
  const [bulkCondition, setBulkCondition] = useState('NM');
  const [bulkLocation, setBulkLocation] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showSimilarCards, setShowSimilarCards] = useState(false);
  const [similarCardsSource, setSimilarCardsSource] = useState(null);
  const [similarCards, setSimilarCards] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showSynergies, setShowSynergies] = useState(false);
  const [synergiesSource, setSynergiesSource] = useState(null);
  const [synergies, setSynergies] = useState({ tribal: [], keywords: [], mechanics: [] });
  const [loadingSynergies, setLoadingSynergies] = useState(false);
  const [synergiesTab, setSynergiesTab] = useState('tribal');

  const conditions = ['NM', 'LP', 'MP', 'HP', 'DMG'];
  const mtgColors = ['W', 'U', 'B', 'R', 'G', 'C'];
  const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };

  const currentFilters = {
    searchTerm, filterCondition, filterColor, filterSet,
    filterType, filterSpecial, filterRarity, filterTag, filterLocation,
  };

  const scryfallSearchUrl = useMemo(
    () => buildScryfallSearchUrl({ searchTerm, filterColor, filterType, filterRarity, filterSet, filterSpecial, cards }),
    [searchTerm, filterColor, filterType, filterRarity, filterSet, filterSpecial, cards]
  );

  const handleVoiceResult = useCallback((transcript) => setSearchTerm(transcript), []);
  const { isSupported: voiceSearchSupported, isListening: voiceListening, start: startVoiceSearch } = useVoiceSearch(handleVoiceResult);

  const applyPreset = (filters) => {
    setSearchTerm(filters.searchTerm ?? '');
    setFilterCondition(filters.filterCondition ?? 'all');
    setFilterColor(filters.filterColor ?? 'all');
    setFilterSet(filters.filterSet ?? 'all');
    setFilterType(filters.filterType ?? 'all');
    setFilterSpecial(filters.filterSpecial ?? 'all');
    setFilterRarity(filters.filterRarity ?? 'all');
    setFilterTag(filters.filterTag ?? 'all');
    setFilterLocation(filters.filterLocation ?? 'all');
  };

  useEffect(() => {
    if (!showPresets) return;
    const handler = (e) => {
      if (!e.target.closest('[data-presets-panel]')) setShowPresets(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPresets]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('location');
    if (locationParam) setFilterLocation(decodeURIComponent(locationParam));
  }, []);

  const formatPrice = useCallback((priceUSD) => {
    if (priceUSD == null || isNaN(priceUSD)) priceUSD = 0;
    if (settings.displayCurrency === 'CAD') return `C$${(priceUSD / settings.cadToUsdRate).toFixed(2)}`;
    if (settings.displayCurrency === 'EUR') return `€${(priceUSD * settings.usdToEurRate).toFixed(2)}`;
    return `$${priceUSD.toFixed(2)}`;
  }, [settings.displayCurrency, settings.cadToUsdRate, settings.usdToEurRate]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(standardTypes);
    cards.forEach(card => { if (card.types?.length > 0) types.add(card.types.join(' ')); });
    return Array.from(types).sort();
  }, [cards]);

  const uniqueSets = useMemo(() => {
    const sets = new Set();
    cards.forEach(card => { if (card.set) sets.add(card.set); });
    return Array.from(sets).sort();
  }, [cards]);

  const uniqueLocations = useMemo(() => {
    const locs = new Set();
    cards.forEach(card => { if (card.location) locs.add(card.location); });
    locations.forEach(loc => locs.add(loc.name));
    return Array.from(locs).sort();
  }, [cards, locations]);

  const handleCardNameChange = async (value) => {
    setFormData({ ...formData, name: value });
    if (manualEntry) { setShowAutocomplete(false); return; }
    if (value.length >= 2) {
      setShowAutocomplete(true);
      try {
        const response = await axios.get(`${API_URL}/scryfall/autocomplete?q=${value}`);
        setAutocompleteResults(response.data);
      } catch (error) { console.error('Error searching Scryfall:', error); }
    } else { setShowAutocomplete(false); setAutocompleteResults([]); }
  };

  const selectAutocompleteCard = async (cardName) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/scryfall/search?name=${cardName}`);
      const cardData = response.data;
      setFormData({
        ...formData, name: cardData.name, set: cardData.set,
        setCode: cardData.setCode || '', collectorNumber: cardData.collectorNumber || '',
        rarity: cardData.rarity || '', colors: cardData.colors, types: cardData.types,
        manaCost: cardData.manaCost || '', scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl, price: cardData.prices.usd || 0,
        oracleText: cardData.oracleText || '', tags: [],
      });
      setTypesInputValue(cardData.types ? cardData.types.join(', ') : '');
      setTagsInputValue(''); setShowAutocomplete(false); setAutocompleteResults([]);
    } catch (error) {
      console.error('Error fetching card details:', error);
      addToast('Card not found on Scryfall', 'error');
    } finally { setLoading(false); }
  };

  const searchScryfallManually = async () => {
    if (!formData.name) { addToast('Please enter a card name first', 'warning'); return; }
    await selectAutocompleteCard(formData.name);
  };

  const handleOpenCamera = () => setShowCameraModal(true);
  const handleCameraClose = () => setShowCameraModal(false);

  const handleCardExtracted = async (extractedData) => {
    setShowCameraModal(false);
    if (!extractedData.name) {
      addToast('No card name extracted. Please try again or use manual entry.', 'warning');
      return;
    }
    if (offlineMode) {
      setFormData({ ...formData, name: extractedData.name });
      addToast(`Card name extracted: ${extractedData.name} (Offline mode - please fill in other details manually)`, 'info');
      return;
    }
    try {
      setLoading(true);
      await selectAutocompleteCard(extractedData.name);
      const ct = extractedData.confidence ? ` (${Math.round(extractedData.confidence)}% confidence)` : '';
      addToast(`Card found: ${extractedData.name}${ct}`, 'success');
    } catch (error) {
      setFormData({ ...formData, name: extractedData.name });
      const ct = extractedData.confidence ? ` (${Math.round(extractedData.confidence)}% confidence)` : '';
      addToast(`Card name extracted: ${extractedData.name}${ct} — could not find on Scryfall, please verify and search manually.`, 'warning');
    } finally { setLoading(false); }
  };

  const handleEdit = (card) => {
    setFormData({
      name: card.name, set: card.set, quantity: card.quantity, condition: card.condition,
      price: card.price, colors: card.colors || [], types: card.types || [],
      manaCost: card.manaCost || '', isFoil: card.isFoil || false, isToken: card.isToken || false,
      oracleText: card.oracleText || '', tags: card.tags || [], location: card.location || '',
    });
    setTypesInputValue(card.types ? card.types.join(', ') : '');
    setTagsInputValue(card.tags ? card.tags.join(', ') : '');
    setEditingId(card._id);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setEditingId(null); setShowAutocomplete(false); setTypesInputValue(''); setTagsInputValue('');
    setFormData({
      name: '', set: '', quantity: 1, condition: settings.defaultCondition,
      price: 0, colors: [], types: [], manaCost: '', isFoil: false, isToken: false,
      oracleText: '', tags: [], location: '',
    });
  };

  const toggleColor = (color) => {
    setFormData({
      ...formData,
      colors: formData.colors.includes(color)
        ? formData.colors.filter(c => c !== color)
        : [...formData.colors, color],
    });
  };

  const toggleCardSelection = (cardId) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) newSelected.delete(cardId); else newSelected.add(cardId);
    setSelectedCards(newSelected);
  };

  const toggleSelectAllOnPage = () => {
    const pageCardIds = paginatedCards.map(card => card._id);
    const allSelected = pageCardIds.every(id => selectedCards.has(id));
    const newSelected = new Set(selectedCards);
    if (allSelected) pageCardIds.forEach(id => newSelected.delete(id));
    else pageCardIds.forEach(id => newSelected.add(id));
    setSelectedCards(newSelected);
  };

  const clearSelection = () => setSelectedCards(new Set());

  const handleBulkUpdateCondition = async () => {
    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards), updates: { condition: bulkCondition },
      });
      addToast(response.data.message, 'success');
      fetchCards(); clearSelection(); setBulkUpdateModal(null);
    } catch (error) { console.error('Error bulk updating condition:', error); addToast('Error updating cards', 'error'); }
  };

  const handleBulkUpdateLocation = async () => {
    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards), updates: { location: bulkLocation },
      });
      addToast(response.data.message, 'success');
      fetchCards(); clearSelection(); setBulkUpdateModal(null);
    } catch (error) { console.error('Error bulk updating location:', error); addToast('Error updating cards', 'error'); }
  };

  const handleBulkAddTags = async () => {
    const tags = bulkTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length === 0) { addToast('Please enter at least one tag', 'warning'); return; }
    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards), updates: { addTags: tags },
      });
      addToast(response.data.message, 'success');
      fetchCards(); fetchAvailableTags(); clearSelection(); setBulkUpdateModal(null); setBulkTags('');
    } catch (error) { console.error('Error bulk adding tags:', error); addToast('Error adding tags', 'error'); }
  };

  const handleBulkRemoveTags = async () => {
    const tags = bulkTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length === 0) { alert('Please enter at least one tag'); return; }
    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards), updates: { removeTags: tags },
      });
      alert(response.data.message);
      fetchCards(); fetchAvailableTags(); clearSelection(); setBulkUpdateModal(null); setBulkTags('');
    } catch (error) { console.error('Error bulk removing tags:', error); alert('Error removing tags'); }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCards.size} cards? This cannot be undone.`)) return;
    try {
      const response = await axios.delete(`${API_URL}/cards/bulk-delete`, {
        data: { cardIds: Array.from(selectedCards) },
      });
      alert(response.data.message);
      fetchCards(); clearSelection(); setBulkUpdateModal(null);
    } catch (error) { console.error('Error bulk deleting:', error); alert('Error deleting cards'); }
  };

  const getSelectedCardsForPrint = () => cards.filter(card => selectedCards.has(card._id));
  const handlePrintProxies = () => setShowPrintPreview(true);
  const executePrint = () => window.print();

  const findSimilarCards = async (card) => {
    setSimilarCardsSource(card); setShowSimilarCards(true); setLoadingSimilar(true); setSimilarCards([]);
    try {
      const queries = [];
      if (card.types?.length > 0) queries.push(`t:${card.types[0].toLowerCase()}`);
      if (card.colors?.length > 0) queries.push(`(${card.colors.map(c => `c:${c.toLowerCase()}`).join(' ')})`);
      else queries.push('c:colorless');
      queries.push(`-!"${card.name}"`);
      const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(queries.join(' '))}&order=edhrec&unique=cards`);
      setSimilarCards(response.data.data.slice(0, 20));
    } catch (error) {
      console.error('Error finding similar cards:', error);
      try {
        if (card.types?.length > 0) {
          const response = await axios.get(`https://api.scryfall.com/cards/search?q=t:${card.types[0].toLowerCase()}&order=edhrec&unique=cards`);
          setSimilarCards(response.data.data.slice(0, 20));
        }
      } catch (e) { setSimilarCards([]); }
    } finally { setLoadingSimilar(false); }
  };

  const addSimilarCardToCollection = async (scryfallCard) => {
    try {
      const response = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(scryfallCard.name)}`);
      const cardData = response.data;
      await axios.post(`${API_URL}/cards`, {
        name: cardData.name, set: cardData.set, setCode: cardData.setCode,
        collectorNumber: cardData.collectorNumber, rarity: cardData.rarity,
        quantity: 1, condition: 'NM', price: cardData.prices?.usd || 0,
        colors: cardData.colors, types: cardData.types, manaCost: cardData.manaCost,
        scryfallId: cardData.scryfallId, imageUrl: cardData.imageUrl,
        oracleText: cardData.oracleText, tags: [], location: '',
      });
      alert(`Added ${cardData.name} to your collection!`); fetchCards();
    } catch (error) { console.error('Error adding card:', error); alert('Error adding card to collection'); }
  };

  const addSimilarCardToWishlist = (scryfallCard) => addToWishlist(scryfallCard, similarCardsSource?.name);

  const findCardSynergies = async (card) => {
    setSynergiesSource(card); setShowSynergies(true); setLoadingSynergies(true);
    setSynergies({ tribal: [], keywords: [], mechanics: [] }); setSynergiesTab('tribal');
    const results = { tribal: [], keywords: [], mechanics: [] };
    try {
      const colorQuery = card.colors?.length > 0 ? `id<=${card.colors.map(c => c[0].toLowerCase()).join('')}` : 'id:c';
      if (card.types?.some(t => t.toLowerCase() === 'creature')) {
        const ot = card.oracleText || '';
        const typeMatch = ot.match(/\b(Elf|Goblin|Zombie|Human|Vampire|Dragon|Angel|Demon|Merfolk|Wizard|Warrior|Knight|Soldier|Beast|Elemental|Spirit|Dinosaur|Pirate|Cat|Dog|Bird|Snake|Spider|Rat|Wolf|Bear|Sliver|Ally|Cleric|Rogue|Shaman|Druid|Artifact|Enchantment)\b/gi);
        const nameTypes = card.name.match(/\b(Elf|Goblin|Zombie|Human|Vampire|Dragon|Angel|Demon|Merfolk|Wizard|Warrior|Knight|Soldier|Beast|Elemental|Spirit|Dinosaur|Pirate|Cat|Dog|Bird|Snake|Spider|Rat|Wolf|Bear|Sliver|Ally|Cleric|Rogue|Shaman|Druid)\b/gi);
        const tribes = [...new Set([...(typeMatch || []), ...(nameTypes || [])])].map(t => t.toLowerCase());
        if (tribes.length > 0) {
          const tribe = tribes[0];
          try {
            const res = await axios.get(`https://api.scryfall.com/cards/search?q=o:"${tribe}" ${colorQuery} -t:${tribe} -!"${card.name}"&order=edhrec&unique=cards`);
            results.tribal = res.data.data.slice(0, 12);
          } catch (e) {
            try {
              const res2 = await axios.get(`https://api.scryfall.com/cards/search?q=t:${tribe} ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
              results.tribal = res2.data.data.slice(0, 12);
            } catch (e2) {}
          }
        }
      }
      const ot = (card.oracleText || '').toLowerCase();
      const keywordPatterns = [
        { keyword: 'flying', search: 'o:"flying" OR o:"creatures with flying"' },
        { keyword: 'deathtouch', search: 'o:"deathtouch"' },
        { keyword: 'lifelink', search: 'o:"lifelink" OR o:"whenever you gain life"' },
        { keyword: 'trample', search: 'o:"trample"' },
        { keyword: 'haste', search: 'o:"haste"' },
        { keyword: 'vigilance', search: 'o:"vigilance"' },
        { keyword: 'first strike', search: 'o:"first strike" OR o:"double strike"' },
        { keyword: 'hexproof', search: 'o:"hexproof"' },
        { keyword: 'indestructible', search: 'o:"indestructible"' },
        { keyword: 'menace', search: 'o:"menace"' },
        { keyword: 'reach', search: 'o:"reach"' },
        { keyword: 'flash', search: 'o:"flash"' },
        { keyword: 'prowess', search: 'o:"prowess" OR o:"whenever you cast a noncreature"' },
        { keyword: 'ward', search: 'o:"ward"' },
      ];
      const foundKeywords = keywordPatterns.filter(({ keyword }) => ot.includes(keyword));
      if (foundKeywords.length > 0) {
        try {
          const res = await axios.get(`https://api.scryfall.com/cards/search?q=(${foundKeywords[0].search}) ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
          results.keywords = res.data.data.slice(0, 12);
        } catch (e) {}
      }
      const mechanicPatterns = [
        { pattern: /\+1\/\+1 counter/i, search: 'o:"+1/+1 counter" OR o:"proliferate"' },
        { pattern: /-1\/-1 counter/i, search: 'o:"-1/-1 counter" OR o:"wither"' },
        { pattern: /draw.*(card|cards)/i, search: 'o:"whenever you draw" OR o:"draw a card"' },
        { pattern: /discard/i, search: 'o:"discard" o:"whenever"' },
        { pattern: /creature dies|when.*dies/i, search: 'o:"when" o:"dies" OR o:"whenever a creature dies"' },
        { pattern: /sacrifice/i, search: 'o:"sacrifice" o:"whenever" OR o:"sacrifice a creature"' },
        { pattern: /token/i, search: 'o:"create" o:"token"' },
        { pattern: /graveyard/i, search: 'o:"from your graveyard" OR o:"in your graveyard"' },
        { pattern: /exile/i, search: 'o:"exile" o:"return"' },
        { pattern: /enters the battlefield|etb/i, search: 'o:"enters the battlefield" o:"whenever"' },
        { pattern: /life.*gain|gain.*life/i, search: 'o:"gain life" OR o:"whenever you gain life"' },
        { pattern: /deals.*damage.*opponent/i, search: 'o:"deals damage to" o:"opponent"' },
        { pattern: /mana/i, search: 'o:"add" o:"mana"' },
        { pattern: /equipment|equip/i, search: 't:equipment OR o:"equipped creature"' },
        { pattern: /aura|enchant creature/i, search: 't:aura OR o:"enchanted creature"' },
        { pattern: /spell.*cast|cast.*spell/i, search: 'o:"whenever you cast" o:"spell"' },
        { pattern: /attack/i, search: 'o:"whenever" o:"attacks"' },
        { pattern: /untap/i, search: 'o:"untap" o:"whenever"' },
        { pattern: /copy/i, search: 'o:"copy" o:"spell" OR o:"copy" o:"creature"' },
      ];
      const foundMechanics = mechanicPatterns.filter(({ pattern }) => pattern.test(ot));
      if (foundMechanics.length > 0) {
        try {
          const res = await axios.get(`https://api.scryfall.com/cards/search?q=(${foundMechanics[0].search}) ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
          results.mechanics = res.data.data.slice(0, 12);
        } catch (e) {}
      }
      if (results.mechanics.length === 0) {
        if (card.types?.includes('Instant') || card.types?.includes('Sorcery')) {
          try {
            const res = await axios.get(`https://api.scryfall.com/cards/search?q=o:"whenever you cast" (o:"instant" OR o:"sorcery") ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
            results.mechanics = res.data.data.slice(0, 12);
          } catch (e) {}
        } else if (card.types?.includes('Artifact')) {
          try {
            const res = await axios.get(`https://api.scryfall.com/cards/search?q=o:"artifact" o:"whenever" ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
            results.mechanics = res.data.data.slice(0, 12);
          } catch (e) {}
        } else if (card.types?.includes('Enchantment')) {
          try {
            const res = await axios.get(`https://api.scryfall.com/cards/search?q=o:"enchantment" o:"whenever" OR o:"constellation" ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
            results.mechanics = res.data.data.slice(0, 12);
          } catch (e) {}
        }
      }
      setSynergies(results);
      if (results.tribal.length > 0) setSynergiesTab('tribal');
      else if (results.keywords.length > 0) setSynergiesTab('keywords');
      else if (results.mechanics.length > 0) setSynergiesTab('mechanics');
    } catch (error) { console.error('Error finding synergies:', error); }
    finally { setLoadingSynergies(false); }
  };

  const addSynergyCardToCollection = async (scryfallCard) => {
    try {
      const response = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(scryfallCard.name)}`);
      const cardData = response.data;
      await axios.post(`${API_URL}/cards`, {
        name: cardData.name, set: cardData.set, setCode: cardData.setCode,
        collectorNumber: cardData.collectorNumber, rarity: cardData.rarity,
        quantity: 1, condition: 'NM', price: cardData.prices?.usd || 0,
        colors: cardData.colors, types: cardData.types, manaCost: cardData.manaCost,
        scryfallId: cardData.scryfallId, imageUrl: cardData.imageUrl,
        oracleText: cardData.oracleText, tags: [], location: '',
      });
      alert(`Added ${cardData.name} to your collection!`); fetchCards();
    } catch (error) { console.error('Error adding card:', error); alert('Error adding card to collection'); }
  };

  const addSynergyCardToWishlist = async (scryfallCard) => {
    try {
      await axios.post(`${API_URL}/wishlist`, {
        name: scryfallCard.name, set: scryfallCard.set_name || '',
        setCode: scryfallCard.set?.toUpperCase() || '', scryfallId: scryfallCard.id,
        imageUrl: scryfallCard.image_uris?.normal || '', colors: scryfallCard.colors || [],
        types: scryfallCard.type_line ? scryfallCard.type_line.split('—')[0].trim().split(' ') : [],
        manaCost: scryfallCard.mana_cost || '',
        rarity: scryfallCard.rarity ? scryfallCard.rarity[0].toUpperCase() : '',
        targetPrice: 0, currentPrice: scryfallCard.prices?.usd ? parseFloat(scryfallCard.prices.usd) : 0,
        priority: 'medium', notes: `Synergy with ${synergiesSource?.name}`,
        quantity: 1, condition: 'NM', oracleText: scryfallCard.oracle_text || '',
      });
      alert(`Added ${scryfallCard.name} to your wishlist!`); fetchWishlist();
    } catch (error) { console.error('Error adding to wishlist:', error); alert('Error adding card to wishlist'); }
  };

  const fuse = useMemo(() => new Fuse(cards, {
    keys: ['name'],
    threshold: 0.3,
    distance: 100,
    minMatchCharLength: 2,
  }), [cards]);

  const fuzzyMatchedIds = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return null;
    return new Set(fuse.search(searchTerm).map(r => r.item._id));
  }, [fuse, searchTerm]);

  const filteredAndSortedCards = useMemo(() => {
    let filtered = cards.filter(card => {
      let matchesSearch = false;
      if (searchTerm) {
        const sl = searchTerm.toLowerCase();
        matchesSearch = (fuzzyMatchedIds ? fuzzyMatchedIds.has(card._id) : card.name.toLowerCase().includes(sl)) || card.set.toLowerCase().includes(sl);
        if (searchIncludesOracleText && card.oracleText) matchesSearch = matchesSearch || card.oracleText.toLowerCase().includes(sl);
        if (card.tags?.some(tag => tag.includes(sl))) matchesSearch = true;
      } else { matchesSearch = true; }
      const matchesCondition = filterCondition === 'all' || card.condition === filterCondition;
      const matchesColor = filterColor === 'all' || (card.colors?.includes(filterColor));
      const matchesSet = filterSet === 'all' || card.set === filterSet;
      let matchesType = true;
      if (filterType !== 'all') matchesType = card.types?.length > 0 ? card.types.join(' ') === filterType : false;
      let matchesSpecial = true;
      if (filterSpecial === 'tokens') matchesSpecial = card.isToken === true;
      else if (filterSpecial === 'non-tokens') matchesSpecial = !card.isToken;
      else if (filterSpecial === 'foil') matchesSpecial = card.isFoil === true;
      else if (filterSpecial === 'non-foil') matchesSpecial = !card.isFoil;
      const matchesRarity = filterRarity === 'all' || card.rarity === filterRarity;
      const matchesTag = filterTag === 'all' || (card.tags?.includes(filterTag));
      const matchesLocation = filterLocation === 'all' || card.location === filterLocation;
      return matchesSearch && matchesCondition && matchesColor && matchesSet && matchesType && matchesSpecial && matchesRarity && matchesTag && matchesLocation;
    });
    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') return b.price - a.price;
      if (sortBy === 'quantity') return b.quantity - a.quantity;
      if (sortBy === 'totalValue') return (b.price * b.quantity) - (a.price * a.quantity);
      if (sortBy === 'type') {
        const aType = a.types?.length > 0 ? a.types.join(' ') : 'zzz';
        const bType = b.types?.length > 0 ? b.types.join(' ') : 'zzz';
        return aType.localeCompare(bType);
      }
      if (sortBy === 'color') {
        const cv = (card) => !card.colors?.length ? 'Z' : card.colors.length === 1 ? card.colors[0] : 'M' + card.colors.sort().join('');
        return cv(a).localeCompare(cv(b));
      }
      return 0;
    });
  }, [cards, searchTerm, filterCondition, filterColor, filterSet, filterType, filterSpecial, filterRarity, filterTag, filterLocation, searchIncludesOracleText, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedCards.length / pageSize);

  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedCards.slice(start, start + pageSize);
  }, [filteredAndSortedCards, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCondition, filterColor, filterSet, filterType, filterSpecial, filterRarity, filterTag, filterLocation, searchIncludesOracleText, sortBy, pageSize]);

  return (    <>
          <>
            {isShowingCachedCards && (
              <div className="mb-4 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-200 text-sm flex items-center gap-2">
                <WifiOff size={16} className="shrink-0" />
                <span>
                  You're offline — showing your collection as of{' '}
                  {cacheAge ? new Date(cacheAge).toLocaleString() : 'last sync'}. It'll refresh automatically once you're back online.
                </span>
              </div>
            )}
            {/* Search & Filter Bar - Collapseable */}
            <div className="mb-6">
              {/* Mobile: inline search + filter button */}
              <div className="flex sm:hidden gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-white/60" size={18} />
                  <input
                    type="text"
                    placeholder="Search cards..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 bg-white/20 border border-white/30 rounded-xl text-white text-base placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400 min-h-[44px]"
                  />
                  {voiceSearchSupported && (
                    <button
                      onClick={startVoiceSearch}
                      title="Search by voice"
                      className={`absolute right-2 top-2 p-1 rounded-lg transition ${voiceListening ? 'text-red-400 animate-pulse' : 'text-white/60 hover:text-white'}`}
                    >
                      <Mic size={18} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="relative flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white transition min-h-[44px] flex-shrink-0"
                >
                  <SlidersHorizontal size={16} />
                  <span className="text-sm font-medium">Filters</span>
                  {[filterCondition, filterColor, filterSet, filterType, filterSpecial, filterRarity, filterTag, filterLocation].filter(v => v !== 'all').length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                      {[filterCondition, filterColor, filterSet, filterType, filterSpecial, filterRarity, filterTag, filterLocation].filter(v => v !== 'all').length}
                    </span>
                  )}
                </button>
                <div className="relative" data-presets-panel>
                  <button
                    onClick={() => setShowPresets(p => !p)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-white transition min-h-[44px] flex-shrink-0"
                    title="Presets"
                  >
                    <Bookmark size={16} />
                  </button>
                  {showPresets && (
                    <FilterPresetsPanel
                      currentFilters={currentFilters}
                      onApply={applyPreset}
                      onClose={() => setShowPresets(false)}
                    />
                  )}
                </div>
              </div>

              {/* Desktop: collapsible toggle */}
              <div className="hidden sm:block">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full px-4 py-2 flex items-center justify-between text-white/70 hover:text-white font-semibold bg-white/5 rounded-t-lg transition"
              >
                <span>{showFilters ? 'â–¼' : 'â–¶'} Search &amp; Filter</span>
              </button>
              {showFilters && (
            <div className="bg-white/10 backdrop-blur-md rounded-b-lg p-4 shadow-xl sticky top-0 z-30">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4 mb-4">
            <div className="relative md:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-3 text-white/60" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              {searchTerm ? (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-3 text-white/60 hover:text-white transition"
                  title="Clear search"
                >
                  <X size={20} />
                </button>
              ) : voiceSearchSupported && (
                <button
                  onClick={startVoiceSearch}
                  title="Search by voice"
                  className={`absolute right-3 top-3 transition ${voiceListening ? 'text-red-400 animate-pulse' : 'text-white/60 hover:text-white'}`}
                >
                  <Mic size={20} />
                </button>
              )}
            </div>

            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All Conditions</option>
              {conditions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={filterSet}
              onChange={(e) => setFilterSet(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All Sets</option>
              {uniqueSets.map(set => <option key={set} value={set}>{set}</option>)}
            </select>

            <select
              value={filterColor}
              onChange={(e) => setFilterColor(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All Colors</option>
              {mtgColors.map(c => <option key={c} value={c}>{colorNames[c]}</option>)}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>

            <select
              value={filterSpecial}
              onChange={(e) => setFilterSpecial(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All Cards</option>
              <option value="tokens">Tokens Only</option>
              <option value="non-tokens">Non-Tokens Only</option>
              <option value="foil">Foil Only</option>
              <option value="non-foil">Non-Foil Only</option>
            </select>

            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All Rarities</option>
              <option value="C">Common</option>
              <option value="U">Uncommon</option>
              <option value="R">Rare</option>
              <option value="M">Mythic</option>
            </select>

            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">All Tags</option>
              {availableTags.map(tag => <option key={tag.name || tag} value={tag.name || tag}>{tag.name || tag}</option>)}
            </select>
          </div>

          <div className="flex gap-4 items-center flex-wrap">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
              <option value="quantity">Sort by Quantity</option>
              <option value="totalValue">Sort by Total Value</option>
              <option value="type">Sort by Type</option>
              <option value="color">Sort by Color</option>
            </select>
            <div className="flex gap-1 items-center">
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg text-white transition"
                title="Manage Locations"
              >
                <Settings size={16} />
              </button>
            </div>
            <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={searchIncludesOracleText}
                onChange={(e) => setSearchIncludesOracleText(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              Include card text in search
            </label>
            <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={offlineMode}
                onChange={(e) => setOfflineMode(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              Offline Mode
            </label>
            {/* Presets button */}
            <div className="relative" data-presets-panel>
              <button
                onClick={() => setShowPresets(p => !p)}
                className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg text-sm transition"
                title="Filter presets"
              >
                <Bookmark size={14} />
                <span>Presets</span>
              </button>
              {showPresets && (
                <FilterPresetsPanel
                  currentFilters={currentFilters}
                  onApply={applyPreset}
                  onClose={() => setShowPresets(false)}
                />
              )}
            </div>
            {scryfallSearchUrl && (
              <a
                href={scryfallSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg text-sm transition"
                title="Open this search on Scryfall"
              >
                <ExternalLink size={14} />
                <span>View on Scryfall</span>
              </a>
            )}
          </div>
            </div>
              )}
            </div>

        {/* Add/Edit Form - Collapseable */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg mb-6 shadow-xl">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full px-6 py-3 flex items-center justify-between text-white font-semibold hover:bg-white/5 transition"
          >
            <span>{showAddForm ? 'â–¼' : 'â–¶'} {editingId ? 'Edit Card' : 'Add New Card'}</span>
          </button>
          {showAddForm && (
          <div className="px-6 pb-6">
            <div className="flex justify-end items-center mb-4">
              <label className="flex items-center gap-2 text-white/90 text-sm cursor-pointer bg-white/10 px-4 py-1 rounded-lg hover:bg-white/20 transition">
                <input
                  type="checkbox"
                  checked={manualEntry}
                  onChange={(e) => setManualEntry(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                Manual Entry (Offline)
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className={`${manualEntry ? 'lg:col-span-3' : 'lg:col-span-2'} relative`}>
                <input
                  type="text"
                  placeholder={manualEntry ? "Card Name (manual entry)" : "Card Name (type to see autocomplete)"}
                  value={formData.name}
                  onChange={(e) => handleCardNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                {!manualEntry && showAutocomplete && autocompleteResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-purple-400 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {autocompleteResults.map((cardName, index) => (
                      <div
                        key={index}
                        onClick={() => selectAutocompleteCard(cardName)}
                        className="px-4 py-2 hover:bg-purple-600 cursor-pointer text-white border-b border-white/10 last:border-b-0"
                      >
                        {cardName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!manualEntry && (
                <button
                  onClick={searchScryfallManually}
                  className="px-4 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Search size={18} /> Search Scryfall
                </button>
              )}

              <button
                onClick={handleOpenCamera}
                className="px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
              >
                <Camera size={18} /> Scan Card
              </button>

              {!manualEntry && (
                <input
                  type="text"
                  placeholder="Set (optional)"
                  value={formData.set}
                  onChange={(e) => setFormData({...formData, set: e.target.value})}
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              )}
              <input
                type="text"
                placeholder="Set Code (optional, e.g., LCI)"
                value={formData.setCode || ''}
                onChange={(e) => setFormData({...formData, setCode: e.target.value.toUpperCase()})}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <input
                type="text"
                placeholder="Collector # (optional, e.g., 0226)"
                value={formData.collectorNumber || ''}
                onChange={(e) => setFormData({...formData, collectorNumber: e.target.value})}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <select
                value={formData.rarity || ''}
                onChange={(e) => setFormData({...formData, rarity: e.target.value})}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="">Rarity (optional)</option>
                <option value="C">Common</option>
                <option value="U">Uncommon</option>
                <option value="R">Rare</option>
                <option value="M">Mythic</option>
              </select>
              <input
                type="number"
                placeholder="Quantity"
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                min="1"
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <select
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {!manualEntry && (
                <input
                  type="number"
                  placeholder="Price ($)"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                  min="0"
                  step="0.01"
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              )}
              <input
                type="text"
                placeholder="Mana Cost (e.g., {2}{U}{U})"
                value={formData.manaCost}
                onChange={(e) => setFormData({...formData, manaCost: e.target.value})}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <input
                type="text"
                placeholder="Types (comma separated)"
                value={typesInputValue}
                onChange={(e) => setTypesInputValue(e.target.value)}
                onBlur={(e) => {
                  // Convert to array when user finishes typing
                  const types = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  setFormData({...formData, types});
                }}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <input
                type="text"
                placeholder="Tags (comma separated, e.g., commander, wishlist)"
                value={tagsInputValue}
                onChange={(e) => setTagsInputValue(e.target.value)}
                onBlur={(e) => {
                  // Convert to array when user finishes typing, normalize to lowercase
                  const tags = e.target.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                  setFormData({...formData, tags});
                }}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <select
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="">No Location</option>
                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-white mb-2 block">Colors:</label>
              <div className="flex gap-2">
                {mtgColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => toggleColor(color)}
                    className={`px-4 py-1 rounded-lg font-semibold transition ${
                      formData.colors.includes(color)
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/20 text-white/60 hover:bg-white/30'
                    }`}
                  >
                    {colorNames[color]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFoil}
                  onChange={(e) => setFormData({...formData, isFoil: e.target.checked})}
                  className="w-5 h-5 cursor-pointer"
                />
                <span className="font-semibold">This is a Foil card</span>
              </label>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isToken}
                  onChange={(e) => setFormData({...formData, isToken: e.target.checked})}
                  className="w-5 h-5 cursor-pointer"
                />
                <span className="font-semibold">This is a Token card</span>
              </label>
            </div>

            {formData.oracleText && (
              <div className="mb-4">
                <label className="text-white mb-2 block text-sm font-semibold">Card Text:</label>
                <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white/80 text-sm italic">
                  {formData.oracleText}
                </div>
              </div>
            )}

            {formData.tags && formData.tags.length > 0 && (
              <div className="mb-4">
                <label className="text-white mb-2 block text-sm font-semibold">Tags:</label>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-indigo-600/70 text-white text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleSubmit(formData, handleCancel)}
                className="flex-1 px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
              >
                <Save size={18} /> {editingId ? 'Update' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
              >
                <X size={18} /> Clear Form
              </button>
            </div>
          </div>
          )}
              </div>{/* end hidden sm:block desktop filter */}

              <MobileFilterSheet
                isOpen={showMobileFilters}
                onClose={() => setShowMobileFilters(false)}
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                filterCondition={filterCondition} setFilterCondition={setFilterCondition}
                filterSet={filterSet} setFilterSet={setFilterSet}
                filterColor={filterColor} setFilterColor={setFilterColor}
                filterType={filterType} setFilterType={setFilterType}
                filterSpecial={filterSpecial} setFilterSpecial={setFilterSpecial}
                filterRarity={filterRarity} setFilterRarity={setFilterRarity}
                filterTag={filterTag} setFilterTag={setFilterTag}
                filterLocation={filterLocation} setFilterLocation={setFilterLocation}
                sets={uniqueSets}
                availableTags={availableTags}
                locations={locations}
                onClear={() => {
                  setSearchTerm(''); setFilterCondition('all'); setFilterSet('all');
                  setFilterColor('all'); setFilterType('all'); setFilterSpecial('all');
                  setFilterRarity('all'); setFilterTag('all'); setFilterLocation('all');
                }}
              />
        </div>

        {/* Mobile card grid */}
        <div className="sm:hidden space-y-3 mb-4">
          {paginatedCards.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              {filteredAndSortedCards.length === 0 ? 'No cards in collection.' : 'No cards match your filters.'}
            </div>
          ) : (
            paginatedCards.map((card) => (
              <MobileCardRow
                key={card._id}
                card={card}
                formatPrice={formatPrice}
                onEdit={(c) => {
                  setEditingId(c._id);
                  setFormData({
                    name: c.name, set: c.set || '', setCode: c.setCode || '',
                    collectorNumber: c.collectorNumber || '', rarity: c.rarity || '',
                    quantity: c.quantity, condition: c.condition,
                    price: c.price, colors: c.colors || [], types: c.types || [],
                    manaCost: c.manaCost || '', tags: c.tags || [], location: c.location || '',
                    isToken: c.isToken || false, isFoil: c.isFoil || false,
                    oracleText: c.oracleText || '', imageUrl: c.imageUrl || '',
                    scryfallId: c.scryfallId || '',
                  });
                  setShowAddForm(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDelete={(id) => {
                  if (window.confirm('Delete this card?')) handleDelete(id, fetchCards);
                }}
                onUpdatePrice={(id) => updateCardPrice(id, false, false, fetchCards)}
                onViewDetail={setDetailCard}
              />
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white/10 backdrop-blur-md rounded-lg overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table
              className="w-full"
              onContextMenu={(e) => {
                e.preventDefault();
                const menuWidth = 250;
                const menuHeight = 420;
                const padding = 10;
                let x = e.clientX;
                let y = e.clientY;
                if (x + menuWidth + padding > window.innerWidth) x = window.innerWidth - menuWidth - padding;
                if (y + menuHeight + padding > window.innerHeight) y = window.innerHeight - menuHeight - padding;
                setContextMenu({ x, y });
              }}
            >
              <thead className="bg-white/20">
                <tr>
                  <th className="px-3 py-3 text-center text-white font-semibold">
                    <button
                      onClick={toggleSelectAllOnPage}
                      className="hover:text-purple-300 transition"
                      title={paginatedCards.every(c => selectedCards.has(c._id)) ? "Deselect all on page" : "Select all on page"}
                    >
                      {paginatedCards.length > 0 && paginatedCards.every(c => selectedCards.has(c._id)) ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-white font-semibold">Card Name</th>
                  {isColumnVisible('set') && <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Set</th>}
                  {isColumnVisible('setCode') && <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">Set Code</th>}
                  {isColumnVisible('collectorNumber') && <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">#</th>}
                  {isColumnVisible('rarity') && <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">Rarity</th>}
                  {isColumnVisible('manaCost') && <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Mana Cost</th>}
                  {isColumnVisible('colors') && <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Colors</th>}
                  {isColumnVisible('types') && <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Types</th>}
                  {isColumnVisible('location') && <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Location</th>}
                  {isColumnVisible('foil') && <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Foil</th>}
                  {isColumnVisible('token') && <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Token</th>}
                  {isColumnVisible('tags') && <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Tags</th>}
                  <th className="px-6 py-3 text-left text-white font-semibold">Qty</th>
                  <th className="px-6 py-3 text-left text-white font-semibold">Condition</th>
                  <th className="px-6 py-3 text-left text-white font-semibold">Price</th>
                  {isColumnVisible('buylistValue') && <th className="px-6 py-3 text-left text-white font-semibold">Buylist Value</th>}
                  {isColumnVisible('sellValue') && <th className="px-6 py-3 text-left text-white font-semibold">Sell Value</th>}
                  {isColumnVisible('total') && <th className="px-6 py-3 text-left text-white font-semibold">Total</th>}
                  {isColumnVisible('actions') && <th className="px-6 py-3 text-left text-white font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {paginatedCards.length === 0 ? (
                  <tr>
                    <td colSpan="18" className="px-6 py-8 text-center text-white/60">
                      {filteredAndSortedCards.length === 0 ? 'No cards in collection. Add your first card!' : 'No cards found on this page.'}
                    </td>
                  </tr>
                ) : (
                  paginatedCards.map(card => (
                    <tr key={card._id} onClick={e => {
                        if (e.target.closest?.('button') || e.target.closest?.('input') || e.target.closest?.('a')) return;
                        setDetailCard(card);
                      }} className={`hover:bg-white/5 transition cursor-pointer ${selectedCards.has(card._id) ? 'bg-purple-900/30' : ''}`}>
                      <td className="px-3 py-4 text-center">
                        <button
                          onClick={() => toggleCardSelection(card._id)}
                          className="hover:text-purple-300 transition text-white"
                        >
                          {selectedCards.has(card._id) ? (
                            <CheckSquare size={18} />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td
                        className="px-6 py-4 text-white font-medium cursor-pointer hover:text-purple-300 transition"
                        onMouseEnter={(e) => {
                          setHoveredCard(card);
                          handleCardHover(card);
                        }}
                        onMouseLeave={() => { setHoveredCard(null); setHoveredCardPriceHistory([]); }}
                      >
                        {card.name}
                      </td>
                      {isColumnVisible('set') && <td className="px-6 py-4 text-white/80 text-sm hidden lg:table-cell">{card.set}</td>}
                      {isColumnVisible('setCode') && <td className="px-6 py-4 text-white/80 text-xs hidden xl:table-cell">{card.setCode || 'â€”'}</td>}
                      {isColumnVisible('collectorNumber') && <td className="px-6 py-4 text-white/80 text-xs hidden xl:table-cell">{card.collectorNumber || 'â€”'}</td>}
                      {isColumnVisible('rarity') && <td className="px-6 py-4 text-white/80 text-xs hidden xl:table-cell">{card.rarity || 'â€”'}</td>}
                      {isColumnVisible('manaCost') && <td className="px-6 py-4 text-white/80 text-sm font-mono hidden lg:table-cell">
                        {card.manaCost || '0'}
                      </td>}
                      {isColumnVisible('colors') && <td className="px-6 py-4 text-white/80 text-sm hidden lg:table-cell">
                        {card.colors && card.colors.length > 0 ? card.colors.join(', ') : '-'}
                      </td>}
                      {isColumnVisible('types') && <td className="px-6 py-4 text-white/80 text-sm hidden lg:table-cell">
                        {card.types && card.types.length > 0 ? card.types.join(' ') : '-'}
                      </td>}
                      {isColumnVisible('location') && <td className="px-6 py-4 text-white/80 text-sm hidden xl:table-cell">
                        {card.location ? (
                          <span className="px-2 py-1 bg-blue-600/50 text-white text-xs rounded flex items-center gap-1 w-fit">
                            <MapPin size={12} /> {card.location}
                          </span>
                        ) : (
                          <span className="text-white/40 text-sm">-</span>
                        )}
                      </td>}
                      {isColumnVisible('foil') && <td className="px-6 py-4 hidden xl:table-cell">
                        {card.isFoil ? (
                          <span className="px-2 py-1 bg-amber-600/50 text-white text-sm rounded font-semibold">
                            Foil âœ¨
                          </span>
                        ) : (
                          <span className="text-white/40 text-sm">-</span>
                        )}
                      </td>}
                      {isColumnVisible('token') && <td className="px-6 py-4 hidden xl:table-cell">
                        {card.isToken ? (
                          <span className="px-2 py-1 bg-yellow-600/50 text-white text-sm rounded font-semibold">
                            Token
                          </span>
                        ) : (
                          <span className="text-white/40 text-sm">-</span>
                        )}
                      </td>}
                      {isColumnVisible('tags') && <td className="px-6 py-4 hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1 items-center">
                          {card.tags && card.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-indigo-600/70 text-white text-xs rounded-full flex items-center gap-1"
                            >
                              {tag}
                              <button
                                onClick={() => handleRemoveTag(card._id, tag, fetchAvailableTags)}
                                className="hover:text-red-300 transition"
                                title="Remove tag"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                          {showTagInput === card._id ? (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddTag(card._id, newTag, setNewTag, setShowTagInput, fetchAvailableTags);
                                  }
                                }}
                                placeholder="tag"
                                className="px-2 py-1 bg-white/20 border border-white/30 rounded text-white text-xs w-24 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                autoFocus
                              />
                              <button
                                onClick={() => handleAddTag(card._id, newTag, setNewTag, setShowTagInput, fetchAvailableTags)}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                              >
                                <Save size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  setShowTagInput(null);
                                  setNewTag('');
                                }}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowTagInput(card._id)}
                              className="px-2 py-1 bg-purple-600/50 hover:bg-purple-600 text-white text-xs rounded-full"
                              title="Add tag"
                            >
                              <Plus size={12} />
                            </button>
                          )}
                        </div>
                      </td>}
                      {isColumnVisible('quantity') && <td className="px-6 py-4 text-white/80">{card.quantity}</td>}
                      {isColumnVisible('condition') && <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-purple-600/50 text-white text-sm rounded">
                          {card.condition}
                        </span>
                      </td>}
                      {isColumnVisible('price') && <td
                        onMouseEnter={e => handlePriceCellEnter(e, card)}
                        onMouseLeave={handlePriceCellLeave}
                        className="px-6 py-4 text-white/80"
                      >{formatPrice(card.price)}</td>}
                      {isColumnVisible('buylistValue') && <td className="px-6 py-4 text-white">${(card.buylistValue || 0).toFixed(2)}</td>}
                      {isColumnVisible('sellValue') && <td className="px-6 py-4 text-white">${(card.sellValue || 0).toFixed(2)}</td>}
                      {isColumnVisible('total') && <td className="px-6 py-4 text-white font-semibold">
                        {formatPrice(card.price * card.quantity)}
                      </td>}
                      {isColumnVisible('actions') && <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateCardPrice(card._id)}
                            className="p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
                            title="Update price from Scryfall"
                          >
                            <DollarSign size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(card)}
                            className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                            title="Edit card"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => findSimilarCards(card)}
                            className="p-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition"
                            title="Find similar cards"
                          >
                            <Layers size={16} />
                          </button>
                          <button
                            onClick={() => findCardSynergies(card)}
                            className="p-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition"
                            title="Find card synergies"
                          >
                            <Zap size={16} />
                          </button>
                          <button
                            onClick={() => setPriceAlertCard(card)}
                            className={`p-1 hover:bg-amber-700 text-white rounded transition ${card.priceAlert?.targetPrice > 0 || card.priceAlert?.targetHigh > 0 ? 'bg-amber-600' : 'bg-amber-600/40'}`}
                            title="Set price alert"
                          >
                            <Bell size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(card._id)}
                            className="p-1 bg-red-600 hover:bg-red-700 text-white rounded transition"
                            title="Delete card"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <ColumnContextMenu
            isOpen={contextMenu !== null}
            position={contextMenu || { x: 0, y: 0 }}
            columns={allColumns}
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
            onClose={() => setContextMenu(null)}
            onEdit={() => { setContextMenu(null); setShowColumnSettings(true); }}
          />

          <ColumnSettingsModal
            isOpen={showColumnSettings}
            columns={allColumns}
            visibleColumns={visibleColumns}
            onToggle={toggleColumn}
            onSelectAll={selectAllColumns}
            onReset={resetColumns}
            onClose={() => setShowColumnSettings(false)}
          />

          {/* Pagination Controls */}
          {filteredAndSortedCards.length > 0 && (
            <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex items-center justify-between">
              <div className="text-white/80 text-sm">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredAndSortedCards.length)} of {filteredAndSortedCards.length} cards
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="text-white/80 text-sm px-4">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>{/* end hidden sm:block desktop table */}

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div className="sm:hidden flex items-center justify-between mt-4 px-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl disabled:opacity-40 transition min-h-[44px] font-medium"
            >
              ← Prev
            </button>
            <span className="text-white/60 text-sm">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl disabled:opacity-40 transition min-h-[44px] font-medium"
            >
              Next →
            </button>
          </div>
        )}

        {/* Collection Value History - Bottom */}
        <div className="mt-8 mb-6">
          <ValueHistoryChart />
        </div>

        {/* Card Image Hover Preview */}
        {hoveredCard && hoveredCard.scryfallId && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <img
              src={`${API_URL}/images/${hoveredCard.scryfallId}`}
              alt={hoveredCard.name}
              className="w-80 rounded-xl shadow-2xl border-4 border-purple-500 bg-gray-900"
              onError={(e) => {
                e.target.src = hoveredCard.imageUrl || '';
              }}
            />
            {hoveredCardPriceHistory.length > 0 && (
              <div className="mt-2 bg-gray-900/90 rounded-lg px-3 py-2 border border-purple-500/50">
                <p className="text-xs text-slate-400 mb-1">Price trend</p>
                <div className="flex gap-1 items-end h-6 justify-end">
                  {hoveredCardPriceHistory.map((h, i) => (
                    <div
                      key={i}
                      className="w-0.5 bg-purple-400"
                      style={{ height: `${(h.price / Math.max(...hoveredCardPriceHistory.map(x => x.price))) * 20}px` }}
                      title={`$${h.price.toFixed(2)} on ${new Date(h.date).toLocaleDateString()}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
          </>

    {/* Import Progress Modal */}        {/* Import Progress Modal */}
        {isImporting && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-8 border-2 border-purple-500 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Importing Cards</h2>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-white/80 mb-2">
                  <span>Progress</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  >
                    <span className="text-xs font-bold text-white">
                      {Math.round((importProgress.current / importProgress.total) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Card */}
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-sm text-white/60 mb-1">Currently importing:</div>
                <div className="text-lg font-semibold text-white">{importProgress.cardName || 'Loading...'}</div>
              </div>

              {/* Animated spinner */}
              <div className="flex justify-center mt-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            </div>
          </div>
        )}

        {/* Import Results Modal */}
        {showImportResults && importResults && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white">Import Results</h2>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-600/20 rounded-lg p-4 border border-green-600/50">
                    <div className="text-sm text-green-400">Added</div>
                    <div className="text-3xl font-bold text-green-500">{importResults.added.length}</div>
                  </div>
                  <div className="bg-blue-600/20 rounded-lg p-4 border border-blue-600/50">
                    <div className="text-sm text-blue-400">Merged</div>
                    <div className="text-3xl font-bold text-blue-500">{importResults.merged.length}</div>
                  </div>
                  {importResults.offline && (
                    <div className="bg-yellow-600/20 rounded-lg p-4 border border-yellow-600/50">
                      <div className="text-sm text-yellow-400">Offline</div>
                      <div className="text-3xl font-bold text-yellow-500">{importResults.offline.length}</div>
                    </div>
                  )}
                  <div className="bg-red-600/20 rounded-lg p-4 border border-red-600/50">
                    <div className="text-sm text-red-400">Failed</div>
                    <div className="text-3xl font-bold text-red-500">{importResults.failed.length}</div>
                  </div>
                </div>

                {importResults.added.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-green-400 mb-2">âœ“ Added Cards</h3>
                    <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {importResults.added.map((item, i) => (
                        <div key={i} className="text-sm text-white/80 py-1">{item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {importResults.merged.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">â†‘ Merged Cards</h3>
                    <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {importResults.merged.map((item, i) => (
                        <div key={i} className="text-sm text-white/80 py-1">{item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {importResults.offline && importResults.offline.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">âš  Offline Imports</h3>
                    <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {importResults.offline.map((item, i) => (
                        <div key={i} className="text-sm text-white/80 py-1">{item}</div>
                      ))}
                    </div>
                    <p className="text-xs text-yellow-400/80 mt-2">
                      These cards were added without full details. Use "Update All Prices" when online to fetch complete data.
                    </p>
                  </div>
                )}

                {importResults.failed.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">âœ— Failed Cards</h3>
                    <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {importResults.failed.map((item, i) => (
                        <div key={i} className="text-sm text-white/80 py-1">{item}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-white/10">
                <button
                  onClick={() => setShowImportResults(false)}
                  className="w-full px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions Floating Bar */}
        {selectedCards.size > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border-2 border-purple-500 px-6 py-4 flex items-center gap-4 z-40">
            <span className="text-white font-semibold">
              {selectedCards.size} card{selectedCards.size > 1 ? 's' : ''} selected
            </span>
            <div className="h-6 w-px bg-white/20"></div>
            <button
              onClick={() => setBulkUpdateModal('condition')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
            >
              Update Condition
            </button>
            <button
              onClick={() => setBulkUpdateModal('location')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
            >
              Update Location
            </button>
            <button
              onClick={() => setBulkUpdateModal('addTags')}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition"
            >
              Add Tags
            </button>
            <button
              onClick={() => setBulkUpdateModal('removeTags')}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition"
            >
              Remove Tags
            </button>
            <button
              onClick={() => setBulkUpdateModal('delete')}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition"
            >
              Delete
            </button>
            <div className="h-6 w-px bg-white/20"></div>
            <button
              onClick={handlePrintProxies}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition"
            >
              ðŸ–¨ï¸ Print Proxies
            </button>
            <div className="h-6 w-px bg-white/20"></div>
            <button
              onClick={clearSelection}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition"
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Bulk Update Modals */}
        {bulkUpdateModal === 'condition' && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-6 border-2 border-purple-500 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Update Condition</h2>
              <p className="text-white/60 mb-4">Set condition for {selectedCards.size} selected cards:</p>
              <select
                value={bulkCondition}
                onChange={(e) => setBulkCondition(e.target.value)}
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkUpdateCondition}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  Update
                </button>
                <button
                  onClick={() => setBulkUpdateModal(null)}
                  className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkUpdateModal === 'location' && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-6 border-2 border-purple-500 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Update Location</h2>
              <p className="text-white/60 mb-4">Set location for {selectedCards.size} selected cards:</p>
              <select
                value={bulkLocation}
                onChange={(e) => setBulkLocation(e.target.value)}
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="">No Location</option>
                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkUpdateLocation}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  Update
                </button>
                <button
                  onClick={() => setBulkUpdateModal(null)}
                  className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkUpdateModal === 'addTags' && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-6 border-2 border-purple-500 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Add Tags</h2>
              <p className="text-white/60 mb-4">Add tags to {selectedCards.size} selected cards:</p>
              <input
                type="text"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
                placeholder="Tags (comma separated)"
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white mb-4 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleBulkAddTags}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                >
                  Add Tags
                </button>
                <button
                  onClick={() => { setBulkUpdateModal(null); setBulkTags(''); }}
                  className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkUpdateModal === 'removeTags' && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-6 border-2 border-purple-500 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Remove Tags</h2>
              <p className="text-white/60 mb-4">Remove tags from {selectedCards.size} selected cards:</p>
              <input
                type="text"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
                placeholder="Tags to remove (comma separated)"
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white mb-4 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleBulkRemoveTags}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition"
                >
                  Remove Tags
                </button>
                <button
                  onClick={() => { setBulkUpdateModal(null); setBulkTags(''); }}
                  className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkUpdateModal === 'delete' && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-6 border-2 border-red-500 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Delete Cards</h2>
              <p className="text-white/60 mb-4">
                Are you sure you want to delete {selectedCards.size} selected cards? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                >
                  Delete Cards
                </button>
                <button
                  onClick={() => setBulkUpdateModal(null)}
                  className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Print Proxies Preview Modal */}
        {showPrintPreview && (
          <div className="fixed inset-0 bg-black/90 flex flex-col z-50 print:bg-white">
            {/* Header - hidden when printing */}
            <div className="bg-gray-900 p-4 flex justify-between items-center print:hidden">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white">Print Proxies</h2>
                <span className="text-white/60">
                  {getSelectedCardsForPrint().length} cards ({Math.ceil(getSelectedCardsForPrint().length / 9)} pages)
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={executePrint}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition flex items-center gap-2"
                >
                  ðŸ–¨ï¸ Print
                </button>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Print Content */}
            <div className="flex-1 overflow-auto p-4 print:p-0 print:overflow-visible">
              <div className="print-content">
                {/* Group cards into pages of 9 */}
                {Array.from({ length: Math.ceil(getSelectedCardsForPrint().length / 9) }, (_, pageIndex) => (
                  <div
                    key={pageIndex}
                    className="print-page bg-white mx-auto mb-8 print:mb-0 print:break-after-page"
                    style={{
                      width: '8.5in',
                      minHeight: '11in',
                      padding: '0.25in',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div
                      className="grid grid-cols-3 gap-2"
                      style={{
                        width: '100%',
                        height: '100%'
                      }}
                    >
                      {getSelectedCardsForPrint()
                        .slice(pageIndex * 9, (pageIndex + 1) * 9)
                        .map((card, cardIndex) => (
                          <div
                            key={card._id}
                            className="proxy-card flex items-center justify-center bg-gray-100 rounded overflow-hidden"
                            style={{
                              width: '2.5in',
                              height: '3.5in'
                            }}
                          >
                            {card.imageUrl ? (
                              <img
                                src={card.imageUrl?.startsWith('/api/') ? `${API_URL.replace('/api', '')}${card.imageUrl}` : card.imageUrl}
                                alt={card.name}
                                className="w-full h-full object-contain"
                                style={{ maxWidth: '2.5in', maxHeight: '3.5in' }}
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-300 text-gray-600 p-2 text-center">
                                <div className="text-sm font-bold mb-1">{card.name}</div>
                                <div className="text-xs">{card.set}</div>
                                <div className="text-xs mt-2 text-gray-500">No image available</div>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Similar Cards Modal */}
        {showSimilarCards && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-purple-500">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Similar Cards</h2>
                  {similarCardsSource && (
                    <p className="text-white/60 mt-1">
                      Finding cards similar to <span className="text-purple-400 font-semibold">{similarCardsSource.name}</span>
                      {similarCardsSource.types?.length > 0 && ` (${similarCardsSource.types[0]})`}
                      {similarCardsSource.colors?.length > 0 && ` â€¢ ${similarCardsSource.colors.join(', ')}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setShowSimilarCards(false); setSimilarCards([]); setSimilarCardsSource(null); }}
                  className="text-white/60 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {loadingSimilar ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw size={48} className="text-purple-500 animate-spin mb-4" />
                    <p className="text-white/60">Searching for similar cards...</p>
                  </div>
                ) : similarCards.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-white/60">No similar cards found.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {similarCards.map((card) => (
                      <div key={card.id} className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition">
                        {card.image_uris?.normal ? (
                          <img
                            src={card.image_uris.normal}
                            alt={card.name}
                            className="w-full h-auto"
                          />
                        ) : card.card_faces?.[0]?.image_uris?.normal ? (
                          <img
                            src={card.card_faces[0].image_uris.normal}
                            alt={card.name}
                            className="w-full h-auto"
                          />
                        ) : (
                          <div className="aspect-[2.5/3.5] bg-gray-700 flex items-center justify-center">
                            <span className="text-white/60 text-sm text-center p-2">{card.name}</span>
                          </div>
                        )}
                        <div className="p-3">
                          <h3 className="text-white font-semibold text-sm truncate" title={card.name}>{card.name}</h3>
                          <p className="text-white/60 text-xs truncate">{card.set_name}</p>
                          <p className="text-green-400 text-sm mt-1">
                            ${card.prices?.usd || '0.00'}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => addSimilarCardToCollection(card)}
                              className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition"
                              title="Add to collection"
                            >
                              + Collection
                            </button>
                            <button
                              onClick={() => addSimilarCardToWishlist(card)}
                              className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition"
                              title="Add to wishlist"
                            >
                              + Wishlist
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/10 bg-white/5">
                <p className="text-white/40 text-xs text-center">
                  Showing up to 20 similar cards based on type and color â€¢ Powered by Scryfall
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Card Synergies Modal */}
        {showSynergies && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-yellow-500">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Zap className="text-yellow-500" size={24} /> Card Synergies
                  </h2>
                  {synergiesSource && (
                    <p className="text-white/60 mt-1">
                      Finding synergies for <span className="text-yellow-400 font-semibold">{synergiesSource.name}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setShowSynergies(false); setSynergies({ tribal: [], keywords: [], mechanics: [] }); setSynergiesSource(null); }}
                  className="text-white/60 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Synergy Category Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setSynergiesTab('tribal')}
                  className={`flex-1 px-4 py-3 font-semibold transition ${
                    synergiesTab === 'tribal'
                      ? 'text-white bg-white/10 border-b-2 border-yellow-500'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Tribal ({synergies.tribal.length})
                </button>
                <button
                  onClick={() => setSynergiesTab('keywords')}
                  className={`flex-1 px-4 py-3 font-semibold transition ${
                    synergiesTab === 'keywords'
                      ? 'text-white bg-white/10 border-b-2 border-yellow-500'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Keywords ({synergies.keywords.length})
                </button>
                <button
                  onClick={() => setSynergiesTab('mechanics')}
                  className={`flex-1 px-4 py-3 font-semibold transition ${
                    synergiesTab === 'mechanics'
                      ? 'text-white bg-white/10 border-b-2 border-yellow-500'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Mechanics ({synergies.mechanics.length})
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {loadingSynergies ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw size={48} className="text-yellow-500 animate-spin mb-4" />
                    <p className="text-white/60">Analyzing card and searching for synergies...</p>
                  </div>
                ) : (
                  <>
                    {/* Tribal Synergies */}
                    {synergiesTab === 'tribal' && (
                      synergies.tribal.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-white/60">No tribal synergies found.</p>
                          <p className="text-white/40 text-sm mt-2">This card may not be a creature or have a notable creature type.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {synergies.tribal.map((card) => (
                            <div key={card.id} className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition">
                              {card.image_uris?.normal ? (
                                <img src={card.image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                              ) : card.card_faces?.[0]?.image_uris?.normal ? (
                                <img src={card.card_faces[0].image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                              ) : (
                                <div className="aspect-[2.5/3.5] bg-gray-700 flex items-center justify-center">
                                  <span className="text-white/60 text-sm text-center p-2">{card.name}</span>
                                </div>
                              )}
                              <div className="p-3">
                                <h3 className="text-white font-semibold text-sm truncate" title={card.name}>{card.name}</h3>
                                <p className="text-white/60 text-xs truncate">{card.type_line}</p>
                                <p className="text-green-400 text-sm mt-1">${card.prices?.usd || '0.00'}</p>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => addSynergyCardToCollection(card)}
                                    className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition"
                                  >
                                    + Collection
                                  </button>
                                  <button
                                    onClick={() => addSynergyCardToWishlist(card)}
                                    className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition"
                                  >
                                    + Wishlist
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {/* Keyword Synergies */}
                    {synergiesTab === 'keywords' && (
                      synergies.keywords.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-white/60">No keyword synergies found.</p>
                          <p className="text-white/40 text-sm mt-2">This card may not have notable keyword abilities.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {synergies.keywords.map((card) => (
                            <div key={card.id} className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition">
                              {card.image_uris?.normal ? (
                                <img src={card.image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                              ) : card.card_faces?.[0]?.image_uris?.normal ? (
                                <img src={card.card_faces[0].image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                              ) : (
                                <div className="aspect-[2.5/3.5] bg-gray-700 flex items-center justify-center">
                                  <span className="text-white/60 text-sm text-center p-2">{card.name}</span>
                                </div>
                              )}
                              <div className="p-3">
                                <h3 className="text-white font-semibold text-sm truncate" title={card.name}>{card.name}</h3>
                                <p className="text-white/60 text-xs truncate">{card.type_line}</p>
                                <p className="text-green-400 text-sm mt-1">${card.prices?.usd || '0.00'}</p>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => addSynergyCardToCollection(card)}
                                    className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition"
                                  >
                                    + Collection
                                  </button>
                                  <button
                                    onClick={() => addSynergyCardToWishlist(card)}
                                    className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition"
                                  >
                                    + Wishlist
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}

                    {/* Mechanic Synergies */}
                    {synergiesTab === 'mechanics' && (
                      synergies.mechanics.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-white/60">No mechanic synergies found.</p>
                          <p className="text-white/40 text-sm mt-2">Try checking the Tribal or Keywords tabs.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {synergies.mechanics.map((card) => (
                            <div key={card.id} className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition">
                              {card.image_uris?.normal ? (
                                <img src={card.image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                              ) : card.card_faces?.[0]?.image_uris?.normal ? (
                                <img src={card.card_faces[0].image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                              ) : (
                                <div className="aspect-[2.5/3.5] bg-gray-700 flex items-center justify-center">
                                  <span className="text-white/60 text-sm text-center p-2">{card.name}</span>
                                </div>
                              )}
                              <div className="p-3">
                                <h3 className="text-white font-semibold text-sm truncate" title={card.name}>{card.name}</h3>
                                <p className="text-white/60 text-xs truncate">{card.type_line}</p>
                                <p className="text-green-400 text-sm mt-1">${card.prices?.usd || '0.00'}</p>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={() => addSynergyCardToCollection(card)}
                                    className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition"
                                  >
                                    + Collection
                                  </button>
                                  <button
                                    onClick={() => addSynergyCardToWishlist(card)}
                                    className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition"
                                  >
                                    + Wishlist
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </>
                )}
              </div>

              <div className="p-4 border-t border-white/10 bg-white/5">
                <p className="text-white/40 text-xs text-center">
                  Synergies found by analyzing tribal types, keywords, and card mechanics â€¢ Sorted by EDHREC popularity
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Commander Recommendations Modal */}
        {showCommanderRecs && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-amber-500">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Crown className="text-amber-500" size={24} /> Commander Recommendations
                  </h2>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setCommanderFinderMode('collection')}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${commanderFinderMode === 'collection' ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                    >
                      From Collection
                    </button>
                    <button
                      onClick={() => setCommanderFinderMode('finder')}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${commanderFinderMode === 'finder' ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                    >
                      Commander Finder
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setShowCommanderRecs(false); setCommanderRecs([]); setCommanderFinderMode('collection'); }}
                  className="text-white/60 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Mode-specific controls */}
              {commanderFinderMode === 'collection' ? (
                <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex items-center gap-4">
                  <span className="text-white/60 text-sm">Filter by color:</span>
                  <select
                    value={commanderColorFilter}
                    onChange={(e) => { setCommanderColorFilter(e.target.value); }}
                    className="px-3 py-1 bg-white/20 border border-white/30 rounded text-white text-sm"
                  >
                    <option value="auto">Auto (based on collection)</option>
                    <option value="all">All Colors</option>
                    <option value="w">White</option>
                    <option value="u">Blue</option>
                    <option value="b">Black</option>
                    <option value="r">Red</option>
                    <option value="g">Green</option>
                    <option value="wubrg">5-Color</option>
                  </select>
                  <button
                    onClick={getCommanderRecommendations}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm transition"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="px-6 py-4 bg-white/5 border-b border-white/10 space-y-3">
                  {/* Color Identity Picker */}
                  <div className="flex items-center gap-3">
                    <span className="text-white/60 text-sm w-24 shrink-0">Colors:</span>
                    <div className="flex gap-2">
                      {[
                        { code: 'W', label: 'W', bg: 'bg-yellow-100', active: 'bg-yellow-300 ring-2 ring-yellow-400', text: 'text-yellow-900' },
                        { code: 'U', label: 'U', bg: 'bg-blue-200', active: 'bg-blue-400 ring-2 ring-blue-500', text: 'text-blue-900' },
                        { code: 'B', label: 'B', bg: 'bg-gray-400', active: 'bg-gray-600 ring-2 ring-gray-500', text: 'text-gray-100' },
                        { code: 'R', label: 'R', bg: 'bg-red-200', active: 'bg-red-500 ring-2 ring-red-400', text: 'text-red-900' },
                        { code: 'G', label: 'G', bg: 'bg-green-200', active: 'bg-green-500 ring-2 ring-green-400', text: 'text-green-900' },
                      ].map(({ code, label, bg, active, text }) => (
                        <button
                          key={code}
                          onClick={() => setFinderColors(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])}
                          className={`w-8 h-8 rounded-full font-bold text-sm flex items-center justify-center transition ${text} ${finderColors.includes(code) ? active : `${bg} opacity-40 hover:opacity-70`}`}
                          title={code === 'W' ? 'White' : code === 'U' ? 'Blue' : code === 'B' ? 'Black' : code === 'R' ? 'Red' : 'Green'}
                        >
                          {label}
                        </button>
                      ))}
                      {finderColors.length > 0 && (
                        <button
                          onClick={() => setFinderColors([])}
                          className="px-2 py-1 text-white/40 hover:text-white/70 text-xs transition"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {finderColors.length === 0 && <span className="text-white/40 text-xs">Any color</span>}
                  </div>

                  {/* Strategy/Theme Selector */}
                  <div className="flex items-start gap-3">
                    <span className="text-white/60 text-sm w-24 shrink-0 pt-1">Themes:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'tokens', 'graveyard', 'counters', 'lifegain', 'sacrifice',
                        'spellslinger', 'artifacts', 'enchantments', 'tribal', 'ramp',
                        'draw', 'control', 'voltron', 'mill', 'blink',
                        'stax', 'grouphug', 'aristocrats', 'storm', 'landfall'
                      ].map(theme => (
                        <button
                          key={theme}
                          onClick={() => setFinderThemes(prev => prev.includes(theme) ? prev.filter(t => t !== theme) : [...prev, theme])}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition ${finderThemes.includes(theme) ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                        >
                          {theme === 'grouphug' ? 'Group Hug' : theme === 'counters' ? '+1/+1 Counters' : theme === 'blink' ? 'Blink/Flicker' : theme.charAt(0).toUpperCase() + theme.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Creature Type Input + Search Button */}
                  <div className="flex items-center gap-3">
                    <span className="text-white/60 text-sm w-24 shrink-0">Type:</span>
                    <input
                      type="text"
                      value={finderCreatureType}
                      onChange={(e) => setFinderCreatureType(e.target.value)}
                      placeholder="e.g. Dragon, Elf, Zombie (optional)"
                      className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm placeholder-white/30 w-64"
                      onKeyDown={(e) => { if (e.key === 'Enter') searchCommandersByPreference(); }}
                    />
                    <button
                      onClick={searchCommandersByPreference}
                      className="px-4 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium transition flex items-center gap-1.5"
                    >
                      <Search size={14} /> Search
                    </button>
                  </div>
                </div>
              )}

              <div className="p-6 overflow-y-auto flex-1">
                {loadingCommanders ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw size={48} className="text-amber-500 animate-spin mb-4" />
                    <p className="text-white/60">{commanderFinderMode === 'collection' ? 'Analyzing your collection and finding commanders...' : 'Searching for commanders...'}</p>
                  </div>
                ) : commanderRecs.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-white/60">{commanderFinderMode === 'collection' ? 'No commanders found. Try adjusting the color filter.' : 'Select colors, themes, or a creature type and click Search.'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {commanderRecs.map((card) => (
                      <div key={card.id} className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition">
                        {card.image_uris?.normal ? (
                          <img src={card.image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                        ) : card.card_faces?.[0]?.image_uris?.normal ? (
                          <img src={card.card_faces[0].image_uris.normal} alt={card.name} className="w-full h-auto" loading="lazy" />
                        ) : (
                          <div className="aspect-[2.5/3.5] bg-gray-700 flex items-center justify-center">
                            <span className="text-white/60 text-sm text-center p-2">{card.name}</span>
                          </div>
                        )}
                        <div className="p-3">
                          <h3 className="text-white font-semibold text-sm truncate" title={card.name}>{card.name}</h3>
                          <p className="text-white/60 text-xs truncate">{card.type_line?.replace('Legendary ', '')}</p>
                          <p className="text-green-400 text-sm mt-1">${card.prices?.usd || '0.00'}</p>
                          <button
                            onClick={() => addCommanderToCollection(card)}
                            className="w-full mt-2 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded transition"
                          >
                            + Add to Collection
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/10 bg-white/5">
                <p className="text-white/40 text-xs text-center">
                  {commanderFinderMode === 'collection' ? 'Recommendations based on your collection\'s colors and card themes' : 'Search results based on your selected preferences'} â€¢ Sorted by EDHREC popularity
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Set Completion Tracker Modal */}
        {showSetCompletion && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-teal-500">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="text-teal-500" size={24} /> Set Completion Tracker
                  </h2>
                  <p className="text-white/60 mt-1">
                    Your progress toward completing each set
                  </p>
                </div>
                <button
                  onClick={() => { setShowSetCompletion(false); setCompletionData([]); }}
                  className="text-white/60 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {loadingSetCompletion ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw size={48} className="text-teal-500 animate-spin mb-4" />
                    <p className="text-white/60">Fetching set information...</p>
                  </div>
                ) : completionData.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-white/60">No set data available. Make sure your cards have set codes.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {completionData.map((set) => {
                      const percentage = Math.round((set.ownedUnique / set.totalInSet) * 100);
                      return (
                        <div key={set.setCode} className="bg-white/5 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {set.icon && (
                                <img src={set.icon} alt={set.setCode} className="w-6 h-6 invert" loading="lazy" />
                              )}
                              <div>
                                <h3 className="text-white font-semibold">{set.setName}</h3>
                                <p className="text-white/40 text-xs">{set.setCode} â€¢ {set.setType}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-white font-bold">{percentage}%</p>
                              <p className="text-white/60 text-sm">{set.ownedUnique} / {set.totalInSet} cards</p>
                            </div>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all ${
                                percentage === 100 ? 'bg-green-500' :
                                percentage >= 75 ? 'bg-teal-500' :
                                percentage >= 50 ? 'bg-blue-500' :
                                percentage >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-white/40 text-xs mt-2">
                            {set.totalOwned} total copies owned
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/10 bg-white/5">
                <p className="text-white/40 text-xs text-center">
                  Showing up to 20 sets from your collection â€¢ Sorted by completion percentage
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Combo Finder Modal */}
        {showComboFinder && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-orange-500">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Zap className="text-orange-500" size={24} /> Combo Finder
                  </h2>
                  <p className="text-white/60 mt-1">
                    Infinite combos you can assemble from your collection
                  </p>
                </div>
                <button
                  onClick={() => { setShowComboFinder(false); setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0 }); setComboTab('complete'); }}
                  className="text-white/60 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Tab buttons */}
              {!loadingCombos && !comboResults.error && (
                <div className="px-6 py-3 border-b border-white/10 flex gap-2">
                  <button
                    onClick={() => setComboTab('complete')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      comboTab === 'complete'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    Complete ({comboResults.found})
                  </button>
                  <button
                    onClick={() => setComboTab('partial')}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      comboTab === 'partial'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    Near-Complete ({comboResults.partialFound || 0})
                  </button>
                </div>
              )}

              <div className="p-6 overflow-y-auto flex-1">
                {loadingCombos ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw size={48} className="text-orange-500 animate-spin mb-4" />
                    <p className="text-white/60">Searching Commander Spellbook for combos in your collection...</p>
                    <p className="text-white/40 text-sm mt-2">This may take a moment on first load</p>
                  </div>
                ) : comboResults.error ? (
                  <div className="text-center py-12">
                    <p className="text-red-400 mb-2">Error finding combos</p>
                    <p className="text-white/60 text-sm">{comboResults.error}</p>
                    <button
                      onClick={findCombos}
                      className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
                    >
                      Try Again
                    </button>
                  </div>
                ) : comboTab === 'complete' ? (
                  // Complete Combos Tab
                  comboResults.combos.length === 0 ? (
                    <div className="text-center py-12">
                      <Zap size={48} className="text-white/20 mx-auto mb-4" />
                      <p className="text-white/60 mb-2">No complete combos found in your collection</p>
                      <p className="text-white/40 text-sm">
                        Check the "Near-Complete" tab to see combos you're close to assembling!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {comboResults.combos.map((combo, idx) => (
                        <div key={combo.id || idx} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition">
                          <div className="flex flex-wrap gap-2 mb-3">
                            {combo.cards.map((cardName, cardIdx) => (
                              <span
                                key={cardIdx}
                                className="px-3 py-1 bg-green-600/30 text-green-200 rounded-full text-sm font-medium"
                              >
                                âœ“ {cardName}
                              </span>
                            ))}
                          </div>

                          {combo.produces && combo.produces.length > 0 && (
                            <div className="mb-3">
                              <span className="text-white/60 text-sm">Produces: </span>
                              <span className="text-green-400 text-sm">
                                {Array.isArray(combo.produces)
                                  ? combo.produces.map(p => {
                                      if (typeof p === 'string') return p;
                                      if (p.feature && p.feature.name) return p.feature.name;
                                      if (p.name) return p.name;
                                      if (p.description) return p.description;
                                      return JSON.stringify(p);
                                    }).join(', ')
                                  : combo.produces}
                              </span>
                            </div>
                          )}

                          {combo.prerequisite && (
                            <div className="mb-2">
                              <span className="text-white/60 text-sm">Prerequisites: </span>
                              <span className="text-white/80 text-sm">{combo.prerequisite}</span>
                            </div>
                          )}

                          {combo.steps && (
                            <div className="mb-2">
                              <span className="text-white/60 text-sm">Steps: </span>
                              <span className="text-white/80 text-sm">{combo.steps}</span>
                            </div>
                          )}

                          {combo.description && !combo.steps && (
                            <p className="text-white/70 text-sm">{combo.description}</p>
                          )}

                          {combo.spellbookUrl && (
                            <a
                              href={combo.spellbookUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 text-orange-400 hover:text-orange-300 text-sm underline"
                            >
                              View on Commander Spellbook â†’
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // Partial Combos Tab
                  (!comboResults.partialCombos || comboResults.partialCombos.length === 0) ? (
                    <div className="text-center py-12">
                      <Zap size={48} className="text-white/20 mx-auto mb-4" />
                      <p className="text-white/60 mb-2">No near-complete combos found</p>
                      <p className="text-white/40 text-sm">
                        You need at least 2 pieces of a combo for it to show here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {comboResults.partialCombos.map((combo, idx) => (
                        <div key={combo.id || idx} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition border border-yellow-600/30">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-yellow-400 text-xs font-medium px-2 py-1 bg-yellow-600/20 rounded">
                              Missing {combo.missingCards.length} card{combo.missingCards.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-3">
                            {combo.cards.map((cardName, cardIdx) => {
                              const isMissing = combo.missingCards.includes(cardName);
                              return (
                                <span
                                  key={cardIdx}
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    isMissing
                                      ? 'bg-red-600/30 text-red-200 border border-red-500/50'
                                      : 'bg-green-600/30 text-green-200'
                                  }`}
                                >
                                  {isMissing ? 'âœ—' : 'âœ“'} {cardName}
                                </span>
                              );
                            })}
                          </div>

                          {/* Add to Wishlist buttons for missing cards */}
                          {combo.missingCards.length > 0 && (
                            <div className="mb-3 p-3 bg-yellow-600/10 rounded-lg border border-yellow-600/20">
                              <p className="text-yellow-200 text-sm mb-2">Add missing cards to wishlist:</p>
                              <div className="flex flex-wrap gap-2">
                                {combo.missingCards.map((cardName, cardIdx) => (
                                  <button
                                    key={cardIdx}
                                    onClick={() => addToWishlistFromCombo(cardName)}
                                    className="px-3 py-1 bg-pink-600 hover:bg-pink-700 text-white text-sm rounded transition flex items-center gap-1"
                                  >
                                    <Heart size={12} /> {cardName}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {combo.produces && combo.produces.length > 0 && (
                            <div className="mb-3">
                              <span className="text-white/60 text-sm">Produces: </span>
                              <span className="text-green-400 text-sm">
                                {Array.isArray(combo.produces)
                                  ? combo.produces.map(p => {
                                      if (typeof p === 'string') return p;
                                      if (p.feature && p.feature.name) return p.feature.name;
                                      if (p.name) return p.name;
                                      if (p.description) return p.description;
                                      return JSON.stringify(p);
                                    }).join(', ')
                                  : combo.produces}
                              </span>
                            </div>
                          )}

                          {combo.prerequisite && (
                            <div className="mb-2">
                              <span className="text-white/60 text-sm">Prerequisites: </span>
                              <span className="text-white/80 text-sm">{combo.prerequisite}</span>
                            </div>
                          )}

                          {combo.steps && (
                            <div className="mb-2">
                              <span className="text-white/60 text-sm">Steps: </span>
                              <span className="text-white/80 text-sm">{combo.steps}</span>
                            </div>
                          )}

                          {combo.description && !combo.steps && (
                            <p className="text-white/70 text-sm">{combo.description}</p>
                          )}

                          {combo.spellbookUrl && (
                            <a
                              href={combo.spellbookUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 text-orange-400 hover:text-orange-300 text-sm underline"
                            >
                              View on Commander Spellbook â†’
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center">
                <p className="text-white/40 text-xs">
                  {comboTab === 'complete'
                    ? `Found ${comboResults.found} complete combo${comboResults.found !== 1 ? 's' : ''}`
                    : `Found ${comboResults.partialFound || 0} near-complete combo${(comboResults.partialFound || 0) !== 1 ? 's' : ''}`}
                </p>
                <p className="text-white/40 text-xs">
                  Data from Commander Spellbook
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Price Update Options Modal */}
        {showPriceUpdateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-md w-full p-6 border-2 border-blue-500 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Update All Prices</h2>
              <p className="text-white/60 mb-6">Choose update options:</p>

              <div className="space-y-4 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceUpdate}
                    onChange={(e) => setForceUpdate(e.target.checked)}
                    className="w-5 h-5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <div className="text-white font-medium">Force Update Existing Cards</div>
                    <div className="text-white/60 text-sm">Update all cards even if they already have price data</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateFullData}
                    onChange={(e) => setUpdateFullData(e.target.checked)}
                    className="w-5 h-5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <div className="text-white font-medium">Update Full Card Data</div>
                    <div className="text-white/60 text-sm">Fetch complete metadata (set, rarity, colors, images, etc.)</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowPriceUpdateModal(false);
                    updateAllPrices(forceUpdate, updateFullData);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                >
                  <RefreshCw size={18} /> Update Prices
                </button>
                <button
                  onClick={() => setShowPriceUpdateModal(false)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Finance Panel Modal */}
        {showFinancePanel && financeData && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-slate-900 rounded-t-2xl sm:rounded-lg border border-slate-700 sm:max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Portfolio Finance</h2>
                <button onClick={() => setShowFinancePanel(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-800/50 p-3 rounded">
                  <p className="text-slate-400 text-sm">Collection Value</p>
                  <p className="text-white font-bold text-xl">${financeData.collectionValue.toFixed(2)}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded">
                  <p className="text-slate-400 text-sm">Buylist Value</p>
                  <p className="text-green-400 font-bold text-xl">${financeData.buylistValue.toFixed(2)}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded">
                  <p className="text-slate-400 text-sm">Sell Value</p>
                  <p className="text-yellow-400 font-bold text-xl">${financeData.sellValue.toFixed(2)}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded">
                  <p className="text-slate-400 text-sm">Spread (Collection - Buylist)</p>
                  <p className={`font-bold text-xl ${financeData.spread > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${financeData.spread.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {priceAlertCard && (
          <PriceAlertModal
            card={priceAlertCard}
            onClose={() => setPriceAlertCard(null)}
            onSaved={() => { setPriceAlertCard(null); fetchCards(); }}
          />
        )}

        {/* QR Preview Modal */}
        {showQRPreview && qrPreviewLocation && (
          <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-gray-900 rounded-t-2xl sm:rounded-xl shadow-2xl sm:max-w-sm w-full p-6 border-2 border-purple-500 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">QR Label</h3>
                <button onClick={() => setShowQRPreview(false)} className="text-white/60 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="bg-white rounded-lg p-4 text-center print-content">
                {qrDataUrls[qrPreviewLocation.name] && (
                  <img src={qrDataUrls[qrPreviewLocation.name]} alt="QR" className="mx-auto mb-2" />
                )}
                <div className="font-bold text-lg text-black">{qrPreviewLocation.name}</div>
                <div className="text-gray-600 text-sm">
                  {locationStats[qrPreviewLocation.name]?.cardCount || 0} cards | {formatPrice(locationStats[qrPreviewLocation.name]?.totalValue || 0)}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => window.print()} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">
                  Print
                </button>
                <button onClick={() => setShowQRPreview(false)} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Print All Labels Modal */}
        {showPrintLabels && (
          <div className="fixed inset-0 bg-black/90 flex flex-col z-50 print:bg-white">
            <div className="bg-gray-900 p-4 flex justify-between items-center print:hidden">
              <h2 className="text-xl font-bold text-white">Print Location Labels ({locations.length})</h2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">
                  Print
                </button>
                <button onClick={() => setShowPrintLabels(false)} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 print:p-0 flex justify-center">
              <div className="print-content bg-white p-4 print:p-2" style={{ width: '8.5in' }}>
                <div className="grid grid-cols-3 gap-3">
                  {locations.map(loc => (
                    <div key={loc._id} className="label-item border border-gray-300 rounded p-2 flex items-center gap-2" style={{ height: '1in' }}>
                      {qrDataUrls[loc.name] && (
                        <img src={qrDataUrls[loc.name]} alt="QR" style={{ width: 70, height: 70 }} />
                      )}
                      <div className="flex-1 overflow-hidden">
                        <div className="font-bold text-sm truncate text-black">{loc.name}</div>
                        <div className="text-xs text-gray-600">{locationStats[loc.name]?.cardCount || 0} cards</div>
                        <div className="text-xs text-gray-600">{formatPrice(locationStats[loc.name]?.totalValue || 0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Camera OCR Modal */}
        {showCameraModal && (
          <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 text-white/50">Loading camera...</div>}>
            <CameraModal
              isOpen={showCameraModal}
              onClose={handleCameraClose}
              onCardExtracted={handleCardExtracted}
            />
          </Suspense>
        )}

        <CollectionFAB
          onAddCard={() => {
            setShowAddForm(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onImport={() => fileInputRef.current?.click()}
          disabled={selectedCards.size > 0 || showPriceUpdateModal || showImportResults || !!bulkUpdateModal || showPrintPreview || showSimilarCards || showSynergies || showFinancePanel}
        />
    </>
  );
};

export default CollectionView;
