import React, { useState, useEffect, useRef } from 'react';
import { X, Loader } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';
import DuplicateDetectionModal from './DuplicateDetectionModal';

const BUG_REPORT_TEMPLATE = `**What happened?**


**Steps to reproduce:**
1. 
2. 
3. 

**Expected behavior:**


**Actual behavior:**


**Screenshots or error messages (if any):**

`;

const FEATURE_REQUEST_TEMPLATE = `**What would you like to see added?**


**What problem would this solve, or what's the use case?**


**Any additional context or examples?**

`;

const SITE_AREAS = [
  'Collection', 'Deck Builder', 'Wishlist', 'Trading Board', 'Forum',
  'Life Counter', 'Commanders', 'Sets', 'Combos', 'Finance', 'Scan Card',
  'Admin Panel', 'Other'
];

function findCategorySlug(categoryTree, categoryId) {
  if (!categoryId) return null;
  const idStr = categoryId.toString();
  for (const node of categoryTree) {
    if (node._id === idStr) return node.slug;
    if (node.children) {
      for (const child of node.children) {
        if (child._id === idStr) return child.slug;
      }
    }
  }
  return null;
}

export default function ThreadComposer({ isOpen, onClose, categoryId, apiUrl = API_URL, user, onThreadCreated, categoryIsQA = false }) {
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
  const [isQA, setIsQA] = useState(categoryIsQA);
  const [templateCategoryType, setTemplateCategoryType] = useState(null); // 'bug' | 'feature' | null, frozen once determined per open
  const [reportArea, setReportArea] = useState(''); // '' | 'main-site' | 'discord-bot'
  const [reportSiteSection, setReportSiteSection] = useState('');
  const templateCheckedRef = useRef(false);

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

  useEffect(() => { setIsQA(categoryIsQA); }, [categoryIsQA]);

  useEffect(() => {
    if (!isOpen) {
      templateCheckedRef.current = false;
      setTemplateCategoryType(null);
      setReportArea('');
      setReportSiteSection('');
      return;
    }
    if (templateCheckedRef.current) return;
    if (categories.length === 0) return; // wait for categories to finish loading

    const slug = findCategorySlug(categories, categoryId);
    templateCheckedRef.current = true;

    if (slug === 'bug-reports') {
      setTemplateCategoryType('bug');
      setContent(prev => (prev.trim() ? prev : BUG_REPORT_TEMPLATE));
    } else if (slug === 'feature-requests') {
      setTemplateCategoryType('feature');
      setContent(prev => (prev.trim() ? prev : FEATURE_REQUEST_TEMPLATE));
    }
  }, [isOpen, categories, categoryId]);

  const buildAreaLine = () => {
    if (reportArea === 'discord-bot') return '**Area:** Discord Bot';
    if (reportArea === 'main-site' && reportSiteSection) return `**Area:** Main Site — ${reportSiteSection}`;
    if (reportArea === 'main-site') return '**Area:** Main Site';
    return null;
  };

  const buildAreaTags = () => {
    if (reportArea === 'discord-bot') return ['discord-bot'];
    if (reportArea === 'main-site') {
      const areaTags = ['main-site'];
      if (reportSiteSection) {
        areaTags.push(reportSiteSection.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
      }
      return areaTags;
    }
    return [];
  };

  const handleCreateThread = async () => {
    if (!title.trim() || !content.trim() || !selectedCategoryId) {
      setError('Title, content, and category are required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const areaLine = buildAreaLine();
      const finalContent = areaLine ? `${areaLine}\n\n${content.trim()}` : content.trim();
      const userTags = tags.split(',').map(t => t.trim()).filter(t => t);
      const finalTags = [...new Set([...userTags, ...buildAreaTags()])];

      const response = await axios.post(`${apiUrl}/forum/threads`, {
        categoryId: selectedCategoryId,
        title: title.trim(),
        content: finalContent,
        tags: finalTags,
        contentFormat: 'markdown',
        isQA
      });

      const threadData = response.data;
      const duplicates = threadData.suggestedDuplicates;

      // The API returns { thread, suggestedDuplicates } — extract the thread object
      const newThread = threadData.thread || threadData;

      if (duplicates && duplicates.length > 0) {
        const threadId = newThread._id;
        setCreatedThread(newThread);
        setNewThreadId(threadId);
        setSuggestedDuplicates(duplicates);
        setShowDuplicateModal(true);
      } else {
        onThreadCreated?.(newThread);
        setTitle('');
        setContent('');
        setTags('');
        setReportArea('');
        setReportSiteSection('');
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
    // createdThread is already the unwrapped thread object
    onThreadCreated?.(createdThread);
    setTitle('');
    setContent('');
    setTags('');
    setReportArea('');
    setReportSiteSection('');
    onClose();
  };

  const handleMergeRequest = () => {
    setShowDuplicateModal(false);
    // createdThread is already the unwrapped thread object
    onThreadCreated?.(createdThread);
    setTitle('');
    setContent('');
    setTags('');
    setReportArea('');
    setReportSiteSection('');
    onClose();
  };

  const handleCancel = () => {
    setTitle('');
    setContent('');
    setTags('');
    setReportArea('');
    setReportSiteSection('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4 pb-16 sm:pb-0">
      <div className="bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900">
          <h2 className="text-xl font-bold text-white">Create New Thread</h2>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
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

          {/* Bug report / feature request area selector */}
          {templateCategoryType && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">Where does this apply?</label>
              <select
                value={reportArea}
                onChange={(e) => { setReportArea(e.target.value); setReportSiteSection(''); }}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">Select...</option>
                <option value="main-site">Main Site</option>
                <option value="discord-bot">Discord Bot</option>
              </select>
              {reportArea === 'main-site' && (
                <select
                  value={reportSiteSection}
                  onChange={(e) => setReportSiteSection(e.target.value)}
                  className="w-full p-3 mt-2 bg-slate-800 border border-slate-700 rounded text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Which part of the site?</option>
                  {SITE_AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              )}
            </div>
          )}

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

          {/* Q&A toggle (new threads only) */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setIsQA(v => !v)}
              className={`relative w-9 h-5 rounded-full transition ${isQA ? 'bg-green-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isQA ? 'left-4' : 'left-0.5'}`} />
            </div>
            <span className="text-white/60 text-sm">This is a question (Q&amp;A format)</span>
            {isQA && <span className="text-green-400 text-xs">❓ Q&amp;A</span>}
          </label>

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
