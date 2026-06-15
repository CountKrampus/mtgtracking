import React, { useState, useEffect } from 'react';
import { Sliders } from 'lucide-react';

export default function SpamFilterAdmin({ apiUrl, isOpen, onClose }) {
  const [config, setConfig] = useState(null);
  const [sensitivity, setSensitivity] = useState('moderate');
  const [bannedWords, setBannedWords] = useState('');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        try {
          const response = await fetch(`${apiUrl}/admin/spam-config`);
          const data = await response.json();
          setConfig(data);
          setSensitivity(data.sensitivity);
          setBannedWords(data.bannedWords.join('\n'));
        } catch (error) {
          console.error('Error fetching config:', error);
        }
      };
      fetchConfig();
    }
  }, [isOpen, apiUrl]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={24} />
          <h2 className="text-xl font-bold text-white">Spam Filter Config</h2>
        </div>

        {config && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Sensitivity</label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value)}
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
              >
                <option value="strict">Strict</option>
                <option value="moderate">Moderate</option>
                <option value="lenient">Lenient</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">Banned Words</label>
              <textarea
                value={bannedWords}
                onChange={(e) => setBannedWords(e.target.value)}
                rows="4"
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white"
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
            >
              Save
            </button>

            <div className="border-t border-slate-600 pt-4">
              <h3 className="font-semibold text-white mb-2">Test Filter</h3>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Enter test text..."
                rows="3"
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white mb-2"
              />
              <button
                onClick={handleTest}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white mb-2"
              >
                Test
              </button>

              {testResult && (
                <div className={`p-3 rounded ${testResult.flagged ? 'bg-red-900 border border-red-700' : 'bg-green-900 border border-green-700'}`}>
                  <div className="text-white font-semibold mb-1">
                    {testResult.flagged ? 'Flagged' : 'Not Spam'}
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

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
