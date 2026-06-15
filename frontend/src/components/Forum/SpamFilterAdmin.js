import React, { useState, useEffect } from 'react';
import { Sliders } from 'lucide-react';

export default function SpamFilterAdmin({ apiUrl = 'http://localhost:5000/api' }) {
  const [config, setConfig] = useState(null);
  const [sensitivity, setSensitivity] = useState('moderate');
  const [bannedWords, setBannedWords] = useState('');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${apiUrl}/admin/spam-config`);
        const data = await response.json();
        setConfig(data);
        setSensitivity(data.sensitivity);
        setBannedWords(data.bannedWords.join('\n'));
      } catch (error) {
        console.error('Error fetching config:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [apiUrl]);

  const handleSave = async () => {
    try {
      await fetch(`${apiUrl}/admin/spam-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensitivity,
          bannedWords: bannedWords.split('\n').filter(w => w.trim())
        })
      });
      alert('Config updated');
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleTest = async () => {
    if (!testText.trim()) return;
    try {
      const response = await fetch(`${apiUrl}/admin/spam-config/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText })
      });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      console.error('Error testing:', error);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Loading spam filter config...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sliders size={24} className="text-blue-400" />
        <h2 className="text-xl font-bold text-white">Spam Filter Configuration</h2>
      </div>

      {config && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 p-4 rounded border border-slate-700 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Sensitivity Level</label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
              >
                <option value="strict">Strict - Aggressive filtering</option>
                <option value="moderate">Moderate - Balanced (default)</option>
                <option value="lenient">Lenient - Permissive filtering</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Higher sensitivity blocks more potentially problematic content</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">Banned Words (one per line)</label>
              <textarea
                value={bannedWords}
                onChange={(e) => setBannedWords(e.target.value)}
                rows="4"
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white font-mono text-sm"
                placeholder="Enter banned words, one per line..."
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-semibold"
            >
              Save Configuration
            </button>
          </div>

          <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
            <h3 className="font-semibold text-white mb-3">Test Spam Filter</h3>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Enter test text to check against spam filter..."
              rows="3"
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white mb-3"
            />
            <button
              onClick={handleTest}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold"
            >
              Test Text
            </button>

            {testResult && (
              <div className={`mt-3 p-3 rounded border ${testResult.flagged ? 'bg-red-900/30 border-red-700' : 'bg-green-900/30 border-green-700'}`}>
                <div className={`font-semibold mb-1 ${testResult.flagged ? 'text-red-400' : 'text-green-400'}`}>
                  {testResult.flagged ? '🚫 Flagged as Spam' : '✅ Not Spam'}
                </div>
                {testResult.reasons.length > 0 && (
                  <ul className="text-sm text-slate-200">
                    {testResult.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
