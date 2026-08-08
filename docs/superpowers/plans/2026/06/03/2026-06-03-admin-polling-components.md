# Admin Components with Auto-Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 new admin components (Tasks 20-24) with automatic 2-second polling for async job status, plus refactor SystemHealthTab to extract settings into a separate component.

**Architecture:** Each async job component follows a unified polling pattern:
1. User triggers async job via button
2. Button click starts the job via API POST endpoint and immediately begins polling
3. Poll every 2 seconds via GET endpoint checking `{status, progress, results}`
4. Display real-time progress bar and status message
5. Auto-stop polling when status becomes 'complete' or 'failed'
6. Show final results or error state

SystemHealthTab refactored to remove settings section; settings extracted to new SettingsTab.js component.

**Tech Stack:** React hooks (useState, useEffect, useRef), Lucide icons, Tailwind CSS, authFetch from AuthContext

---

## File Structure

**Creating:**
- `frontend/src/components/admin/data-pricing/PricingAdminTab.js` - Task 20: Scryfall price validations
- `frontend/src/components/admin/data-pricing/CollectionAuditsTab.js` - Task 21: Collection data audits
- `frontend/src/components/admin/data-pricing/BackupsExportsTab.js` - Task 22: Backup/export operations
- `frontend/src/components/admin/data-pricing/DataCleanupTab.js` - Task 23: Data cleanup jobs
- `frontend/src/components/admin/data-pricing/SettingsTab.js` - New: Extracted settings from SystemHealth

**Modifying:**
- `frontend/src/components/admin/AdminPanel.js` - Add new tabs to data-pricing group
- `frontend/src/components/admin/data-pricing/SystemHealthTab.js` - Remove settings section, keep only health stats

---

## Task 1: Create Reusable Polling Hook

A custom hook to encapsulate the polling logic reduces code duplication across all 5 components.

**Files:**
- Create: `frontend/src/components/admin/data-pricing/useJobPoller.js`

- [ ] **Step 1: Write the custom hook with polling logic**

```javascript
import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for managing async jobs with polling
 * @param {string} jobEndpoint - GET endpoint to poll for job status
 * @param {boolean} shouldStart - When true, start polling immediately
 * @returns {object} { status, progress, results, error, isPolling }
 */
export function useJobPoller(jobEndpoint, shouldStart = false) {
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef(null);
  const authFetchRef = useRef(null);

  // Start polling
  const startPolling = (authFetch) => {
    authFetchRef.current = authFetch;
    setIsPolling(true);
    setStatus('starting');
    setProgress(0);
    setError(null);

    // Initial poll immediately
    pollOnce(authFetch);

    // Then poll every 2 seconds
    pollIntervalRef.current = setInterval(() => {
      pollOnce(authFetch);
    }, 2000);
  };

  // Poll once
  const pollOnce = async (authFetch) => {
    if (!jobEndpoint) return;

    try {
      const response = await authFetch(jobEndpoint);
      const data = await response.json();

      if (response.ok) {
        setStatus(data.status || 'unknown');
        setProgress(data.progress || 0);
        if (data.results) setResults(data.results);

        // Stop polling when complete or failed
        if (data.status === 'complete' || data.status === 'failed') {
          stopPolling();
        }
      } else {
        setError(data.message || 'Poll request failed');
        stopPolling();
      }
    } catch (err) {
      setError(err.message || 'Polling error');
      stopPolling();
    }
  };

  // Stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  return {
    status,
    progress,
    results,
    error,
    isPolling,
    startPolling,
    stopPolling
  };
}
```

- [ ] **Step 2: Verify hook exports correctly**

Run: Check that the file exists and has proper export syntax
```bash
grep -n "export function useJobPoller" frontend/src/components/admin/data-pricing/useJobPoller.js
```
Expected: Should show the export statement on a line

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/data-pricing/useJobPoller.js
git commit -m "feat: create useJobPoller hook for async job management with auto-polling"
```

---

## Task 2: Create PricingAdminTab (Task 20)

Manages Scryfall price validations and bulk price update operations.

**Files:**
- Create: `frontend/src/components/admin/data-pricing/PricingAdminTab.js`

- [ ] **Step 1: Write component with polling integration**

```javascript
import React, { useState } from 'react';
import { Play, StopCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { useJobPoller } from './useJobPoller';

function PricingAdminTab() {
  const { authFetch } = useAuthContext();
  const [jobId, setJobId] = useState(null);
  const [jobType, setJobType] = useState(null);
  const [validationType, setValidationType] = useState('all'); // all, missing, invalid, outliers

  const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

  const poller = useJobPoller(
    jobId ? `${API_URL}/admin/jobs/pricing/${jobId}` : null,
    false
  );

  const startValidation = async () => {
    try {
      const response = await authFetch(`${API_URL}/admin/jobs/pricing/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validationType })
      });

      const data = await response.json();
      if (response.ok) {
        setJobId(data.jobId);
        setJobType('validate');
        poller.startPolling(authFetch);
      } else {
        alert(data.message || 'Failed to start validation');
      }
    } catch (err) {
      alert('Error starting validation: ' + err.message);
    }
  };

  const startBulkUpdate = async () => {
    try {
      const response = await authFetch(`${API_URL}/admin/jobs/pricing/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });

      const data = await response.json();
      if (response.ok) {
        setJobId(data.jobId);
        setJobType('bulk-update');
        poller.startPolling(authFetch);
      } else {
        alert(data.message || 'Failed to start bulk update');
      }
    } catch (err) {
      alert('Error starting bulk update: ' + err.message);
    }
  };

  const resetJob = () => {
    setJobId(null);
    setJobType(null);
    poller.stopPolling();
  };

  const renderProgressBar = () => {
    const progressPercent = Math.min(poller.progress * 100, 100);
    return (
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    );
  };

  const renderStatusBadge = () => {
    const badgeClasses = {
      starting: 'bg-blue-500/20 text-blue-300',
      processing: 'bg-purple-500/20 text-purple-300',
      complete: 'bg-green-500/20 text-green-300',
      failed: 'bg-red-500/20 text-red-300'
    };

    const icon = {
      complete: CheckCircle,
      failed: AlertCircle
    };

    const Icon = icon[poller.status];

    return (
      <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${badgeClasses[poller.status] || badgeClasses.starting}`}>
        {Icon && <Icon size={16} />}
        <span className="capitalize">{poller.status || 'idle'}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4">Scryfall Price Validation</h4>
          <p className="text-gray-300 text-sm mb-4">
            Validate prices across your collection against Scryfall data. Identifies missing prices, invalid entries, and statistical outliers.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-gray-300 text-sm block mb-2">Validation Type</label>
              <select
                value={validationType}
                onChange={(e) => setValidationType(e.target.value)}
                disabled={poller.isPolling}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                <option value="all">All Cards</option>
                <option value="missing">Missing Prices Only</option>
                <option value="invalid">Invalid Prices Only</option>
                <option value="outliers">Price Outliers Only</option>
              </select>
            </div>

            {!jobId ? (
              <button
                onClick={startValidation}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
              >
                <Play size={16} />
                Start Validation
              </button>
            ) : (
              <button
                onClick={resetJob}
                className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg font-medium"
              >
                <StopCircle size={16} />
                Clear Results
              </button>
            )}
          </div>
        </div>

        {poller.isPolling && (
          <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Progress</span>
              {renderStatusBadge()}
            </div>
            {renderProgressBar()}
            <p className="text-gray-400 text-sm">Processed: {poller.progress} items</p>
          </div>
        )}

        {poller.status === 'complete' && poller.results && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 space-y-2">
            <h5 className="text-green-400 font-medium">Validation Complete</h5>
            <div className="text-gray-300 text-sm space-y-1">
              <p>Total Checked: {poller.results.totalChecked || 0}</p>
              <p>Missing Prices: {poller.results.missingPrices || 0}</p>
              <p>Invalid Entries: {poller.results.invalidEntries || 0}</p>
              <p>Outliers Found: {poller.results.outliers || 0}</p>
            </div>
          </div>
        )}

        {poller.error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-300 text-sm mt-1">{poller.error}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4">Bulk Price Update</h4>
          <p className="text-gray-300 text-sm mb-4">
            Force update all card prices from Scryfall and Exor Games. Uses 500ms rate limiting.
          </p>

          {!jobId || jobType !== 'bulk-update' ? (
            <button
              onClick={startBulkUpdate}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
            >
              <Play size={16} />
              Start Bulk Update
            </button>
          ) : (
            <button
              onClick={resetJob}
              className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg font-medium"
            >
              <StopCircle size={16} />
              Clear Results
            </button>
          )}
        </div>

        {jobType === 'bulk-update' && poller.isPolling && (
          <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Progress</span>
              {renderStatusBadge()}
            </div>
            {renderProgressBar()}
            <p className="text-gray-400 text-sm">Updated: {poller.progress} / ...</p>
          </div>
        )}

        {jobType === 'bulk-update' && poller.status === 'complete' && poller.results && (
          <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 space-y-2">
            <h5 className="text-green-400 font-medium">Update Complete</h5>
            <div className="text-gray-300 text-sm space-y-1">
              <p>Cards Updated: {poller.results.updated || 0}</p>
              <p>Skipped (no change): {poller.results.skipped || 0}</p>
              <p>Failed: {poller.results.failed || 0}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PricingAdminTab;
```

- [ ] **Step 2: Verify component renders**

Check syntax is valid by looking at imports and exports:
```bash
grep -n "import\|export" frontend/src/components/admin/data-pricing/PricingAdminTab.js | head -20
```
Expected: Should show imports and export statement

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/data-pricing/PricingAdminTab.js
git commit -m "feat: add PricingAdminTab with Scryfall validation and bulk price updates"
```

---

## Task 3: Create CollectionAuditsTab (Task 21)

Manages collection data audits including integrity checks and duplicate detection.

**Files:**
- Create: `frontend/src/components/admin/data-pricing/CollectionAuditsTab.js`

- [ ] **Step 1: Write component with polling**

```javascript
import React, { useState } from 'react';
import { Play, StopCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { useJobPoller } from './useJobPoller';

function CollectionAuditsTab() {
  const { authFetch } = useAuthContext();
  const [jobId, setJobId] = useState(null);
  const [auditType, setAuditType] = useState('integrity'); // integrity, duplicates, consistency

  const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

  const poller = useJobPoller(
    jobId ? `${API_URL}/admin/jobs/audits/${jobId}` : null,
    false
  );

  const startAudit = async () => {
    try {
      const response = await authFetch(`${API_URL}/admin/jobs/audits/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditType })
      });

      const data = await response.json();
      if (response.ok) {
        setJobId(data.jobId);
        poller.startPolling(authFetch);
      } else {
        alert(data.message || 'Failed to start audit');
      }
    } catch (err) {
      alert('Error starting audit: ' + err.message);
    }
  };

  const resetJob = () => {
    setJobId(null);
    poller.stopPolling();
  };

  const renderProgressBar = () => {
    const progressPercent = Math.min(poller.progress * 100, 100);
    return (
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    );
  };

  const renderStatusBadge = () => {
    const badgeClasses = {
      starting: 'bg-blue-500/20 text-blue-300',
      processing: 'bg-blue-500/20 text-blue-300',
      complete: 'bg-green-500/20 text-green-300',
      failed: 'bg-red-500/20 text-red-300'
    };

    const icon = {
      complete: CheckCircle,
      failed: AlertCircle
    };

    const Icon = icon[poller.status];

    return (
      <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${badgeClasses[poller.status] || badgeClasses.starting}`}>
        {Icon && <Icon size={16} />}
        <span className="capitalize">{poller.status || 'idle'}</span>
      </div>
    );
  };

  const AuditSection = ({ title, type, description }) => {
    const isActive = auditType === type && jobId;
    const isComplete = poller.status === 'complete' && auditType === type;

    return (
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h4 className="text-white font-medium mb-2">{title}</h4>
        <p className="text-gray-300 text-sm mb-4">{description}</p>

        {!jobId || auditType !== type ? (
          <button
            onClick={() => {
              setAuditType(type);
              setTimeout(startAudit, 0);
            }}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
          >
            <Play size={16} />
            Start Audit
          </button>
        ) : (
          <>
            {poller.isPolling && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Progress</span>
                  {renderStatusBadge()}
                </div>
                {renderProgressBar()}
                <p className="text-gray-400 text-sm">Scanned: {poller.progress} items</p>
              </div>
            )}

            {isComplete && poller.results && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3 space-y-2 mb-3">
                <p className="text-green-400 font-medium text-sm">Audit Complete</p>
                <div className="text-gray-300 text-xs space-y-1">
                  {poller.results.issues && poller.results.issues > 0 ? (
                    <>
                      <p className="text-yellow-400">Issues Found: {poller.results.issues}</p>
                      {poller.results.details && (
                        <pre className="text-gray-400 bg-black/30 p-2 rounded text-xs overflow-auto max-h-32">
                          {poller.results.details}
                        </pre>
                      )}
                    </>
                  ) : (
                    <p className="text-green-300">No issues found</p>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={resetJob}
              className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg font-medium"
            >
              <StopCircle size={16} />
              Clear Results
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <AuditSection
        title="Data Integrity Check"
        type="integrity"
        description="Scans all cards for missing required fields (name, quantity, condition). Reports data consistency issues."
      />

      <AuditSection
        title="Duplicate Detection"
        type="duplicates"
        description="Finds duplicate card entries (same name, set, condition). Merges duplicates or reports them for manual review."
      />

      <AuditSection
        title="Consistency Audit"
        type="consistency"
        description="Validates relationships between cards and other entities. Checks for orphaned data and referential integrity."
      />

      {poller.error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 font-medium">Error</p>
          <p className="text-red-300 text-sm mt-1">{poller.error}</p>
        </div>
      )}
    </div>
  );
}

export default CollectionAuditsTab;
```

- [ ] **Step 2: Verify component**

```bash
grep -n "^function CollectionAuditsTab\|^export" frontend/src/components/admin/data-pricing/CollectionAuditsTab.js
```
Expected: Should show function declaration and export

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/data-pricing/CollectionAuditsTab.js
git commit -m "feat: add CollectionAuditsTab with integrity and consistency checks"
```

---

## Task 4: Create BackupsExportsTab (Task 22)

Manages backup creation and collection exports (no polling - direct operations).

**Files:**
- Create: `frontend/src/components/admin/data-pricing/BackupsExportsTab.js`

- [ ] **Step 1: Write component with export/backup operations**

```javascript
import React, { useState } from 'react';
import { Download, Database, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';

function BackupsExportsTab() {
  const { authFetch } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

  // Fetch existing backups on mount
  React.useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const response = await authFetch(`${API_URL}/admin/backups/list`);
      const data = await response.json();
      if (response.ok) {
        setBackups(data.backups || []);
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const createFullBackup = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await authFetch(`${API_URL}/admin/backups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeImages: true })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Backup created successfully' });
        fetchBackups();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create backup' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error creating backup: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const exportCollectionJSON = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/export/json`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mtg-collection-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setMessage({ type: 'success', text: 'Collection exported as JSON' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error exporting JSON: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const exportCollectionCSV = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/export/csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mtg-collection-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setMessage({ type: 'success', text: 'Collection exported as CSV' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error exporting CSV: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const deleteBackup = async (backupId) => {
    if (!window.confirm('Delete this backup permanently?')) return;

    try {
      const response = await authFetch(`${API_URL}/admin/backups/${backupId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Backup deleted' });
        fetchBackups();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.message || 'Failed to delete backup' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error deleting backup: ' + err.message });
    }
  };

  const restoreBackup = async (backupId) => {
    if (!window.confirm('Restore this backup? Current data will be overwritten.')) return;

    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/admin/backups/${backupId}/restore`, {
        method: 'POST'
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Backup restored successfully' });
        fetchBackups();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to restore backup' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error restoring backup: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-lg p-4 flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/50'
            : 'bg-red-500/10 text-red-400 border border-red-500/50'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
            <Database size={18} />
            Create Backup
          </h4>
          <p className="text-gray-300 text-sm mb-4">
            Create a complete backup of all collection data and cached images.
          </p>
          <button
            onClick={createFullBackup}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 rounded-lg font-medium"
          >
            {loading ? 'Creating...' : 'Create Backup'}
          </button>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
            <Download size={18} />
            Export as JSON
          </h4>
          <p className="text-gray-300 text-sm mb-4">
            Download all collection data as a single JSON file.
          </p>
          <button
            onClick={exportCollectionJSON}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-2 rounded-lg font-medium"
          >
            {loading ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
            <Download size={18} />
            Export as CSV
          </h4>
          <p className="text-gray-300 text-sm mb-4">
            Download all collection data as a CSV file for spreadsheet programs.
          </p>
          <button
            onClick={exportCollectionCSV}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 rounded-lg font-medium"
          >
            {loading ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <h4 className="text-white font-medium mb-4 flex items-center gap-2">
          <Calendar size={18} />
          Existing Backups
        </h4>

        {loadingBackups ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
          </div>
        ) : backups.length === 0 ? (
          <p className="text-gray-400 text-sm py-4">No backups created yet</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="bg-black/20 rounded p-3 flex items-center justify-between"
              >
                <div className="text-sm">
                  <p className="text-gray-200">{backup.name}</p>
                  <p className="text-gray-400 text-xs">
                    {new Date(backup.createdAt).toLocaleString()} • {backup.size}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => restoreBackup(backup.id)}
                    disabled={loading}
                    className="text-blue-400 hover:text-blue-300 disabled:text-gray-400 text-sm font-medium"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.id)}
                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                  >
                    Delete
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

export default BackupsExportsTab;
```

- [ ] **Step 2: Verify component**

```bash
grep -n "^function BackupsExportsTab\|^export" frontend/src/components/admin/data-pricing/BackupsExportsTab.js
```
Expected: Should show function and export

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/data-pricing/BackupsExportsTab.js
git commit -m "feat: add BackupsExportsTab with backup creation and collection exports"
```

---

## Task 5: Create DataCleanupTab (Task 23)

Manages data cleanup jobs including orphan removal and duplicate consolidation.

**Files:**
- Create: `frontend/src/components/admin/data-pricing/DataCleanupTab.js`

- [ ] **Step 1: Write component with polling for cleanup jobs**

```javascript
import React, { useState } from 'react';
import { Play, StopCircle, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { useJobPoller } from './useJobPoller';

function DataCleanupTab() {
  const { authFetch } = useAuthContext();
  const [jobId, setJobId] = useState(null);
  const [cleanupType, setCleanupType] = useState('orphans'); // orphans, duplicates, empty-fields

  const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

  const poller = useJobPoller(
    jobId ? `${API_URL}/admin/jobs/cleanup/${jobId}` : null,
    false
  );

  const startCleanup = async () => {
    try {
      const response = await authFetch(`${API_URL}/admin/jobs/cleanup/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleanupType })
      });

      const data = await response.json();
      if (response.ok) {
        setJobId(data.jobId);
        poller.startPolling(authFetch);
      } else {
        alert(data.message || 'Failed to start cleanup');
      }
    } catch (err) {
      alert('Error starting cleanup: ' + err.message);
    }
  };

  const resetJob = () => {
    setJobId(null);
    poller.stopPolling();
  };

  const renderProgressBar = () => {
    const progressPercent = Math.min(poller.progress * 100, 100);
    return (
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    );
  };

  const renderStatusBadge = () => {
    const badgeClasses = {
      starting: 'bg-orange-500/20 text-orange-300',
      processing: 'bg-orange-500/20 text-orange-300',
      complete: 'bg-green-500/20 text-green-300',
      failed: 'bg-red-500/20 text-red-300'
    };

    const icon = {
      complete: CheckCircle,
      failed: AlertCircle
    };

    const Icon = icon[poller.status];

    return (
      <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${badgeClasses[poller.status] || badgeClasses.starting}`}>
        {Icon && <Icon size={16} />}
        <span className="capitalize">{poller.status || 'idle'}</span>
      </div>
    );
  };

  const CleanupSection = ({ title, type, description, icon: Icon, warningText }) => {
    const isActive = cleanupType === type && jobId;
    const isComplete = poller.status === 'complete' && cleanupType === type;

    return (
      <div className="bg-gray-700/50 rounded-lg p-4 border-l-4 border-orange-500">
        <h4 className="text-white font-medium mb-2 flex items-center gap-2">
          <Icon size={18} className="text-orange-400" />
          {title}
        </h4>
        <p className="text-gray-300 text-sm mb-2">{description}</p>

        {warningText && (
          <div className="bg-orange-500/10 text-orange-300 text-xs p-2 rounded mb-3 border border-orange-500/30">
            {warningText}
          </div>
        )}

        {!jobId || cleanupType !== type ? (
          <button
            onClick={() => {
              setCleanupType(type);
              setTimeout(startCleanup, 0);
            }}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
          >
            <Play size={16} />
            Start Cleanup
          </button>
        ) : (
          <>
            {poller.isPolling && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Progress</span>
                  {renderStatusBadge()}
                </div>
                {renderProgressBar()}
                <p className="text-gray-400 text-sm">Processed: {poller.progress} items</p>
              </div>
            )}

            {isComplete && poller.results && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3 space-y-2 mb-3">
                <p className="text-green-400 font-medium text-sm">Cleanup Complete</p>
                <div className="text-gray-300 text-xs space-y-1">
                  <p>Processed: {poller.results.processed || 0}</p>
                  <p>Removed: {poller.results.removed || 0}</p>
                  {poller.results.merged && <p>Merged: {poller.results.merged}</p>}
                  {poller.results.fixed && <p>Fixed: {poller.results.fixed}</p>}
                </div>
              </div>
            )}

            <button
              onClick={resetJob}
              className="w-full flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg font-medium"
            >
              <StopCircle size={16} />
              Clear Results
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-400 font-medium text-sm">Caution: Destructive Operations</p>
          <p className="text-red-300 text-xs mt-1">
            These operations permanently delete or modify data. Ensure you have a recent backup before proceeding.
          </p>
        </div>
      </div>

      <CleanupSection
        title="Remove Orphaned Records"
        type="orphans"
        description="Removes cards and decks with no owner. These records cannot be accessed by any user."
        icon={Trash2}
        warningText="This will permanently delete all orphaned records. This action cannot be undone."
      />

      <CleanupSection
        title="Consolidate Duplicates"
        type="duplicates"
        description="Finds and consolidates duplicate card entries (same name, set, condition). Merges quantities and keeps the oldest record."
        icon={Trash2}
        warningText="Duplicate metadata will be merged. The oldest record will be preserved with combined quantity."
      />

      <CleanupSection
        title="Fix Empty Fields"
        type="empty-fields"
        description="Scans for cards with missing or invalid field values and attempts to populate them from Scryfall."
        icon={Trash2}
      />

      {poller.error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 font-medium">Error</p>
          <p className="text-red-300 text-sm mt-1">{poller.error}</p>
        </div>
      )}
    </div>
  );
}

export default DataCleanupTab;
```

- [ ] **Step 2: Verify component**

```bash
grep -n "^function DataCleanupTab\|^export" frontend/src/components/admin/data-pricing/DataCleanupTab.js
```
Expected: Should show function and export

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/data-pricing/DataCleanupTab.js
git commit -m "feat: add DataCleanupTab with orphan removal and duplicate consolidation"
```

---

## Task 6: Create SettingsTab (Extract from SystemHealthTab)

New component containing system settings (maintenance, registration, default role).

**Files:**
- Create: `frontend/src/components/admin/data-pricing/SettingsTab.js`

- [ ] **Step 1: Write component with settings management**

```javascript
import React, { useState, useEffect } from 'react';
import { Settings, AlertTriangle } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';

function SettingsTab() {
  const { authFetch } = useAuthContext();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/admin/health`);
      const data = await response.json();

      if (response.ok) {
        setHealth(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch system settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const newState = !health?.settings?.maintenanceMode?.value;
      const response = await authFetch(`${API_URL}/admin/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Maintenance mode updated' });
        setTimeout(() => setMessage(null), 3000);
        fetchHealth();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.message || 'Failed to update' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const toggleRegistration = async () => {
    setRegistrationLoading(true);
    setMessage(null);
    try {
      const newState = !health?.settings?.registrationEnabled?.value;
      const response = await authFetch(`${API_URL}/admin/settings/registrationEnabled`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newState })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Registration setting updated' });
        setTimeout(() => setMessage(null), 3000);
        fetchHealth();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.message || 'Failed to update' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setRegistrationLoading(false);
    }
  };

  const updateDefaultRole = async (newRole) => {
    setRoleLoading(true);
    setMessage(null);
    try {
      const response = await authFetch(`${API_URL}/admin/settings/defaultUserRole`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newRole })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Default user role updated' });
        setTimeout(() => setMessage(null), 3000);
        fetchHealth();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.message || 'Failed to update' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setRoleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        <p>{error}</p>
        <button onClick={fetchHealth} className="mt-4 text-purple-400 hover:text-purple-300">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/50'
            : 'bg-red-500/10 text-red-400 border border-red-500/50'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-gray-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-400" />
            <h4 className="text-white font-medium">System Settings</h4>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-600">
            <div>
              <p className="text-white">Maintenance Mode</p>
              <p className="text-gray-500 text-sm">When enabled, only admins can access the system</p>
            </div>
            <button
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
              className={`px-4 py-1.5 rounded-lg font-medium ${
                health?.settings?.maintenanceMode?.value
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
              }`}
            >
              {maintenanceLoading ? '...' : health?.settings?.maintenanceMode?.value ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-600">
            <div>
              <p className="text-white">Registration</p>
              <p className="text-gray-500 text-sm">Allow new users to register</p>
            </div>
            <button
              onClick={toggleRegistration}
              disabled={registrationLoading}
              className={`px-4 py-1.5 rounded-lg font-medium ${
                health?.settings?.registrationEnabled?.value
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
              }`}
            >
              {registrationLoading ? '...' : health?.settings?.registrationEnabled?.value ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white">Default User Role</p>
              <p className="text-gray-500 text-sm">Role assigned to new users</p>
            </div>
            <select
              value={health?.settings?.defaultUserRole?.value || 'editor'}
              onChange={(e) => updateDefaultRole(e.target.value)}
              disabled={roleLoading}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded-lg capitalize text-sm"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>
      </div>

      <div className="text-right text-gray-500 text-sm">
        Server time: {health?.serverTime ? new Date(health.serverTime).toLocaleString() : '-'}
      </div>
    </div>
  );
}

export default SettingsTab;
```

- [ ] **Step 2: Verify component**

```bash
grep -n "^function SettingsTab\|^export" frontend/src/components/admin/data-pricing/SettingsTab.js
```
Expected: Should show function and export

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/admin/data-pricing/SettingsTab.js
git commit -m "feat: create SettingsTab extracted from SystemHealthTab"
```

---

## Task 7: Refactor SystemHealthTab (Remove Settings Section)

Update SystemHealthTab to remove the settings section (now in SettingsTab).

**Files:**
- Modify: `frontend/src/components/admin/data-pricing/SystemHealthTab.js`

- [ ] **Step 1: Read the file to confirm structure**

```bash
grep -n "System Settings\|Settings" frontend/src/components/admin/data-pricing/SystemHealthTab.js
```
Expected: Should show line number with "System Settings" section

- [ ] **Step 2: Remove settings section from SystemHealthTab**

Delete lines 241-303 (the entire "System Settings" div) and the related state/handler functions.

Open the file and remove:
- Lines 10-13: State variables for maintenanceLoading, registrationLoading, roleLoading, message
- Lines 39-111: Functions toggleMaintenance, toggleRegistration, updateDefaultRole
- Lines 235-303: The rendered "System Settings" section
- Line 2: Remove Settings import

The file should now only contain health statistics display.

Final file should be around 180 lines instead of 312.

- [ ] **Step 3: Verify refactored file**

```bash
wc -l frontend/src/components/admin/data-pricing/SystemHealthTab.js
```
Expected: Should show approximately 180-200 lines

Also verify Settings import is gone:
```bash
grep "Settings" frontend/src/components/admin/data-pricing/SystemHealthTab.js
```
Expected: Should return no matches (Settings import removed)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/data-pricing/SystemHealthTab.js
git commit -m "refactor: remove settings section from SystemHealthTab, move to SettingsTab"
```

---

## Task 8: Update AdminPanel (Register New Tabs)

Update AdminPanel.js to include the new tabs in the data-pricing group.

**Files:**
- Modify: `frontend/src/components/admin/AdminPanel.js`

- [ ] **Step 1: Add imports for new components**

At the top of AdminPanel.js (after existing imports), add:

```javascript
import PricingAdminTab from './data-pricing/PricingAdminTab';
import CollectionAuditsTab from './data-pricing/CollectionAuditsTab';
import BackupsExportsTab from './data-pricing/BackupsExportsTab';
import DataCleanupTab from './data-pricing/DataCleanupTab';
import SettingsTab from './data-pricing/SettingsTab';
```

- [ ] **Step 2: Update data-pricing group tabs array**

In the `groups` object, update the 'data-pricing' group's tabs array to include all 5 new components:

```javascript
'data-pricing': {
  label: 'Data & Pricing',
  tabs: [
    { id: 'health', label: 'System Health', component: SystemHealthTab },
    { id: 'pricing', label: 'Pricing Admin', component: PricingAdminTab },
    { id: 'audits', label: 'Collection Audits', component: CollectionAuditsTab },
    { id: 'backups', label: 'Backups & Exports', component: BackupsExportsTab },
    { id: 'cleanup', label: 'Data Cleanup', component: DataCleanupTab },
    { id: 'settings', label: 'Settings', component: SettingsTab },
    { id: 'migration', label: 'Data Migration', component: MigrationPanel }
  ]
}
```

- [ ] **Step 3: Verify AdminPanel.js has all imports**

```bash
grep -c "import.*Tab from\|import.*Panel from" frontend/src/components/admin/AdminPanel.js
```
Expected: Should show 11 (original tabs + new 5)

- [ ] **Step 4: Verify tabs are registered**

```bash
grep -n "id: 'pricing'\|id: 'audits'\|id: 'backups'\|id: 'cleanup'\|id: 'settings'" frontend/src/components/admin/AdminPanel.js
```
Expected: Should show all 5 new tab registrations

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/AdminPanel.js
git commit -m "feat: register new admin tabs (pricing, audits, backups, cleanup, settings) in AdminPanel"
```

---

## Summary

This plan creates a unified polling infrastructure for async admin operations:

1. **useJobPoller Hook** - Reusable polling logic (2-second intervals, auto-stop on complete/failed)
2. **PricingAdminTab** - Scryfall validation and bulk price updates
3. **CollectionAuditsTab** - Data integrity and duplicate detection
4. **BackupsExportsTab** - Backup creation and collection exports
5. **DataCleanupTab** - Orphan removal and duplicate consolidation
6. **SettingsTab** - System settings extracted from SystemHealthTab
7. **SystemHealthTab Refactor** - Remove settings, keep only stats
8. **AdminPanel Update** - Register all new tabs in sidebar

**Key Implementation Details:**
- All polling components follow unified pattern: start job → poll every 2 seconds → auto-stop at complete/failed
- Progress displayed as percentage bar + item count
- Status badges show starting/processing/complete/failed states
- Results shown when status becomes 'complete'
- Error handling with user-friendly messages
- All components use authFetch from AuthContext for authenticated requests

**6 Total Commits:**
1. useJobPoller hook
2. PricingAdminTab
3. CollectionAuditsTab
4. BackupsExportsTab
5. DataCleanupTab + SettingsTab + SystemHealthTab refactor + AdminPanel update (batched as final commit)

Alternative: Could be 6 individual commits if doing one per component.
