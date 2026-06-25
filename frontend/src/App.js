import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import axios from 'axios';
import { Search, Plus, Trash2, Edit2, Save, X, Download, RefreshCw, DollarSign, Upload, Camera, Settings, Heart, CheckSquare, Square, MapPin, Star, Layers, Zap, Crown, BarChart3, Users, QrCode, Printer, Home, BookOpen, Trophy, User, MessageSquare } from 'lucide-react';
import QRCode from 'qrcode';
import './App.css';
import 'mana-font';
import Sidebar from './components/Sidebar';
import ValueHistoryChart from './components/ValueHistoryChart';
import Breadcrumb from './components/Breadcrumb';
import CommandPalette from './components/CommandPalette';
import useKeyboardShortcuts, { buildShortcutKey } from './hooks/useKeyboardShortcuts';
import useSettings from './hooks/useSettings';
import useColumnVisibility from './hooks/useColumnVisibility';
import ColumnContextMenu from './components/ColumnContextMenu';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { AuthGuard } from './components/auth/AuthGuard';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { CardCollectionProvider, useCardCollection } from './contexts/CardCollectionContext';
import { LocationTagProvider, useLocationTag } from './contexts/LocationTagContext';
import { WishlistProvider, useWishlist } from './contexts/WishlistContext';
import { AccountSettings } from './components/auth/AccountSettings';
import { AdminPanel } from './components/admin/AdminPanel';

// Learning Components
import CardRulingsBrowser from './components/Learn/CardRulingsBrowser';
import InteractionChecker from './components/Learn/InteractionChecker';
import NewPlayerGuide from './components/Learn/NewPlayerGuide';
import KeywordGlossary from './components/Learn/KeywordGlossary';
import ComboTutorials from './components/Learn/ComboTutorials';
import FormatGuides from './components/Learn/FormatGuides';
import SealedSimulator from './components/Gameplay/SealedSimulator';
import ArchenemyMode from './components/Gameplay/ArchenemyMode';

// Forum Components
import ForumHome from './components/Forum/ForumHome';
import ForumNav from './components/Forum/ForumNav';
import CategoryView from './components/Forum/CategoryView';
import ThreadView from './components/Forum/ThreadView';
import SpamFilterAdmin from './components/Forum/SpamFilterAdmin';
import MuteManager from './components/Forum/MuteManager';
import ForumLevelWidget from './components/Forum/ForumLevelWidget';
import ForumProfilePage from './components/Forum/ForumProfilePage';
import ForumShop from './components/Forum/ForumShop';
import ForumLeaderboard from './components/Forum/ForumLeaderboard';
import SharedDeckView from './components/CommunityDecks/SharedDeckView';
import CommunityDecks from './components/CommunityDecks/CommunityDecks';
import { API_URL } from './config';
import NotificationBell from './components/NotificationBell';
import CardDetailPanel from './components/CardDetailPanel';
import DMPreview from './components/DMPreview';
import UserMenu from './components/UserMenu';
import MessagesPage from './components/MessagesPage';
import MyProfile from './components/MyProfile';
import UserProfile from './components/UserProfile';
import SettingsView from './components/SettingsView';
import SparklinePopup from './components/SparklinePopup';
import CollectionView from './components/CollectionView';

const DeckBuilder = React.lazy(() => import('./components/DeckBuilder'));
const CameraModal = React.lazy(() => import('./components/CameraModal'));
const LifeCounter = React.lazy(() => import('./components/LifeCounter/LifeCounter'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));

// Gameplay components
const StarVariant = React.lazy(() => import('./components/Gameplay/StarVariant'));
const PlanechaseMode = React.lazy(() => import('./components/Gameplay/PlanechaseMode'));
const CustomFormatBuilder = React.lazy(() => import('./components/Gameplay/CustomFormatBuilder'));
const CubeBuilder = React.lazy(() => import('./components/Gameplay/CubeBuilder'));

// Tools components
const ReprintTracker = React.lazy(() => import('./components/Tools/ReprintTracker'));
const SetReleaseCalendar = React.lazy(() => import('./components/Tools/SetReleaseCalendar'));
const SpoilerSeasonIntegration = React.lazy(() => import('./components/Tools/SpoilerSeasonIntegration'));

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
  // Toast notifications
  const { addToast } = useToast();

  // Auth context - available when wrapped with AuthProvider
  const authContext = useAuthContext();
  const { user: authUser, isMultiUserEnabled, logout: authLogout } = authContext || {};

  // Settings must be first so other state can use its values
  const { settings, updateSettings, resetSettings } = useSettings();

  // Card collection state and handlers from context
  const {
    cards, setCards,
    loading, setLoading,
    editingId, setEditingId,
    hoveredCard, setHoveredCard,
    hoveredCardPriceHistory, setHoveredCardPriceHistory,
    detailCard, setDetailCard,
    sparkline, setSparkline,
    sparklineTimerRef,
    fetchCards,
    handleSubmit,
    handleDelete,
    updateCardPrice,
    updateAllPrices,
    updateAllOracleText,
    handleAddTag,
    handleRemoveTag,
    handleCardHover,
    handlePriceCellEnter,
    handlePriceCellLeave,
    handleBulkImport,
  } = useCardCollection();

  // Location and tag state and handlers from context
  const {
    locations, fetchLocations, locationStats,
    newLocationName, setNewLocationName, newLocationDesc, setNewLocationDesc,
    editingLocation, startEditLocation, cancelEditLocation,
    handleCreateLocation, handleUpdateLocation, handleDeleteLocation, handleToggleLocationIgnorePrice,
    availableTags, fetchAvailableTags,
    newTagName, setNewTagName,
    handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
  } = useLocationTag();

  // Wishlist state and handlers from context
  const {
    wishlistItems, fetchWishlist,
    wishlistFormData, setWishlistFormData,
    editingWishlistId, setEditingWishlistId,
    wishlistAutocompleteResults, setWishlistAutocompleteResults,
    showWishlistAutocomplete, setShowWishlistAutocomplete,
    wishlistFilterPriority, setWishlistFilterPriority,
    selectWishlistAutocompleteCard,
    handleWishlistNameChange, handleWishlistSubmit, handleWishlistEdit,
    handleWishlistDelete, handleWishlistCancel,
    handleAcquireWishlistItem, updateAllWishlistPrices,
    addToWishlist,
  } = useWishlist();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCondition, setFilterCondition] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSpecial, setFilterSpecial] = useState('all'); // Combined token/foil filter
  const [filterRarity, setFilterRarity] = useState('all');
  const [filterSet, setFilterSet] = useState('all');
  const [sortBy, setSortBy] = useState(settings.defaultSort);
  const [showAddForm, setShowAddForm] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showFinancePanel, setShowFinancePanel] = useState(false);
  const [financeData, setFinanceData] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, cardName: '' });
  const [isImporting, setIsImporting] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [openPanel, setOpenPanel] = useState(null); // null | 'notifications' | 'dms'
  const [manualEntry, setManualEntry] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = settings.pageSize;
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('currentView') || 'dashboard';
  }); // 'dashboard', 'collection', 'decks', 'wishlist', 'forum', 'lifecounter', or 'settings'
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

  // Forum state
  const [forumCategories, setForumCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [loadingForumCategories, setLoadingForumCategories] = useState(false);
  const [showSpamFilterAdmin, setShowSpamFilterAdmin] = useState(false);
  const [showMuteManager, setShowMuteManager] = useState(false);
  const [showForumShop, setShowForumShop] = useState(false);
  const [cosmeticVersion, setCosmeticVersion] = useState(0);
  const [forumRefreshKey, setForumRefreshKey] = useState(0);
  const [selectedForumProfileUsername, setSelectedForumProfileUsername] = useState(null);
  const [forumProfileView, setForumProfileView] = useState(false);
  const [showForumLeaderboard, setShowForumLeaderboard] = useState(false);

  // Location management state is now in LocationTagContext

  // Wishlist state is now in WishlistContext

  // Bulk selection
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [bulkUpdateModal, setBulkUpdateModal] = useState(null); // 'condition', 'location', 'addTags', 'removeTags', 'delete'
  const [bulkCondition, setBulkCondition] = useState('NM');
  const [bulkLocation, setBulkLocation] = useState('');
  const [bulkTags, setBulkTags] = useState('');

  // Column visibility
  const { visibleColumns, isColumnVisible, toggleColumn, loading: colLoading, allColumns } = useColumnVisibility();
  const [contextMenu, setContextMenu] = useState(null);

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

  useEffect(() => {
    fetchCards();
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

  // Save current view to localStorage
  useEffect(() => {
    localStorage.setItem('currentView', currentView);
  }, [currentView]);

  // Load forum categories when forum view is active and restore saved state
  useEffect(() => {
    if (currentView === 'forum') {
      fetchForumCategories();
      // Restore forum navigation state from localStorage
      const savedCategory = localStorage.getItem('forumSelectedCategory');
      const savedThread = localStorage.getItem('forumSelectedThread');
      if (savedThread) setSelectedThreadId(savedThread);
      else if (savedCategory) setSelectedCategoryId(savedCategory);
    }
  }, [currentView]);

  const fetchForumCategories = async () => {
    setLoadingForumCategories(true);
    try {
      const response = await axios.get(`${API_URL}/forum/categories`);
      setForumCategories(response.data);
    } catch (error) {
      console.error('Error fetching forum categories:', error);
    } finally {
      setLoadingForumCategories(false);
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
      addToast('Card not found on Scryfall', 'error');
    } finally {
      setLoading(false);
    }
  };

  const searchScryfallManually = async () => {
    if (!formData.name) {
      addToast('Please enter a card name first', 'warning');
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
      addToast('No card name extracted. Please try again or use manual entry.', 'warning');
      return;
    }

    // In offline mode or if we just want to populate the name
    if (offlineMode) {
      setFormData({...formData, name: extractedData.name});
      addToast(`Card name extracted: ${extractedData.name} (Offline mode - please fill in other details manually)`, 'info');
      return;
    }

    // Try to search Scryfall
    try {
      setLoading(true);
      await selectAutocompleteCard(extractedData.name);

      const confidenceText = extractedData.confidence ? ` (${Math.round(extractedData.confidence)}% confidence)` : '';
      addToast(`Card found: ${extractedData.name}${confidenceText}`, 'success');
    } catch (error) {
      // If Scryfall search fails, still populate the name
      setFormData({...formData, name: extractedData.name});
      const confidenceText = extractedData.confidence ? ` (${Math.round(extractedData.confidence)}% confidence)` : '';
      addToast(`Card name extracted: ${extractedData.name}${confidenceText} â€” could not find on Scryfall, please verify and search manually.`, 'warning');
    } finally {
      setLoading(false);
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

  // ============================================
  // FINANCE FUNCTIONS
  // ============================================

  const openFinancePanel = async () => {
    try {
      const res = await axios.get(`${API_URL}/finance`);
      setFinanceData(res.data);
      setShowFinancePanel(true);
    } catch (error) {
      console.error('Error fetching finance data:', error);
      addToast('Error fetching finance data', 'error');
    }
  };

  // ============================================
  // WISHLIST FUNCTIONS are now in WishlistContext

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
      addToast(response.data.message, 'success');
      fetchCards();
      clearSelection();
      setBulkUpdateModal(null);
    } catch (error) {
      console.error('Error bulk updating condition:', error);
      addToast('Error updating cards', 'error');
    }
  };

  const handleBulkUpdateLocation = async () => {
    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards),
        updates: { location: bulkLocation }
      });
      addToast(response.data.message, 'success');
      fetchCards();
      clearSelection();
      setBulkUpdateModal(null);
    } catch (error) {
      console.error('Error bulk updating location:', error);
      addToast('Error updating cards', 'error');
    }
  };

  const handleBulkAddTags = async () => {
    const tags = bulkTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length === 0) {
      addToast('Please enter at least one tag', 'warning');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/cards/bulk-update`, {
        cardIds: Array.from(selectedCards),
        updates: { addTags: tags }
      });
      addToast(response.data.message, 'success');
      fetchCards();
      fetchAvailableTags();
      clearSelection();
      setBulkUpdateModal(null);
      setBulkTags('');
    } catch (error) {
      console.error('Error bulk adding tags:', error);
      addToast('Error adding tags', 'error');
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

  const addSimilarCardToWishlist = (scryfallCard) => addToWishlist(scryfallCard, similarCardsSource?.name);

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
        types: scryfallCard.type_line ? scryfallCard.type_line.split('â€”')[0].trim().split(' ') : [],
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
    if (settings.displayCurrency === 'EUR') return `â‚¬${(priceUSD * settings.usdToEurRate).toFixed(2)}`;
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
      { id: 'nav-forum', label: 'Go to Forum', icon: MessageSquare, category: 'Navigation', action: () => setCurrentView('forum') },
      { id: 'nav-lifecounter', label: 'Go to Life Counter', icon: Users, category: 'Navigation', action: () => setCurrentView('lifecounter') },
      { id: 'nav-settings', label: 'Go to Settings', icon: Settings, category: 'Navigation', action: () => setCurrentView('settings') },
      // Actions
      { id: 'act-add', label: 'Add New Card', icon: Plus, category: 'Actions', action: () => { setCurrentView('collection'); setShowAddForm(true); } },
      { id: 'act-import', label: 'Import Cards', icon: Upload, category: 'Actions', action: () => fileInputRef.current?.click() },
      { id: 'act-export-json', label: 'Export as JSON', icon: Download, category: 'Actions', action: () => exportData('json') },
      { id: 'act-export-csv', label: 'Export as CSV', icon: Download, category: 'Actions', action: () => exportData('csv') },
      { id: 'act-prices', label: 'Update Prices', icon: RefreshCw, category: 'Actions', action: () => setShowPriceUpdateModal(true) },
      { id: 'act-text', label: 'Fetch Card Text', icon: RefreshCw, category: 'Actions', action: () => updateAllOracleText() },
      { id: 'act-finance', label: 'View Finance', icon: DollarSign, category: 'Actions', action: () => openFinancePanel() },
      { id: 'act-search', label: 'Focus Search', icon: Search, category: 'Actions', action: () => { setCurrentView('collection'); setTimeout(() => searchInputRef.current?.focus(), 100); } },
      // Tools
      { id: 'tool-commanders', label: 'Commander Recommendations', icon: Crown, category: 'Tools', action: () => getCommanderRecommendations(), feature: 'commanderRecs' },
      { id: 'tool-sets', label: 'Set Completion Tracker', icon: BarChart3, category: 'Tools', action: () => getSetCompletionData(), feature: 'setCompletion' },
      { id: 'tool-combos', label: 'Find Combos', icon: Zap, category: 'Tools', action: () => findCombos(), feature: 'comboFinder' },
      { id: 'tool-camera', label: 'Scan Card with Camera', icon: Camera, category: 'Tools', action: () => setShowCameraModal(true) },
      // Learning
      { id: 'learn-rulings', label: 'Card Rulings Browser', icon: BookOpen, category: 'Learning', action: () => setCurrentView('card-rulings') },
      { id: 'learn-interactions', label: 'Interaction Checker', icon: Zap, category: 'Learning', action: () => setCurrentView('interaction-checker') },
      { id: 'learn-new-player', label: 'New Player Guide', icon: User, category: 'Learning', action: () => setCurrentView('new-player-guide') },
      { id: 'learn-keywords', label: 'Keyword Glossary', icon: BookOpen, category: 'Learning', action: () => setCurrentView('keyword-glossary') },
      { id: 'learn-combos', label: 'Combo Tutorials', icon: Zap, category: 'Learning', action: () => setCurrentView('combo-tutorials') },
      { id: 'learn-formats', label: 'Format Guides', icon: Trophy, category: 'Learning', action: () => setCurrentView('format-guides') },
    ];
    const cmds = allCmds
      .filter(cmd => !cmd.feature || ft[cmd.feature] !== false)
      .map(cmd => ({ ...cmd, shortcut: shortcuts[cmd.id] || undefined }));
    paletteCommandsRef.current = cmds;
    return cmds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, settings.features]);

  // Settings View Component extracted to ./components/SettingsView.js

  // URL routing: public shared deck view
  const sharedDeckMatch = window.location.pathname.match(/^\/shared\/deck\/([a-f0-9]+)$/i);
  if (sharedDeckMatch) {
    return <SharedDeckView shareCode={sharedDeckMatch[1]} />;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col overflow-hidden">
      {/* Top Header with Notifications and DMs */}
      {authUser && (
        <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700 px-6 py-3 flex items-center justify-between">
          <div className="flex-1"></div>
          <div className="flex items-center gap-4">
            <NotificationBell apiUrl={API_URL} user={authUser} openPanel={openPanel} setOpenPanel={setOpenPanel} />
            <button
              onClick={() => setCurrentView('messages')}
              className="relative p-2 hover:bg-white/10 rounded-lg transition text-white/70 hover:text-white"
              title="Messages"
            >
              <MessageSquare size={20} />
            </button>
            <UserMenu
              user={authUser}
              onProfile={() => setCurrentView('my-profile')}
              onSettings={() => setShowAccountSettings(true)}
              onLogout={authLogout}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
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
        onFinance={openFinancePanel}
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
        apiUrl={API_URL}
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,.json"
        onChange={(e) => handleBulkImport(e, { offlineMode, setIsImporting, setImportProgress, setImportResults, setShowImportResults })}
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
            <CollectionView
              fileInputRef={fileInputRef}
              setCurrentView={setCurrentView}
              showPriceUpdateModal={showPriceUpdateModal} setShowPriceUpdateModal={setShowPriceUpdateModal}
              forceUpdate={forceUpdate} setForceUpdate={setForceUpdate}
              updateFullData={updateFullData} setUpdateFullData={setUpdateFullData}
              isImporting={isImporting} setIsImporting={setIsImporting}
              importProgress={importProgress} setImportProgress={setImportProgress}
              importResults={importResults} setImportResults={setImportResults}
              showImportResults={showImportResults} setShowImportResults={setShowImportResults}
              showQRPreview={showQRPreview} setShowQRPreview={setShowQRPreview}
              qrPreviewLocation={qrPreviewLocation} setQRPreviewLocation={setQRPreviewLocation}
              qrDataUrls={qrDataUrls} setQrDataUrls={setQrDataUrls}
              showPrintLabels={showPrintLabels} setShowPrintLabels={setShowPrintLabels}
              generateQR={generateQR}
              showCommanderRecs={showCommanderRecs} setShowCommanderRecs={setShowCommanderRecs}
              commanderRecs={commanderRecs} setCommanderRecs={setCommanderRecs}
              loadingCommanders={loadingCommanders} setLoadingCommanders={setLoadingCommanders}
              commanderColorFilter={commanderColorFilter} setCommanderColorFilter={setCommanderColorFilter}
              commanderFinderMode={commanderFinderMode} setCommanderFinderMode={setCommanderFinderMode}
              finderColors={finderColors} setFinderColors={setFinderColors}
              finderThemes={finderThemes} setFinderThemes={setFinderThemes}
              finderCreatureType={finderCreatureType} setFinderCreatureType={setFinderCreatureType}
              getCommanderRecommendations={getCommanderRecommendations}
              searchCommandersByPreference={searchCommandersByPreference}
              addCommanderToCollection={addCommanderToCollection}
              showSetCompletion={showSetCompletion} setShowSetCompletion={setShowSetCompletion}
              setCompletionData={setCompletionData} loadingSetCompletion={loadingSetCompletion}
              getSetCompletionData={getSetCompletionData}
              showComboFinder={showComboFinder} setShowComboFinder={setShowComboFinder}
              comboResults={comboResults} setComboResults={setComboResults} loadingCombos={loadingCombos}
              comboTab={comboTab} setComboTab={setComboTab}
              findCombos={findCombos} addToWishlistFromCombo={addToWishlistFromCombo}
              showFinancePanel={showFinancePanel} setShowFinancePanel={setShowFinancePanel}
              financeData={financeData} openFinancePanel={openFinancePanel}
            />
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
                  className="w-80 rounded-xl shadow-2xl border-4 border-pink-500 bg-gray-900"
                  onError={(e) => {
                    e.target.src = hoveredCard.imageUrl || '';
                  }}
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

        {/* Messages View */}
        {currentView === 'messages' && authUser && (
          <MessagesPage user={authUser} onBack={() => setCurrentView('dashboard')} />
        )}

        {/* My Profile View */}
        {currentView === 'my-profile' && authUser && (
          <MyProfile user={authUser} onBack={() => setCurrentView('dashboard')} />
        )}

        {/* Forum Profile View */}
        {currentView === 'forum-profile' && selectedForumProfileUsername && (
          <UserProfile
            username={selectedForumProfileUsername}
          />
        )}

        {/* Forum Profile Page (authenticated user's own forum profile) */}
        {currentView === 'forum-profile-page' && authUser && (
          <ForumProfilePage user={authUser} apiUrl={API_URL} />
        )}

        {/* Learning Components */}
        {currentView === 'card-rulings' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <CardRulingsBrowser />
          </Suspense>
        )}
        {currentView === 'interaction-checker' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <InteractionChecker />
          </Suspense>
        )}
        {currentView === 'new-player-guide' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <NewPlayerGuide />
          </Suspense>
        )}
        {currentView === 'keyword-glossary' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <KeywordGlossary />
          </Suspense>
        )}
        {currentView === 'combo-tutorials' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <ComboTutorials />
          </Suspense>
        )}
        {currentView === 'format-guides' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <FormatGuides />
          </Suspense>
        )}
        {currentView === 'sealed-simulator' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <SealedSimulator />
          </Suspense>
        )}
        {currentView === 'archenemy-mode' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <ArchenemyMode />
          </Suspense>
        )}
        {currentView === 'star-variant' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <StarVariant />
          </Suspense>
        )}
        {currentView === 'planechase-mode' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <PlanechaseMode />
          </Suspense>
        )}
        {currentView === 'custom-format-builder' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <CustomFormatBuilder />
          </Suspense>
        )}
        {currentView === 'cube-builder' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <CubeBuilder />
          </Suspense>
        )}
        {currentView === 'reprint-tracker' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <ReprintTracker />
          </Suspense>
        )}
        {currentView === 'set-release-calendar' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <SetReleaseCalendar />
          </Suspense>
        )}
        {currentView === 'spoiler-season' && (
          <Suspense fallback={<div className="flex items-center justify-center py-20 text-white/50">Loading...</div>}>
            <SpoilerSeasonIntegration />
          </Suspense>
        )}

        {/* Forum View */}
        {currentView === 'forum' && (
          <div className="flex flex-col h-full">
            <div className="flex flex-1 min-h-0">
            {showForumLeaderboard ? (
              <ForumLeaderboard
                onBack={() => setShowForumLeaderboard(false)}
              />
            ) : selectedThreadId ? (
              <ThreadView
                threadId={selectedThreadId}
                apiUrl={API_URL}
                user={authUser}
                refreshKey={cosmeticVersion}
                onBack={() => {
                  setSelectedThreadId(null);
                  localStorage.removeItem('forumSelectedThread');
                }}
                onThreadDeleted={() => setForumRefreshKey(k => k + 1)}
                onViewProfile={(username) => {
                  setSelectedForumProfileUsername(username);
                  setCurrentView('forum-profile');
                }}
              />
            ) : selectedCategoryId ? (
              <CategoryView
                categoryId={selectedCategoryId}
                apiUrl={API_URL}
                onThreadSelect={(threadId) => {
                  setSelectedThreadId(threadId);
                  localStorage.setItem('forumSelectedThread', threadId);
                }}
                onBack={() => {
                  setSelectedCategoryId(null);
                  localStorage.removeItem('forumSelectedCategory');
                }}
                user={authUser}
                onViewProfile={(username) => {
                  setSelectedForumProfileUsername(username);
                  setCurrentView('forum-profile');
                }}
                refreshKey={forumRefreshKey}
              />
            ) : (
              <ForumHome
                onSelectCategory={(catId) => {
                  setSelectedCategoryId(catId);
                  localStorage.setItem('forumSelectedCategory', catId);
                }}
                onNewThread={() => {}}
                onOpenAdmin={() => {
                  // Show forum-specific admin features (spam filter, mutes)
                  setShowSpamFilterAdmin(true);
                }}
                authUser={authUser}
                onForumProfile={() => setCurrentView('forum-profile-page')}
                onLeaderboard={() => setShowForumLeaderboard(true)}
                refreshKey={forumRefreshKey}
              />
            )}
            </div>
          </div>
        )}

        {/* Community Decks View */}
        {currentView === 'community-decks' && (
          <CommunityDecks />
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
        <AdminPanel
          onClose={() => setShowAdminPanel(false)}
          onOpenSpamFilter={() => setShowSpamFilterAdmin(true)}
          onOpenMuteManager={() => setShowMuteManager(true)}
          user={authUser}
        />
      )}

      {/* Forum Admin Modals */}
      {showSpamFilterAdmin && (
        <SpamFilterAdmin
          apiUrl={API_URL}
          isOpen={showSpamFilterAdmin}
          onClose={() => setShowSpamFilterAdmin(false)}
        />
      )}

      {showMuteManager && (
        <MuteManager
          apiUrl={API_URL}
          isOpen={showMuteManager}
          onClose={() => setShowMuteManager(false)}
        />
      )}

      {showForumShop && (
        <ForumShop
          apiUrl={API_URL}
          user={authUser}
          isOpen={showForumShop}
          onClose={() => setShowForumShop(false)}
          onEquip={() => setCosmeticVersion(v => v + 1)}
        />
      )}

      {sparkline && <SparklinePopup sparkline={sparkline} />}
      {detailCard && (
        <CardDetailPanel
          card={detailCard}
          onClose={() => setDetailCard(null)}
        />
      )}

      </div>
    </div>
  );
}

// Wrap App with AuthProvider and AuthGuard
function AppWithAuth() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CardCollectionProvider>
          <LocationTagProvider>
            <WishlistProvider>
              <AuthGuard>
                <App />
              </AuthGuard>
            </WishlistProvider>
          </LocationTagProvider>
        </CardCollectionProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default AppWithAuth;
