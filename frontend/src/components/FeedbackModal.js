import React, { useState } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

function FeedbackModal({ onClose }) {
  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/feedback`, {
        message: message.trim(),
        category,
        pageUrl: window.location.pathname,
        userAgent: navigator.userAgent,
      });
      alert('Thanks for the feedback!');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Send Feedback</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="bug">Bug</option>
              <option value="feature">Feature request</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="What's on your mind?"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold transition"
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default FeedbackModal;
