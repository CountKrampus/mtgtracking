import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';

export function AuthGuard({ children }) {
  const {
    isAuthenticated,
    isLoading,
    isMultiUserEnabled,
    serverUnreachable,
    retryConnection,
    login,
    register,
    error
  } = useAuthContext();

  const [showRegister, setShowRegister] = React.useState(false);
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);

  // Handle hash-based routing for auth pages
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1); // Remove '#' prefix
      
      if (hash === '/forgot-password') {
        setShowForgotPassword(true);
      } else {
        setShowForgotPassword(false);
      }
    };

    // Initialize based on current hash
    handleHashChange();

    // Add hashchange event listener
    window.addEventListener('hashchange', handleHashChange);

    // Also check hash on mount in case it's set before the listener is added
    window.addEventListener('load', handleHashChange);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('load', handleHashChange);
    };
  }, []);

  // Show loading state first — before checking isMultiUserEnabled to avoid race condition
  // where isMultiUserEnabled is still false during the status check and bypasses auth entirely
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Online but the server isn't responding - show a retry screen instead of
  // falling through to the single-user branch below (isMultiUserEnabled is
  // still false during an outage, so that branch would wrongly render the app).
  if (serverUnreachable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="text-center max-w-md">
          <WifiOff size={48} className="mx-auto mb-4 text-purple-400" />
          <h1 className="text-2xl font-bold text-white mb-2">Can't reach the server</h1>
          <p className="text-gray-400 mb-6">
            The MTG Tracker server isn't responding. Check that the backend is running, then retry.
          </p>
          <button
            onClick={retryConnection}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Status check complete — if multi-user is disabled, render children without auth
  if (!isMultiUserEnabled) {
    return children;
  }

  // Show forgot password form if hash indicates so
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
        <div className="w-full max-w-md">
          <ForgotPasswordForm 
            onClose={() => {
              setShowForgotPassword(false);
              window.location.hash = ''; // Clear the hash
            }} 
          />
        </div>
      </div>
    );
  }

  // Show login/register if not authenticated
  if (!isAuthenticated) {
    if (showRegister) {
      return (
        <RegisterForm
          onRegister={register}
          onSwitchToLogin={() => setShowRegister(false)}
          error={error}
        />
      );
    }

    return (
      <LoginForm
        onLogin={login}
        onSwitchToRegister={() => setShowRegister(true)}
        error={error}
      />
    );
  }

  // User is authenticated, render children
  return children;
}

export default AuthGuard;
