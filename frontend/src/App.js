import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import axios from 'axios';
import { Search, Plus, Download, RefreshCw, DollarSign, Upload, Camera, Settings, Heart, Layers, Zap, Crown, BarChart3, Users, Home, BookOpen, Trophy, User, MessageSquare } from 'lucide-react';
import QRCode from 'qrcode';
import './App.css';
import 'mana-font';
import Sidebar from './components/Sidebar';
import Breadcrumb from './components/Breadcrumb';
import CommandPalette from './components/CommandPalette';
import useKeyboardShortcuts, { buildShortcutKey } from './hooks/useKeyboardShortcuts';
import useSettings from './hooks/useSettings';
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
import CategoryView from './components/Forum/CategoryView';
import ThreadView from './components/Forum/ThreadView';
import SpamFilterAdmin from './components/Forum/SpamFilterAdmin';
import MuteManager from './components/Forum/MuteManager';
import ForumProfilePage from './components/Forum/ForumProfilePage';
import ForumShop from './components/Forum/ForumShop';
import ForumLeaderboard from './components/Forum/ForumLeaderboard';
import SharedDeckView from './components/CommunityDecks/SharedDeckView';
import CommunityDecks from './components/CommunityDecks/CommunityDecks';
import { API_URL } from './config';
import NotificationBell from './components/NotificationBell';
import CardDetailPanel from './components/CardDetailPanel';
import UserMenu from './components/UserMenu';
import MessagesPage from './components/MessagesPage';
import MyProfile from './components/MyProfile';
import UserProfile from './components/UserProfile';
import SettingsView from './components/SettingsView';
import SparklinePopup from './components/SparklinePopup';
import CollectionView from './components/CollectionView';
import WishlistView from './components/WishlistView';

const DeckBuilder = React.lazy(() => import('./components/DeckBuilder'));
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


function App() {
  useToast(); // Required for context availability; individual components consume toast via useToast()

  // Auth context - available when wrapped with AuthProvider
  const authContext = useAuthContext();
  const { user: authUser, isMultiUserEnabled, logout: authLogout } = authContext || {};

  // Settings must be first so other state can use its values
  const { settings, updateSettings, resetSettings } = useSettings();

  // Card collection state and handlers from context
  const {
    cards,
    loading,
    detailCard, setDetailCard,
    sparkline,
    fetchCards,
    updateAllOracleText,
    handleBulkImport,
  } = useCardCollection();

  // Location and tag state and handlers from context
  const {
    locations, locationStats,
    newLocationName, setNewLocationName, newLocationDesc, setNewLocationDesc,
    editingLocation, startEditLocation, cancelEditLocation,
    handleCreateLocation, handleUpdateLocation, handleDeleteLocation, handleToggleLocationIgnorePrice,
    availableTags,
    newTagName, setNewTagName,
    handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
  } = useLocationTag();

  // Wishlist context - WishlistView handles UI; App.js only needs fetchWishlist for combo-to-wishlist
  const { fetchWishlist } = useWishlist();

  const [showFinancePanel, setShowFinancePanel] = useState(false);
  const [financeData, setFinanceData] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, cardName: '' });
  const [isImporting, setIsImporting] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [openPanel, setOpenPanel] = useState(null); // null | 'notifications' | 'dms'
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('currentView') || 'dashboard';
  }); // 'dashboard', 'collection', 'decks', 'wishlist', 'forum', 'lifecounter', or 'settings'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const fileInputRef = useRef(null);
  const { shortcuts, keyToCommand, setShortcut, removeShortcut } = useKeyboardShortcuts();
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
  const [completionData, setCompletionData] = useState([]);
  const [loadingSetCompletion, setLoadingSetCompletion] = useState(false);

  // Combo Finder
  const [showComboFinder, setShowComboFinder] = useState(false);
  const [comboResults, setComboResults] = useState({ combos: [], partialCombos: [], found: 0, partialFound: 0 });
  const [loadingCombos, setLoadingCombos] = useState(false);
  const [comboTab, setComboTab] = useState('complete'); // 'complete' or 'partial'

  const [forceUpdate, setForceUpdate] = useState(false); // Force update cards even if they have data
  const [updateFullData, setUpdateFullData] = useState(false); // Update full card data (set, rarity, etc.)
  const [showPriceUpdateModal, setShowPriceUpdateModal] = useState(false);

  // QR Labels
  const [showQRPreview, setShowQRPreview] = useState(false);
  const [qrPreviewLocation, setQRPreviewLocation] = useState(null);
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [showPrintLabels, setShowPrintLabels] = useState(false);


  useEffect(() => {
    fetchCards();
  }, []);

  // Handle ?location= URL parameter (for QR code scanning)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('location')) setCurrentView('collection');
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

  const openFinancePanel = async () => {
    try {
      const response = await axios.get(`${API_URL}/finance`);
      setFinanceData(response.data);
      setShowFinancePanel(true);
    } catch (error) {
      console.error('Error fetching finance data:', error);
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

      setCompletionData(completionData);
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
      if (showCommanderRecs) { setShowCommanderRecs(false); setCommanderFinderMode('collection'); return; }
      if (showSetCompletion) { setShowSetCompletion(false); return; }
      if (showComboFinder) { setShowComboFinder(false); return; }
      if (showImportResults) { setShowImportResults(false); return; }
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
  }, [keyToCommand, showCommandPalette, showPriceUpdateModal, showCommanderRecs, showSetCompletion, showComboFinder, showImportResults, showQRPreview]);

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
      { id: 'act-add', label: 'Add New Card', icon: Plus, category: 'Actions', action: () => setCurrentView('collection') },
      { id: 'act-import', label: 'Import Cards', icon: Upload, category: 'Actions', action: () => fileInputRef.current?.click() },
      { id: 'act-export-json', label: 'Export as JSON', icon: Download, category: 'Actions', action: () => exportData('json') },
      { id: 'act-export-csv', label: 'Export as CSV', icon: Download, category: 'Actions', action: () => exportData('csv') },
      { id: 'act-prices', label: 'Update Prices', icon: RefreshCw, category: 'Actions', action: () => setShowPriceUpdateModal(true) },
      { id: 'act-text', label: 'Fetch Card Text', icon: RefreshCw, category: 'Actions', action: () => updateAllOracleText() },
      { id: 'act-finance', label: 'View Finance', icon: DollarSign, category: 'Actions', action: () => openFinancePanel() },
      { id: 'act-search', label: 'Focus Search', icon: Search, category: 'Actions', action: () => setCurrentView('collection') },
      // Tools
      { id: 'tool-commanders', label: 'Commander Recommendations', icon: Crown, category: 'Tools', action: () => getCommanderRecommendations(), feature: 'commanderRecs' },
      { id: 'tool-sets', label: 'Set Completion Tracker', icon: BarChart3, category: 'Tools', action: () => getSetCompletionData(), feature: 'setCompletion' },
      { id: 'tool-combos', label: 'Find Combos', icon: Zap, category: 'Tools', action: () => findCombos(), feature: 'comboFinder' },
      { id: 'tool-camera', label: 'Scan Card with Camera', icon: Camera, category: 'Tools', action: () => setCurrentView('collection') },
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
        onOpenCamera={() => setCurrentView('collection')}
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
                onAddCard={() => setCurrentView('collection')}
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
              completionData={completionData} setCompletionData={setCompletionData} loadingSetCompletion={loadingSetCompletion}
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
        {currentView === 'wishlist' && <WishlistView />}

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
