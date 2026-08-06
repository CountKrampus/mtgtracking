import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, Download, RefreshCw, DollarSign, Upload, Camera, Settings, Heart, Layers, Zap, Crown, BarChart3, Users, Home, BookOpen, Trophy, User, MessageSquare } from 'lucide-react';
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
import { WishlistProvider } from './contexts/WishlistContext';
import { TradesProvider } from './contexts/TradesContext';
import { AccountSettings } from './components/auth/AccountSettings';
import { AdminPanel } from './components/admin/AdminPanel';

import { API_URL } from './config';
import AppHeader from './components/AppHeader';
import CardDetailPanel from './components/CardDetailPanel';
import SparklinePopup from './components/SparklinePopup';
import BottomNav from './components/BottomNav';
import AppRoutes from './routes/AppRoutes';

// Set up axios interceptor to add auth headers to all requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('mtg_access_token');
  if (token) {
    config.headers = config.headers || {};
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

            originalRequest.headers = originalRequest.headers || {};
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'default');
  }, [settings.theme]);

  // Card collection state and handlers from context
  const {
    cards,
    loading,
    detailCard, setDetailCard,
    sparkline,
    fetchCards,
    updateAllOracleText,
    handleBulkImport,
    offline,
    syncStatus,
    queuedRequestCount,
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

  const navigate = useNavigate();
  const location = useLocation();

  const [importResults, setImportResults] = useState(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, cardName: '' });
  const [isImporting, setIsImporting] = useState(false);
  const offlineMode = offline;
  const [openPanel, setOpenPanel] = useState(null); // null | 'notifications' | 'dms'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const fileInputRef = useRef(null);
  const { shortcuts, keyToCommand, setShortcut, removeShortcut } = useKeyboardShortcuts();
  // Auth/Admin state
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Location management state is now in LocationTagContext

  // Wishlist state is now in WishlistContext

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Handle ?location= URL parameter (for QR code scanning)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('location')) navigate('/collection');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      '/decks': 'deckBuilder',
      '/wishlist': 'wishlist',
    };
    const feature = viewFeatureMap[location.pathname];
    if (feature && settings.features[feature] === false) {
      navigate('/dashboard');
    }
  }, [location.pathname, settings.features]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (showImportResults) { setShowImportResults(false); return; }
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
  }, [keyToCommand, showCommandPalette, showImportResults]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [handleKeyboardShortcut]);

  // Command palette commands
  const paletteCommands = useMemo(() => {
    const ft = settings.features;
    const allCmds = [
      // Navigation
      { id: 'nav-dashboard', label: 'Go to Dashboard', icon: Home, category: 'Navigation', action: () => navigate('/dashboard') },
      { id: 'nav-collection', label: 'Go to Collection', icon: BookOpen, category: 'Navigation', action: () => navigate('/collection') },
      { id: 'nav-decks', label: 'Go to Deck Builder', icon: Layers, category: 'Navigation', action: () => navigate('/decks'), feature: 'deckBuilder' },
      { id: 'nav-wishlist', label: 'Go to Wishlist', icon: Heart, category: 'Navigation', action: () => navigate('/wishlist'), feature: 'wishlist' },
      { id: 'nav-forum', label: 'Go to Forum', icon: MessageSquare, category: 'Navigation', action: () => navigate('/forum') },
      { id: 'nav-lifecounter', label: 'Go to Life Counter', icon: Users, category: 'Navigation', action: () => navigate('/lifecounter') },
      { id: 'nav-settings', label: 'Go to Settings', icon: Settings, category: 'Navigation', action: () => navigate('/settings') },
      // Actions
      { id: 'act-add', label: 'Add New Card', icon: Plus, category: 'Actions', action: () => navigate('/collection') },
      { id: 'act-import', label: 'Import Cards', icon: Upload, category: 'Actions', action: () => fileInputRef.current?.click() },
      { id: 'act-export-json', label: 'Export as JSON', icon: Download, category: 'Actions', action: () => exportData('json') },
      { id: 'act-export-csv', label: 'Export as CSV', icon: Download, category: 'Actions', action: () => exportData('csv') },
      { id: 'act-prices', label: 'Update Prices', icon: RefreshCw, category: 'Actions', action: () => navigate('/collection?tool=priceUpdate') },
      { id: 'act-text', label: 'Fetch Card Text', icon: RefreshCw, category: 'Actions', action: () => updateAllOracleText() },
      { id: 'act-finance', label: 'View Finance', icon: DollarSign, category: 'Actions', action: () => navigate('/collection?tool=finance') },
      { id: 'act-search', label: 'Focus Search', icon: Search, category: 'Actions', action: () => navigate('/collection') },
      // Tools
      { id: 'tool-commanders', label: 'Commander Recommendations', icon: Crown, category: 'Tools', action: () => navigate('/collection?tool=commanderRecs'), feature: 'commanderRecs' },
      { id: 'tool-sets', label: 'Set Completion Tracker', icon: BarChart3, category: 'Tools', action: () => navigate('/collection?tool=setCompletion'), feature: 'setCompletion' },
      { id: 'tool-combos', label: 'Find Combos', icon: Zap, category: 'Tools', action: () => navigate('/collection?tool=comboFinder'), feature: 'comboFinder' },
      { id: 'tool-camera', label: 'Scan Card with Camera', icon: Camera, category: 'Tools', action: () => navigate('/collection') },
      // Learning
      { id: 'learn-rulings', label: 'Card Rulings Browser', icon: BookOpen, category: 'Learning', action: () => navigate('/learn/card-rulings') },
      { id: 'learn-interactions', label: 'Interaction Checker', icon: Zap, category: 'Learning', action: () => navigate('/learn/interaction-checker') },
      { id: 'learn-new-player', label: 'New Player Guide', icon: User, category: 'Learning', action: () => navigate('/learn/new-player-guide') },
      { id: 'learn-keywords', label: 'Keyword Glossary', icon: BookOpen, category: 'Learning', action: () => navigate('/learn/keyword-glossary') },
      { id: 'learn-combos', label: 'Combo Tutorials', icon: Zap, category: 'Learning', action: () => navigate('/learn/combo-tutorials') },
      { id: 'learn-formats', label: 'Format Guides', icon: Trophy, category: 'Learning', action: () => navigate('/learn/format-guides') },
    ];
    const cmds = allCmds
      .filter(cmd => !cmd.feature || ft[cmd.feature] !== false)
      .map(cmd => ({ ...cmd, shortcut: shortcuts[cmd.id] || undefined }));
    paletteCommandsRef.current = cmds;
    return cmds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, settings.features]);

  const rootBgClass = settings.theme === 'default' || !settings.theme
    ? 'bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900'
    : 'bg-black';

  return (
    <div className={`h-screen ${rootBgClass} flex flex-col overflow-hidden`}>
      {/* Top Header with Notifications and DMs */}
      <AppHeader
        authUser={authUser}
        apiUrl={API_URL}
        offline={offline}
        queuedRequestCount={queuedRequestCount}
        syncStatus={syncStatus}
        openPanel={openPanel}
        setOpenPanel={setOpenPanel}
        onOpenMessages={() => navigate('/messages')}
        onOpenProfile={() => navigate('/profile')}
        onOpenAccountSettings={() => setShowAccountSettings(true)}
        onLogout={authLogout}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onImport={() => fileInputRef.current?.click()}
        onExportJSON={() => exportData('json')}
        onExportCSV={() => exportData('csv')}
        onUpdatePrices={() => navigate('/collection?tool=priceUpdate')}
        onFetchCardText={updateAllOracleText}
        onCommanders={() => navigate('/collection?tool=commanderRecs')}
        onSets={() => navigate('/collection?tool=setCompletion')}
        onCombos={() => navigate('/collection?tool=comboFinder')}
        onFinance={() => navigate('/collection?tool=finance')}
        onOpenSettings={() => navigate('/settings')}
        onOpenCamera={() => navigate('/collection')}
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
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 mobile-content-offset sm:pt-6 pb-20 sm:pb-0">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb />

          <AppRoutes
            cards={cards}
            totalCards={totalCards}
            totalValue={totalValue}
            ignoredValue={ignoredValue}
            formatPrice={formatPrice}
            navigate={navigate}
            fileInputRef={fileInputRef}
            isImporting={isImporting} setIsImporting={setIsImporting}
            importProgress={importProgress} setImportProgress={setImportProgress}
            importResults={importResults} setImportResults={setImportResults}
            showImportResults={showImportResults} setShowImportResults={setShowImportResults}
            authUser={authUser}
            settings={settings}
            updateSettings={updateSettings}
            resetSettings={resetSettings}
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
          />
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
          user={authUser}
        />
      )}

      {sparkline && <SparklinePopup sparkline={sparkline} />}
      {detailCard && (
        <CardDetailPanel
          card={detailCard}
          onClose={() => setDetailCard(null)}
        />
      )}

      <BottomNav />
      </div>
    </div>
  );
}

// Wrap App with BrowserRouter, AuthProvider and AuthGuard
function AppWithAuth() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CardCollectionProvider>
            <LocationTagProvider>
              <WishlistProvider>
                <TradesProvider>
                  <AuthGuard>
                    <App />
                  </AuthGuard>
                </TradesProvider>
              </WishlistProvider>
            </LocationTagProvider>
          </CardCollectionProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default AppWithAuth;



