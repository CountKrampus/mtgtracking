import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

function CollectionBackupPanel() {
  const [cards, setCards] = useState(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const downloadBackup = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/export/json`);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mtg-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create a collection backup.');
    } finally {
      setLoading(false);
    }
  };

  const loadBackup = async (event) => {
    const file = event.target.files?.[0];
    setCards(null);
    setPreview(null);
    setResult(null);
    setError('');
    if (!file) return;

    setLoading(true);
    setFileName(file.name);
    try {
      const data = JSON.parse(await file.text());
      const backupCards = Array.isArray(data) ? data : data?.cards;
      if (!Array.isArray(backupCards) || backupCards.length === 0) {
        throw new Error('Choose a valid MTG Tracker JSON backup containing cards.');
      }
      setCards(backupCards);
      const response = await axios.post(`${API_URL}/cards/restore/preview`, { cards: backupCards });
      setPreview(response.data);
    } catch (requestError) {
      setCards(null);
      setPreview(null);
      setError(requestError.response?.data?.message || requestError.message || 'Could not read this backup.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const restoreMissing = async () => {
    if (!cards || !preview) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await axios.post(`${API_URL}/cards/restore/merge`, {
        cards,
        confirmation: 'MERGE_MISSING',
      });
      setResult(response.data);
      if (!response.data.failed?.length) {
        setCards(null);
        setPreview(null);
        setFileName('');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not restore this backup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-6 p-4 bg-white/5 border border-white/15 rounded-lg">
      <h3 className="text-white font-semibold mb-2">Collection backup</h3>
      <p className="text-white/60 text-sm mb-4">
        Download a backup file and keep it somewhere safe. Restoring only adds cards missing from your collection;
        existing cards are never overwritten or deleted.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={downloadBackup}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
        >
          {loading ? 'Working…' : 'Download backup'}
        </button>
        <label className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium cursor-pointer">
          Choose backup to restore
          <input type="file" accept=".json,application/json" onChange={loadBackup} className="sr-only" disabled={loading} />
        </label>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {preview && (
        <div className="mt-4 p-3 bg-slate-900/60 border border-white/10 rounded-lg">
          <p className="text-white font-medium truncate">{fileName}</p>
          <p className="mt-1 text-sm text-white/65">
            {preview.toAdd} missing entries ({preview.copiesToAdd} card copies) will be added.
            {' '}{preview.alreadyOwned} existing entries will be left unchanged.
          </p>
          {preview.toAdd > 0 ? (
            <button
              onClick={restoreMissing}
              disabled={loading}
              className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {loading ? 'Restoring…' : `Add ${preview.toAdd} missing cards`}
            </button>
          ) : (
            <p className="mt-3 text-sm text-green-300">Your collection already contains every entry in this backup.</p>
          )}
        </div>
      )}
      {result && (
        <div role="status" className="mt-3 p-3 bg-green-900/30 border border-green-700/50 rounded text-sm text-green-200">
          {result.message}
          {result.failed?.length > 0 && (
            <>
              <ul className="mt-2 list-disc list-inside text-amber-200">
                {result.failed.map((item, index) => <li key={`${item.name}-${index}`}>{item.name}: {item.message}</li>)}
              </ul>
              <button onClick={restoreMissing} disabled={loading} className="mt-2 underline hover:text-white">
                Retry failed cards
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default CollectionBackupPanel;
