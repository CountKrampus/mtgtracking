import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Plus, Trash2, Edit2, Save, X, Download, RefreshCw, DollarSign, Upload, Camera, Settings, Heart, CheckSquare, Square, MapPin, Star, Layers, Zap, Crown, BarChart3, Users, QrCode, Printer, Home, BookOpen } from 'lucide-react';
import QRCode from 'qrcode';
import './App.css';
import Sidebar from './components/Sidebar';
import Breadcrumb from './components/Breadcrumb';
import CommandPalette from './components/CommandPalette';
import useKeyboardShortcuts, { buildShortcutKey } from './hooks/useKeyboardShortcuts';
import useSettings from './hooks/useSettings';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { AccountSettings } from './components/auth/AccountSettings';
import { AdminPanel } from './components/admin/AdminPanel';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';
import ResetPasswordForm from './components/auth/ResetPasswordForm';
import MainDashboard from './MainDashboard';

const DeckBuilder = React.lazy(() => import('./components/DeckBuilder'));
const CameraModal = React.lazy(() => import('./components/CameraModal'));
const LifeCounter = React.lazy(() => import('./components/LifeCounter/LifeCounter'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));

const API_URL = 'http://localhost:5000/api';

// Helper to get auth headers for API calls
const getAuthHeaders = () => {
  const token = localStorage.getItem('mtg_access_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

// Set up axios interceptor to add auth headers to all requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('mtg_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Axios response interceptor for token refresh on 401
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('mtg_refresh_token');
      if (refreshToken) {
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });

          if (response.ok) {
            const data = await response.json();
            localStorage.setItem('mtg_access_token', data.accessToken);
            localStorage.setItem('mtg_user', JSON.stringify(data.user));

            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
            return axios(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }

      // If refresh failed, clear tokens
      localStorage.removeItem('mtg_access_token');
      localStorage.removeItem('mtg_refresh_token');
      localStorage.removeItem('mtg_user');
    }

    return Promise.reject(error);
  }
);

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

function App() {
  // Auth context - available when wrapped with AuthProvider
  const authContext = useAuthContext();
  const { user: authUser, isMultiUserEnabled, logout: authLogout } = authContext || {};

  // Settings must be first so other state can use its values
  const { settings, updateSettings, resetSettings } = useSettings();

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
    if (!window.confirm(`Delete tag "${tagName}"? This will remove it from all cards.`)) return;

    try {
      await axios.delete(`${API_URL}/tags/${encodeURIComponent(tagName)}`);
      fetchAvailableTags();
      fetchCards(); // Refresh cards since tags may have been removed
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert(error.response?.data?.message || 'Error deleting tag');
    }
  };

  const handleToggleTagIgnorePrice = async (tagName, currentValue) => {
    try {
      await axios.put(`${API_URL}/tags/${encodeURIComponent(tagName)}`, { ignorePrice: !currentValue });
      fetchAvailableTags();
    } catch (error) {
      console.error('Error updating tag:', error);
      alert(error.response?.data?.message || 'Error updating tag');
    }
  };

  const handleToggleLocationIgnorePrice = async (locationId, currentValue) => {
    try {
      await axios.put(`${API_URL}/locations/${locationId}`, { ignorePrice: !currentValue });
      fetchLocations();
    } catch (error) {
      console.error('Error updating location:', error);
      alert(error.response?.data?.message || 'Error updating location');
    }
  };

  // ============================================
  // WISHLIST FUNCTIONS
  // ============================================

  const handleWishlistNameChange = async (value) => {
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
        colors: cardData.colors,
        types: cardData.types,
        manaCost: cardData.manaCost || '',
        scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl,
        currentPrice: cardData.prices.usd || 0,
        oracleText: cardData.oracleText || '',
        rarity: cardData.rarity || ''
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

  const handleWishlistSubmit = async () => {
    if (!wishlistFormData.name) {
      alert('Card name is required');
      return;
    }

    try {
      if (editingWishlistId) {
        await axios.put(`${API_URL}/wishlist/${editingWishlistId}`, wishlistFormData);
      } else {
        await axios.post(`${API_URL}/wishlist`, wishlistFormData);
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
      set: item.set || '',
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
    if (!window.confirm('Remove this item from your wishlist?')) return;

    try {
      await axios.delete(`${API_URL}/wishlist/${id}`);
      fetchWishlist();
    } catch (error) {
      console.error('Error deleting wishlist item:', error);
    }
  };

  const handleWishlistCancel = () => {
    setEditingWishlistId(null);
    setShowWishlistAutocomplete(false);
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

  const handleAcquireWishlistItem = async (id) => {
    try {
      const response = await axios.post(`${API_URL}/wishlist/${id}/acquire`, {
        location: '' // Can add location selection later
      });
      alert(response.data.message);
      fetchWishlist();
      fetchCards();
    } catch (error) {
      console.error('Error acquiring wishlist item:', error);
      alert('Error acquiring item');
    }
  };

  const updateAllWishlistPrices = async () => {
    if (!window.confirm('Update prices for all wishlist items?')) return;

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/wishlist/update-all-prices`);
      fetchWishlist();
      alert(`Updated ${response.data.updated} of ${response.data.total} wishlist items`);
    } catch (error) {
      console.error('Error updating wishlist prices:', error);
      alert('Error updating prices');
    } finally {
      setLoading(false);
    }
  };

  const filteredWishlistItems = useMemo(() => {
    return wishlistItems.filter(item => {
      if (wishlistFilterPriority !== 'all' && item.priority !== wishlistFilterPriority) {
        return false;
      }
      return true;
    });
  }, [wishlistItems, wishlistFilterPriority]);

  // ============================================
  // BULK OPERATIONS FUNCTIONS
  // ============================================

  const toggleCardSelection = (cardId) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const toggleSelectAllOnPage = () => {
    const pageCardIds = paginatedCards.map(card => card._id);
    const allSelected = pageCardIds.every(id => selectedCards.has(id));

    const newSelected = new Set(selectedCards);
    if (allSelected) {
      // Deselect all on this page
      pageCardIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all on this page
      pageCardIds.forEach(id => newSelected.add(id));
    }
    setSelectedCards(newSelected);
  };

  const clearSelection = () => {
    setSelectedCards(new Set());
  };

  const handleBulkUpdateCondition = async () => {
    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards),
        updates: { condition: bulkCondition }
      });
      alert(response.data.message);
      fetchCards();
      clearSelection();
      setBulkUpdateModal(null);
    } catch (error) {
      console.error('Error bulk updating condition:', error);
      alert('Error updating cards');
    }
  };

  const handleBulkUpdateLocation = async () => {
    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards),
        updates: { location: bulkLocation }
      });
      alert(response.data.message);
      fetchCards();
      clearSelection();
      setBulkUpdateModal(null);
    } catch (error) {
      console.error('Error bulk updating location:', error);
      alert('Error updating cards');
    }
  };

  const handleBulkAddTags = async () => {
    const tags = bulkTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length === 0) {
      alert('Please enter at least one tag');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards),
        updates: { addTags: tags }
      });
      alert(response.data.message);
      fetchCards();
      fetchAvailableTags();
      clearSelection();
      setBulkUpdateModal(null);
      setBulkTags('');
    } catch (error) {
      console.error('Error bulk adding tags:', error);
      alert('Error adding tags');
    }
  };

  const handleBulkRemoveTags = async () => {
    const tags = bulkTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length === 0) {
      alert('Please enter at least one tag');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards),
        updates: { removeTags: tags }
      });
      alert(response.data.message);
      fetchCards();
      fetchAvailableTags();
      clearSelection();
      setBulkUpdateModal(null);
      setBulkTags('');
    } catch (error) {
      console.error('Error bulk removing tags:', error);
      alert('Error removing tags');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCards.size} cards? This cannot be undone.`)) return;

    try {
      const response = await axios.delete(`${API_URL}/cards/bulk-delete`, {
        data: { cardIds: Array.from(selectedCards) }
      });
      alert(response.data.message);
      fetchCards();
      clearSelection();
      setBulkUpdateModal(null);
    } catch (error) {
      console.error('Error bulk deleting:', error);
      alert('Error deleting cards');
    }
  };

  // Get selected cards data for printing
  const getSelectedCardsForPrint = () => {
    return cards.filter(card => selectedCards.has(card._id));
  };

  const handlePrintProxies = () => {
    setShowPrintPreview(true);
  };

  const executePrint = () => {
    window.print();
  };

  // Similar Cards Functions
  const findSimilarCards = async (card) => {
    setSimilarCardsSource(card);
    setShowSimilarCards(true);
    setLoadingSimilar(true);
    setSimilarCards([]);

    try {
      // Build Scryfall search query based on card characteristics
      const queries = [];

      // Search by type
      if (card.types && card.types.length > 0) {
        const mainType = card.types[0]; // Use first type (Creature, Instant, etc.)
        queries.push(`t:${mainType.toLowerCase()}`);
      }

      // Search by color identity
      if (card.colors && card.colors.length > 0) {
        const colorQuery = card.colors.map(c => `c:${c.toLowerCase()}`).join(' ');
        queries.push(`(${colorQuery})`);
      } else {
        queries.push('c:colorless');
      }

      // Exclude the exact same card
      queries.push(`-!"${card.name}"`);

      const searchQuery = queries.join(' ');
      const response = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`
      );

      setSimilarCards(response.data.data.slice(0, 20)); // Limit to 20 results
    } catch (error) {
      console.error('Error finding similar cards:', error);
      // Try a simpler search if the first one fails
      try {
        if (card.types && card.types.length > 0) {
          const response = await axios.get(
            `https://api.scryfall.com/cards/search?q=t:${card.types[0].toLowerCase()}&order=edhrec&unique=cards`
          );
          setSimilarCards(response.data.data.slice(0, 20));
        }
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        setSimilarCards([]);
      }
    } finally {
      setLoadingSimilar(false);
    }
  };

  const addSimilarCardToCollection = async (scryfallCard) => {
    try {
      // Fetch full card data and add to collection
      const response = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(scryfallCard.name)}`);
      const cardData = response.data;

      await axios.post(`${API_URL}/cards`, {
        name: cardData.name,
        set: cardData.set,
        setCode: cardData.setCode,
        collectorNumber: cardData.collectorNumber,
        rarity: cardData.rarity,
        quantity: 1,
        condition: 'NM',
        price: cardData.prices?.usd || 0,
        colors: cardData.colors,
        types: cardData.types,
        manaCost: cardData.manaCost,
        scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl,
        oracleText: cardData.oracleText,
        tags: [],
        location: ''
      });

      alert(`Added ${cardData.name} to your collection!`);
      fetchCards();
    } catch (error) {
      console.error('Error adding card:', error);
      alert('Error adding card to collection');
    }
  };

  const addSimilarCardToWishlist = async (scryfallCard) => {
    try {
      await axios.post(`${API_URL}/wishlist`, {
        name: scryfallCard.name,
        set: scryfallCard.set_name || '',
        setCode: scryfallCard.set?.toUpperCase() || '',
        scryfallId: scryfallCard.id,
        imageUrl: scryfallCard.image_uris?.normal || '',
        colors: scryfallCard.colors || [],
        types: scryfallCard.type_line ? scryfallCard.type_line.split('—')[0].trim().split(' ') : [],
        manaCost: scryfallCard.mana_cost || '',
        rarity: scryfallCard.rarity ? scryfallCard.rarity[0].toUpperCase() : '',
        targetPrice: 0,
        currentPrice: scryfallCard.prices?.usd ? parseFloat(scryfallCard.prices.usd) : 0,
        priority: 'medium',
        notes: `Similar to ${similarCardsSource?.name}`,
        quantity: 1,
        condition: 'NM',
        oracleText: scryfallCard.oracle_text || ''
      });

      alert(`Added ${scryfallCard.name} to your wishlist!`);
      fetchWishlist();
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      alert('Error adding card to wishlist');
    }
  };

  // Card Synergies Functions
  const findCardSynergies = async (card) => {
    setSynergiesSource(card);
    setShowSynergies(true);
    setLoadingSynergies(true);
    setSynergies({ tribal: [], keywords: [], mechanics: [] });
    setSynergiesTab('tribal');

    const results = { tribal: [], keywords: [], mechanics: [] };

    try {
      // Build color identity query
      const colorQuery = card.colors?.length > 0
        ? `id<=${card.colors.map(c => c[0].toLowerCase()).join('')}`
        : 'id:c';

      // 1. TRIBAL SYNERGIES - Find cards of same creature type + tribal payoffs
      if (card.types && card.types.some(t => t.toLowerCase() === 'creature')) {
        // Extract creature subtypes from the card's type line or oracle text
        const oracleText = card.oracleText || '';
        const typeMatch = oracleText.match(/\b(Elf|Goblin|Zombie|Human|Vampire|Dragon|Angel|Demon|Merfolk|Wizard|Warrior|Knight|Soldier|Beast|Elemental|Spirit|Dinosaur|Pirate|Cat|Dog|Bird|Snake|Spider|Rat|Wolf|Bear|Sliver|Ally|Cleric|Rogue|Shaman|Druid|Artifact|Enchantment)\b/gi);

        // Also check if the card name suggests a tribe
        const nameTypes = card.name.match(/\b(Elf|Goblin|Zombie|Human|Vampire|Dragon|Angel|Demon|Merfolk|Wizard|Warrior|Knight|Soldier|Beast|Elemental|Spirit|Dinosaur|Pirate|Cat|Dog|Bird|Snake|Spider|Rat|Wolf|Bear|Sliver|Ally|Cleric|Rogue|Shaman|Druid)\b/gi);

        const tribes = [...new Set([...(typeMatch || []), ...(nameTypes || [])])].map(t => t.toLowerCase());

        if (tribes.length > 0) {
          const tribe = tribes[0]; // Use first found tribe
          try {
            // Search for tribal payoffs (cards that mention the tribe)
            const tribalResponse = await axios.get(
              `https://api.scryfall.com/cards/search?q=o:"${tribe}" ${colorQuery} -t:${tribe} -!"${card.name}"&order=edhrec&unique=cards`
            );
            results.tribal = tribalResponse.data.data.slice(0, 12);
          } catch (e) {
            // Try simpler search - just other creatures of same type
            try {
              const sameTypeResponse = await axios.get(
                `https://api.scryfall.com/cards/search?q=t:${tribe} ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`
              );
              results.tribal = sameTypeResponse.data.data.slice(0, 12);
            } catch (e2) {
              console.log('No tribal synergies found');
            }
          }
        }
      }

      // 2. KEYWORD SYNERGIES - Find cards that share or grant keywords
      const oracleText = (card.oracleText || '').toLowerCase();
      const keywords = [];

      // Common MTG keywords to look for
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
        { keyword: 'ward', search: 'o:"ward"' }
      ];

      for (const { keyword, search } of keywordPatterns) {
        if (oracleText.includes(keyword)) {
          keywords.push({ keyword, search });
        }
      }

      if (keywords.length > 0) {
        // Search for first found keyword synergy
        const keywordToSearch = keywords[0];
        try {
          const keywordResponse = await axios.get(
            `https://api.scryfall.com/cards/search?q=(${keywordToSearch.search}) ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`
          );
          results.keywords = keywordResponse.data.data.slice(0, 12);
        } catch (e) {
          console.log('No keyword synergies found');
        }
      }

      // 3. MECHANIC SYNERGIES - Parse oracle text for common patterns
      const mechanicPatterns = [
        { pattern: /\+1\/\+1 counter/i, search: 'o:"+1/+1 counter" OR o:"proliferate"', name: '+1/+1 Counters' },
        { pattern: /-1\/-1 counter/i, search: 'o:"-1/-1 counter" OR o:"wither"', name: '-1/-1 Counters' },
        { pattern: /draw.*(card|cards)/i, search: 'o:"whenever you draw" OR o:"draw a card"', name: 'Card Draw' },
        { pattern: /discard/i, search: 'o:"discard" o:"whenever"', name: 'Discard' },
        { pattern: /creature dies|when.*dies/i, search: 'o:"when" o:"dies" OR o:"whenever a creature dies"', name: 'Death Triggers' },
        { pattern: /sacrifice/i, search: 'o:"sacrifice" o:"whenever" OR o:"sacrifice a creature"', name: 'Sacrifice' },
        { pattern: /token/i, search: 'o:"create" o:"token"', name: 'Tokens' },
        { pattern: /graveyard/i, search: 'o:"from your graveyard" OR o:"in your graveyard"', name: 'Graveyard' },
        { pattern: /exile/i, search: 'o:"exile" o:"return"', name: 'Exile/Blink' },
        { pattern: /enters the battlefield|etb/i, search: 'o:"enters the battlefield" o:"whenever"', name: 'ETB Triggers' },
        { pattern: /life.*gain|gain.*life/i, search: 'o:"gain life" OR o:"whenever you gain life"', name: 'Lifegain' },
        { pattern: /deals.*damage.*opponent|damage.*to.*opponent/i, search: 'o:"deals damage to" o:"opponent"', name: 'Direct Damage' },
        { pattern: /mana/i, search: 'o:"add" o:"mana"', name: 'Mana Ramp' },
        { pattern: /equipment|equip/i, search: 't:equipment OR o:"equipped creature"', name: 'Equipment' },
        { pattern: /aura|enchant creature/i, search: 't:aura OR o:"enchanted creature"', name: 'Auras' },
        { pattern: /spell.*cast|cast.*spell/i, search: 'o:"whenever you cast" o:"spell"', name: 'Spellslinger' },
        { pattern: /attack/i, search: 'o:"whenever" o:"attacks"', name: 'Attack Triggers' },
        { pattern: /untap/i, search: 'o:"untap" o:"whenever"', name: 'Untap Synergy' },
        { pattern: /copy/i, search: 'o:"copy" o:"spell" OR o:"copy" o:"creature"', name: 'Copy Effects' }
      ];

      const foundMechanics = [];
      for (const { pattern, search, name } of mechanicPatterns) {
        if (pattern.test(oracleText)) {
          foundMechanics.push({ search, name });
        }
      }

      if (foundMechanics.length > 0) {
        // Search for first found mechanic
        const mechanicToSearch = foundMechanics[0];
        try {
          const mechanicResponse = await axios.get(
            `https://api.scryfall.com/cards/search?q=(${mechanicToSearch.search}) ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`
          );
          results.mechanics = mechanicResponse.data.data.slice(0, 12);
        } catch (e) {
          console.log('No mechanic synergies found');
        }
      }

      // If no mechanics found from text, try based on card type
      if (results.mechanics.length === 0) {
        if (card.types?.includes('Instant') || card.types?.includes('Sorcery')) {
          try {
            const spellResponse = await axios.get(
              `https://api.scryfall.com/cards/search?q=o:"whenever you cast" (o:"instant" OR o:"sorcery") ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`
            );
            results.mechanics = spellResponse.data.data.slice(0, 12);
          } catch (e) {
            console.log('No spell synergies found');
          }
        } else if (card.types?.includes('Artifact')) {
          try {
            const artifactResponse = await axios.get(
              `https://api.scryfall.com/cards/search?q=o:"artifact" o:"whenever" ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`
            );
            results.mechanics = artifactResponse.data.data.slice(0, 12);
          } catch (e) {
            console.log('No artifact synergies found');
          }
        } else if (card.types?.includes('Enchantment')) {
          try {
            const enchantmentResponse = await axios.get(
              `https://api.scryfall.com/cards/search?q=o:"enchantment" o:"whenever" OR o:"constellation" ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`
            );
            results.mechanics = enchantmentResponse.data.data.slice(0, 12);
          } catch (e) {
            console.log('No enchantment synergies found');
          }
        }
      }

      setSynergies(results);

      // Auto-select first tab with results
      if (results.tribal.length > 0) {
        setSynergiesTab('tribal');
      } else if (results.keywords.length > 0) {
        setSynergiesTab('keywords');
      } else if (results.mechanics.length > 0) {
        setSynergiesTab('mechanics');
      }

    } catch (error) {
      console.error('Error finding synergies:', error);
    } finally {
      setLoadingSynergies(false);
    }
  };

  const addSynergyCardToCollection = async (scryfallCard) => {
    try {
      const response = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(scryfallCard.name)}`);
      const cardData = response.data;

      await axios.post(`${API_URL}/cards`, {
        name: cardData.name,
        set: cardData.set,
        setCode: cardData.setCode,
        collectorNumber: cardData.collectorNumber,
        rarity: cardData.rarity,
        quantity: 1,
        condition: 'NM',
        price: cardData.prices?.usd || 0,
        colors: cardData.colors,
        types: cardData.types,
        manaCost: cardData.manaCost,
        scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl,
        oracleText: cardData.oracleText,
        tags: [],
        location: ''
      });

      alert(`Added ${cardData.name} to your collection!`);
      fetchCards();
    } catch (error) {
      console.error('Error adding card:', error);
      alert('Error adding card to collection');
    }
  };

  const addSynergyCardToWishlist = async (scryfallCard) => {
    try {
      await axios.post(`${API_URL}/wishlist`, {
        name: scryfallCard.name,
        set: scryfallCard.set_name || '',
        setCode: scryfallCard.set?.toUpperCase() || '',
        scryfallId: scryfallCard.id,
        imageUrl: scryfallCard.image_uris?.normal || '',
        colors: scryfallCard.colors || [],
        types: scryfallCard.type_line ? scryfallCard.type_line.split('—')[0].trim().split(' ') : [],
        manaCost: scryfallCard.mana_cost || '',
        rarity: scryfallCard.rarity ? scryfallCard.rarity[0].toUpperCase() : '',
        targetPrice: 0,
        currentPrice: scryfallCard.prices?.usd ? parseFloat(scryfallCard.prices.usd) : 0,
        priority: 'medium',
        notes: `Synergy with ${synergiesSource?.name}`,
        quantity: 1,
        condition: 'NM',
        oracleText: scryfallCard.oracle_text || ''
      });

      alert(`Added ${scryfallCard.name} to your wishlist!`);
      fetchWishlist();
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      alert('Error adding card to wishlist');
    }
  };

  // Commander Recommendations Functions
  const getCommanderRecommendations = async () => {
    setShowCommanderRecs(true);
    setLoadingCommanders(true);
    setCommanderRecs([]);

    try {
      // Analyze collection to find dominant colors
      const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
      const themeCounts = {};

      cards.forEach(card => {
        // Count colors
        if (card.colors) {
          card.colors.forEach(color => {
            const c = color[0].toUpperCase();
            if (colorCounts[c] !== undefined) {
              colorCounts[c] += card.quantity;
            }
          });
        }

        // Detect themes from oracle text
        const oracleText = (card.oracleText || '').toLowerCase();
        const themes = [
          { name: 'tokens', patterns: [/create.*token/, /token.*creature/] },
          { name: 'graveyard', patterns: [/from.*graveyard/, /into.*graveyard/, /mill/] },
          { name: 'counters', patterns: [/\+1\/\+1 counter/, /proliferate/] },
          { name: 'lifegain', patterns: [/gain.*life/, /lifelink/] },
          { name: 'sacrifice', patterns: [/sacrifice.*creature/, /when.*dies/] },
          { name: 'spellslinger', patterns: [/instant.*sorcery/, /when.*cast.*spell/] },
          { name: 'artifacts', patterns: [/artifact.*enter/, /artifact.*you.*control/] },
          { name: 'enchantments', patterns: [/enchantment.*enter/, /constellation/] },
          { name: 'tribal', patterns: [/creature.*type/, /creatures.*you.*control.*get/] },
          { name: 'ramp', patterns: [/add.*mana/, /search.*land/] },
          { name: 'draw', patterns: [/draw.*card/, /whenever.*draw/] },
          { name: 'control', patterns: [/counter.*spell/, /destroy.*target/, /exile.*target/] }
        ];

        themes.forEach(({ name, patterns }) => {
          if (patterns.some(p => p.test(oracleText))) {
            themeCounts[name] = (themeCounts[name] || 0) + card.quantity;
          }
        });
      });

      // Determine color identity to search
      let colorQuery = '';
      if (commanderColorFilter === 'auto') {
        // Find top 2-3 colors
        const sortedColors = Object.entries(colorCounts)
          .sort((a, b) => b[1] - a[1])
          .filter(([_, count]) => count > 0);

        if (sortedColors.length >= 2) {
          const topColors = sortedColors.slice(0, 3).map(([c]) => c.toLowerCase());
          colorQuery = `id:${topColors.join('')}`;
        }
      } else if (commanderColorFilter !== 'all') {
        colorQuery = `id:${commanderColorFilter}`;
      }

      // Determine top theme
      const topTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0];
      let themeQuery = '';
      if (topTheme) {
        const themeSearches = {
          tokens: 'o:"create" o:"token"',
          graveyard: 'o:"graveyard"',
          counters: 'o:"+1/+1 counter"',
          lifegain: 'o:"gain" o:"life"',
          sacrifice: 'o:"sacrifice"',
          spellslinger: 'o:"instant" o:"sorcery"',
          artifacts: 'o:"artifact"',
          enchantments: 'o:"enchantment"',
          tribal: 'o:"creature" o:"type"',
          ramp: 'o:"add" o:"mana"',
          draw: 'o:"draw" o:"card"',
          control: 'o:"counter" OR o:"destroy"'
        };
        themeQuery = themeSearches[topTheme[0]] || '';
      }

      // Search for legendary creatures
      const searchQuery = `t:legendary t:creature ${colorQuery} ${themeQuery}`.trim();
      const response = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`
      );

      setCommanderRecs(response.data.data.slice(0, 20));
    } catch (error) {
      console.error('Error getting commander recommendations:', error);
      // Fallback: just get popular commanders
      try {
        const response = await axios.get(
          'https://api.scryfall.com/cards/search?q=t:legendary+t:creature&order=edhrec&unique=cards'
        );
        setCommanderRecs(response.data.data.slice(0, 20));
      } catch (e) {
        setCommanderRecs([]);
      }
    } finally {
      setLoadingCommanders(false);
    }
  };

  const addCommanderToCollection = async (scryfallCard) => {
    try {
      const response = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(scryfallCard.name)}`);
      const cardData = response.data;

      await axios.post(`${API_URL}/cards`, {
        name: cardData.name,
        set: cardData.set,
        setCode: cardData.setCode,
        collectorNumber: cardData.collectorNumber,
        rarity: cardData.rarity,
        quantity: 1,
        condition: 'NM',
        price: cardData.prices?.usd || 0,
        colors: cardData.colors,
        types: cardData.types,
        manaCost: cardData.manaCost,
        scryfallId: cardData.scryfallId,
        imageUrl: cardData.imageUrl,
        oracleText: cardData.oracleText,
        tags: ['commander'],
        location: ''
      });

      alert(`Added ${cardData.name} to your collection!`);
      fetchCards();
    } catch (error) {
      console.error('Error adding commander:', error);
      alert('Error adding commander to collection');
    }
  };

  const searchCommandersByPreference = async () => {
    setLoadingCommanders(true);
    setCommanderRecs([]);

    const themeSearches = {
      tokens: 'o:"create" o:"token"',
      graveyard: 'o:"graveyard"',
      counters: 'o:"+1/+1 counter"',
      lifegain: 'o:"gain" o:"life"',
      sacrifice: 'o:"sacrifice"',
      spellslinger: '(o:"instant" o:"sorcery")',
      artifacts: 'o:"artifact"',
      enchantments: 'o:"enchantment"',
      tribal: 'o:"creature you control"',
      ramp: 'o:"search your library" o:"land"',
      draw: 'o:"draw" o:"card"',
      control: '(o:"counter target" OR o:"destroy target")',
      voltron: '(o:"equip" OR o:"aura" OR o:"attach")',
      mill: 'o:"mill"',
      blink: '(o:"exile" o:"return" o:"battlefield")',
      stax: '(o:"can\'t" OR o:"don\'t untap")',
      grouphug: '(o:"each player" o:"draw")',
      aristocrats: '(o:"when" o:"dies")',
      storm: '(o:"copy" o:"spell")',
      landfall: 'o:"landfall"',
    };

    try {
      let parts = ['t:legendary', 't:creature'];

      // Color identity
      if (finderColors.length > 0) {
        parts.push(`id<=${finderColors.join('').toLowerCase()}`);
      }

      // Themes (OR them together if multiple)
      const themeQueries = finderThemes.map(t => themeSearches[t]).filter(Boolean);
      if (themeQueries.length === 1) {
        parts.push(themeQueries[0]);
      } else if (themeQueries.length > 1) {
        parts.push(`(${themeQueries.join(' OR ')})`);
      }

      // Creature type
      if (finderCreatureType.trim()) {
        parts.push(`t:${finderCreatureType.trim().toLowerCase()}`);
      }

      const searchQuery = parts.join(' ');
      const response = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`
      );

      setCommanderRecs(response.data.data.slice(0, 20));
    } catch (error) {
      console.error('Error searching commanders by preference:', error);
      setCommanderRecs([]);
    } finally {
      setLoadingCommanders(false);
    }
  };

  // Set Completion Tracker Functions
  const getSetCompletionData = async () => {
    setShowSetCompletion(true);
    setLoadingSetCompletion(true);

    try {
      // Group cards by set code
      const cardsBySet = {};
      cards.forEach(card => {
        if (card.setCode) {
          const code = card.setCode.toLowerCase();
          if (!cardsBySet[code]) {
            cardsBySet[code] = {
              setCode: code,
              setName: card.set,
              ownedCards: new Set(),
              totalOwned: 0
            };
          }
          cardsBySet[code].ownedCards.add(card.name);
          cardsBySet[code].totalOwned += card.quantity;
        }
      });

      // Fetch set info from Scryfall for sets we have cards from
      const completionData = [];
      const setCodes = Object.keys(cardsBySet);

      for (const code of setCodes.slice(0, 20)) { // Limit to 20 sets to avoid too many API calls
        try {
          const setResponse = await axios.get(`https://api.scryfall.com/sets/${code}`);
          const setInfo = setResponse.data;

          completionData.push({
            setCode: code.toUpperCase(),
            setName: setInfo.name,
            icon: setInfo.icon_svg_uri,
            ownedUnique: cardsBySet[code].ownedCards.size,
            totalInSet: setInfo.card_count,
            totalOwned: cardsBySet[code].totalOwned,
            releasedAt: setInfo.released_at,
            setType: setInfo.set_type
          });

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          // Skip sets that can't be found
          console.log(`Could not fetch set info for ${code}`);
        }
      }

      // Sort by completion percentage descending
      completionData.sort((a, b) => (b.ownedUnique / b.totalInSet) - (a.ownedUnique / a.totalInSet));

      setSetCompletionData(completionData);
    } catch (error) {
      console.error('Error getting set completion data:', error);
    } finally {
      setLoadingSetCompletion(false);
    }
  };

  // Combo Finder Functions
  const findCombos = async () => {
    setShowComboFinder(true);
    setLoadingCombos(true);
    setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
    setComboTab('complete');

    try {
      const response = await axios.get(`${API_URL}/combos/find`);
      setComboResults(response.data);
      // Auto-switch to partial tab if no complete combos but there are partial ones
      if (response.data.found === 0 && response.data.partialFound > 0) {
        setComboTab('partial');
      }
    } catch (error) {
      console.error('Error finding combos:', error);
      setComboResults({ combos: [], partialCombos: [], found: 0, partialFound: 0, error: error.message });
    } finally {
      setLoadingCombos(false);
    }
  };

  // Add missing combo card to wishlist
  const addToWishlistFromCombo = async (cardName) => {
    try {
      // First search Scryfall to get card data
      const searchResponse = await axios.get(`${API_URL}/scryfall/search?name=${encodeURIComponent(cardName)}`);
      const cardData = searchResponse.data;

      // Add to wishlist
      await axios.post(`${API_URL}/wishlist`, {
        name: cardData.name,
        set: cardData.set || 'Unknown',
        imageUrl: cardData.imageUrl,
        currentPrice: cardData.price || 0,
        targetPrice: cardData.price || 0,
        priority: 'medium',
        notes: 'Added from Combo Finder'
      });

      alert(`${cardData.name} added to wishlist!`);
      fetchWishlist();
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      // Try adding with just the name if Scryfall search fails
      try {
        await axios.post(`${API_URL}/wishlist`, {
          name: cardName,
          set: 'Unknown',
          currentPrice: 0,
          targetPrice: 0,
          priority: 'medium',
          notes: 'Added from Combo Finder'
        });
        alert(`${cardName} added to wishlist!`);
        fetchWishlist();
      } catch (e) {
        alert('Failed to add card to wishlist');
      }
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return []; // Need header + at least one data row

    const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const cards = [];

    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;

      // Parse CSV respecting quoted fields
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const card = {};
      header.forEach((key, idx) => {
        // Map CSV header names to card fields
        const fieldMap = {
          'name': 'name',
          'set': 'set',
          'quantity': 'quantity',
          'condition': 'condition',
          'price': 'price',
          'colors': 'colors',
          'types': 'types',
          'mana cost': 'manaCost',
          'manacost': 'manaCost',
          'total value': null, // Skip calculated field
          'totalvalue': null,
          'setcode': 'setCode',
          'set code': 'setCode',
          'collectornumber': 'collectorNumber',
          'collector number': 'collectorNumber',
          'rarity': 'rarity',
          'scryfallid': 'scryfallId',
          'imageurl': 'imageUrl',
          'isfoil': 'isFoil',
          'istoken': 'isToken',
          'oracletext': 'oracleText',
          'tags': 'tags'
        };
        const field = fieldMap[key] || key;
        if (field && values[idx] !== undefined) {
          card[field] = values[idx];
        }
      });

      if (card.name) cards.push(card);
    }

    return cards;
  };

  const handleBulkImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const fileExtension = file.name.split('.').pop().toLowerCase();

      let response;

      if (fileExtension === 'json') {
        // JSON import - parse and send full card objects
        const cards = JSON.parse(text);
        const cardArray = Array.isArray(cards) ? cards : [cards];
        setImportProgress({ current: 0, total: cardArray.length, cardName: '' });
        response = await axios.post(`${API_URL}/cards/bulk-import-full`, { cards: cardArray });

      } else if (fileExtension === 'csv') {
        // CSV import - parse and send full card objects
        const cards = parseCSV(text);
        setImportProgress({ current: 0, total: cards.length, cardName: '' });
        response = await axios.post(`${API_URL}/cards/bulk-import-full`, { cards });

      } else {
        // TXT import - send as card list (existing behavior)
        const cardList = text.split('\n').filter(line => line.trim());
        setImportProgress({ current: 0, total: cardList.length, cardName: '' });
        response = await axios.post(`${API_URL}/cards/bulk-import`, {
          cardList,
          offlineMode
        });
      }

      setImportResults(response.data);
      setShowImportResults(true);
      fetchCards();
    } catch (error) {
      console.error('Error importing cards:', error);
      alert('Error importing cards: ' + error.message);
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0, cardName: '' });
      event.target.value = ''; // Reset file input
    }
  };

  const exportData = async (format) => {
    try {
      const response = await axios.get(`${API_URL}/export/${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      const blob = format === 'csv'
        ? response.data
        : new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mtg-collection.${format}`;
      a.click();
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const filteredAndSortedCards = useMemo(() => {
    let filtered = cards.filter(card => {
      // Enhanced search: name, set, oracle text, and tags
      let matchesSearch = false;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        matchesSearch = card.name.toLowerCase().includes(searchLower) ||
                       card.set.toLowerCase().includes(searchLower);

        // Include oracle text in search if enabled
        if (searchIncludesOracleText && card.oracleText) {
          matchesSearch = matchesSearch ||
                         card.oracleText.toLowerCase().includes(searchLower);
        }

        // Include tags in search
        if (card.tags && card.tags.some(tag => tag.includes(searchLower))) {
          matchesSearch = true;
        }
      } else {
        matchesSearch = true;
      }

      const matchesCondition = filterCondition === 'all' || card.condition === filterCondition;
      const matchesColor = filterColor === 'all' || (card.colors && card.colors.includes(filterColor));
      const matchesSet = filterSet === 'all' || card.set === filterSet;

      let matchesType = true;
      if (filterType !== 'all') {
        if (card.types && card.types.length > 0) {
          const cardTypeStr = card.types.join(' ');
          matchesType = cardTypeStr === filterType;
        } else {
          matchesType = false;
        }
      }

      // Combined special filter (token/foil)
      let matchesSpecial = true;
      if (filterSpecial === 'tokens') {
        matchesSpecial = card.isToken === true;
      } else if (filterSpecial === 'non-tokens') {
        matchesSpecial = !card.isToken;
      } else if (filterSpecial === 'foil') {
        matchesSpecial = card.isFoil === true;
      } else if (filterSpecial === 'non-foil') {
        matchesSpecial = !card.isFoil;
      }

      // Rarity filter
      let matchesRarity = true;
      if (filterRarity !== 'all') {
        matchesRarity = card.rarity === filterRarity;
      }

      // Add tag filter
      let matchesTag = true;
      if (filterTag !== 'all') {
        matchesTag = card.tags && card.tags.includes(filterTag);
      }

      // Add location filter
      let matchesLocation = true;
      if (filterLocation !== 'all') {
        matchesLocation = card.location === filterLocation;
      }

      return matchesSearch && matchesCondition && matchesColor && matchesSet && matchesType && matchesSpecial && matchesRarity && matchesTag && matchesLocation;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') return b.price - a.price;
      if (sortBy === 'quantity') return b.quantity - a.quantity;
      if (sortBy === 'totalValue') return (b.price * b.quantity) - (a.price * a.quantity);

      if (sortBy === 'type') {
        const aType = a.types && a.types.length > 0 ? a.types.join(' ') : 'zzz';
        const bType = b.types && b.types.length > 0 ? b.types.join(' ') : 'zzz';
        return aType.localeCompare(bType);
      }

      if (sortBy === 'color') {
        const getColorSortValue = (card) => {
          if (!card.colors || card.colors.length === 0) return 'Z';
          if (card.colors.length === 1) return card.colors[0];
          return 'M' + card.colors.sort().join('');
        };
        return getColorSortValue(a).localeCompare(getColorSortValue(b));
      }

      return 0;
    });
  }, [cards, searchTerm, filterCondition, filterColor, filterSet, filterType, filterSpecial, filterRarity, filterTag, filterLocation, searchIncludesOracleText, sortBy]);

  // Calculate total value, excluding cards with ignored tags/locations
  const { totalValue, ignoredValue } = useMemo(() => {
    // Build sets of ignored location/tag names
    const ignoredLocations = new Set(
      locations.filter(l => l.ignorePrice).map(l => l.name)
    );
    const ignoredTags = new Set(
      availableTags.filter(t => t.ignorePrice).map(t => t.name || t)
    );

    const shouldIgnore = (card) => {
      if (card.location && ignoredLocations.has(card.location)) return true;
      if (card.tags && card.tags.some(tag => ignoredTags.has(tag))) return true;
      return false;
    };

    let total = 0;
    let ignored = 0;
    cards.forEach(card => {
      const value = card.price * card.quantity;
      if (shouldIgnore(card)) {
        ignored += value;
      } else {
        total += value;
      }
    });

    return { totalValue: total, ignoredValue: ignored };
  }, [cards, locations, availableTags]);

  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);

  // Format price based on currency settings
  const formatPrice = useCallback((priceUSD) => {
    if (priceUSD == null || isNaN(priceUSD)) priceUSD = 0;
    if (settings.displayCurrency === 'CAD') return `C$${(priceUSD / settings.cadToUsdRate).toFixed(2)}`;
    if (settings.displayCurrency === 'EUR') return `€${(priceUSD * settings.usdToEurRate).toFixed(2)}`;
    return `$${priceUSD.toFixed(2)}`;
  }, [settings.displayCurrency, settings.cadToUsdRate, settings.usdToEurRate]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCards.length / pageSize);
  const paginatedCards = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedCards.slice(startIndex, endIndex);
  }, [filteredAndSortedCards, currentPage, pageSize]);

  // Reset to page 1 when filters or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCondition, filterColor, filterSet, filterType, filterSpecial, filterRarity, filterTag, filterLocation, searchIncludesOracleText, sortBy, pageSize]);

  // Redirect to dashboard if current view's feature is disabled
  useEffect(() => {
    const viewFeatureMap = {
      decks: 'deckBuilder',
      wishlist: 'wishlist',
    };
    const feature = viewFeatureMap[currentView];
    if (feature && settings.features[feature] === false) {
      setCurrentView('dashboard');
    }
  }, [currentView, settings.features]);

  // Keyboard shortcuts
  const searchInputRef = useRef(null);
  const paletteCommandsRef = useRef([]);

  const handleKeyboardShortcut = useCallback((e) => {
    const tag = e.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;

    // Ctrl+K / Cmd+K always works
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setShowCommandPalette(prev => !prev);
      return;
    }

    // Escape always works
    if (e.key === 'Escape') {
      if (showCommandPalette) {
        setShowCommandPalette(false);
        return;
      }
      // Close any open modals
      if (showPriceUpdateModal) { setShowPriceUpdateModal(false); return; }
      if (showSimilarCards) { setShowSimilarCards(false); return; }
      if (showSynergies) { setShowSynergies(false); return; }
      if (showCommanderRecs) { setShowCommanderRecs(false); setCommanderFinderMode('collection'); return; }
      if (showSetCompletion) { setShowSetCompletion(false); return; }
      if (showComboFinder) { setShowComboFinder(false); return; }
      if (showImportResults) { setShowImportResults(false); return; }
      if (showPrintPreview) { setShowPrintPreview(false); return; }
      if (showQRPreview) { setShowQRPreview(false); return; }
      return;
    }

    // Build combo string from key event (e.g. "ctrl+shift+l" or "n")
    const combo = buildShortcutKey(e);
    if (!combo) return;

    // Skip single-key shortcuts when typing in inputs, but allow modifier combos
    const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
    if (isInput && !hasModifier) return;

    const commandId = keyToCommand[combo];
    if (commandId) {
      e.preventDefault();
      const cmd = paletteCommandsRef.current.find(c => c.id === commandId);
      if (cmd) cmd.action();
    }
  }, [keyToCommand, showCommandPalette, showPriceUpdateModal, showSimilarCards, showSynergies, showCommanderRecs, showSetCompletion, showComboFinder, showImportResults, showPrintPreview, showQRPreview]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [handleKeyboardShortcut]);

  // Command palette commands
  const paletteCommands = useMemo(() => {
    const ft = settings.features;
    const allCmds = [
      // Navigation
      { id: 'nav-dashboard', label: 'Go to Dashboard', icon: Home, category: 'Navigation', action: () => setCurrentView('dashboard') },
      { id: 'nav-collection', label: 'Go to Collection', icon: BookOpen, category: 'Navigation', action: () => setCurrentView('collection') },
      { id: 'nav-decks', label: 'Go to Deck Builder', icon: Layers, category: 'Navigation', action: () => setCurrentView('decks'), feature: 'deckBuilder' },
      { id: 'nav-wishlist', label: 'Go to Wishlist', icon: Heart, category: 'Navigation', action: () => setCurrentView('wishlist'), feature: 'wishlist' },
      { id: 'nav-lifecounter', label: 'Go to Life Counter', icon: Users, category: 'Navigation', action: () => setCurrentView('lifecounter') },
      { id: 'nav-settings', label: 'Go to Settings', icon: Settings, category: 'Navigation', action: () => setCurrentView('settings') },
      // Actions
      { id: 'act-add', label: 'Add New Card', icon: Plus, category: 'Actions', action: () => { setCurrentView('collection'); setShowAddForm(true); } },
      { id: 'act-import', label: 'Import Cards', icon: Upload, category: 'Actions', action: () => fileInputRef.current?.click() },
      { id: 'act-export-json', label: 'Export as JSON', icon: Download, category: 'Actions', action: () => exportData('json') },
      { id: 'act-export-csv', label: 'Export as CSV', icon: Download, category: 'Actions', action: () => exportData('csv') },
      { id: 'act-prices', label: 'Update Prices', icon: RefreshCw, category: 'Actions', action: () => setShowPriceUpdateModal(true) },
      { id: 'act-text', label: 'Fetch Card Text', icon: RefreshCw, category: 'Actions', action: () => updateAllOracleText() },
      { id: 'act-search', label: 'Focus Search', icon: Search, category: 'Actions', action: () => { setCurrentView('collection'); setTimeout(() => searchInputRef.current?.focus(), 100); } },
      // Tools
      { id: 'tool-commanders', label: 'Commander Recommendations', icon: Crown, category: 'Tools', action: () => getCommanderRecommendations(), feature: 'commanderRecs' },
      { id: 'tool-sets', label: 'Set Completion Tracker', icon: BarChart3, category: 'Tools', action: () => getSetCompletionData(), feature: 'setCompletion' },
      { id: 'tool-combos', label: 'Find Combos', icon: Zap, category: 'Tools', action: () => findCombos(), feature: 'comboFinder' },
      { id: 'tool-camera', label: 'Scan Card with Camera', icon: Camera, category: 'Tools', action: () => setShowCameraModal(true) },
    ];
    const cmds = allCmds
      .filter(cmd => !cmd.feature || ft[cmd.feature] !== false)
      .map(cmd => ({ ...cmd, shortcut: shortcuts[cmd.id] || undefined }));
    paletteCommandsRef.current = cmds;
    return cmds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, settings.features]);

  // Settings View Component (inline)
  const SettingsView = ({
    settings, updateSettings, resetSettings, formatPrice,
    locations, availableTags, locationStats,
    newLocationName, setNewLocationName, newLocationDesc, setNewLocationDesc,
    editingLocation, handleCreateLocation, handleUpdateLocation, cancelEditLocation,
    startEditLocation, handleDeleteLocation, handleToggleLocationIgnorePrice,
    newTagName, setNewTagName, handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
    generateQR, qrDataUrls, setQrDataUrls, setQRPreviewLocation, setShowQRPreview, setShowPrintLabels
  }) => {
    const [settingsTab, setSettingsTab] = React.useState('display');
    const [clearCollectionConfirm, setClearCollectionConfirm] = React.useState(false);
    const [clearCacheConfirm, setClearCacheConfirm] = React.useState(false);
    const [statsData, setStatsData] = React.useState(null);

    // Fetch stats on mount
    React.useEffect(() => {
      const fetchStats = async () => {
        try {
          const res = await axios.get(`${API_URL}/stats`);
          setStatsData(res.data);
        } catch (err) {
          console.error('Failed to fetch stats:', err);
        }
      };
      fetchStats();
    }, []);

    const handleClearCollection = async () => {
      if (!clearCollectionConfirm) {
        setClearCollectionConfirm(true);
        return;
      }
      try {
        await axios.delete(`${API_URL}/collection/clear-all`, { data: { confirmation: 'DELETE_ALL_CARDS' } });
        setClearCollectionConfirm(false);
        window.location.reload();
      } catch (err) {
        alert('Failed to clear collection: ' + err.message);
      }
    };

    const handleClearCache = async () => {
      if (!clearCacheConfirm) {
        setClearCacheConfirm(true);
        return;
      }
      try {
        const res = await axios.delete(`${API_URL}/cache/clear`);
        setClearCacheConfirm(false);
        alert(`Cleared ${res.data.deletedCount} cached images`);
        // Refresh stats
        const statsRes = await axios.get(`${API_URL}/stats`);
        setStatsData(statsRes.data);
      } catch (err) {
        alert('Failed to clear cache: ' + err.message);
      }
    };

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={24} /> Settings
        </h1>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
          {[
            { id: 'display', label: 'Display' },
            { id: 'pricing', label: 'Pricing' },
            { id: 'features', label: 'Features' },
            { id: 'data', label: 'Data' },
            { id: 'locations', label: 'Locations' },
            { id: 'tags', label: 'Tags' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                settingsTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Display Settings */}
        {settingsTab === 'display' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Display Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-white/80 text-sm mb-2">Items per page</label>
                <select
                  value={settings.pageSize}
                  onChange={(e) => updateSettings({ pageSize: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Default sort</label>
                <select
                  value={settings.defaultSort}
                  onChange={(e) => updateSettings({ defaultSort: e.target.value })}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                >
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="quantity">Quantity</option>
                  <option value="totalValue">Total Value</option>
                  <option value="type">Type</option>
                  <option value="color">Color</option>
                </select>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Default condition</label>
                <select
                  value={settings.defaultCondition}
                  onChange={(e) => updateSettings({ defaultCondition: e.target.value })}
                  className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                >
                  <option value="NM">Near Mint (NM)</option>
                  <option value="LP">Lightly Played (LP)</option>
                  <option value="MP">Moderately Played (MP)</option>
                  <option value="HP">Heavily Played (HP)</option>
                  <option value="DMG">Damaged (DMG)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Settings */}
        {settingsTab === 'pricing' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Pricing Settings</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-white/80 text-sm mb-2">Display Currency</label>
                <div className="flex gap-2">
                  {['USD', 'CAD', 'EUR'].map(currency => (
                    <button
                      key={currency}
                      onClick={() => updateSettings({ displayCurrency: currency })}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        settings.displayCurrency === currency
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/20 text-white/70 hover:bg-white/30'
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">CAD to USD rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.cadToUsdRate}
                    onChange={(e) => updateSettings({ cadToUsdRate: parseFloat(e.target.value) || 0.73 })}
                    className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/80 text-sm mb-2">USD to EUR rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.usdToEurRate}
                    onChange={(e) => updateSettings({ usdToEurRate: parseFloat(e.target.value) || 0.92 })}
                    className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">Condition Price Multipliers</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['NM', 'LP', 'MP', 'HP', 'DMG'].map(cond => (
                    <div key={cond}>
                      <label className="block text-white/60 text-xs mb-1">{cond}</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={settings.conditionMultipliers[cond]}
                        onChange={(e) => updateSettings({
                          conditionMultipliers: { [cond]: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Toggles */}
        {settingsTab === 'features' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Feature Toggles</h2>
            <p className="text-white/60 text-sm mb-4">Enable or disable features to customize your experience.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { id: 'deckBuilder', label: 'Deck Builder', icon: Layers },
                { id: 'wishlist', label: 'Wishlist', icon: Heart },
                { id: 'commanderRecs', label: 'Commander Recommendations', icon: Crown },
                { id: 'setCompletion', label: 'Set Completion Tracker', icon: BarChart3 },
                { id: 'comboFinder', label: 'Combo Finder', icon: Zap },
              ].map(feature => {
                const Icon = feature.icon;
                const enabled = settings.features[feature.id] !== false;
                return (
                  <button
                    key={feature.id}
                    onClick={() => updateSettings({ features: { [feature.id]: !enabled } })}
                    className={`flex items-center gap-3 p-4 rounded-lg transition ${
                      enabled
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-white/50 hover:bg-white/20'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{feature.label}</span>
                    {enabled && <span className="ml-auto">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Management */}
        {settingsTab === 'data' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Data Management</h2>
            {statsData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-white/60 text-sm">Total Cards</div>
                  <div className="text-2xl font-bold text-white">{statsData.totalCards?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-white/60 text-sm">Unique Cards</div>
                  <div className="text-2xl font-bold text-white">{statsData.uniqueCards?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-white/60 text-sm">Collection Value</div>
                  <div className="text-2xl font-bold text-white">{formatPrice(statsData.totalValue || 0)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-white/60 text-sm">Cached Images</div>
                  <div className="text-2xl font-bold text-white">{statsData.cachedImageCount?.toLocaleString() || 0}</div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleClearCollection}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  clearCollectionConfirm
                    ? 'bg-red-700 text-white animate-pulse'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {clearCollectionConfirm ? 'Click again to confirm' : 'Clear Collection'}
              </button>
              <button
                onClick={handleClearCache}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  clearCacheConfirm
                    ? 'bg-orange-700 text-white animate-pulse'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {clearCacheConfirm ? 'Click again to confirm' : 'Clear Image Cache'}
              </button>
              <button
                onClick={() => {
                  resetSettings();
                  alert('Settings reset to defaults');
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
              >
                Reset All Settings
              </button>
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {settingsTab === 'locations' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Storage Locations</h2>
            {/* Add/Edit Location Form */}
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <h3 className="text-md font-semibold text-white mb-3">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h3>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="Location name (e.g., Binder A, Box 1)"
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <input
                  type="text"
                  value={newLocationDesc}
                  onChange={(e) => setNewLocationDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <div className="flex gap-2">
                  {editingLocation ? (
                    <>
                      <button
                        onClick={handleUpdateLocation}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                      >
                        Update Location
                      </button>
                      <button
                        onClick={cancelEditLocation}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCreateLocation}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                    >
                      <Plus size={18} className="inline mr-2" /> Add Location
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Existing Locations */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-semibold text-white">Existing Locations ({locations.length})</h3>
              {locations.length > 0 && (
                <button
                  onClick={async () => {
                    const urls = {};
                    for (const loc of locations) {
                      urls[loc.name] = await generateQR(loc.name);
                    }
                    setQrDataUrls(urls);
                    setShowPrintLabels(true);
                  }}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1 transition"
                >
                  <Printer size={16} /> Print All Labels
                </button>
              )}
            </div>
            {locations.length === 0 ? (
              <p className="text-white/60">No locations created yet.</p>
            ) : (
              <div className="space-y-2">
                {locations.map(location => (
                  <div key={location._id} className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium flex items-center gap-2">
                        <MapPin size={16} /> {location.name}
                        {locationStats[location.name] && (
                          <span className="text-white/50 text-sm ml-2">
                            ({locationStats[location.name].cardCount} cards, {formatPrice(locationStats[location.name].totalValue)})
                          </span>
                        )}
                      </div>
                      {location.description && (
                        <div className="text-white/60 text-sm mt-1">{location.description}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleLocationIgnorePrice(location._id, location.ignorePrice)}
                        className={`px-2 py-2 rounded text-xs font-medium transition ${
                          location.ignorePrice
                            ? 'bg-orange-600 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                        title={location.ignorePrice ? 'Price is ignored in stats' : 'Click to ignore price in stats'}
                      >
                        {location.ignorePrice ? '$ off' : '$'}
                      </button>
                      <button
                        onClick={async () => {
                          const dataUrl = await generateQR(location.name);
                          setQrDataUrls(prev => ({ ...prev, [location.name]: dataUrl }));
                          setQRPreviewLocation(location);
                          setShowQRPreview(true);
                        }}
                        className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition"
                        title="Generate QR Label"
                      >
                        <QrCode size={16} />
                      </button>
                      <button
                        onClick={() => startEditLocation(location)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location._id)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags Tab */}
        {settingsTab === 'tags' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Tags</h2>
            {/* Add Tag Form */}
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <h3 className="text-md font-semibold text-white mb-3">Add New Tag</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                  placeholder="Tag name (e.g., commander, trade)"
                  className="flex-1 px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={handleCreateTag}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                >
                  <Plus size={18} className="inline mr-1" /> Add
                </button>
              </div>
            </div>

            {/* Existing Tags */}
            <h3 className="text-md font-semibold text-white mb-3">Existing Tags ({availableTags.length})</h3>
            {availableTags.length === 0 ? (
              <p className="text-white/60">No tags created yet. Tags are created when you add them to cards or create them here.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => {
                  const tagName = tag.name || tag;
                  const ignorePrice = tag.ignorePrice || false;
                  return (
                    <div key={tagName} className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2 group">
                      <span className="text-white">{tagName}</span>
                      <button
                        onClick={() => handleToggleTagIgnorePrice(tagName, ignorePrice)}
                        className={`px-1.5 py-0.5 rounded text-xs font-medium transition ${
                          ignorePrice
                            ? 'bg-orange-600 text-white'
                            : 'bg-white/10 text-white/40 hover:bg-white/20'
                        }`}
                        title={ignorePrice ? 'Price is ignored in stats' : 'Click to ignore price in stats'}
                      >
                        {ignorePrice ? '$ off' : '$'}
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tagName)}
                        className="text-white/40 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                        title="Delete tag"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onImport={() => fileInputRef.current?.click()}
        onExportJSON={() => exportData('json')}
        onExportCSV={() => exportData('csv')}
        onUpdatePrices={() => setShowPriceUpdateModal(true)}
        onFetchCardText={updateAllOracleText}
        onCommanders={getCommanderRecommendations}
        onSets={getSetCompletionData}
        onCombos={findCombos}
        onOpenSettings={() => setCurrentView('settings')}
        onOpenCamera={() => setShowCameraModal(true)}
        onCommandPalette={() => setShowCommandPalette(true)}
        fileInputRef={fileInputRef}
        isImporting={isImporting}
        loading={loading}
        featureToggles={settings.features}
        authUser={authUser}
        isMultiUserEnabled={isMultiUserEnabled}
        onAccountSettings={() => setShowAccountSettings(true)}
        onAdminPanel={() => setShowAdminPanel(true)}
        onLogout={authLogout}
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,.json"
        onChange={handleBulkImport}
        className="hidden"
        disabled={isImporting}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 mobile-content-offset sm:pt-6">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb currentView={currentView} setCurrentView={setCurrentView} />

          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
              <Dashboard
                cards={cards}
                totalCards={totalCards}
                totalValue={totalValue}
                ignoredValue={ignoredValue}
                setCurrentView={setCurrentView}
                onAddCard={() => { setCurrentView('collection'); setShowAddForm(true); }}
                onImport={() => fileInputRef.current?.click()}
                onUpdatePrices={() => setShowPriceUpdateModal(true)}
                fileInputRef={fileInputRef}
                isImporting={isImporting}
                formatPrice={formatPrice}
              />
            </Suspense>
          )}

          {/* Collection View */}
        {currentView === 'collection' && (
          <>
            {/* Controls - Sticky Filters */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 mb-6 shadow-xl sticky top-0 z-30">
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
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-3 text-white/60 hover:text-white transition"
                  title="Clear search"
                >
                  <X size={20} />
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
                onClick={() => setCurrentView('settings')}
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
          </div>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Edit Card' : 'Add New Card'}
              </h2>
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
                onClick={handleSubmit}
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

        {/* Cards List */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
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
                  <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Set</th>
                  <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">Set Code</th>
                  <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">#</th>
                  <th className="px-6 py-3 text-left text-white font-semibold text-sm hidden xl:table-cell">Rarity</th>
                  <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Mana Cost</th>
                  <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Colors</th>
                  <th className="px-6 py-3 text-left text-white font-semibold hidden lg:table-cell">Types</th>
                  <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Location</th>
                  <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Foil</th>
                  <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Token</th>
                  <th className="px-6 py-3 text-left text-white font-semibold hidden xl:table-cell">Tags</th>
                  <th className="px-6 py-3 text-left text-white font-semibold">Qty</th>
                  <th className="px-6 py-3 text-left text-white font-semibold">Condition</th>
                  <th className="px-6 py-3 text-left text-white font-semibold">Price</th>
                  <th className="px-6 py-3 text-left text-white font-semibold">Total</th>
                  <th className="px-6 py-3 text-left text-white font-semibold">Actions</th>
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
                    <tr key={card._id} className={`hover:bg-white/5 transition ${selectedCards.has(card._id) ? 'bg-purple-900/30' : ''}`}>
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
                          console.log('Hovering over:', card.name, 'Has image:', !!card.imageUrl);
                          setHoveredCard(card);
                        }}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        {card.name}
                      </td>
                      <td className="px-6 py-4 text-white/80 text-sm hidden lg:table-cell">{card.set}</td>
                      <td className="px-6 py-4 text-white/80 text-xs hidden xl:table-cell">{card.setCode || '—'}</td>
                      <td className="px-6 py-4 text-white/80 text-xs hidden xl:table-cell">{card.collectorNumber || '—'}</td>
                      <td className="px-6 py-4 text-white/80 text-xs hidden xl:table-cell">{card.rarity || '—'}</td>
                      <td className="px-6 py-4 text-white/80 text-sm font-mono hidden lg:table-cell">
                        {card.manaCost || '0'}
                      </td>
                      <td className="px-6 py-4 text-white/80 text-sm hidden lg:table-cell">
                        {card.colors && card.colors.length > 0 ? card.colors.join(', ') : '-'}
                      </td>
                      <td className="px-6 py-4 text-white/80 text-sm hidden lg:table-cell">
                        {card.types && card.types.length > 0 ? card.types.join(' ') : '-'}
                      </td>
                      <td className="px-6 py-4 text-white/80 text-sm hidden xl:table-cell">
                        {card.location ? (
                          <span className="px-2 py-1 bg-blue-600/50 text-white text-xs rounded flex items-center gap-1 w-fit">
                            <MapPin size={12} /> {card.location}
                          </span>
                        ) : (
                          <span className="text-white/40 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden xl:table-cell">
                        {card.isFoil ? (
                          <span className="px-2 py-1 bg-amber-600/50 text-white text-sm rounded font-semibold">
                            Foil ✨
                          </span>
                        ) : (
                          <span className="text-white/40 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden xl:table-cell">
                        {card.isToken ? (
                          <span className="px-2 py-1 bg-yellow-600/50 text-white text-sm rounded font-semibold">
                            Token
                          </span>
                        ) : (
                          <span className="text-white/40 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1 items-center">
                          {card.tags && card.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-indigo-600/70 text-white text-xs rounded-full flex items-center gap-1"
                            >
                              {tag}
                              <button
                                onClick={() => handleRemoveTag(card._id, tag)}
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
                                    handleAddTag(card._id);
                                  }
                                }}
                                placeholder="tag"
                                className="px-2 py-1 bg-white/20 border border-white/30 rounded text-white text-xs w-24 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                autoFocus
                              />
                              <button
                                onClick={() => handleAddTag(card._id)}
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
                      </td>
                      <td className="px-6 py-4 text-white/80">{card.quantity}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-purple-600/50 text-white text-sm rounded">
                          {card.condition}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white/80">{formatPrice(card.price)}</td>
                      <td className="px-6 py-4 text-white font-semibold">
                        {formatPrice(card.price * card.quantity)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateCardPrice(card._id)}
                            className="p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
                            title="Update price from Exor Games"
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
                            onClick={() => handleDelete(card._id)}
                            className="p-1 bg-red-600 hover:bg-red-700 text-white rounded transition"
                            title="Delete card"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
        </div>

        {/* Card Image Hover Preview */}
        {hoveredCard && hoveredCard.imageUrl && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <img
              src={hoveredCard.imageUrl?.startsWith('/api/') ? `${API_URL.replace('/api', '')}${hoveredCard.imageUrl}` : hoveredCard.imageUrl}
              alt={hoveredCard.name}
              className="w-80 rounded-xl shadow-2xl border-4 border-purple-500 bg-gray-900"
              onLoad={() => console.log('Image displayed:', hoveredCard.name)}
            />
          </div>
        )}
          </>
        )}

        {/* Import Progress Modal */}
        {isImporting && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-8 border-2 border-purple-500">
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
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
                    <h3 className="text-lg font-semibold text-green-400 mb-2">✓ Added Cards</h3>
                    <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {importResults.added.map((item, i) => (
                        <div key={i} className="text-sm text-white/80 py-1">{item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {importResults.merged.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">↑ Merged Cards</h3>
                    <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {importResults.merged.map((item, i) => (
                        <div key={i} className="text-sm text-white/80 py-1">{item}</div>
                      ))}
                    </div>
                  </div>
                )}

                {importResults.offline && importResults.offline.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-2">⚠ Offline Imports</h3>
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
                    <h3 className="text-lg font-semibold text-red-400 mb-2">✗ Failed Cards</h3>
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
              🖨️ Print Proxies
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-purple-500">
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-purple-500">
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-purple-500">
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-purple-500">
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-red-500">
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
                  🖨️ Print
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border-2 border-purple-500">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Similar Cards</h2>
                  {similarCardsSource && (
                    <p className="text-white/60 mt-1">
                      Finding cards similar to <span className="text-purple-400 font-semibold">{similarCardsSource.name}</span>
                      {similarCardsSource.types?.length > 0 && ` (${similarCardsSource.types[0]})`}
                      {similarCardsSource.colors?.length > 0 && ` • ${similarCardsSource.colors.join(', ')}`}
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
                  Showing up to 20 similar cards based on type and color • Powered by Scryfall
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Card Synergies Modal */}
        {showSynergies && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-yellow-500">
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
                  Synergies found by analyzing tribal types, keywords, and card mechanics • Sorted by EDHREC popularity
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Commander Recommendations Modal */}
        {showCommanderRecs && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-amber-500">
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
                  {commanderFinderMode === 'collection' ? 'Recommendations based on your collection\'s colors and card themes' : 'Search results based on your selected preferences'} • Sorted by EDHREC popularity
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Set Completion Tracker Modal */}
        {showSetCompletion && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-teal-500">
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
                  onClick={() => { setShowSetCompletion(false); setSetCompletionData([]); }}
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
                ) : setCompletionData.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-white/60">No set data available. Make sure your cards have set codes.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {setCompletionData.map((set) => {
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
                                <p className="text-white/40 text-xs">{set.setCode} • {set.setType}</p>
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
                  Showing up to 20 sets from your collection • Sorted by completion percentage
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Combo Finder Modal */}
        {showComboFinder && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-orange-500">
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
                                ✓ {cardName}
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
                              View on Commander Spellbook →
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
                                  {isMissing ? '✗' : '✓'} {cardName}
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
                              View on Commander Spellbook →
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-blue-500">
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
                    updateAllPrices();
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

        {/* QR Preview Modal */}
        {showQRPreview && qrPreviewLocation && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-sm w-full p-6 border-2 border-purple-500">
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

        {/* Wishlist View */}
        {currentView === 'wishlist' && (
          <div className="space-y-6">
            {/* Wishlist Controls */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-xl">
              <div className="flex gap-4 items-center justify-between">
                <div className="flex gap-4 items-center">
                  <select
                    value={wishlistFilterPriority}
                    onChange={(e) => setWishlistFilterPriority(e.target.value)}
                    className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                  <span className="text-white/60">
                    {filteredWishlistItems.length} item{filteredWishlistItems.length !== 1 ? 's' : ''} in wishlist
                  </span>
                </div>
                <button
                  onClick={updateAllWishlistPrices}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition disabled:bg-gray-600"
                >
                  <RefreshCw size={18} /> Update All Prices
                </button>
              </div>
            </div>

            {/* Add/Edit Wishlist Form */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                {editingWishlistId ? 'Edit Wishlist Item' : 'Add to Wishlist'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="relative lg:col-span-2">
                  <input
                    type="text"
                    placeholder="Card Name (type to search)"
                    value={wishlistFormData.name}
                    onChange={(e) => handleWishlistNameChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowWishlistAutocomplete(false), 200)}
                    className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  {showWishlistAutocomplete && wishlistAutocompleteResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-purple-400 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {wishlistAutocompleteResults.map((cardName, index) => (
                        <div
                          key={index}
                          onClick={() => selectWishlistAutocompleteCard(cardName)}
                          className="px-4 py-2 hover:bg-purple-600 cursor-pointer text-white border-b border-white/10 last:border-b-0"
                        >
                          {cardName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  placeholder="Target Price ($)"
                  value={wishlistFormData.targetPrice || ''}
                  onChange={(e) => setWishlistFormData({...wishlistFormData, targetPrice: parseFloat(e.target.value) || 0})}
                  min="0"
                  step="0.01"
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <select
                  value={wishlistFormData.priority}
                  onChange={(e) => setWishlistFormData({...wishlistFormData, priority: e.target.value})}
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <input
                  type="number"
                  placeholder="Quantity"
                  value={wishlistFormData.quantity}
                  onChange={(e) => setWishlistFormData({...wishlistFormData, quantity: parseInt(e.target.value) || 1})}
                  min="1"
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <select
                  value={wishlistFormData.condition}
                  onChange={(e) => setWishlistFormData({...wishlistFormData, condition: e.target.value})}
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={wishlistFormData.notes}
                  onChange={(e) => setWishlistFormData({...wishlistFormData, notes: e.target.value})}
                  className="lg:col-span-2 px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
              {wishlistFormData.set && (
                <div className="text-white/60 text-sm mb-4">
                  Set: {wishlistFormData.set} | Current Price: {formatPrice(wishlistFormData.currentPrice)}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleWishlistSubmit}
                  className="flex-1 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Heart size={18} /> {editingWishlistId ? 'Update' : 'Add to Wishlist'}
                </button>
                {editingWishlistId && (
                  <button
                    onClick={handleWishlistCancel}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Wishlist Table */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/20">
                    <tr>
                      <th className="px-6 py-3 text-left text-white font-semibold">Card Name</th>
                      <th className="px-6 py-3 text-left text-white font-semibold">Set</th>
                      <th className="px-6 py-3 text-left text-white font-semibold">Qty</th>
                      <th className="px-6 py-3 text-left text-white font-semibold">Target Price</th>
                      <th className="px-6 py-3 text-left text-white font-semibold">Current Price</th>
                      <th className="px-6 py-3 text-left text-white font-semibold">Diff</th>
                      <th className="px-6 py-3 text-left text-white font-semibold">Priority</th>
                      <th className="px-6 py-3 text-left text-white font-semibold">Notes</th>
                      <th className="px-6 py-3 text-left text-white font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredWishlistItems.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-6 py-8 text-center text-white/60">
                          Your wishlist is empty. Add cards you want to acquire!
                        </td>
                      </tr>
                    ) : (
                      filteredWishlistItems.map(item => {
                        const isDeal = item.targetPrice > 0 && item.currentPrice > 0 && item.currentPrice <= item.targetPrice;
                        const diff = item.currentPrice - item.targetPrice;
                        return (
                          <tr
                            key={item._id}
                            className={`hover:bg-white/5 transition ${isDeal ? 'bg-green-900/30' : ''}`}
                            onMouseEnter={() => setHoveredCard(item)}
                            onMouseLeave={() => setHoveredCard(null)}
                          >
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
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Wishlist Card Image Hover Preview */}
            {hoveredCard && hoveredCard.imageUrl && (
              <div
                className="fixed z-50 pointer-events-none"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <img
                  src={hoveredCard.imageUrl?.startsWith('/api/') ? `${API_URL.replace('/api', '')}${hoveredCard.imageUrl}` : hoveredCard.imageUrl}
                  alt={hoveredCard.name}
                  className="w-80 rounded-xl shadow-2xl border-4 border-pink-500 bg-gray-900"
                />
              </div>
            )}
          </div>
        )}

        {/* Deck Builder View */}
        {currentView === 'decks' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <DeckBuilder />
          </Suspense>
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

// Login Wrapper Component to access navigate
function LoginWrapper() {
  const navigate = useNavigate();
  const { login } = useAuthContext();

  const handleLogin = async (email, password) => {
    return await login(email, password);
  };

  const handleSwitchToRegister = () => {
    navigate('/register');
  };

  return (
    <LoginForm 
      onLogin={handleLogin}
      onSwitchToRegister={handleSwitchToRegister}
    />
  );
}

// Main App Component with Routing
function AppContent() {
  const location = useLocation();
  const { isMultiUserEnabled } = useAuthContext();

  // Determine if we should show auth forms based on location or system status
  const showAuthForms = location.pathname.startsWith('/login') || 
                       location.pathname.startsWith('/register') || 
                       location.pathname.startsWith('/forgot-password') || 
                       location.pathname.startsWith('/reset-password') ||
                       !isMultiUserEnabled;

  if (showAuthForms) {
    // Show auth forms when on auth routes or multi-user is disabled
    return (
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/login" element={<LoginWrapper />} />
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          <Route path="/reset-password/:token" element={<ResetPasswordForm />} />
          <Route path="/" element={
            isMultiUserEnabled ? 
            <Navigate to="/login" replace /> : 
            <MainDashboard />
          } />
          <Route path="*" element={
            isMultiUserEnabled ? 
            <Navigate to="/login" replace /> : 
            <MainDashboard />
          } />
        </Routes>
      </div>
    );
  }

  // For protected routes, show the main dashboard
  return <MainDashboard />;
}

// Wrap App with AuthProvider and Router
function AppWithProviders() {
  return (
    <Router>
      <AuthProvider>
        <AuthGuard>
          <AppContent />
        </AuthGuard>
      </AuthProvider>
    </Router>
  );
}

export default AppWithProviders;
