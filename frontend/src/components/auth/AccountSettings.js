import React, { useState } from 'react';
import { User, Mail, Lock, Save, AlertCircle, CheckCircle, LogOut, Trash2 } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { SessionManager } from './SessionManager';

export function AccountSettings({ onClose }) {
  const { user, updateProfile, changePassword, logout, authFetch } = useAuthContext();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  // Delete state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage(null);

    const result = await updateProfile({ displayName, email });

    if (result.success) {
      setProfileMessage({ type: 'success', text: 'Profile updated successfully' });
    } else {
      setProfileMessage({ type: 'error', text: result.error });
    }

    setProfileLoading(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      setPasswordLoading(false);
      return;
    }

    const result = await changePassword(currentPassword, newPassword);

    if (result.success) {
      setPasswordMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordMessage({ type: 'error', text: result.error });
    }

    setPasswordLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE_MY_ACCOUNT') {
      alert('Please type DELETE_MY_ACCOUNT to confirm');
      return;
    }

    setDeleteLoading(true);

    try {
      const response = await authFetch('http://localhost:5000/api/users/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation
        })
      });

      if (response.ok) {
        logout();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete account');
      }
    } catch (err) {
      alert('Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Account Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            &times;
          </button>
        </div>

        <div className="flex border-b border-gray-700">
          {['profile', 'password', 'sessions', 'danger'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium ${
                activeTab === tab
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'danger' ? 'Danger Zone' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  profileMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-red-500/20 text-red-200'
                }`}>
                  {profileMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <input
                  type="text"
                  value={user?.role || ''}
                  disabled
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed capitalize"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {passwordMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  passwordMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-red-500/20 text-red-200'
                }`}>
                  {passwordMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  minLength={8}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <Lock size={18} />
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          )}

          {activeTab === 'sessions' && (
            <SessionManager />
          )}

          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
                <h3 className="text-lg font-bold text-red-400 mb-2">Delete Account</h3>
                <p className="text-gray-300 mb-4">
                  This action is permanent and cannot be undone. All your data including cards,
                  decks, and settings will be permanently deleted.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Enter your password
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Type DELETE_MY_ACCOUNT to confirm
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="DELETE_MY_ACCOUNT"
                    />
                  </div>

                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading || deleteConfirmation !== 'DELETE_MY_ACCOUNT'}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={18} />
                    {deleteLoading ? 'Deleting...' : 'Delete My Account'}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-700/50 rounded-lg">
                <h3 className="text-lg font-bold text-white mb-2">Sign Out</h3>
                <p className="text-gray-300 mb-4">
                  Sign out of your account on this device.
                </p>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg flex items-center gap-2"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountSettings;
