import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

function DeckImport({ onBack, onImportComplete }) {
  const [importSource, setImportSource] = useState('text');
  const [importData, setImportData] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!importData.trim()) {
      alert('Please enter a deck list or URL');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/decks/import`, {
        source: importSource,
        data: importData
      });

      const { deckData, statistics, validation } = response.data;

      if (validation.errors.length > 0) {
        alert('Deck validation errors:\n' + validation.errors.join('\n'));
      }
      if (validation.warnings.length > 0) {
        alert('Deck validation warnings:\n' + validation.warnings.join('\n'));
      }

      await axios.post(`${API_URL}/decks`, {
        ...deckData,
        statistics
      });

      alert('Deck imported successfully!');
      setImportData('');
      onImportComplete();
    } catch (error) {
      alert('Error importing deck: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/30">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Import Commander Deck</h2>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
        >
          ← Back to Decks
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-white/80 mb-2">Import Source</label>
        <div className="flex gap-2">
          {['text', 'moxfield', 'archidekt'].map(source => (
            <button
              key={source}
              onClick={() => setImportSource(source)}
              className={`px-4 py-2 rounded-lg transition capitalize ${
                importSource === source
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {source === 'text' ? 'Text List' : source}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-white/80 mb-2">
          {importSource === 'text' ? 'Paste Deck List' : 'Enter Deck URL'}
        </label>
        <textarea
          value={importData}
          onChange={(e) => setImportData(e.target.value)}
          placeholder={
            importSource === 'text'
              ? 'Commander:\n1 Atraxa, Praetors\' Voice\n\nDeck:\n1 Sol Ring\n1 Command Tower\n...'
              : `https://${importSource}.com/decks/...`
          }
          className="w-full h-64 px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono text-sm"
        />
      </div>

      <button
        onClick={handleImport}
        disabled={loading}
        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:bg-gray-600"
      >
        {loading ? 'Importing...' : 'Import & Validate Deck'}
      </button>
    </div>
  );
}

export default DeckImport;
