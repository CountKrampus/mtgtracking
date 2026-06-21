import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function PostComposer({ threadId, apiUrl, user, onPostCreated }) {
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('mtg_access_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${apiUrl}/forum/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          threadId,
          body,
          bodyFormat: 'markdown'
        })
      });

      if (response.ok) {
        const newPost = await response.json();
        onPostCreated(newPost);
        setBody('');
      } else {
        const data = await response.json().catch(() => ({}));
        const msg = data.message || `Error ${response.status}: failed to post reply`;
        setError(msg);
        console.error('Error creating post:', msg);
      }
    } catch (error) {
      const msg = 'Network error — could not post reply';
      setError(msg);
      console.error('Error creating post:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 p-4 rounded border border-slate-700">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        rows="4"
        className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white mb-3"
      />
      {error && (
        <p className="text-red-400 text-sm mb-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white"
      >
        <Send size={16} />
        {loading ? 'Posting...' : 'Post Reply'}
      </button>
    </form>
  );
}
