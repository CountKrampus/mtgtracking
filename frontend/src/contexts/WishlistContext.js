import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';
import { useCardCollection } from './CardCollectionContext';
import { API_URL } from '../config';

const WishlistContext = createContext(null);

const DEFAULT_WISHLIST_FORM = {
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
};

export function WishlistProvider({ children }) {
  const { addToast } = useToast();
  const { fetchCards, setLoading } = useCardCollection();

  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistFormData, setWishlistFormData] = useState(DEFAULT_WISHLIST_FORM);
  const [editingWishlistId, setEditingWishlistId] = useState(null);
  const [wishlistAutocompleteResults, setWishlistAutocompleteResults] = useState([]);
  const [showWishlistAutocomplete, setShowWishlistAutocomplete] = useState(false);
  const [wishlistFilterPriority, setWishlistFilterPriority] = useState('all');

  const fetchWishlist = async () => {
    try {
      const response = await axios.get(`${API_URL}/wishlist`);
      setWishlistItems(response.data);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  };

  const handleWishlistNameChange = async (value) => {
    setWishlistFormData(prev => ({...prev, name: value}));

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

      setWishlistFormData(prev => ({
        ...prev,
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
      }));
      setShowWishlistAutocomplete(false);
      setWishlistAutocompleteResults([]);
    } catch (error) {
      console.error('Error fetching card details:', error);
      addToast('Card not found on Scryfall', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWishlistSubmit = async () => {
    if (!wishlistFormData.name) {
      addToast('Card name is required', 'warning');
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
      addToast('Error saving wishlist item', 'error');
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
      addToast(response.data.message, 'success');
      fetchWishlist();
      fetchCards();
    } catch (error) {
      console.error('Error acquiring wishlist item:', error);
      addToast('Error acquiring item', 'error');
    }
  };

  const updateAllWishlistPrices = async () => {
    if (!window.confirm('Update prices for all wishlist items?')) return;

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/wishlist/update-all-prices`);
      fetchWishlist();
      addToast(`Updated ${response.data.updated} of ${response.data.total} wishlist prices`, 'success');
    } catch (error) {
      console.error('Error updating wishlist prices:', error);
      addToast('Error updating prices', 'error');
    } finally {
      setLoading(false);
    }
  };

  // addToWishlist: adds a Scryfall card to the wishlist (used by Similar Cards feature).
  // sourceName is the name of the card we were finding similars for (passed by caller).
  const addToWishlist = async (scryfallCard, sourceName) => {
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
        notes: sourceName ? `Similar to ${sourceName}` : '',
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

  useEffect(() => {
    fetchWishlist();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    wishlistItems, setWishlistItems, fetchWishlist,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wishlistItems, wishlistFormData, editingWishlistId, wishlistAutocompleteResults, showWishlistAutocomplete, wishlistFilterPriority]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
