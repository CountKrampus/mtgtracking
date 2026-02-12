import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Plus, Trash2, Edit2, Save, X, Download, RefreshCw, DollarSign, Upload, Camera, Settings, Heart, CheckSquare, Square, MapPin, Star, Layers, Zap, Crown, BarChart3, Users, QrCode, Printer, Home, BookOpen } from 'lucide-react';
import QRCode from 'qrcode';
import './App.css';
import Sidebar from './components/Sidebar';
import Breadcrumb from './components/Breadcrumb';
import CommandPalette from './components/CommandPalette';
import useKeyboardShortcuts, { buildShortcutKey } from '../hooks/useKeyboardShortcuts';
import useSettings from '../hooks/useSettings';
import { useAuthContext } from '../contexts/AuthContext';
import { AccountSettings } from '../components/auth/AccountSettings';
import { AdminPanel } from '../components/admin/AdminPanel';
import { AuthGuard } from '../components/auth/AuthGuard';

const DeckBuilder = React.lazy(() => import('./components/DeckBuilder'));
const CameraModal = React.lazy(() => import('./components/CameraModal'));
const LifeCounter = React.lazy(() => import('./components/LifeCounter/LifeCounter'));

const API_URL = 'http://localhost:5000/api';

// Helper to get auth headers for API calls
const getAuthHeaders = () => {
  const token = localStorage.getItem('mtg_access_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

// Standard MTG card types
const standardTypes = [
  'Artifact',
  'Battle',
  'Creature',
  'Enchantment',
  'Instant',
  'Land',
  'Planeswalker',
  'Sorcery',
  'Tribal'
];

function MainDashboard() {
  // Auth context - available when wrapped with AuthProvider
  const authContext = useAuthContext();
  const { user: authUser, isMultiUserEnabled, logout: authLogout } = authContext || {};

  // Settings must be first so other state can use its values
  const { settings, updateSettings, resetSettings } = useSettings();
  const navigate = useNavigate();

  const [cards, setCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCondition, setFilterCondition] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSpecial, setFilterSpecial] = useState('all'); // Combined token/foil filter
  const [filterRarity, setFilterRarity] = useState('all');
  const [filterSet, setFilterSet] = useState('all');
  const [sortBy, setSortBy] = useState(settings.defaultSort);
  const [showAddForm, setShowAddForm] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, cardName: '' });
  const [isImporting, setIsImporting] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = settings.pageSize;
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'collection', 'decks', 'wishlist', 'lifecounter', or 'settings'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const fileInputRef = useRef(null);
  const { shortcuts, keyToCommand, setShortcut, removeShortcut } = useKeyboardShortcuts();
  const [filterTag, setFilterTag] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');

  // Auth/Admin state
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Location management
  const [locations, setLocations] = useState([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDesc, setNewLocationDesc] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);
  const [newTagName, setNewTagName] = useState('');

  // Wishlist
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistFormData, setWishlistFormData] = useState({
    name: '',
    set: '',
    targetPrice: 0,
    currentPrice: 0,
    priority: 'medium',
    notes: '',
    quantity: 1,
    condition: 'NM',
    colors: [],
    types: [],
    manaCost: '',
    scryfallId: '',
    imageUrl: '',
    oracleText: ''
  });
  const [editingWishlistId, setEditingWishlistId] = useState(null);
  const [wishlistAutocompleteResults, setWishlistAutocompleteResults] = useState([]);
  const [showWishlistAutocomplete, setShowWishlistAutocomplete] = useState(false);
  const [wishlistFilterPriority, setWishlistFilterPriority] = useState('all');

  // Bulk selection
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [bulkUpdateModal, setBulkUpdateModal] = useState(null); // 'condition', 'location', 'addTags', 'removeTags', 'delete'
  const [bulkCondition, setBulkCondition] = useState('NM');
  const [bulkLocation, setBulkLocation] = useState('');
  const [bulkTags, setBulkTags] = useState('');

  // Print Proxies
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Similar Cards
  const [showSimilarCards, setShowSimilarCards] = useState(false);
  const [similarCardsSource, setSimilarCardsSource] = useState(null); // The card we're finding similar cards for
  const [similarCards, setSimilarCards] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Card Synergies
  const [showSynergies, setShowSynergies] = useState(false);
  const [synergiesSource, setSynergiesSource] = useState(null);
  const [synergies, setSynergies] = useState({ tribal: [], keywords: [], mechanics: [] });
  const [loadingSynergies, setLoadingSynergies] = useState(false);
  const [synergiesTab, setSynergiesTab] = useState('tribal');

  // Commander Recommendations
  const [showCommanderRecs, setShowCommanderRecs] = useState(false);
  const [commanderRecs, setCommanderRecs] = useState([]);
  const [loadingCommanders, setLoadingCommanders] = useState(false);
  const [commanderColorFilter, setCommanderColorFilter] = useState('auto');
  const [commanderFinderMode, setCommanderFinderMode] = useState('collection'); // 'collection' | 'finder'
  const [finderColors, setFinderColors] = useState([]);
  const [finderThemes, setFinderThemes] = useState([]);
  const [finderCreatureType, setFinderCreatureType] = useState('');

  // Set Completion Tracker
  const [showSetCompletion, setShowSetCompletion] = useState(false);
  const [setCompletionData, setSetCompletionData] = useState([]);
  const [loadingSetCompletion, setLoadingSetCompletion] = useState(false);

  // Combo Finder
  const [showComboFinder, setShowComboFinder] = useState(false);
  const [comboResults, setComboResults] = useState({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
  const [loadingCombos, setLoadingCombos] = useState(false);
  const [comboTab, setComboTab] = useState('complete'); // 'complete' or 'partial'

  const [showTagInput, setShowTagInput] = useState(null); // Card ID currently editing tags
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [searchIncludesOracleText, setSearchIncludesOracleText] = useState(true);
  const [typesInputValue, setTypesInputValue] = useState(''); // Temporary state for types input
  const [tagsInputValue, setTagsInputValue] = useState(''); // Temporary state for tags input
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false); // Force update cards even if they have data
  const [updateFullData, setUpdateFullData] = useState(false); // Update full card data (set, rarity, etc.)
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false);

  // QR Labels
  const [showQRPreview, setShowQRPreview] = useState(false);
  const [qrPreviewLocation, setQRPreviewLocation] = useState(null);
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [showPrintLabels, setShowPrintLabels] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    set: '',
    setCode: '',
    collectorNumber: '',
    rarity: '',
    quantity: 1,
    condition: settings.defaultCondition,
    price: 0,
    colors: [],
    types: [],
    manaCost: '',
    scryfallId: '',
    imageUrl: '',
    isFoil: false,
    isToken: false,
    oracleText: '',
    tags: [],
    location: ''
  });

  const conditions = ['NM', 'LP', 'MP', 'HP', 'DMG'];
  const mtgColors = ['W', 'U', 'B', 'R', 'G', 'C'];
  const colorNames = {
    'W': 'White',
    'U': 'Blue',
    'B': 'Black',
    'R': 'Red',
    'G': 'Green',
    'C': 'Colorless'
  };

  const uniqueTypes = useMemo(() => {
    const types = new Set(standardTypes);
    // Add any additional types from existing cards
    cards.forEach(card => {
      if (card.types && card.types.length > 0) {
        const typeStr = card.types.join(' ');
        types.add(typeStr);
      }
    });
    return Array.from(types).sort();
  }, [cards]);

  const uniqueSets = useMemo(() => {
    const sets = new Set();
    cards.forEach(card => {
      if (card.set) {
        sets.add(card.set);
      }
    });
    return Array.from(sets).sort();
  }, [cards]);

  const uniqueLocations = useMemo(() => {
    const locs = new Set();
    cards.forEach(card => {
      if (card.location) {
        locs.add(card.location);
      }
    });
    // Also add locations from the locations list
    locations.forEach(loc => locs.add(loc.name));
    return Array.from(locs).sort();
  }, [cards, locations]);

  // Location stats for QR labels
  const locationStats = useMemo(() => {
    const stats = {};
    locations.forEach(loc => {
      const cardsInLoc = cards.filter(c => c.location === loc.name);
      const cardCount = cardsInLoc.reduce((sum, c) => sum + c.quantity, 0);
      const totalValue = cardsInLoc.reduce((sum, c) => sum + (c.price * c.quantity), 0);
      stats[loc.name] = { cardCount, totalValue };
    });
    return stats;
  }, [cards, locations]);

  useEffect(() => {
    fetchCards();
    fetchAvailableTags();
    fetchLocations();
    fetchWishlist();
  }, []);

  // Handle ?location= URL parameter (for QR code scanning)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('location');
    if (locationParam) {
      setFilterLocation(decodeURIComponent(locationParam));
      setCurrentView('collection');
    }
  }, []);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API_URL}/cards`);
      setCards(response.data);
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const response = await axios.get(`${API_URL}/tags`);
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await axios.get(`${API_URL}/locations`);
      setLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchWishlist = async () => {
    try {
      const response = await axios.get(`${API_URL}/wishlist`);
      setWishlistItems(response.data);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  };

  // Generate QR code data URL for a location
  const generateQR = async (locationName) => {
    const url = `${window.location.origin}?location=${encodeURIComponent(locationName)}`;
    try {
      return await QRCode.toDataURL(url, { width: 150, margin: 1 });
    } catch (err) {
      console.error('QR generation failed:', err);
      return null;
    }
  };

  const handleCardNameChange = async (value) => {
    setFormData({...formData, name: value});

    // Skip autocomplete if in manual entry mode
    if (manualEntry) {
      setShowAutocomplete(false);
      return;
    }

    if (value.length >= 2) {
      setShowAutocomplete(true);
      try {
        const response = await axios.get(`${API_URL}/scryfall/autocomplete?q=${value}`);
        setAutocompleteResults(response.data);
      } catch (error) {
        console.error('Error searching Scryfall:', error);
      }
    } else {
      setShowAutocomplete(false);
      setAutocompleteResults([]);
    }
  };

  const selectAutocompleteCard = async (cardName) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/scryfall/search?name=${cardName}`);
      const cardData = response.data;

      console.log('Card data from backend:', cardData);
      console.log('Mana cost:', cardData.manaCost);

      setFormData({
        ...formData,
        name: cardData.name,
        set: cardData.set,
        setCode: cardData.setCode || '',
        collectorNumber: cardData.collectorNumber || '',
        rarity: cardData.rarity || '',
        colors: cardData.colors,
        types: cardData.types,
        manaCost: cardData.manaCost || '',
        scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl,
        price: cardData.prices.usd || 0,
        oracleText: cardData.oracleText || '',
        tags: []
      });
      setTypesInputValue(cardData.types ? cardData.types.join(', ') : '');
      setTagsInputValue(''); // Clear tags when searching Scryfall
      setShowAutocomplete(false);
      setAutocompleteResults([]);
    } catch (error) {
      console.error('Error fetching card details:', error);
      alert('Card not found on Scryfall');
    } finally {
      setLoading(false);
    }
  };

  const searchScryfallManually = async () => {
    if (!formData.name) {
      alert('Please enter a card name first');
      return;
    }
    await selectAutocompleteCard(formData.name);
  };

  const handleOpenCamera = () => {
    setShowCameraModal(true);
  };

  const handleCameraClose = () => {
    setShowCameraModal(false);
  };

  const handleCardExtracted = async (extractedData) => {
    setShowCameraModal(false);

    if (!extractedData.name) {
      alert('No card name extracted. Please try again or use manual entry.');
      return;
    }

    // In offline mode or if we just want to populate the name
    if (offlineMode) {
      setFormData({...formData, name: extractedData.name});
      alert(`Card name extracted: ${extractedData.name}\n(Offline mode - please fill in other details manually)`);
      return;
    }

    // Try to search Scryfall
    try {
      setLoading(true);
      await selectAutocompleteCard(extractedData.name);

      const confidenceText = extractedData.confidence ? ` (${Math.round(extractedData.confidence)}% confidence)` : '';
      alert(`Card found: ${extractedData.name}${confidenceText}`);
    } catch (error) {
      // If Scryfall search fails, still populate the name
      setFormData({...formData, name: extractedData.name});
      const confidenceText = extractedData.confidence ? ` (${Math.round(extractedData.confidence)}% confidence)` : '';
      alert(`Card name extracted: ${extractedData.name}${confidenceText}\nCould not find on Scryfall - please verify and search manually.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('Card name is required');
      return;
    }

    try {
      let response;
      if (editingId) {
        response = await axios.put(`${API_URL}/cards/${editingId}`, formData);
      } else {
        response = await axios.post(`${API_URL}/cards`, formData);
      }

      // Check if card was merged with existing entry
      if (response.data.merged) {
        alert(`Card already exists! ${response.data.message}`);
      }

      fetchCards();
      handleCancel();
    } catch (error) {
      console.error('Error saving card:', error);
      alert('Error saving card');
    }
  };

  const handleEdit = (card) => {
    setFormData({
      name: card.name,
      set: card.set,
      quantity: card.quantity,
      condition: card.condition,
      price: card.price,
      colors: card.colors || [],
      types: card.types || [],
      manaCost: card.manaCost || '',
      isFoil: card.isFoil || false,
      isToken: card.isToken || false,
      oracleText: card.oracleText || '',
      tags: card.tags || [],
      location: card.location || ''
    });
    setTypesInputValue(card.types ? card.types.join(', ') : '');
    setTagsInputValue(card.tags ? card.tags.join(', ') : '');
    setEditingId(card._id);
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this card?')) return;

    try {
      await axios.delete(`${API_URL}/cards/${id}`);
      fetchCards();
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAutocomplete(false);
    setTypesInputValue('');
    setTagsInputValue('');
    setFormData({
      name: '',
      set: '',
      quantity: 1,
      condition: settings.defaultCondition,
      price: 0,
      colors: [],
      types: [],
      manaCost: '',
      isFoil: false,
      isToken: false,
      oracleText: '',
      tags: [],
      location: ''
    });
  };

  const toggleColor = (color) => {
    setFormData({
      ...formData,
      colors: formData.colors.includes(color)
        ? formData.colors.filter(c => c !== color)
        : [...formData.colors, color]
    });
  };

  const updateCardPrice = async (id) => {
    try {
      await axios.post(`${API_URL}/cards/${id}/update-price`);
      fetchCards();
      alert('Price updated successfully!');
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Error updating price');
    }
  };

  const updateAllPrices = async () => {
    let message = 'This will update prices';
    if (updateFullData) {
      message += ' and full card data (set, rarity, collector number, colors, types, mana cost, images)';
    }
    message += forceUpdate
      ? ' for ALL cards (even those with existing data). Continue?'
      : ' only for cards missing data. Continue?';

    if (!window.confirm(message)) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (forceUpdate) params.append('force', 'true');
      if (updateFullData) params.append('fullData', 'true');

      const url = `${API_URL}/cards/update-all-prices${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axios.post(url);
      fetchCards();

      // Show detailed results
      const { updated, skipped, total } = response.data;
      const dataType = updateFullData ? 'full card data' : 'prices';
      alert(`${dataType} updated: ${updated} cards updated, ${skipped} skipped, ${total} total`);
    } catch (error) {
      console.error('Error updating prices:', error);
      alert('Error updating prices');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (cardId) => {
    if (!newTag.trim()) return;

    try {
      await axios.post(`${API_URL}/cards/${cardId}/tags`, { tag: newTag.trim() });
      setNewTag('');
      setShowTagInput(null);
      fetchCards();
      fetchAvailableTags();
    } catch (error) {
      console.error('Error adding tag:', error);
      alert('Error adding tag');
    }
  };

  const handleRemoveTag = async (cardId, tag) => {
    try {
      await axios.delete(`${API_URL}/cards/${cardId}/tags/${encodeURIComponent(tag)}`);
      fetchCards();
      fetchAvailableTags();
    } catch (error) {
      console.error('Error removing tag:', error);
      alert('Error removing tag');
    }
  };

  const updateAllOracleText = async () => {
    if (!window.confirm('This will fetch oracle text for all cards from Scryfall. Continue?')) return;

    try {
      setLoading(true);
      await axios.post(`${API_URL}/cards/update-all-oracle-text`);
      fetchCards();
      alert('Oracle text updated successfully!');
    } catch (error) {
      console.error('Error updating oracle text:', error);
      alert('Error updating oracle text');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // LOCATION MANAGEMENT FUNCTIONS
  // ============================================

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      alert('Location name is required');
      return;
    }

    try {
      await axios.post(`${API_URL}/locations`, {
        name: newLocationName.trim(),
        description: newLocationDesc.trim()
      });
      setNewLocationName('');
      setNewLocationDesc('');
      fetchLocations();
    } catch (error) {
      console.error('Error creating location:', error);
      alert(error.response?.data?.message || 'Error creating location');
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation || !newLocationName.trim()) return;

    try {
      await axios.put(`${API_URL}/locations/${editingLocation._id}`, {
        name: newLocationName.trim(),
        description: newLocationDesc.trim()
      });
      setEditingLocation(null);
      setNewLocationName('');
      setNewLocationDesc('');
      fetchLocations();
      fetchCards(); // Refresh cards in case location name changed
    } catch (error) {
      console.error('Error updating location:', error);
      alert(error.response?.data?.message || 'Error updating location');
    }
  };

  const handleDeleteLocation = async (locationId) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;

    try {
      await axios.delete(`${API_URL}/locations/${locationId}`);
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      alert(error.response?.data?.message || 'Error deleting location');
    }
  };

  const startEditLocation = (location) => {
    setEditingLocation(location);
    setNewLocationName(location.name);
    setNewLocationDesc(location.description || '');
  };

  const cancelEditLocation = () => {
    setEditingLocation(null);
    setNewLocationName('');
    setNewLocationDesc('');
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      alert('Tag name is required');
      return;
    }

    const normalizedTag = newTagName.trim().toLowerCase();
    // Check if tag exists (availableTags is now array of objects)
    if (availableTags.some(t => (t.name || t) === normalizedTag)) {
      alert('Tag already exists');
      return;
    }

    try {
      await axios.post(`${API_URL}/tags`, { name: normalizedTag });
      setNewTagName('');
      fetchAvailableTags();
    } catch (error) {
      console.error('Error creating tag:', error);
      alert(error.response?.data?.message || 'Error creating tag');
    }
  };

  const handleDeleteTag = async (tagName) => {
    if (!window.confirm(`Are you sure you want to delete the tag "${tagName}"? This will remove it from all cards.`)) return;

    try {
      await axios.delete(`${API_URL}/tags/${encodeURIComponent(tagName)}`);
      fetchAvailableTags();
      fetchCards(); // Refresh cards to reflect tag removal
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert(error.response?.data?.message || 'Error deleting tag');
    }
  };

  // Wishlist Functions
  const handleWishlistSubmit = async () => {
    if (!wishlistFormData.name) {
      alert('Card name is required');
      return;
    }

    try {
      let response;
      if (editingWishlistId) {
        response = await axios.put(`${API_URL}/wishlist/${editingWishlistId}`, wishlistFormData);
      } else {
        response = await axios.post(`${API_URL}/wishlist`, wishlistFormData);
      }

      fetchWishlist();
      handleWishlistCancel();
    } catch (error) {
      console.error('Error saving wishlist item:', error);
      alert('Error saving wishlist item');
    }
  };

  const handleWishlistEdit = (item) => {
    setWishlistFormData({
      name: item.name,
      set: item.set,
      targetPrice: item.targetPrice || 0,
      currentPrice: item.currentPrice || 0,
      priority: item.priority || 'medium',
      notes: item.notes || '',
      quantity: item.quantity || 1,
      condition: item.condition || 'NM',
      colors: item.colors || [],
      types: item.types || [],
      manaCost: item.manaCost || '',
      scryfallId: item.scryfallId || '',
      imageUrl: item.imageUrl || '',
      oracleText: item.oracleText || ''
    });
    setEditingWishlistId(item._id);
  };

  const handleWishlistDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this wishlist item?')) return;

    try {
      await axios.delete(`${API_URL}/wishlist/${id}`);
      fetchWishlist();
    } catch (error) {
      console.error('Error deleting wishlist item:', error);
    }
  };

  const handleWishlistCancel = () => {
    setEditingWishlistId(null);
    setWishlistFormData({
      name: '',
      set: '',
      targetPrice: 0,
      currentPrice: 0,
      priority: 'medium',
      notes: '',
      quantity: 1,
      condition: 'NM',
      colors: [],
      types: [],
      manaCost: '',
      scryfallId: '',
      imageUrl: '',
      oracleText: ''
    });
  };

  const handleWishlistSearch = async (value) => {
    setWishlistFormData({...wishlistFormData, name: value});

    if (value.length >= 2) {
      setShowWishlistAutocomplete(true);
      try {
        const response = await axios.get(`${API_URL}/scryfall/autocomplete?q=${value}`);
        setWishlistAutocompleteResults(response.data);
      } catch (error) {
        console.error('Error searching Scryfall:', error);
      }
    } else {
      setShowWishlistAutocomplete(false);
      setWishlistAutocompleteResults([]);
    }
  };

  const selectWishlistAutocompleteCard = async (cardName) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/scryfall/search?name=${cardName}`);
      const cardData = response.data;

      setWishlistFormData({
        ...wishlistFormData,
        name: cardData.name,
        set: cardData.set,
        setCode: cardData.setCode || '',
        collectorNumber: cardData.collectorNumber || '',
        rarity: cardData.rarity || '',
        colors: cardData.colors,
        types: cardData.types,
        manaCost: cardData.manaCost || '',
        scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl,
        targetPrice: cardData.prices.usd || 0,
        oracleText: cardData.oracleText || ''
      });
      setShowWishlistAutocomplete(false);
      setWishlistAutocompleteResults([]);
    } catch (error) {
      console.error('Error fetching card details:', error);
      alert('Card not found on Scryfall');
    } finally {
      setLoading(false);
    }
  };

  const handleAcquireWishlistItem = async (id) => {
    try {
      const item = wishlistItems.find(i => i._id === id);
      if (!item) return;

      // Convert wishlist item to card format
      const cardData = {
        name: item.name,
        set: item.set,
        quantity: item.quantity,
        condition: item.condition,
        price: item.targetPrice,
        colors: item.colors || [],
        types: item.types || [],
        manaCost: item.manaCost || '',
        scryfallId: item.scryfallId || '',
        imageUrl: item.imageUrl || '',
        oracleText: item.oracleText || '',
        tags: item.tags || [],
        location: item.location || ''
      };

      // Add to collection
      await axios.post(`${API_URL}/cards`, cardData);
      
      // Remove from wishlist
      await axios.delete(`${API_URL}/wishlist/${id}`);
      
      fetchCards();
      fetchWishlist();
      alert(`${item.name} added to collection!`);
    } catch (error) {
      console.error('Error acquiring wishlist item:', error);
      alert('Error acquiring wishlist item');
    }
  };

  // Bulk Operations
  const handleBulkUpdate = async () => {
    if (selectedCards.size === 0) return;

    try {
      const cardIds = Array.from(selectedCards);
      
      switch (bulkUpdateModal) {
        case 'condition':
          await Promise.all(cardIds.map(id => 
            axios.put(`${API_URL}/cards/${id}`, { ...cards.find(c => c._id === id), condition: bulkCondition })
          ));
          break;
        case 'location':
          await Promise.all(cardIds.map(id => 
            axios.put(`${API_URL}/cards/${id}`, { ...cards.find(c => c._id === id), location: bulkLocation })
          ));
          break;
        case 'addTags':
          const tagsToAdd = bulkTags.split(',').map(tag => tag.trim()).filter(tag => tag);
          await Promise.all(cardIds.map(id => 
            Promise.all(tagsToAdd.map(tag => 
              axios.post(`${API_URL}/cards/${id}/tags`, { tag })
            ))
          ));
          break;
        case 'removeTags':
          const tagsToRemove = bulkTags.split(',').map(tag => tag.trim()).filter(tag => tag);
          await Promise.all(cardIds.map(id => 
            Promise.all(tagsToRemove.map(tag => 
              axios.delete(`${API_URL}/cards/${id}/tags/${encodeURIComponent(tag)}`)
            ))
          ));
          break;
        case 'delete':
          if (window.confirm(`Are you sure you want to delete ${selectedCards.size} cards?`)) {
            await Promise.all(cardIds.map(id => axios.delete(`${API_URL}/cards/${id}`)));
          }
          break;
      }

      setSelectedCards(new Set());
      setBulkUpdateModal(null);
      fetchCards();
    } catch (error) {
      console.error('Error performing bulk update:', error);
      alert('Error performing bulk update');
    }
  };

  const toggleCardSelection = (id) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCards(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCards.size === filteredCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(filteredCards.map(card => card._id)));
    }
  };

  // Filtering and sorting
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const matchesSearch = !searchTerm || 
        card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (card.oracleText && card.oracleText.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCondition = filterCondition === 'all' || card.condition === filterCondition;
      const matchesColor = filterColor === 'all' || (card.colors && card.colors.includes(filterColor));
      const matchesType = filterType === 'all' || 
        (card.types && card.types.join(' ').toLowerCase().includes(filterType.toLowerCase()));
      const matchesSpecial = filterSpecial === 'all' || 
        (filterSpecial === 'foil' && card.isFoil) || 
        (filterSpecial === 'token' && card.isToken) ||
        (filterSpecial === 'nonfoil' && !card.isFoil) ||
        (filterSpecial === 'card' && !card.isToken);
      const matchesRarity = filterRarity === 'all' || card.rarity === filterRarity;
      const matchesSet = filterSet === 'all' || card.set === filterSet;
      const matchesTag = filterTag === 'all' || (card.tags && card.tags.includes(filterTag));
      const matchesLocation = filterLocation === 'all' || card.location === filterLocation;

      return matchesSearch && matchesCondition && matchesColor && matchesType && 
             matchesSpecial && matchesRarity && matchesSet && matchesTag && matchesLocation;
    });
  }, [cards, searchTerm, filterCondition, filterColor, filterType, filterSpecial, filterRarity, filterSet, filterTag, filterLocation]);

  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'set':
          return (a.set || '').localeCompare(b.set || '');
        case 'price':
          return (b.price || 0) - (a.price || 0);
        case 'quantity':
          return b.quantity - a.quantity;
        case 'date':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        default:
          return 0;
      }
    });
  }, [filteredCards, sortBy]);

  const totalPages = Math.ceil(sortedCards.length / pageSize);
  const paginatedCards = sortedCards.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const formatPrice = (price) => {
    if (typeof price !== 'number') return '$0.00';
    return `$${price.toFixed(2)}`;
  };

  const totalCollectionValue = useMemo(() => {
    return sortedCards.reduce((sum, card) => sum + (card.price * card.quantity), 0);
  }, [sortedCards]);

  const totalCards = useMemo(() => {
    return sortedCards.reduce((sum, card) => sum + card.quantity, 0);
  }, [sortedCards]);

  // Similar Cards Functions
  const findSimilarCards = async (card) => {
    if (!card.scryfallId) {
      alert('Card must have a Scryfall ID to find similar cards');
      return;
    }

    try {
      setLoadingSimilar(true);
      setSimilarCardsSource(card);
      setShowSimilarCards(true);

      const response = await axios.get(`${API_URL}/cards/${card._id}/similar`);
      setSimilarCards(response.data);
    } catch (error) {
      console.error('Error finding similar cards:', error);
      alert('Error finding similar cards');
    } finally {
      setLoadingSimilar(false);
    }
  };

  // Card Synergies Functions
  const findCardSynergies = async (card) => {
    if (!card.scryfallId) {
      alert('Card must have a Scryfall ID to find synergies');
      return;
    }

    try {
      setLoadingSynergies(true);
      setSynergiesSource(card);
      setShowSynergies(true);

      const response = await axios.get(`${API_URL}/cards/${card._id}/synergies`);
      setSynergies(response.data);
    } catch (error) {
      console.error('Error finding card synergies:', error);
      alert('Error finding card synergies');
    } finally {
      setLoadingSynergies(false);
    }
  };

  // Commander Recommendations Functions
  const findCommanderRecommendations = async () => {
    try {
      setLoadingCommanders(true);
      setShowCommanderRecs(true);

      let response;
      if (commanderFinderMode === 'collection') {
        // Find commanders from collection
        response = await axios.get(`${API_URL}/cards/commander-recommendations`);
      } else {
        // Find commanders based on selected filters
        const params = new URLSearchParams();
        if (finderColors.length > 0) params.append('colors', finderColors.join(','));
        if (finderThemes.length > 0) params.append('themes', finderThemes.join(','));
        if (finderCreatureType) params.append('creatureType', finderCreatureType);

        response = await axios.get(`${API_URL}/cards/commander-finder?${params.toString()}`);
      }

      setCommanderRecs(response.data);
    } catch (error) {
      console.error('Error finding commander recommendations:', error);
      alert('Error finding commander recommendations');
    } finally {
      setLoadingCommanders(false);
    }
  };

  // Set Completion Tracker Functions
  const getSetCompletion = async (setCode) => {
    if (!setCode) {
      alert('Please select a set');
      return;
    }

    try {
      setLoadingSetCompletion(true);
      setShowSetCompletion(true);

      const response = await axios.get(`${API_URL}/cards/set-completion?set=${setCode}`);
      setSetCompletionData(response.data);
    } catch (error) {
      console.error('Error getting set completion:', error);
      alert('Error getting set completion');
    } finally {
      setLoadingSetCompletion(false);
    }
  };

  // Combo Finder Functions
  const findCombos = async () => {
    try {
      setLoadingCombos(true);
      setShowComboFinder(true);

      const response = await axios.get(`${API_URL}/cards/combo-finder`);
      setComboResults(response.data);
    } catch (error) {
      console.error('Error finding combos:', error);
      alert('Error finding combos');
    } finally {
      setLoadingCombos(false);
    }
  };

  // Export Functions
  const exportCollection = async (format) => {
    try {
      const response = await axios.get(`${API_URL}/export?format=${format}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mtg-collection.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting collection:', error);
      alert('Error exporting collection');
    }
  };

  // Import Functions
  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsImporting(true);
      setImportResults(null);
      setImportProgress({ current: 0, total: 0, cardName: '' });

      const response = await axios.post(`${API_URL}/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Update progress bar if needed
        }
      });

      setImportResults(response.data);
      setShowImportResults(true);
      fetchCards();
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Error importing file');
    } finally {
      setIsImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  // Render functions for different views
  const renderDashboard = () => (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Cards</p>
              <p className="text-3xl font-bold text-white">{totalCards}</p>
            </div>
            <div className="bg-purple-500/20 p-3 rounded-lg">
              <Layers className="text-purple-400" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Collection Value</p>
              <p className="text-3xl font-bold text-white">{formatPrice(totalCollectionValue)}</p>
            </div>
            <div className="bg-green-500/20 p-3 rounded-lg">
              <DollarSign className="text-green-400" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Unique Cards</p>
              <p className="text-3xl font-bold text-white">{cards.length}</p>
            </div>
            <div className="bg-blue-500/20 p-3 rounded-lg">
              <BookOpen className="text-blue-400" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Sets Collected</p>
              <p className="text-3xl font-bold text-white">{uniqueSets.length}</p>
            </div>
            <div className="bg-yellow-500/20 p-3 rounded-lg">
              <MapPin className="text-yellow-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">Recent Cards</h3>
          <div className="space-y-3">
            {cards.slice(0, 5).map(card => (
              <div key={card._id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white font-medium">{card.name}</p>
                  <p className="text-white/60 text-sm">{card.set} • Qty: {card.quantity}</p>
                </div>
                <p className="text-green-400 font-medium">{formatPrice(card.price)}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setCurrentView('collection')}
              className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
            >
              View Collection
            </button>
            <button 
              onClick={() => setCurrentView('decks')}
              className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
            >
              Manage Decks
            </button>
            <button 
              onClick={() => setCurrentView('wishlist')}
              className="p-4 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white transition"
            >
              Wishlist
            </button>
            <button 
              onClick={() => setShowCommanderRecs(true)}
              className="p-4 bg-green-600 hover:bg-green-700 rounded-lg text-white transition"
            >
              Commander Recs
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCollection = () => (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input
            type="text"
            placeholder="Search cards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="name">Sort by Name</option>
          <option value="set">Sort by Set</option>
          <option value="price">Sort by Price</option>
          <option value="quantity">Sort by Quantity</option>
          <option value="date">Sort by Date Added</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filterCondition}
          onChange={(e) => setFilterCondition(e.target.value)}
          className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">All Conditions</option>
          {conditions.map(condition => (
            <option key={condition} value={condition}>{condition}</option>
          ))}
        </select>
        
        <select
          value={filterColor}
          onChange={(e) => setFilterColor(e.target.value)}
          className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">All Colors</option>
          {mtgColors.map(color => (
            <option key={color} value={color}>{colorNames[color]}</option>
          ))}
        </select>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">All Types</option>
          {uniqueTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        
        <select
          value={filterSpecial}
          onChange={(e) => setFilterSpecial(e.target.value)}
          className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">All Cards</option>
          <option value="foil">Foil Only</option>
          <option value="nonfoil">Non-Foil Only</option>
          <option value="token">Tokens Only</option>
          <option value="card">Cards Only</option>
        </select>
        
        <select
          value={filterRarity}
          onChange={(e) => setFilterRarity(e.target.value)}
          className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">All Rarities</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="mythic">Mythic</option>
        </select>
        
        <select
          value={filterSet}
          onChange={(e) => setFilterSet(e.target.value)}
          className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">All Sets</option>
          {uniqueSets.map(set => (
            <option key={set} value={set}>{set}</option>
          ))}
        </select>
        
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">All Tags</option>
          {availableTags.map(tag => (
            <option key={tag.name || tag} value={tag.name || tag}>{tag.name || tag}</option>
          ))}
        </select>
        
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          <option value="all">All Locations</option>
          {uniqueLocations.map(location => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
      </div>

      {paginatedCards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60 text-lg">No cards found</p>
          <p className="text-white/40">Try adjusting your filters or add a new card</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-between items-center">
            <div className="text-white/60">
              Showing {paginatedCards.length} of {sortedCards.length} cards
            </div>
            
            <div className="flex gap-2">
              {selectedCards.size > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkUpdateModal('condition')}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                  >
                    Update Condition
                  </button>
                  <button
                    onClick={() => setBulkUpdateModal('location')}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                  >
                    Update Location
                  </button>
                  <button
                    onClick={() => setBulkUpdateModal('delete')}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                  >
                    Delete Selected
                  </button>
                </div>
              )}
              
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
              >
                <Plus size={18} />
                Add Card
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="p-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCards.size === paginatedCards.length && paginatedCards.length > 0}
                      onChange={toggleSelectAll}
                      className="mr-2"
                    />
                    Card
                  </th>
                  <th className="p-3 text-left">Set</th>
                  <th className="p-3 text-left">Quantity</th>
                  <th className="p-3 text-left">Condition</th>
                  <th className="p-3 text-left">Price</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCards.map(card => (
                  <tr key={card._id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCards.has(card._id)}
                          onChange={() => toggleCardSelection(card._id)}
                          className="mr-2"
                        />
                        <div>
                          <div className="font-medium text-white">{card.name}</div>
                          <div className="text-sm text-white/60">
                            {card.colors && card.colors.length > 0 && (
                              <span className="flex gap-1">
                                {card.colors.map(color => (
                                  <span key={color} className="w-4 h-4 rounded-full inline-block" style={{
                                    backgroundColor: {
                                      'W': '#f0f0f0',
                                      'U': '#4a90e2',
                                      'B': '#333',
                                      'R': '#e74c3c',
                                      'G': '#27ae60',
                                      'C': '#7f8c8d'
                                    }[color]
                                  }}></span>
                                ))}
                              </span>
                            )}
                            {card.types && card.types.length > 0 && (
                              <span className="ml-2 text-xs bg-white/10 px-2 py-1 rounded">
                                {card.types.join(' ')}
                              </span>
                            )}
                            {card.isFoil && (
                              <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
                                Foil
                              </span>
                            )}
                            {card.isToken && (
                              <span className="ml-2 text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                                Token
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-white/80">{card.set || '-'}</td>
                    <td className="p-3 text-white">{card.quantity}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        card.condition === 'NM' ? 'bg-green-500/20 text-green-300' :
                        card.condition === 'LP' ? 'bg-blue-500/20 text-blue-300' :
                        card.condition === 'MP' ? 'bg-yellow-500/20 text-yellow-300' :
                        card.condition === 'HP' ? 'bg-orange-500/20 text-orange-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {card.condition}
                      </span>
                    </td>
                    <td className="p-3 text-white font-medium">{formatPrice(card.price * card.quantity)}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(card)}
                          className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(card._id)}
                          className="p-1 bg-red-600 hover:bg-red-700 text-white rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="text-white/60">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">
                {editingId ? 'Edit Card' : 'Add New Card'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-white/60 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Card Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleCardNameChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter card name"
                    required
                  />
                  {showAutocomplete && autocompleteResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-white/20 rounded-lg max-h-60 overflow-y-auto">
                      {autocompleteResults.map((card, index) => (
                        <div
                          key={index}
                          onClick={() => selectAutocompleteCard(card)}
                          className="p-3 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-b-0"
                        >
                          <div className="font-medium text-white">{card}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Set</label>
                  <input
                    type="text"
                    value={formData.set}
                    onChange={(e) => setFormData({...formData, set: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Set name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Collector Number</label>
                  <input
                    type="text"
                    value={formData.collectorNumber}
                    onChange={(e) => setFormData({...formData, collectorNumber: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Collector number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Condition</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({...formData, condition: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {conditions.map(condition => (
                      <option key={condition} value={condition}>{condition}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Location</label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select location</option>
                    {uniqueLocations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Colors</label>
                <div className="flex gap-2 flex-wrap">
                  {mtgColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => toggleColor(color)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        formData.colors.includes(color)
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {colorNames[color]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Types</label>
                <input
                  type="text"
                  value={typesInputValue}
                  onChange={(e) => setTypesInputValue(e.target.value)}
                  onBlur={(e) => setFormData({...formData, types: e.target.value.split(',').map(t => t.trim()).filter(t => t)})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Comma-separated types (e.g., Creature, Human, Warrior)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Tags</label>
                <input
                  type="text"
                  value={tagsInputValue}
                  onChange={(e) => setTagsInputValue(e.target.value)}
                  onBlur={(e) => setFormData({...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Comma-separated tags (e.g., commander, budget, art)"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isFoil"
                  checked={formData.isFoil}
                  onChange={(e) => setFormData({...formData, isFoil: e.target.checked})}
                  className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="isFoil" className="text-sm text-white/80">Foil</label>
                
                <input
                  type="checkbox"
                  id="isToken"
                  checked={formData.isToken}
                  onChange={(e) => setFormData({...formData, isToken: e.target.checked})}
                  className="w-4 h-4 ml-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="isToken" className="text-sm text-white/80">Token</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                >
                  {editingId ? 'Update Card' : 'Add Card'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition"
                >
                  Cancel
                </button>
                {!offlineMode && (
                  <button
                    type="button"
                    onClick={searchScryfallManually}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                  >
                    Search Scryfall
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Bulk Update Modal
  if (bulkUpdateModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">
              Bulk Update ({selectedCards.size} selected)
            </h3>
            <button
              onClick={() => setBulkUpdateModal(null)}
              className="text-white/60 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {bulkUpdateModal === 'condition' && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">New Condition</label>
              <select
                value={bulkCondition}
                onChange={(e) => setBulkCondition(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {conditions.map(condition => (
                  <option key={condition} value={condition}>{condition}</option>
                ))}
              </select>
            </div>
          )}

          {bulkUpdateModal === 'location' && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">New Location</label>
              <select
                value={bulkLocation}
                onChange={(e) => setBulkLocation(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select location</option>
                {uniqueLocations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
          )}

          {(bulkUpdateModal === 'addTags' || bulkUpdateModal === 'removeTags') && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                {bulkUpdateModal === 'addTags' ? 'Tags to Add' : 'Tags to Remove'}
              </label>
              <input
                type="text"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Comma-separated tags"
              />
              <p className="text-xs text-white/60 mt-1">
                Enter tags separated by commas (e.g., "budget, casual, art")
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleBulkUpdate}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
            >
              Apply Changes
            </button>
            <button
              onClick={() => setBulkUpdateModal(null)}
              className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        user={authUser}
        isMultiUserEnabled={isMultiUserEnabled}
        onLogout={authLogout}
        onAccountSettings={() => setShowAccountSettings(true)}
        onAdminPanel={() => setShowAdminPanel(true)}
      />
      
      <main className="flex-1 overflow-auto">
        <Breadcrumb currentView={currentView} />
        
        <div className="p-4">
          {currentView === 'dashboard' && renderDashboard()}
          {currentView === 'collection' && renderCollection()}
          
          {/* Deck Builder View */}
          {currentView === 'decks' && (
            <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
              <DeckBuilder />
            </Suspense>
          )}

          {/* Wishlist View */}
          {currentView === 'wishlist' && (
            <div className="p-6">
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Wishlist</h2>
                <button
                  onClick={() => {
                    setEditingWishlistId(null);
                    setWishlistFormData({
                      name: '',
                      set: '',
                      targetPrice: 0,
                      currentPrice: 0,
                      priority: 'medium',
                      notes: '',
                      quantity: 1,
                      condition: 'NM',
                      colors: [],
                      types: [],
                      manaCost: '',
                      scryfallId: '',
                      imageUrl: '',
                      oracleText: ''
                    });
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add to Wishlist
                </button>
              </div>

              {editingWishlistId || wishlistFormData.name ? (
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-4">
                    {editingWishlistId ? 'Edit Wishlist Item' : 'Add to Wishlist'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-1">Card Name</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={wishlistFormData.name}
                          onChange={(e) => handleWishlistSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Enter card name"
                          required
                        />
                        {showWishlistAutocomplete && wishlistAutocompleteResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-white/20 rounded-lg max-h-60 overflow-y-auto">
                            {wishlistAutocompleteResults.map((card, index) => (
                              <div
                                key={index}
                                onClick={() => selectWishlistAutocompleteCard(card)}
                                className="p-3 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-b-0"
                              >
                                <div className="font-medium text-white">{card}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Set</label>
                        <input
                          type="text"
                          value={wishlistFormData.set}
                          onChange={(e) => setWishlistFormData({...wishlistFormData, set: e.target.value})}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Set name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Target Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={wishlistFormData.targetPrice}
                          onChange={(e) => setWishlistFormData({...wishlistFormData, targetPrice: parseFloat(e.target.value) || 0})}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={wishlistFormData.quantity}
                          onChange={(e) => setWishlistFormData({...wishlistFormData, quantity: parseInt(e.target.value) || 1})}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Priority</label>
                        <select
                          value={wishlistFormData.priority}
                          onChange={(e) => setWishlistFormData({...wishlistFormData, priority: e.target.value})}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-1">Condition</label>
                        <select
                          value={wishlistFormData.condition}
                          onChange={(e) => setWishlistFormData({...wishlistFormData, condition: e.target.value})}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {conditions.map(condition => (
                            <option key={condition} value={condition}>{condition}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-1">Notes</label>
                      <textarea
                        value={wishlistFormData.notes}
                        onChange={(e) => setWishlistFormData({...wishlistFormData, notes: e.target.value})}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        rows="3"
                        placeholder="Additional notes about this card..."
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleWishlistSubmit}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                      >
                        {editingWishlistId ? 'Update Item' : 'Add to Wishlist'}
                      </button>
                      <button
                        onClick={handleWishlistCancel}
                        className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="p-3 text-left">Card</th>
                      <th className="p-3 text-left">Set</th>
                      <th className="p-3 text-left">Quantity</th>
                      <th className="p-3 text-left">Target Price</th>
                      <th className="p-3 text-left">Current Price</th>
                      <th className="p-3 text-left">Diff</th>
                      <th className="p-3 text-left">Priority</th>
                      <th className="p-3 text-left">Notes</th>
                      <th className="p-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wishlistItems
                      .filter(item => wishlistFilterPriority === 'all' || item.priority === wishlistFilterPriority)
                      .map(item => {
                        const diff = item.currentPrice - item.targetPrice;
                        const isDeal = diff <= 0 && item.currentPrice > 0;
                        
                        return (
                          <tr key={item._id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-6 py-4 text-white font-medium">
                              {item.name}
                              {isDeal && (
                                <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded font-bold">
                                  DEAL!
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-white/80 text-sm">{item.set || '-'}</td>
                            <td className="px-6 py-4 text-white/80">{item.quantity}</td>
                            <td className="px-6 py-4 text-white/80">{formatPrice(item.targetPrice)}</td>
                            <td className="px-6 py-4 text-white/80">{formatPrice(item.currentPrice)}</td>
                            <td className={`px-6 py-4 font-semibold ${diff <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {item.targetPrice > 0 ? (diff <= 0 ? '' : '+') + formatPrice(diff) : '-'}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-sm font-semibold ${
                                item.priority === 'high' ? 'bg-red-600/50 text-white' :
                                item.priority === 'medium' ? 'bg-yellow-600/50 text-white' :
                                'bg-gray-600/50 text-white'
                              }`}>
                                <Star size={12} className="inline mr-1" />
                                {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-white/60 text-sm max-w-xs truncate">
                              {item.notes || '-'}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAcquireWishlistItem(item._id)}
                                  className="p-1 bg-green-600 hover:bg-green-700 text-white rounded transition"
                                  title="Acquire - Move to Collection"
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  onClick={() => handleWishlistEdit(item)}
                                  className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleWishlistDelete(item._id)}
                                  className="p-1 bg-red-600 hover:bg-red-700 text-white rounded transition"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Life Counter View */}
          {currentView === 'lifecounter' && (
            <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
              <LifeCounter onBack={() => setCurrentView('dashboard')} />
            </Suspense>
          )}

          {/* Settings View */}
          {currentView === 'settings' && (
            <SettingsView
              settings={settings}
              updateSettings={updateSettings}
              resetSettings={resetSettings}
              formatPrice={formatPrice}
              locations={locations}
              availableTags={availableTags}
              locationStats={locationStats}
              newLocationName={newLocationName}
              setNewLocationName={setNewLocationName}
              newLocationDesc={newLocationDesc}
              setNewLocationDesc={setNewLocationDesc}
              editingLocation={editingLocation}
              handleCreateLocation={handleCreateLocation}
              handleUpdateLocation={handleUpdateLocation}
              cancelEditLocation={cancelEditLocation}
              startEditLocation={startEditLocation}
              handleDeleteLocation={handleDeleteLocation}
              handleToggleLocationIgnorePrice={handleToggleLocationIgnorePrice}
              newTagName={newTagName}
              setNewTagName={setNewTagName}
              handleCreateTag={handleCreateTag}
              handleDeleteTag={handleDeleteTag}
              handleToggleTagIgnorePrice={handleToggleTagIgnorePrice}
              generateQR={generateQR}
              qrDataUrls={qrDataUrls}
              setQrDataUrls={setQrDataUrls}
              setQRPreviewLocation={setQRPreviewLocation}
              setShowQRPreview={setShowQRPreview}
              setShowPrintLabels={setShowPrintLabels}
            />
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
        </div>
      </main>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={paletteCommands}
        onSetShortcut={setShortcut}
        onRemoveShortcut={removeShortcut}
      />

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <AccountSettings onClose={() => setShowAccountSettings(false)} />
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  );
}

export default MainDashboard;