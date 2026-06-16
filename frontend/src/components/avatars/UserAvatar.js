import React from 'react';
import { AVATAR_PRESETS } from './presets';
import { API_URL } from '../../config';

export default function UserAvatar({ avatarUrl, username, size = 'md' }) {
  const sizeClass = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-2xl'
  }[size] || 'w-8 h-8 text-sm';

  // Handle preset avatars
  if (avatarUrl?.startsWith('preset:')) {
    const presetId = avatarUrl.replace('preset:', '');
    const preset = AVATAR_PRESETS.find(p => p.id === presetId);

    if (preset) {
      return (
        <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0`}>
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            {preset.svg.props.children}
          </svg>
        </div>
      );
    }
  }

  // Handle uploaded avatars
  if (avatarUrl && !avatarUrl.startsWith('preset:')) {
    // Construct full URL if relative URL
    const fullUrl = avatarUrl.startsWith('http') ? avatarUrl : `${API_URL.replace('/api', '')}${avatarUrl}`;
    return (
      <img
        src={fullUrl}
        alt={username || 'Avatar'}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  // Fallback: colored circle with initials
  const getInitial = () => {
    if (username) return username.charAt(0).toUpperCase();
    return '?';
  };

  const getColorClass = (name) => {
    if (!name) return 'bg-gray-500';
    const colors = [
      'bg-purple-600',
      'bg-blue-600',
      'bg-green-600',
      'bg-red-600',
      'bg-yellow-600',
      'bg-indigo-600',
      'bg-pink-600'
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div
      className={`${sizeClass} ${getColorClass(username)} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      title={username}
    >
      {getInitial()}
    </div>
  );
}
