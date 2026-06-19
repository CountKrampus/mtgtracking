import React, { useState } from 'react';
import { Download, Database, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-purple-400" />
        <h3 className="text-white font-semibold text-lg">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SuccessAlert({ message }) {
  return (
    <div className="flex items-start gap-2 bg-green-900/40 border border-green-700 rounded-lg p-3 mt-3">
      <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
      <span className="text-green-300 text-sm">{message}</span>
    </div>
  );
}

function ErrorAlert({ message }) {
  return (
    <div className="flex items-start gap-2 bg-red-900/40 border border-red-700 rounded-lg p-3 mt-3">
      <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
      <span className="text-red-300 text-sm">{message}</span>
    </div>
  );
}

export function BackupsExportsTab() {
  const { authFetch } = useAuthContext();

  // Export state
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  // Backup state
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [sessionBackups, setSessionBackups] = useState([]);

  // Restore state
  const [backupId, setBackupId] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState(null);

  const handleExportJson = async () => {
    setExportLoading(true);
    setExportError('');
    try {
      const response = await authFetch(`${API_URL}/admin/export`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'collection-export.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setExportError(data.message || 'Export failed');
      }
    } catch (err) {
      setExportError('Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportCsv = () => {
    window.open(`${API_URL}/export/csv`, '_blank');
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    setBackupError('');
    try {
      const response = await authFetch(`${API_URL}/admin/backup`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setSessionBackups(prev => [
          {
            id: data.id,
            message: data.message,
            cardCount: data.cardCount,
            size: data.size,
            timestamp: new Date().toLocaleString(),
          },
          ...prev,
        ]);
      } else {
        setBackupError(data.message || 'Backup failed');
      }
    } catch (err) {
      setBackupError('Backup failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoreLoading(true);
    setRestoreError('');
    setRestoreSuccess(null);
    try {
      const response = await authFetch(`${API_URL}/admin/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId, confirm: 'RESTORE' }),
      });
      const data = await response.json();
      if (response.ok) {
        setRestoreSuccess(data);
        setBackupId('');
        setConfirmText('');
      } else {
        setRestoreError(data.message || 'Restore failed');
      }
    } catch (err) {
      setRestoreError('Restore failed');
    } finally {
      setRestoreLoading(false);
    }
  };

  const restoreEnabled = backupId.trim() !== '' && confirmText === 'RESTORE';

  return (
    <div className="space-y-6">

      {/* Section 1: Export Collection */}
      <SectionCard title="Export Collection" icon={Download}>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportJson}
            disabled={exportLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            {exportLoading ? 'Exporting...' : 'Export Collection (JSON)'}
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Export Collection (CSV)
          </button>
        </div>
        {exportError && <ErrorAlert message={exportError} />}
      </SectionCard>

      {/* Section 2: Create Backup */}
      <SectionCard title="Create Backup" icon={Database}>
        <button
          onClick={handleCreateBackup}
          disabled={backupLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Database size={16} />
          {backupLoading ? 'Creating Backup...' : 'Create Backup'}
        </button>

        <p className="text-gray-400 text-xs mt-3">
          Note: Backups are in-memory and reset on server restart.
        </p>

        {backupError && <ErrorAlert message={backupError} />}

        {sessionBackups.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-gray-300 text-sm font-medium">Backups Created This Session</h4>
            {sessionBackups.map((b) => (
              <div key={b.id} className="bg-gray-700/60 border border-gray-600 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-green-300 text-sm font-medium">{b.message || 'Backup created'}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                  <span><span className="text-gray-300">Backup ID:</span> {b.id}</span>
                  <span><span className="text-gray-300">Cards:</span> {b.cardCount}</span>
                  <span><span className="text-gray-300">Size:</span> {b.size}</span>
                  <span><span className="text-gray-300">Created:</span> {b.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Section 3: Restore from Backup */}
      <SectionCard title="Restore from Backup" icon={RotateCcw}>
        <div className="flex items-start gap-2 bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4">
          <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
          <span className="text-yellow-300 text-sm">
            This will overwrite your entire collection. This action cannot be undone.
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Backup ID</label>
            <input
              type="text"
              value={backupId}
              onChange={(e) => setBackupId(e.target.value)}
              placeholder="Enter backup ID"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">
              Type <span className="font-mono text-yellow-300">RESTORE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESTORE"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={handleRestore}
            disabled={!restoreEnabled || restoreLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RotateCcw size={16} />
            {restoreLoading ? 'Restoring...' : 'Restore from Backup'}
          </button>
        </div>

        {restoreError && <ErrorAlert message={restoreError} />}
        {restoreSuccess && (
          <SuccessAlert
            message={`${restoreSuccess.message || 'Restore successful.'} ${restoreSuccess.cardCount !== undefined ? `${restoreSuccess.cardCount} cards restored.` : ''}`}
          />
        )}
      </SectionCard>

    </div>
  );
}

export default BackupsExportsTab;
