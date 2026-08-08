import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useToast } from './ToastContext';
import { useCardCollection } from './CardCollectionContext';
import { API_URL } from '../config';

const LocationTagContext = createContext(null);

export function LocationTagProvider({ children }) {
  const { addToast } = useToast();
  const { cards, fetchCards } = useCardCollection();

  // ── Locations ─────────────────────────────────────────────────────────────
  const [locations, setLocations] = useState([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDesc, setNewLocationDesc] = useState('');
  const [newLocationCapacity, setNewLocationCapacity] = useState('');
  const [editingLocation, setEditingLocation] = useState(null);

  // Location stats for QR labels
  const locationStats = useMemo(() => {
    const stats = {};
    const locs = Array.isArray(locations) ? locations : [];
    locs.forEach(loc => {
      const cardsInLoc = Array.isArray(cards) ? cards.filter(c => c.location === loc.name) : [];
      const cardCount = cardsInLoc.reduce((sum, c) => sum + (c.quantity || 0), 0);
      const totalValue = cardsInLoc.reduce((sum, c) => sum + ((c.price || 0) * (c.quantity || 0)), 0);
      const max = loc.maxCapacity || null;
      const nearCapacity = max && cardCount >= max * 0.9;
      const overCapacity = max && cardCount > max;
      stats[loc.name] = { cardCount, totalValue, max, nearCapacity, overCapacity };
    });
    return stats;
  }, [cards, locations]);

  const fetchLocations = async () => {
    try {
      const response = await axios.get(`${API_URL}/locations`);
      setLocations(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    }
  };

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      addToast('Location name is required', 'warning');
      return;
    }

    try {
      await axios.post(`${API_URL}/locations`, {
        name: newLocationName.trim(),
        description: newLocationDesc.trim(),
        maxCapacity: newLocationCapacity ? parseInt(newLocationCapacity, 10) : null
      });
      setNewLocationName('');
      setNewLocationDesc('');
      setNewLocationCapacity('');
      fetchLocations();
    } catch (error) {
      console.error('Error creating location:', error);
      addToast(error.response?.data?.message || 'Error creating location', 'error');
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation || !newLocationName.trim()) return;

    try {
      await axios.put(`${API_URL}/locations/${editingLocation._id}`, {
        name: newLocationName.trim(),
        description: newLocationDesc.trim(),
        maxCapacity: newLocationCapacity ? parseInt(newLocationCapacity, 10) : null
      });
      setEditingLocation(null);
      setNewLocationName('');
      setNewLocationDesc('');
      setNewLocationCapacity('');
      fetchLocations();
      fetchCards(); // Refresh cards in case location name changed
    } catch (error) {
      console.error('Error updating location:', error);
      addToast(error.response?.data?.message || 'Error updating location', 'error');
    }
  };

  const handleDeleteLocation = async (locationId) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;

    try {
      await axios.delete(`${API_URL}/locations/${locationId}`);
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      addToast(error.response?.data?.message || 'Error deleting location', 'error');
    }
  };

  const startEditLocation = (location) => {
    setEditingLocation(location);
    setNewLocationName(location.name);
    setNewLocationDesc(location.description || '');
    setNewLocationCapacity(location.maxCapacity ? String(location.maxCapacity) : '');
  };

  const cancelEditLocation = () => {
    setEditingLocation(null);
    setNewLocationName('');
    setNewLocationDesc('');
    setNewLocationCapacity('');
  };

  const handleToggleLocationIgnorePrice = async (locationId, currentValue) => {
    try {
      await axios.put(`${API_URL}/locations/${locationId}`, { ignorePrice: !currentValue });
      fetchLocations();
    } catch (error) {
      console.error('Error updating location:', error);
      addToast(error.response?.data?.message || 'Error updating location', 'error');
    }
  };

  // ── Tags ──────────────────────────────────────────────────────────────────
  const [availableTags, setAvailableTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');

  const fetchAvailableTags = async () => {
    try {
      const response = await axios.get(`${API_URL}/tags`);
      setAvailableTags(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setAvailableTags([]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      addToast('Tag name is required', 'warning');
      return;
    }

    const normalizedTag = newTagName.trim().toLowerCase();
    // Check if tag exists (availableTags is now array of objects)
    if (availableTags.some(t => (t.name || t) === normalizedTag)) {
      addToast('Tag already exists', 'warning');
      return;
    }

    try {
      await axios.post(`${API_URL}/tags`, { name: normalizedTag });
      setNewTagName('');
      fetchAvailableTags();
    } catch (error) {
      console.error('Error creating tag:', error);
      addToast(error.response?.data?.message || 'Error creating tag', 'error');
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
      addToast(error.response?.data?.message || 'Error deleting tag', 'error');
    }
  };

  const handleToggleTagIgnorePrice = async (tagName, currentValue) => {
    try {
      await axios.put(`${API_URL}/tags/${encodeURIComponent(tagName)}`, { ignorePrice: !currentValue });
      fetchAvailableTags();
    } catch (error) {
      console.error('Error updating tag:', error);
      addToast(error.response?.data?.message || 'Error updating tag', 'error');
    }
  };

  // Mount fetch
  useEffect(() => {
    fetchLocations();
    fetchAvailableTags();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    locations, setLocations, fetchLocations, locationStats,
    newLocationName, setNewLocationName,
    newLocationDesc, setNewLocationDesc,
    newLocationCapacity, setNewLocationCapacity,
    editingLocation, startEditLocation, cancelEditLocation,
    handleCreateLocation, handleUpdateLocation, handleDeleteLocation,
    handleToggleLocationIgnorePrice,
    availableTags, setAvailableTags, fetchAvailableTags,
    newTagName, setNewTagName,
    handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [locations, locationStats, availableTags, editingLocation, newLocationName, newLocationDesc, newLocationCapacity, newTagName]);

  return (
    <LocationTagContext.Provider value={value}>
      {children}
    </LocationTagContext.Provider>
  );
}

export function useLocationTag() {
  const ctx = useContext(LocationTagContext);
  if (!ctx) throw new Error('useLocationTag must be used inside LocationTagProvider');
  return ctx;
}
