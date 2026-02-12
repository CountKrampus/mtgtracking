import React from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

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
