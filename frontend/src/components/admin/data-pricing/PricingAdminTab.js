import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Play, Square, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';

// ─── Module-scope helpers ──────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/60 text-blue-300 border border-blue-700/50">
        <RefreshCw size={12} className="animate-spin" />
        Running
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/60 text-green-300 border border-green-700/50">
        <CheckCircle size={12} />
        Complete
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/60 text-red-300 border border-red-700/50">
        <AlertTriangle size={12} />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700/60 text-gray-300 border border-gray-600/50">
      <Clock size={12} />
      {status || 'Unknown'}
    </span>
  );
}

function ProgressBar({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{completed} / {total} cards</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-purple-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PricingAdminTab() {
  const { authFetch } = useAuthContext();

  // Form options
  const [forceUpdate, setForceUpdate] = useState(false);
  const [fullData, setFullData] = useState(false);

  // Job tracking
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [polling, setPolling] = useState(false);

  // UI states
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [pollError, setPollError] = useState(null);

  const intervalRef = useRef(null);

  // ── Polling logic ──────────────────────────────────────────────────────────

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPolling(false);
  };

  const fetchJobStatus = async (id) => {
    try {
      const res = await authFetch(`${API_URL}/admin/force-price-update/${id}`);
      if (!res.ok) {
        const text = await res.text();
        setPollError(`Failed to fetch job status: ${res.status} ${text}`);
        stopPolling();
        return;
      }
      const data = await res.json();
      setJob(data);
      setPollError(null);
      if (data.status === 'complete' || data.status === 'failed') {
        stopPolling();
      }
    } catch (err) {
      setPollError(`Network error while polling: ${err.message}`);
      stopPolling();
    }
  };

  useEffect(() => {
    if (!jobId || !polling) return;

    // Fetch immediately, then on interval
    fetchJobStatus(jobId);
    intervalRef.current = setInterval(() => fetchJobStatus(jobId), 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, polling]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStart = async () => {
    setStartError(null);
    setStarting(true);
    setJob(null);
    setJobId(null);
    stopPolling();

    try {
      const res = await authFetch(`${API_URL}/admin/force-price-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: forceUpdate, fullData }),
      });
      if (!res.ok) {
        const text = await res.text();
        setStartError(`Failed to start job: ${res.status} ${text}`);
        setStarting(false);
        return;
      }
      const data = await res.json();
      setJobId(data.jobId);
      setPolling(true);
    } catch (err) {
      setStartError(`Network error: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = () => {
    stopPolling();
  };

  const handleReset = () => {
    stopPolling();
    setJobId(null);
    setJob(null);
    setStartError(null);
    setPollError(null);
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const isRunning = polling || (job && job.status === 'running');
  const isFinished = job && (job.status === 'complete' || job.status === 'failed');
  const hasJob = !!jobId;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Section 1: Force Price Update ── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <RefreshCw size={18} className="text-purple-400" />
            Force Price Update
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Trigger a background price update job for the entire collection.
          </p>
        </div>

        <div className="p-5 space-y-5">

          {/* Options — only show when no active job */}
          {!hasJob && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Update Options</p>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={forceUpdate}
                  onChange={(e) => setForceUpdate(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                />
                <div>
                  <span className="text-sm text-white group-hover:text-purple-300 transition-colors">
                    Force update cards with existing prices
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    By default, cards that already have a price are skipped. Enable this to re-fetch all prices.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={fullData}
                  onChange={(e) => setFullData(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                />
                <div>
                  <span className="text-sm text-white group-hover:text-purple-300 transition-colors">
                    Update full card data
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Also refreshes set, rarity, collector number, colors, types, mana cost, images, and oracle text from Scryfall.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Start error */}
          {startError && (
            <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{startError}</span>
            </div>
          )}

          {/* Job status panel */}
          {hasJob && job && (
            <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono">Job {job.jobId}</span>
                  <StatusBadge status={job.status} />
                </div>
                {job.startedAt && (
                  <span className="text-xs text-gray-500">
                    Started {new Date(job.startedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <ProgressBar completed={job.completed ?? 0} total={job.total ?? 0} />

              {job.completedAt && (
                <p className="text-xs text-gray-500">
                  Completed at {new Date(job.completedAt).toLocaleTimeString()}
                </p>
              )}

              {/* Errors list */}
              {job.errors && job.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-yellow-400 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {job.errors.length} error{job.errors.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="max-h-32 overflow-y-auto space-y-0.5">
                    {job.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-300 font-mono bg-red-900/20 px-2 py-0.5 rounded">
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Job started but no data yet */}
          {hasJob && !job && !pollError && (
            <div className="flex items-center gap-2 text-sm text-gray-400 p-4 bg-gray-900/50 rounded-lg border border-gray-700/40">
              <RefreshCw size={16} className="animate-spin text-purple-400" />
              Connecting to job…
            </div>
          )}

          {/* Poll error */}
          {pollError && (
            <div className="flex items-start gap-2 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-sm text-yellow-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{pollError}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {!hasJob && (
              <button
                onClick={handleStart}
                disabled={starting}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {starting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                {starting ? 'Starting…' : 'Start Price Update'}
              </button>
            )}

            {hasJob && isRunning && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Square size={16} />
                Cancel Monitoring
              </button>
            )}

            {(isFinished || (!polling && hasJob)) && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw size={16} />
                Start New Update
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ── Section 2: Info box ── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Clock size={18} className="text-purple-400" />
            Recent Price Jobs
          </h2>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-700/40 rounded-lg text-sm text-blue-300">
            <Clock size={16} className="mt-0.5 shrink-0 text-blue-400" />
            <p>
              Price update jobs run in the background on the server. You can navigate away and return
              to this page to check the status of a job using its Job ID. Jobs continue processing
              even after you leave or cancel monitoring.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

export default PricingAdminTab;
