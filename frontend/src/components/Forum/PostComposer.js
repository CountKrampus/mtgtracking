import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function PostComposer({ threadId, apiUrl, user, onPostCreated }) {
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/forum/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      }
    } catch (error) {
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
      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-white"
      >
        <Send size={16} />
        Post Reply
      </button>
    </form>
  );
}
