import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';

export function AuthGuard({ children }) {
  const {
    isAuthenticated,
    isLoading,
    isMultiUserEnabled,
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

  // If multi-user is disabled, render children without auth check
  if (!isMultiUserEnabled) {
    return children;
  }

  // Show loading state
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
