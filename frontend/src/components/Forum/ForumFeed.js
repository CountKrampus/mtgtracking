import React, { useState, useEffect } from 'react';
import { MessageSquare, User, Calendar, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';

export default function ForumFeed({ onSelectThread, onSelectPost }) {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const LIMIT = 20;

  useEffect(() => {
    fetchFeed(0);
  }, []);

  const fetchFeed = async (newOffset) => {
    try {
      const response = await axios.get(`${API_URL}/forum/feed`, {
        params: { limit: LIMIT, offset: newOffset }
      });

      if (newOffset === 0) {
        setFeedItems(response.data.items);
      } else {
        setFeedItems(prev => [...prev, ...response.data.items]);
      }

      setOffset(newOffset + LIMIT);
      setHasMore(newOffset + LIMIT < response.data.total);
      setLoading(false);
      setIsLoadingMore(false);
    } catch (err) {
      console.error('Error fetching feed:', err);
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    fetchFeed(offset);
  };

  const formatDate = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return then.toLocaleDateString();
  };

  const handleItemClick = (item) => {
    if (item.type === 'thread') {
      onSelectThread(item.id);
    } else {
      onSelectPost(item.threadId, item.id);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-white/60">Loading feed...</div>
      </div>
    );
  }

  if (feedItems.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare size={48} className="mx-auto text-white/20 mb-4" />
        <p className="text-white/60">No forum activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedItems.map((item) => (
        <button
          key={`${item.type}-${item.id}`}
          onClick={() => handleItemClick(item)}
          className="w-full text-left p-4 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 hover:border-purple-400/50 transition group"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-1">
              {item.type === 'thread' ? (
                <MessageSquare size={18} className="text-purple-400" />
              ) : (
                <MessageSquare size={18} className="text-blue-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {item.type === 'thread' ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-purple-300 bg-purple-500/30 px-2 py-0.5 rounded">
                      THREAD
                    </span>
                    {item.categoryId && (
                      <span className="text-xs text-white/60">{item.categoryId.name}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-purple-200 transition truncate">
                    {item.title}
                  </h3>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-blue-300 bg-blue-500/30 px-2 py-0.5 rounded">
                      REPLY
                    </span>
                    <span className="text-xs text-white/60">in {item.threadTitle}</span>
                  </div>
                </>
              )}

              {item.snippet && (
                <p className="text-white/70 text-sm line-clamp-2 mb-2">{item.snippet}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-white/50">
                {item.authorId && (
                  <div className="flex items-center gap-1">
                    <User size={14} />
                    <span>{item.authorId.displayName || item.authorId.username}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                {item.type === 'thread' && (
                  <div className="flex items-center gap-1">
                    <MessageSquare size={14} />
                    <span>{item.postCount} replies</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-lg font-semibold transition"
          >
            {isLoadingMore ? (
              <>Loading...</>
            ) : (
              <>
                <span>Load More</span>
                <ChevronDown size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
