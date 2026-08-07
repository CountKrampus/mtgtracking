import React, { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { AVATAR_PRESETS } from './presets';
import UserAvatar from './UserAvatar';

export default function AvatarPicker({ isOpen, onClose, currentAvatarUrl, onSave, apiUrl, disabled = false }) {
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Only JPEG and PNG images are allowed');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target.result);
      setError(null);
      setSelectedPreset(null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUpload = async () => {
    if (!uploadedImage) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/users/me/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mtg_access_token')}`
        },
        body: JSON.stringify({ imageData: uploadedImage })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to upload avatar');
      }

      const data = await response.json();
      onSave(data.avatarUrl);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreset = async () => {
    if (!selectedPreset) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mtg_access_token')}`
        },
        body: JSON.stringify({ avatarUrl: `preset:${selectedPreset}` })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update avatar');
      }

      const data = await response.json();
      onSave(data.avatarUrl);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete your avatar?')) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/users/me/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('mtg_access_token')}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete avatar');
      }

      onSave('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Choose Avatar</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white">Upload Image</h3>
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileSelect}
                disabled={loading}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Upload size={16} />
                Choose File
              </button>
              {uploadedImage && (
                <button
                  onClick={handleSaveUpload}
                  disabled={loading}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50"
                >
                  {loading ? 'Uploading...' : 'Save Upload'}
                </button>
              )}
            </div>
            {uploadedImage && (
              <div className="flex items-center gap-3">
                <img src={uploadedImage} alt="Preview" className="w-12 h-12 rounded-full object-cover" />
                <span className="text-sm text-slate-400">Preview</span>
              </div>
            )}
          </div>

          {/* Preset Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white">MTG Presets</h3>
            <div className="grid grid-cols-5 gap-3">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedPreset(preset.id);
                    setUploadedImage(null);
                  }}
                  className={`p-2 rounded-lg border-2 transition ${
                    selectedPreset === preset.id
                      ? 'border-purple-500 bg-purple-600/20'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                  title={preset.name}
                  disabled={loading}
                >
                  <UserAvatar avatarUrl={`preset:${preset.id}`} username={preset.name} size="lg" />
                </button>
              ))}
            </div>
            {selectedPreset && (
              <button
                onClick={handleSavePreset}
                disabled={loading}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Preset'}
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800 flex gap-2">
          {currentAvatarUrl && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm disabled:opacity-50"
            >
              Delete Avatar
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-2 text-slate-300 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
