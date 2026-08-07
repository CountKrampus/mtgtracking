import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';
import { API_URL } from '../config';
import { saveCardsToCache, getCachedCards, saveRequestToQueue, getQueuedRequests, removeQueuedRequest } from '../utils/offlineDb';

const CardCollectionContext = createContext(null);

export function CardCollectionProvider({ children }) {
  const { addToast } = useToast();

  // Core card state
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isShowingCachedCards, setIsShowingCachedCards] = useState(false);
  const [cacheAge, setCacheAge] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [queuedRequestCount, setQueuedRequestCount] = useState(0);

  // Hover / sparkline state
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredCardPriceHistory, setHoveredCardPriceHistory] = useState([]);
  const [detailCard, setDetailCard] = useState(null);
  const [sparkline, setSparkline] = useState(null);
  const sparklineTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(sparklineTimerRef.current), []);

  // Sync on reconnect: if we're currently showing a cached (offline) snapshot
  // and connectivity returns, re-fetch immediately rather than waiting for
  // the user to manually refresh.
  const isShowingCachedCardsRef = useRef(isShowingCachedCards);
  isShowingCachedCardsRef.current = isShowingCachedCards;

  const refreshQueuedRequestCount = useCallback(async () => {
    try {
      const queued = await getQueuedRequests();
      setQueuedRequestCount(queued.length);
    } catch {
      setQueuedRequestCount(0);
    }
  }, []);

  const fetchCards = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/cards`);
      // GET /api/cards returns a raw array by default, but a {cards, total, ...}
      // shape if pagination query params are ever present - normalize defensively
      // so a stray paginated response (or a stale cache written from one) can't
      // crash every cards.forEach/reduce call downstream.
      const cardList = Array.isArray(response.data) ? response.data : (response.data?.cards || []);
      setCards(cardList);
      setIsShowingCachedCards(false);
      setCacheAge(null);
      saveCardsToCache(cardList); // fire-and-forget; best-effort offline cache
    } catch (error) {
      console.error('Error fetching cards:', error);
      const cached = await getCachedCards();
      if (cached) {
        setCards(Array.isArray(cached.cards) ? cached.cards : []);
        setIsShowingCachedCards(true);
        setCacheAge(cached.cachedAt);
      }
    }
  }, []);

  const processQueuedRequests = useCallback(async () => {
    const queued = await getQueuedRequests();
    if (!queued.length) {
      setQueuedRequestCount(0);
      return;
    }

    setSyncStatus('syncing');
    for (const request of queued) {
      try {
        await axios({
          method: request.method,
          url: request.url,
          data: request.data
        });
        await removeQueuedRequest(request.id);
      } catch (err) {
        console.error('Offline sync failed for request:', request, err);
        setSyncStatus('error');
        return;
      }
    }

    setSyncStatus('idle');
    setQueuedRequestCount(0);
    fetchCards();
  }, [fetchCards]);

  useEffect(() => {
    refreshQueuedRequestCount();
    const handleConnectionChange = async () => {
      const isOnline = navigator.onLine;
      setOffline(!isOnline);
      if (isOnline) {
        await processQueuedRequests();
      }
    };

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
    };
  }, [processQueuedRequests, refreshQueuedRequestCount]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const queueOfflineRequest = async (request) => {
    await saveRequestToQueue(request);
    refreshQueuedRequestCount();
    addToast('Offline: your change has been queued and will sync when online.', 'info');
  };

  const sendRequest = async ({ method, url, data, queueable = true }) => {
    if (!navigator.onLine) {
      if (queueable) {
        await queueOfflineRequest({ method, url, data });
      }
      return { queued: true };
    }

    try {
      const response = await axios({ method, url, data });
      return response;
    } catch (error) {
      if (queueable && (!error.response || error.message === 'Network Error')) {
        await queueOfflineRequest({ method, url, data });
        return { queued: true };
      }

      throw error;
    }
  };

  /**
   * Submit a new or edited card.
   * @param {object} formData - Card form data
   * @param {Function} onSuccess - Called after a successful save (e.g. handleCancel)
   */
  const handleSubmit = async (formData, onSuccess) => {
    if (!formData.name) {
      addToast('Card name is required', 'warning');
      return;
    }

    try {
      const url = editingId ? `${API_URL}/cards/${editingId}` : `${API_URL}/cards`;
      const method = editingId ? 'put' : 'post';
      const response = await sendRequest({ method, url, data: formData });

      if (response && response.data?.merged) {
        addToast(`Card already exists! ${response.data.message}`, 'info');
      }

      if (!response || response.queued) {
        if (onSuccess) onSuccess();
        return;
      }

      fetchCards();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving card:', error);
      addToast('Error saving card', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this card?')) return;

    try {
      const response = await sendRequest({ method: 'delete', url: `${API_URL}/cards/${id}` });
      if (!response || response.queued) return;
      fetchCards();
    } catch (error) {
      console.error('Error deleting card:', error);
      addToast('Error deleting card', 'error');
    }
  };

  const updateCardPrice = async (id) => {
    try {
      const response = await sendRequest({
        method: 'post',
        url: `${API_URL}/cards/${id}/update-price`
      });

      if (response?.queued) return;

      fetchCards();
      addToast('Price updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating price:', error);
      addToast('Error updating price', 'error');
    }
  };

  /**
   * Update all card prices (and optionally full card data).
   * @param {boolean} forceUpdate - Force update even if data exists
   * @param {boolean} updateFullData - Also update full card metadata
   */
  const updateAllPrices = async (forceUpdate, updateFullData) => {
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
      const response = await sendRequest({ method: 'post', url });

      if (response?.queued) return;

      fetchCards();

      // Show detailed results
      const { updated, skipped, total } = response.data;
      const dataType = updateFullData ? 'full card data' : 'prices';
      addToast(`${dataType} updated: ${updated} cards updated, ${skipped} skipped, ${total} total`, 'success');
    } catch (error) {
      console.error('Error updating prices:', error);
      addToast('Error updating prices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateAllOracleText = async () => {
    if (!window.confirm('This will fetch oracle text for all cards from Scryfall. Continue?')) return;

    try {
      setLoading(true);
      const response = await sendRequest({
        method: 'post',
        url: `${API_URL}/cards/update-all-oracle-text`
      });

      if (response?.queued) return;

      fetchCards();
      addToast('Oracle text updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating oracle text:', error);
      addToast('Error updating oracle text', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add a tag to a card.
   * @param {string} cardId
   * @param {string} newTag - The tag string to add
   * @param {Function} setNewTag - Setter to clear the tag input
   * @param {Function} setShowTagInput - Setter to close the tag input UI
   * @param {Function} [fetchTags] - Optional callback to refresh available tags (owned by LocationTagContext in Task 5)
   */
  const handleAddTag = async (cardId, newTag, setNewTag, setShowTagInput, fetchTags) => {
    if (!newTag.trim()) return;

    try {
     const response = await sendRequest({
       method: 'post',
       url: `${API_URL}/cards/${cardId}/tags`,
       data: { tag: newTag.trim() }
     });

     if (!response || response.queued) {
       if (setNewTag) setNewTag('');
       if (setShowTagInput) setShowTagInput(null);
       return;
     }

     if (setNewTag) setNewTag('');
     if (setShowTagInput) setShowTagInput(null);
     fetchCards();
     if (fetchTags) fetchTags();
   } catch (error) {
     console.error('Error adding tag:', error);
     addToast('Error adding tag', 'error');
   }
  };

  /**
   * @param {Function} [fetchTags] - Optional callback to refresh available tags (owned by LocationTagContext in Task 5)
   */
  const handleRemoveTag = async (cardId, tag, fetchTags) => {
   try {
     const response = await sendRequest({
       method: 'delete',
       url: `${API_URL}/cards/${cardId}/tags/${encodeURIComponent(tag)}`
     });

     if (!response || response.queued) return;
     fetchCards();
     if (fetchTags) fetchTags();
   } catch (error) {
     console.error('Error removing tag:', error);
     addToast('Error removing tag', 'error');
   }
  };

  const handleCardHover = async (card) => {
    try {
      const res = await axios.get(`${API_URL}/cards/${card._id}/price-history`);
      setHoveredCardPriceHistory(res.data);
    } catch (err) {
      console.error('Error fetching price history:', err);
      setHoveredCardPriceHistory([]);
    }
  };

  const handlePriceCellEnter = (e, card) => {
    const rect = e.currentTarget.getBoundingClientRect();
    clearTimeout(sparklineTimerRef.current);
    sparklineTimerRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/cards/${card._id}/price-history?days=30`);
        const pts = (res.data || []).map(p => ({ price: p.price, date: p.date || p.createdAt }));
        setSparkline({
          cardId: card._id,
          cardName: card.name,
          pos: { top: rect.top - 10, left: rect.left + rect.width / 2 },
          history: pts
        });
      } catch {}
    }, 300);
  };

  const handlePriceCellLeave = () => {
    clearTimeout(sparklineTimerRef.current);
    setSparkline(null);
  };

  /**
   * Handle bulk import from a file input event.
   * Import-progress state is passed in because it lives in App (UI concern).
   *
   * @param {Event} event - File input change event
   * @param {object} importState - { offlineMode, setIsImporting, setImportProgress, setImportResults, setShowImportResults }
   */
  const handleBulkImport = async (event, importState) => {
    const { offlineMode, setIsImporting, setImportProgress, setImportResults, setShowImportResults } = importState;
    const file = event.target.files[0];
    if (!file) return;

    const parseCSV = (text) => {
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) return [];

      const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const cards = [];

      for (let i = 1; i < lines.length; i++) {
        const values = [];
        let current = '';
        let inQuotes = false;

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
            'total value': null,
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

    try {
      setIsImporting(true);
      const text = await file.text();
      const fileExtension = file.name.split('.').pop().toLowerCase();

      let response;

      if (fileExtension === 'json') {
        const cards = JSON.parse(text);
        const cardArray = Array.isArray(cards) ? cards : [cards];
        setImportProgress({ current: 0, total: cardArray.length, cardName: '' });
        response = await sendRequest({
          method: 'post',
          url: `${API_URL}/cards/bulk-import-full`,
          data: { cards: cardArray }
        });

      } else if (fileExtension === 'csv') {
        const cards = parseCSV(text);
        setImportProgress({ current: 0, total: cards.length, cardName: '' });
        response = await sendRequest({
          method: 'post',
          url: `${API_URL}/cards/bulk-import-full`,
          data: { cards }
        });

      } else {
        const cardList = text.split('\n').filter(line => line.trim());
        setImportProgress({ current: 0, total: cardList.length, cardName: '' });
        response = await sendRequest({
          method: 'post',
          url: `${API_URL}/cards/bulk-import`,
          data: {
            cardList,
            offlineMode
          }
        });
      }

      if (response?.queued) {
        setImportResults(null);
        setShowImportResults(false);
        addToast('Import queued for sync once you are back online.', 'info');
        return;
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
      event.target.value = '';
    }
  };

  // ── Context value ──────────────────────────────────────────────────────────

  const value = useMemo(() => ({
    // State
    cards, setCards,
    loading, setLoading,
    editingId, setEditingId,
    isShowingCachedCards,
    cacheAge,
    hoveredCard, setHoveredCard,
    hoveredCardPriceHistory, setHoveredCardPriceHistory,
    detailCard, setDetailCard,
    sparkline, setSparkline,
    sparklineTimerRef,
    // Handlers
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
    offline,
    syncStatus,
    queuedRequestCount,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cards, loading, editingId, isShowingCachedCards, cacheAge, hoveredCard, hoveredCardPriceHistory, detailCard, sparkline, offline, syncStatus, queuedRequestCount]);

  return (
    <CardCollectionContext.Provider value={value}>
      {children}
    </CardCollectionContext.Provider>
  );
}

export function useCardCollection() {
  const ctx = useContext(CardCollectionContext);
  if (!ctx) throw new Error('useCardCollection must be used inside CardCollectionProvider');
  return ctx;
}

