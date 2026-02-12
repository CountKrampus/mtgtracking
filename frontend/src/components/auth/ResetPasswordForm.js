import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ResetPasswordForm = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordErrors, setPasswordErrors] = useState([]);
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError('Invalid reset token. Please try again.');
    }
  }, [token]);

  const validatePassword = (pwd) => {
    const errors = [];
    
    if (pwd.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    
    if (!/[A-Z]/.test(pwd)) {
      errors.push('Password should contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(pwd)) {
      errors.push('Password should contain at least one lowercase letter');
    }
    
    if (!/\d/.test(pwd)) {
      errors.push('Password should contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      errors.push('Password should contain at least one special character');
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setPasswordErrors([]);

    if (!token) {
      setError('Invalid reset token. Please try again.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Both password fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const validationErrors = validatePassword(password);
    if (validationErrors.length > 0) {
      setPasswordErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setMessage('Password has been reset successfully. You can now log in with your new password.');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Invalid Reset Link
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              The password reset link is invalid or has expired. Please try resetting your password again.
            </p>
          </div>
          <div className="text-center">
            <button
              onClick={handleBackToLogin}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your new password below.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="password" className="sr-only">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="New password"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="sr-only">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Confirm password"
              />
            </div>
          </div>

          {passwordErrors.length > 0 && (
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="text-sm text-yellow-700">
                <p className="font-medium">Password requirements:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {passwordErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {message && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-700">{message}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordForm;