import { useState, useCallback } from 'react';

const API_URL = 'http://localhost:5000/api';

/**
 * Hook for syncing data with the backend (MongoDB)
 */
function useBackendSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // ============================================
  // PROFILES
  // ============================================

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/profiles`);
      if (!response.ok) throw new Error('Failed to fetch profiles');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createProfile = useCallback(async (name, avatarColor) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatarColor })
      });
      if (!response.ok) throw new Error('Failed to create profile');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (id, updates) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProfile = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/profiles/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete profile');
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // GAMES
  // ============================================

  const saveGame = useCallback(async (gameData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      });
      if (!response.ok) throw new Error('Failed to save game');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGames = useCallback(async (limit = 50) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/games?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch games');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/stats`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // SHARING
  // ============================================

  const shareGame = useCallback(async (gameState) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameState })
      });
      if (!response.ok) throw new Error('Failed to share game');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSharedGame = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/lifecounter/share/${code}`);
      if (!response.ok) throw new Error('Game not found or expired');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    clearError,

    // Profiles
    fetchProfiles,
    createProfile,
    updateProfile,
    deleteProfile,

    // Games
    saveGame,
    fetchGames,
    fetchStats,

    // Sharing
    shareGame,
    loadSharedGame
  };
}

export default useBackendSync;
