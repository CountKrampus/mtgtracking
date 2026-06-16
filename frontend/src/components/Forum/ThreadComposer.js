import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';
import DuplicateDetectionModal from './DuplicateDetectionModal';

export default function ThreadComposer({ isOpen, onClose, categoryId, apiUrl = API_URL, user, onThreadCreated }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [suggestedDuplicates, setSuggestedDuplicates] = useState([]);
  const [newThreadId, setNewThreadId] = useState(null);
  const [createdThread, setCreatedThread] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${apiUrl}/forum/categories`);
        setCategories(response.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, apiUrl]);

  useEffect(() => {
    setSelectedCategoryId(categoryId);
  }, [categoryId]);

  const handleCreateThread = async () => {
    if (!title.trim() || !content.trim() || !selectedCategoryId) {
      setError('Title, content, and category are required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const response = await axios.post(`${apiUrl}/forum/threads`, {
        categoryId: selectedCategoryId,
        title: title.trim(),
        content: content.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        contentFormat: 'markdown'
      });

      const threadData = response.data;
      const duplicates = threadData.suggestedDuplicates;

      if (duplicates && duplicates.length > 0) {
        const threadId = threadData._id || threadData.thread?._id;
        setCreatedThread(threadData);
        setNewThreadId(threadId);
        setSuggestedDuplicates(duplicates);
        setShowDuplicateModal(true);
      } else {
        onThreadCreated?.(threadData);
        setTitle('');
        setContent('');
        setTags('');
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicateModalClose = () => {
    setShowDuplicateModal(false);
    onThreadCreated?.(createdThread);
    setTitle('');
    setContent('');
    setTags('');
    onClose();
  };

  const handleMergeRequest = () => {
    setShowDuplicateModal(false);
    onThreadCreated?.(createdThread);
    setTitle('');
    setContent('');
    setTags('');
    onClose();
  };

  const handleCancel = () => {
    setTitle('');
    setContent('');
    setTags('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <h2 className="text-xl font-bold text-white">Create New Thread</h2>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Category *</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => [
                // Add parent category as an option
                <option key={`parent-${cat._id}`} value={cat._id}>
                  {cat.name}
                </option>,
                // Add child categories in an optgroup
                ...(cat.children && cat.children.length > 0 ? [
                  <optgroup key={`group-${cat._id}`} label={`${cat.name} Sub-categories`}>
                    {cat.children.map((child) => (
                      <option key={child._id} value={child._id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ] : [])
              ])}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title..."
              maxLength={200}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <div className="text-xs text-slate-500 mt-1">{title.length}/200</div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your thread content here... (Markdown supported)"
              rows={8}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Tags (optional)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Separate tags with commas..."
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <div className="text-xs text-slate-500 mt-1">e.g. help, question, announcement</div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-600/20 border border-red-600/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-700">
            <button
              onClick={handleCancel}
              disabled={creating}
              className="px-6 py-2 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateThread}
              disabled={creating || !selectedCategoryId}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold transition disabled:opacity-50 flex items-center gap-2"
            >
              {creating && <Loader size={18} className="animate-spin" />}
              {creating ? 'Creating...' : 'Create Thread'}
            </button>
          </div>
        </div>
      </div>
    </div>
    <DuplicateDetectionModal
      isOpen={showDuplicateModal}
      onClose={handleDuplicateModalClose}
      suggestedDuplicates={suggestedDuplicates}
      newThreadId={newThreadId}
      onMergeRequest={handleMergeRequest}
    />
    </>
  );
}
