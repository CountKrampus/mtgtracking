import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import UserProfile from './UserProfile';
import axios from 'axios';
import { API_URL } from '../config';
import ForumHome from './Forum/ForumHome';
import CategoryView from './Forum/CategoryView';
import ThreadView from './Forum/ThreadView';
import SpamFilterAdmin from './Forum/SpamFilterAdmin';
import MuteManager from './Forum/MuteManager';
import ForumProfilePage from './Forum/ForumProfilePage';
import ForumShop from './Forum/ForumShop';
import ForumLeaderboard from './Forum/ForumLeaderboard';

export default function ForumView() {
  const { user: authUser } = useAuthContext() || {};
  const navigate = useNavigate();

  const [forumCategories, setForumCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(() =>
    localStorage.getItem('forumSelectedCategory') || null
  );
  const [selectedThreadId, setSelectedThreadId] = useState(() =>
    localStorage.getItem('forumSelectedThread') || null
  );
  const [forumRefreshKey, setForumRefreshKey] = useState(0);
  const [cosmeticVersion, setCosmeticVersion] = useState(0);
  const [showForumLeaderboard, setShowForumLeaderboard] = useState(false);
  const [showSpamFilterAdmin, setShowSpamFilterAdmin] = useState(false);
  const [showMuteManager, setShowMuteManager] = useState(false);
  const [selectedForumProfileUsername, setSelectedForumProfileUsername] = useState(null);
  const [loadingForumCategories, setLoadingForumCategories] = useState(false);
  const [showForumShop, setShowForumShop] = useState(false);
  // forumProfileView: 'none' | 'own' | 'other'
  const [forumProfileView, setForumProfileView] = useState('none');

  const fetchForumCategories = async () => {
    setLoadingForumCategories(true);
    try {
      const response = await axios.get(`${API_URL}/forum/categories`);
      setForumCategories(response.data);
    } catch (error) {
      console.error('Error fetching forum categories:', error);
    } finally {
      setLoadingForumCategories(false);
    }
  };

  useEffect(() => {
    fetchForumCategories();
  }, []);

  // If viewing a forum profile, show that
  if (forumProfileView === 'own' && authUser) {
    return (
      <div className="flex flex-col h-full">
        <ForumProfilePage
          user={authUser}
          apiUrl={API_URL}
          onBack={() => setForumProfileView('none')}
        />
      </div>
    );
  }

  if (forumProfileView === 'other' && selectedForumProfileUsername) {
    return (
      <div className="flex flex-col h-full">
        <UserProfile
          username={selectedForumProfileUsername}
          onBack={() => setForumProfileView('none')}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        {showForumLeaderboard ? (
          <ForumLeaderboard
            onBack={() => setShowForumLeaderboard(false)}
          />
        ) : selectedThreadId ? (
          <ThreadView
            threadId={selectedThreadId}
            apiUrl={API_URL}
            user={authUser}
            refreshKey={cosmeticVersion}
            onBack={() => {
              setSelectedThreadId(null);
              localStorage.removeItem('forumSelectedThread');
            }}
            onThreadDeleted={() => setForumRefreshKey(k => k + 1)}
            onViewProfile={(username) => {
              setSelectedForumProfileUsername(username);
              setForumProfileView('other');
            }}
          />
        ) : selectedCategoryId ? (
          <CategoryView
            categoryId={selectedCategoryId}
            apiUrl={API_URL}
            onThreadSelect={(threadId) => {
              setSelectedThreadId(threadId);
              localStorage.setItem('forumSelectedThread', threadId);
            }}
            onBack={() => {
              setSelectedCategoryId(null);
              localStorage.removeItem('forumSelectedCategory');
            }}
            user={authUser}
            onViewProfile={(username) => {
              setSelectedForumProfileUsername(username);
              setForumProfileView('other');
            }}
            refreshKey={forumRefreshKey}
          />
        ) : (
          <ForumHome
            onSelectCategory={(catId) => {
              setSelectedCategoryId(catId);
              localStorage.setItem('forumSelectedCategory', catId);
            }}
            onNewThread={() => {}}
            onOpenAdmin={() => {
              setShowSpamFilterAdmin(true);
            }}
            authUser={authUser}
            onForumProfile={() => setForumProfileView('own')}
            onLeaderboard={() => setShowForumLeaderboard(true)}
            refreshKey={forumRefreshKey}
          />
        )}
      </div>

      {/* Forum Admin Modals */}
      {showSpamFilterAdmin && (
        <SpamFilterAdmin
          apiUrl={API_URL}
          isOpen={showSpamFilterAdmin}
          onClose={() => setShowSpamFilterAdmin(false)}
        />
      )}

      {showMuteManager && (
        <MuteManager
          apiUrl={API_URL}
          isOpen={showMuteManager}
          onClose={() => setShowMuteManager(false)}
        />
      )}

      {showForumShop && (
        <ForumShop
          apiUrl={API_URL}
          user={authUser}
          isOpen={showForumShop}
          onClose={() => setShowForumShop(false)}
          onEquip={() => setCosmeticVersion(v => v + 1)}
        />
      )}
    </div>
  );
}
