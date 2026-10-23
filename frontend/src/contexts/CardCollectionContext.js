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
   * Update all card prices (and optionally full card data). Every card is
   * refreshed on every run — existing prices never cause a skip.
   * @param {boolean} updateFullData - Also update full card metadata
   */
  const updateAllPrices = async (updateFullData) => {
    let message = 'This will refresh prices for ALL cards';
    if (updateFullData) {
      message += ' and full card data (set, rarity, collector number, colors, types, mana cost, images)';
    }
    message += '. Continue?';

    if (!window.confirm(message)) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (updateFullData) params.append('fullData', 'true');

      const url = `${API_URL}/cards/update-all-prices${params.toString() ? '?' + params.toString() : ''}`;
      const response = await sendRequest({ method: 'post', url });

      if (response?.queued) return;

      fetchCards();

      // Show detailed results
      const { updated, total } = response.data;
      const dataType = updateFullData ? 'full card data' : 'prices';
      addToast(`${dataType} refreshed: ${updated} of ${total} cards updated`, 'success');
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
      const rows = [];
      let row = [];
      let cell = '';
      let inQuotes = false;
      const source = text.replace(/^\uFEFF/, '');

      for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (char === '"' && inQuotes && source[index + 1] === '"') {
          cell += '"';
          index++;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(cell.trim());
          cell = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
          if (char === '\r' && source[index + 1] === '\n') index++;
          row.push(cell.trim());
          if (row.some(value => value !== '')) rows.push(row);
          row = [];
          cell = '';
        } else {
          cell += char;
        }
      }
      if (cell || row.length) {
        row.push(cell.trim());
        if (row.some(value => value !== '')) rows.push(row);
      }
      if (rows.length < 2) return [];

      const normalizeHeader = (value) => value
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const fieldMap = {
        name: 'name',
        card: 'name',
        'card name': 'name',
        'card name / item': 'name',
        quantity: 'quantity',
        count: 'quantity',
        qty: 'quantity',
        set: 'set',
        edition: 'set',
        'set name': 'set',
        expansion: 'set',
        setcode: 'setCode',
        'set code': 'setCode',
        editioncode: 'setCode',
        'edition code': 'setCode',
        'collector number': 'collectorNumber',
        'collector no': 'collectorNumber',
        number: 'collectorNumber',
        rarity: 'rarity',
        condition: 'condition',
        price: 'price',
        'market price': 'price',
        'price usd': 'price',
        'price cad': 'priceCad',
        pricecad: 'priceCad',
        'purchase price': 'purchasePrice',
        'colors': 'colors',
        color: 'colors',
        types: 'types',
        type: 'types',
        'mana cost': 'manaCost',
        manacost: 'manaCost',
        'scryfall id': 'scryfallId',
        scryfallid: 'scryfallId',
        'card id': 'scryfallId',
        'image url': 'imageUrl',
        imageurl: 'imageUrl',
        'oracle text': 'oracleText',
        oracletext: 'oracleText',
        foil: 'isFoil',
        isfoil: 'isFoil',
        'is foil': 'isFoil',
        token: 'isToken',
        istoken: 'isToken',
        'is token': 'isToken',
        tags: 'tags',
        location: 'location',
        notes: 'notes',
        reserved: 'reserved',
        'total value': null,
        totalvalue: null,
        language: null,
        proxy: null,
        alter: null,
        signed: null,
        'tradelist count': null,
        'price currency': null,
        'purchase price currency': null,
      };
      const header = rows[0].map(normalizeHeader);
      const nameIndex = header.findIndex(key => fieldMap[key] === 'name');
      if (nameIndex < 0) {
        throw new Error('Could not find a card-name column. Supported headers include Name, Card Name, and Card.');
      }

      return rows.slice(1).map(values => {
        const card = {};
        header.forEach((key, index) => {
          const field = Object.prototype.hasOwnProperty.call(fieldMap, key) ? fieldMap[key] : null;
          if (field && values[index] !== undefined && values[index] !== '') {
            const value = values[index];
            if (field === 'isFoil' || field === 'isToken' || field === 'reserved') {
              card[field] = ['true', 'yes', '1', 'foil'].includes(value.toLowerCase());
            } else if (field === 'condition') {
              const condition = value.toLowerCase().replace(/[^a-z]/g, '');
              const conditionMap = {
                nm: 'NM', mint: 'NM', nearmint: 'NM',
                lp: 'LP', lightlyplayed: 'LP', slightlyplayed: 'LP',
                mp: 'MP', moderatelyplayed: 'MP',
                hp: 'HP', heavilyplayed: 'HP',
                dmg: 'DMG', damaged: 'DMG',
              };
              card[field] = conditionMap[condition] || value;
            } else {
              card[field] = value;
            }
          }
        });
        return card;
      }).filter(card => card.name);
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
        if (!cards.length) {
          throw new Error('No cards were found in this CSV file.');
        }
        const sample = cards.slice(0, 5).map(card => `${card.quantity || 1}x ${card.name}`).join('\n');
        const remaining = cards.length > 5 ? `\n…and ${cards.length - 5} more` : '';
        if (!window.confirm(
          `CSV import preview\n\n${file.name}\n${cards.length} card entries detected.\n\n${sample}${remaining}\n\nMatching cards will be merged into your collection. Continue?`
        )) {
          return;
        }
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
