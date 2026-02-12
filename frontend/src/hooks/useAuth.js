import { useState, useCallback, useEffect } from 'react';

const API_URL = 'http://localhost:5000/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'mtg_access_token';
const REFRESH_TOKEN_KEY = 'mtg_refresh_token';
const USER_KEY = 'mtg_user';

export function useAuth() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMultiUserEnabled, setIsMultiUserEnabled] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);

  // Check system status on mount
  useEffect(() => {
    checkSystemStatus();
  }, []);

  // Check if tokens are still valid on mount
  useEffect(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (accessToken && isMultiUserEnabled) {
      validateSession();
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiUserEnabled]);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/status`);
      const data = await response.json();
      setIsMultiUserEnabled(data.multiUserEnabled);
      setSystemStatus(data);
      if (!data.multiUserEnabled) {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to check system status:', err);
      setIsMultiUserEnabled(false);
      setIsLoading(false);
    }
  };

  const validateSession = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY)}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      } else if (response.status === 401) {
        // Try to refresh token
        const refreshed = await refreshToken();
        if (!refreshed) {
          logout();
        }
      } else {
        logout();
      }
    } catch (err) {
      console.error('Session validation failed:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email, password) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store tokens and user data
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email, username, password, displayName) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, username, password, displayName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store tokens and user data
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      setUser(data.user);
      return { success: true, user: data.user, isFirstUser: data.isFirstUser };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY)}`
          },
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      // Clear local storage regardless of API call success
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: storedRefreshToken })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      return true;
    } catch (err) {
      console.error('Token refresh failed:', err);
      return false;
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    setError(null);

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY)}`
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Profile update failed');
      }

      localStorage.setItem(USER_KEY, JSON.stringify(data));
      setUser(data);
      return { success: true, user: data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setError(null);

    try {
      const response = await fetch(`${API_URL}/users/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(ACCESS_TOKEN_KEY)}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password change failed');
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  const getAccessToken = useCallback(() => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }, []);

  const getRefreshToken = useCallback(() => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    isMultiUserEnabled,
    systemStatus,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    getAccessToken,
    getRefreshToken,
    checkSystemStatus
  };
}

export default useAuth;
