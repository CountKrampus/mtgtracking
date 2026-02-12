import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthContext = createContext(null);

// Create axios-like interceptor for fetch
const createAuthFetch = (getAccessToken, refreshToken, logout) => {
  return async (url, options = {}) => {
    const accessToken = getAccessToken();

    // Add auth header if token exists
    const headers = {
      ...options.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let response = await fetch(url, { ...options, headers });

    // If unauthorized and we have a refresh token, try to refresh
    if (response.status === 401 && accessToken) {
      const refreshed = await refreshToken();

      if (refreshed) {
        // Retry with new token
        const newAccessToken = getAccessToken();
        headers['Authorization'] = `Bearer ${newAccessToken}`;
        response = await fetch(url, { ...options, headers });
      } else {
        // Refresh failed, logout
        logout();
      }
    }

    return response;
  };
};

export function AuthProvider({ children }) {
  const auth = useAuth();

  // Create authenticated fetch function
  const authFetch = useMemo(
    () => createAuthFetch(auth.getAccessToken, auth.refreshToken, auth.logout),
    [auth.getAccessToken, auth.refreshToken, auth.logout]
  );

  // Provide both auth state and authFetch
  const value = useMemo(
    () => ({
      ...auth,
      authFetch
    }),
    [auth, authFetch]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

// HOC for protecting routes
export function withAuth(Component, options = {}) {
  const { requiredRole = null, redirectTo = '/login' } = options;

  return function AuthenticatedComponent(props) {
    const { isAuthenticated, isLoading, user, isMultiUserEnabled } = useAuthContext();

    // If multi-user is disabled, render component normally
    if (!isMultiUserEnabled) {
      return <Component {...props} />;
    }

    // Show loading state
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      );
    }

    // Check authentication
    if (!isAuthenticated) {
      // In a real app, you'd redirect here
      return null;
    }

    // Check role if required
    if (requiredRole && user?.role !== requiredRole) {
      if (requiredRole === 'admin' && user?.role !== 'admin') {
        return (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <h2 className="text-xl font-bold text-red-500">Access Denied</h2>
              <p className="text-gray-400">You don't have permission to view this page.</p>
            </div>
          </div>
        );
      }
    }

    return <Component {...props} />;
  };
}

export default AuthContext;
