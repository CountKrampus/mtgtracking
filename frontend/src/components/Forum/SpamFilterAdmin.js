import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';

export default function SpamFilterAdmin({ apiUrl = 'http://localhost:5000/api' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);

  // Config state
  const [isEnabled, setIsEnabled] = useState(true);
  const [enableRepCheck, setEnableRepCheck] = useState(false);
  const [maxLinksPerPost, setMaxLinksPerPost] = useState(3);
  const [maxCapitalLettersRatio, setMaxCapitalLettersRatio] = useState(0.5);
  const [minPostLength, setMinPostLength] = useState(10);
  const [minRepToBypassSpamCheck, setMinRepToBypassSpamCheck] = useState(100);
  const [spamKeywords, setSpamKeywords] = useState('');
  const [blockedDomains, setBlockedDomains] = useState('');

  // Test section state
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Flagged posts state
  const [flaggedPosts, setFlaggedPosts] = useState([]);
  const [flaggedLoading, setFlaggedLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/forum/admin/spam-config`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setIsEnabled(data.isEnabled ?? true);
        setEnableRepCheck(data.enableRepCheck ?? false);
        setMaxLinksPerPost(data.maxLinksPerPost ?? 3);
        setMaxCapitalLettersRatio(data.maxCapitalLettersRatio ?? 0.5);
        setMinPostLength(data.minPostLength ?? 10);
        setMinRepToBypassSpamCheck(data.minRepToBypassSpamCheck ?? 100);
        setSpamKeywords(Array.isArray(data.spamKeywords) ? data.spamKeywords.join(', ') : '');
        setBlockedDomains(Array.isArray(data.blockedDomains) ? data.blockedDomains.join(', ') : '');
      } catch (err) {
        setError('Failed to load spam filter configuration.');
        console.error('Error fetching spam config:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchFlaggedPosts = async () => {
      setFlaggedLoading(true);
      try {
        const response = await fetch(`${apiUrl}/forum/admin/flagged-posts`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setFlaggedPosts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching flagged posts:', err);
        setFlaggedPosts([]);
      } finally {
        setFlaggedLoading(false);
      }
    };

    fetchConfig();
    fetchFlaggedPosts();
  }, [apiUrl]);

  const handleSaveConfig = async () => {
    setSaveMessage(null);
    try {
      const response = await fetch(`${apiUrl}/forum/admin/spam-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled,
          enableRepCheck,
          maxLinksPerPost: parseInt(maxLinksPerPost, 10),
          maxCapitalLettersRatio: parseFloat(maxCapitalLettersRatio),
          minPostLength: parseInt(minPostLength, 10),
          minRepToBypassSpamCheck: parseInt(minRepToBypassSpamCheck, 10),
          spamKeywords: spamKeywords.split(',').map(w => w.trim()).filter(Boolean),
          blockedDomains: blockedDomains.split(',').map(d => d.trim()).filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSaveMessage({ type: 'success', text: 'Configuration saved successfully.' });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to save configuration.' });
      setTimeout(() => setSaveMessage(null), 4000);
      console.error('Error saving spam config:', err);
    }
  };

  const handleTest = async () => {
    if (!testText.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${apiUrl}/forum/admin/spam-config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      setTestResult({ flagged: false, error: 'Failed to run test.' });
      console.error('Error testing spam filter:', err);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400 py-8 text-center">Loading spam filter config...</div>;
  }

  if (error) {
    return <div className="text-red-400 py-8 text-center">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield size={24} className="text-blue-400" />
        <h2 className="text-xl font-bold text-white">Spam Filter Configuration</h2>
      </div>

      {/* Config Card */}
      <div className="bg-slate-800/50 p-4 rounded border border-slate-700 space-y-5">

        {/* isEnabled toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Enable Spam Filter</div>
            <div className="text-xs text-slate-400">Actively filter posts for spam content</div>
          </div>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            role="switch"
            aria-checked={isEnabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isEnabled ? 'bg-purple-600' : 'bg-slate-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* enableRepCheck toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Enable Reputation Check</div>
            <div className="text-xs text-slate-400">Skip spam check for high-reputation users</div>
          </div>
          <button
            onClick={() => setEnableRepCheck(!enableRepCheck)}
            role="switch"
            aria-checked={enableRepCheck}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enableRepCheck ? 'bg-purple-600' : 'bg-slate-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableRepCheck ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Numeric inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-white mb-1">Max Links Per Post</label>
            <input
              type="number"
              min="0"
              value={maxLinksPerPost}
              onChange={e => setMaxLinksPerPost(e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-1">Max Capital Letters Ratio</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={maxCapitalLettersRatio}
              onChange={e => setMaxCapitalLettersRatio(e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">0 to 1 (e.g. 0.5 = 50% caps)</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-1">Min Post Length</label>
            <input
              type="number"
              min="0"
              value={minPostLength}
              onChange={e => setMinPostLength(e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Characters</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-1">Min Rep to Bypass Check</label>
            <input
              type="number"
              min="0"
              value={minRepToBypassSpamCheck}
              onChange={e => setMinRepToBypassSpamCheck(e.target.value)}
              disabled={!enableRepCheck}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm disabled:opacity-50"
            />
            <p className="text-xs text-slate-400 mt-1">Requires reputation check enabled</p>
          </div>
        </div>

        {/* Spam Keywords */}
        <div>
          <label className="block text-sm font-semibold text-white mb-1">Spam Keywords</label>
          <textarea
            value={spamKeywords}
            onChange={e => setSpamKeywords(e.target.value)}
            rows={3}
            placeholder="casino, buy now, click here, free money"
            className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm font-mono resize-none"
          />
          <p className="text-xs text-slate-400 mt-1">Comma-separated list of keywords to flag</p>
        </div>

        {/* Blocked Domains */}
        <div>
          <label className="block text-sm font-semibold text-white mb-1">Blocked Domains</label>
          <textarea
            value={blockedDomains}
            onChange={e => setBlockedDomains(e.target.value)}
            rows={3}
            placeholder="spam-site.com, phishing-example.net"
            className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm font-mono resize-none"
          />
          <p className="text-xs text-slate-400 mt-1">Comma-separated list of domains to block</p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSaveConfig}
          className="w-full px-4 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white font-semibold transition"
        >
          Save Config
        </button>

        {/* Save message */}
        {saveMessage && (
          <div className={`text-sm text-center py-2 rounded ${saveMessage.type === 'success' ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'}`}>
            {saveMessage.text}
          </div>
        )}
      </div>

      {/* Test Spam Detection */}
      <div className="bg-slate-800/50 p-4 rounded border border-slate-700 space-y-3">
        <h3 className="font-semibold text-white">Test Spam Detection</h3>
        <textarea
          value={testText}
          onChange={e => setTestText(e.target.value)}
          placeholder="Enter post text to test against the spam filter..."
          rows={4}
          className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm resize-none"
        />
        <button
          onClick={handleTest}
          disabled={!testText.trim() || testing}
          className="px-4 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-white font-semibold transition"
        >
          {testing ? 'Testing...' : 'Test Post'}
        </button>

        {testResult && (
          <div className={`p-3 rounded border ${testResult.flagged ? 'bg-red-900/30 border-red-700' : 'bg-green-900/30 border-green-700'}`}>
            <div className="flex items-center gap-2 mb-2">
              {testResult.flagged ? (
                <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">SPAM DETECTED</span>
              ) : (
                <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded">Clean</span>
              )}
            </div>
            {testResult.error && (
              <div className="text-red-400 text-sm">{testResult.error}</div>
            )}
            {testResult.flagged && Array.isArray(testResult.reasons) && testResult.reasons.length > 0 && (
              <ul className="text-sm text-slate-200 space-y-0.5 mt-1">
                {testResult.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Recent Flagged Posts */}
      <div className="bg-slate-800/50 p-4 rounded border border-slate-700 space-y-3">
        <h3 className="font-semibold text-white">Recent Flagged Posts</h3>
        {flaggedLoading ? (
          <div className="text-slate-400 text-sm">Loading flagged posts...</div>
        ) : flaggedPosts.length === 0 ? (
          <div className="text-slate-400 text-sm">No recently flagged posts</div>
        ) : (
          <div className="space-y-2">
            {flaggedPosts.map((post, i) => (
              <div key={post._id || i} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80 truncate">
                      {(post.content || post.text || '').slice(0, 100)}
                      {(post.content || post.text || '').length > 100 && '...'}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>
                        {post.userId?.displayName || post.userId?.username || post.username || 'Unknown User'}
                      </span>
                      <span className="text-yellow-500">{post.flagReason || post.reason || 'Flagged'}</span>
                      {post.createdAt && (
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => console.log('Review flagged post:', post._id)}
                    className="flex-shrink-0 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded text-xs font-semibold transition"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
