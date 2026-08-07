import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Save, AlertCircle, CheckCircle, LogOut, Trash2, Shield, Camera, Link2, Unlink, Copy } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { SessionManager } from './SessionManager';
import { API_URL } from '../../config';
import AvatarPicker from '../avatars/AvatarPicker';
import UserAvatar from '../avatars/UserAvatar';

export function AccountSettings({ onClose }) {
  const { user, updateProfile, changePassword, logout, authFetch } = useAuthContext();
  const [activeTab, setActiveTab] = useState('profile');

  // Privacy state — initialise from current user object
  const [privacy, setPrivacy] = useState({
    isPublic: user?.privacy?.isPublic ?? false,
    showCollection: user?.privacy?.showCollection ?? false,
    showDecks: user?.privacy?.showDecks ?? true,
    showWishlist: user?.privacy?.showWishlist ?? false,
    showForum: user?.privacy?.showForum ?? false
  });
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState(null);

  // Notification preferences state — initialise from current user object
  const [notifPrefs, setNotifPrefs] = useState({
    healthReportEnabled: user?.notificationPreferences?.healthReportEnabled ?? false
  });
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(false);
  const [notifPrefsMessage, setNotifPrefsMessage] = useState(null);

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

  // Avatar state
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user?.avatarUrl || '');

  // Discord link state
  const [discordLinked, setDiscordLinked] = useState(null);
  const [discordStatusLoading, setDiscordStatusLoading] = useState(true);
  const [discordCode, setDiscordCode] = useState(null);
  const [discordCodeExpiresAt, setDiscordCodeExpiresAt] = useState(null);
  const [discordActionLoading, setDiscordActionLoading] = useState(false);
  const [discordMessage, setDiscordMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch(`${API_URL}/discord/link`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setDiscordLinked(data.linked);
      } catch (err) {
        // Leave discordLinked as null (unknown) - the tab still lets the user try to link/unlink.
      } finally {
        if (!cancelled) setDiscordStatusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authFetch]);

  const handleAvatarSave = (avatarUrl) => {
    setCurrentAvatarUrl(avatarUrl);
    // Update user context if available
    if (user) {
      user.avatarUrl = avatarUrl;
    }
  };

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
      const response = await authFetch(`${API_URL}/users/me`, {
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

  const updatePrivacy = async (changes) => {
    const next = { ...privacy, ...changes };
    setPrivacy(next);
    setPrivacyLoading(true);
    setPrivacyMessage(null);

    const result = await updateProfile({ privacy: next });

    if (result.success) {
      setPrivacyMessage({ type: 'success', text: 'Privacy settings saved' });
    } else {
      setPrivacyMessage({ type: 'error', text: result.error || 'Failed to save privacy settings' });
    }

    setPrivacyLoading(false);
  };

  const updateNotifPrefs = async (changes) => {
    const next = { ...notifPrefs, ...changes };
    setNotifPrefs(next);
    setNotifPrefsLoading(true);
    setNotifPrefsMessage(null);

    const result = await updateProfile({ notificationPreferences: next });

    if (result.success) {
      setNotifPrefsMessage({ type: 'success', text: 'Notification preferences saved' });
    } else {
      setNotifPrefsMessage({ type: 'error', text: result.error || 'Failed to save notification preferences' });
    }

    setNotifPrefsLoading(false);
  };

  const handleGenerateDiscordCode = async () => {
    setDiscordActionLoading(true);
    setDiscordMessage(null);
    try {
      const response = await authFetch(`${API_URL}/discord/link-code`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setDiscordCode(data.code);
        setDiscordCodeExpiresAt(data.expiresAt);
      } else {
        setDiscordMessage({ type: 'error', text: data.message || 'Failed to generate a link code' });
      }
    } catch (err) {
      setDiscordMessage({ type: 'error', text: 'Failed to generate a link code' });
    } finally {
      setDiscordActionLoading(false);
    }
  };

  const handleCopyDiscordCode = () => {
    if (!discordCode) return;
    navigator.clipboard?.writeText(discordCode);
  };

  const handleUnlinkDiscord = async () => {
    setDiscordActionLoading(true);
    setDiscordMessage(null);
    try {
      const response = await authFetch(`${API_URL}/discord/link`, { method: 'DELETE' });
      if (response.ok) {
        setDiscordLinked(false);
        setDiscordCode(null);
        setDiscordCodeExpiresAt(null);
        setDiscordMessage({ type: 'success', text: 'Discord account unlinked' });
      } else {
        const data = await response.json();
        setDiscordMessage({ type: 'error', text: data.message || 'Failed to unlink Discord account' });
      }
    } catch (err) {
      setDiscordMessage({ type: 'error', text: 'Failed to unlink Discord account' });
    } finally {
      setDiscordActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-gray-800 rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Account Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            &times;
          </button>
        </div>

        <div className="flex border-b border-gray-700">
          {['profile', 'password', 'privacy', 'notifications', 'discord', 'sessions', 'danger'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium ${
                activeTab === tab
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'danger' ? 'Danger Zone' : tab === 'privacy' ? 'Privacy & Sharing' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Avatar</label>
                <div className="flex items-center gap-4">
                  <UserAvatar avatarUrl={currentAvatarUrl} username={user?.username} size="lg" />
                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm"
                  >
                    <Camera size={16} />
                    Change Avatar
                  </button>
                </div>
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

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              {privacyMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  privacyMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-red-500/20 text-red-200'
                }`}>
                  {privacyMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{privacyMessage.text}</span>
                </div>
              )}

              <div className="p-4 bg-gray-700/50 rounded-lg space-y-1">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield size={14} /> Profile Visibility
                </h3>

                {/* Public Profile */}
                <div className="flex items-center justify-between py-2 border-b border-gray-600/50">
                  <div>
                    <div className="text-white text-sm font-medium">Public profile</div>
                    <div className="text-white/40 text-xs">Allow others to view your profile page</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePrivacy({ isPublic: !privacy.isPublic })}
                    disabled={privacyLoading}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${privacy.isPublic ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${privacy.isPublic ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Show Collection */}
                <div className="flex items-center justify-between py-2 border-b border-gray-600/50">
                  <div>
                    <div className="text-white text-sm font-medium">Show collection</div>
                    <div className="text-white/40 text-xs">Show your card collection on your public profile</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePrivacy({ showCollection: !privacy.showCollection })}
                    disabled={privacyLoading}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${privacy.showCollection ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${privacy.showCollection ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Show Decks */}
                <div className="flex items-center justify-between py-2 border-b border-gray-600/50">
                  <div>
                    <div className="text-white text-sm font-medium">Show decks</div>
                    <div className="text-white/40 text-xs">Show your decks on your public profile</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePrivacy({ showDecks: !privacy.showDecks })}
                    disabled={privacyLoading}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${privacy.showDecks ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${privacy.showDecks ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Show Wishlist */}
                <div className="flex items-center justify-between py-2 border-b border-gray-600/50">
                  <div>
                    <div className="text-white text-sm font-medium">Show wishlist</div>
                    <div className="text-white/40 text-xs">Show your wishlist on your public profile</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePrivacy({ showWishlist: !privacy.showWishlist })}
                    disabled={privacyLoading}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${privacy.showWishlist ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${privacy.showWishlist ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Show Forum */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-white text-sm font-medium">Show forum activity</div>
                    <div className="text-white/40 text-xs">Show your reputation, badges, and recent posts on your public profile</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePrivacy({ showForum: !privacy.showForum })}
                    disabled={privacyLoading}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${privacy.showForum ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${privacy.showForum ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {privacyLoading && (
                <p className="text-white/40 text-xs text-center">Saving…</p>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              {notifPrefsMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  notifPrefsMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-red-500/20 text-red-200'
                }`}>
                  {notifPrefsMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{notifPrefsMessage.text}</span>
                </div>
              )}

              <div className="p-4 bg-gray-700/50 rounded-lg space-y-1">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield size={14} /> Reports
                </h3>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-white text-sm font-medium">Weekly collection health report</div>
                    <div className="text-white/40 text-xs">
                      Get a weekly notification summarizing condition breakdown, value change, and cards worth a look
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateNotifPrefs({ healthReportEnabled: !notifPrefs.healthReportEnabled })}
                    disabled={notifPrefsLoading}
                    className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${notifPrefs.healthReportEnabled ? 'bg-purple-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${notifPrefs.healthReportEnabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {notifPrefsLoading && (
                <p className="text-white/40 text-xs text-center">Saving…</p>
              )}
            </div>
          )}

          {activeTab === 'discord' && (
            <div className="space-y-4">
              {discordMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  discordMessage.type === 'success'
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-red-500/20 text-red-200'
                }`}>
                  {discordMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span>{discordMessage.text}</span>
                </div>
              )}

              <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider flex items-center gap-2">
                  <Link2 size={14} /> Discord Bot
                </h3>

                <p className="text-white/60 text-sm">
                  Link your Discord account to look up cards, manage your collection, and get price alerts
                  right from Discord.
                </p>

                {!discordStatusLoading && discordLinked && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-300 text-sm">
                      <CheckCircle size={16} /> Discord account linked
                    </div>
                    <button
                      type="button"
                      onClick={handleUnlinkDiscord}
                      disabled={discordActionLoading}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Unlink size={16} />
                      {discordActionLoading ? 'Unlinking...' : 'Unlink'}
                    </button>
                  </div>
                )}

                {!discordStatusLoading && !discordLinked && (
                  <div className="space-y-3">
                    {discordCode ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="px-3 py-2 bg-gray-900 text-purple-300 text-lg font-mono rounded-lg tracking-widest">
                            {discordCode}
                          </code>
                          <button
                            type="button"
                            onClick={handleCopyDiscordCode}
                            title="Copy code"
                            className="p-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                        <p className="text-white/40 text-xs">
                          In Discord, run <code className="text-white/60">/link code:{discordCode}</code>
                          {discordCodeExpiresAt && (
                            <> — expires {new Date(discordCodeExpiresAt).toLocaleTimeString()}</>
                          )}
                        </p>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleGenerateDiscordCode}
                      disabled={discordActionLoading}
                      className="px-4 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Link2 size={16} />
                      {discordActionLoading ? 'Generating...' : discordCode ? 'Generate New Code' : 'Generate Link Code'}
                    </button>
                  </div>
                )}
              </div>
            </div>
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

      {/* Avatar Picker Modal */}
      <AvatarPicker
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        currentAvatarUrl={currentAvatarUrl}
        onSave={handleAvatarSave}
        apiUrl={API_URL}
      />
    </div>
  );
}

export default AccountSettings;
