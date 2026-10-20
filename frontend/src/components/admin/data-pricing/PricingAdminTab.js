import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Play, Square, AlertTriangle, CheckCircle, Clock, Activity } from 'lucide-react';
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

// Backend jobs count every processed card as updated, skipped, or failed —
// there is no separate `completed` counter, so derive it. (The panel used to
// read `job.completed`, which never existed, so the bar sat at 0% forever.)
function jobCompleted(job) {
  return (job.updated ?? 0) + (job.skipped ?? 0) + (job.failed ?? 0);
}

function jobDuration(job) {
  if (!job.startedAt) return null;
  const end = job.completedAt ? new Date(job.completedAt) : new Date();
  const secs = Math.max(0, Math.round((end - new Date(job.startedAt)) / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
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

function SourceStatCard({ label, count, percentage, tone }) {
  const toneClasses = {
    good: 'text-green-400',
    warn: 'text-yellow-400',
    bad: 'text-red-400',
  };
  return (
    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${toneClasses[tone]}`}>{percentage}%</p>
      <p className="text-gray-500 text-xs">{count} fetches</p>
    </div>
  );
}

function DailyTrendChart({ dailyTrend }) {
  if (dailyTrend.length === 0) return null;
  const maxDaily = Math.max(...dailyTrend.map(d => d.Scryfall + d['MTGGoldfish (backup)'] + d['None (not found)']), 1);
  return (
    <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
      {dailyTrend.map(d => {
        const total = d.Scryfall + d['MTGGoldfish (backup)'] + d['None (not found)'];
        const heightPct = (total / maxDaily) * 100;
        return (
          <div key={d.date} className="flex flex-col items-center gap-1 flex-shrink-0 w-6" title={`${d.date}: ${total} fetches`}>
            <div className="w-full bg-gray-700 rounded-t flex flex-col-reverse overflow-hidden" style={{ height: `${heightPct}%`, minHeight: total > 0 ? '4px' : '0' }}>
              <div className="w-full bg-green-500" style={{ height: `${(d.Scryfall / total) * 100}%` }} />
              <div className="w-full bg-yellow-500" style={{ height: `${(d['MTGGoldfish (backup)'] / total) * 100}%` }} />
              <div className="w-full bg-red-500" style={{ height: `${(d['None (not found)'] / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PricingAdminTab() {
  const { authFetch } = useAuthContext();

  // Form options
  const [fullData, setFullData] = useState(false);

  // Job tracking
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [polling, setPolling] = useState(false);

  // Recent jobs list (persisted server-side, survives restarts/page navigation)
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentJobsLoading, setRecentJobsLoading] = useState(true);
  const [recentJobsError, setRecentJobsError] = useState(null);

  // UI states
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [pollError, setPollError] = useState(null);

  // Price source health
  const [sourceHealth, setSourceHealth] = useState(null);
  const [sourceHealthLoading, setSourceHealthLoading] = useState(true);

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

  useEffect(() => {
    authFetch(`${API_URL}/admin/price-source-health`)
      .then(r => r.json())
      .then(setSourceHealth)
      .catch(() => setSourceHealth(null))
      .finally(() => setSourceHealthLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Recent jobs list ────────────────────────────────────────────────────

  const fetchRecentJobs = async () => {
    try {
      const res = await authFetch(`${API_URL}/admin/force-price-update`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setRecentJobs(data.jobs || []);
      setRecentJobsError(null);
      return data.jobs || [];
    } catch (err) {
      setRecentJobsError(`Failed to load jobs: ${err.message}`);
      return [];
    } finally {
      setRecentJobsLoading(false);
    }
  };

  // On mount: load the list, then re-attach to the newest *running* job so a
  // page refresh resumes live tracking automatically instead of just showing
  // a static row the user has to click Monitor on.
  const autoAttachedRef = useRef(false);
  useEffect(() => {
    (async () => {
      const jobs = await fetchRecentJobs();
      if (autoAttachedRef.current) return;
      const running = jobs.find(j => j.status === 'running');
      if (running) {
        autoAttachedRef.current = true;
        setJobId(running.jobId);
        setPolling(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the list fresh while any job is still running (locally monitored or
  // just listed from the server), so a finished job flips to Complete here
  // without a manual refresh.
  const anyRunning = polling || recentJobs.some(j => j.status === 'running');
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(fetchRecentJobs, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyRunning]);

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
        body: JSON.stringify({ fullData }),
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
      fetchRecentJobs(); // show the new job in Recent Price Jobs immediately
    } catch (err) {
      setStartError(`Network error: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = () => {
    stopPolling();
    fetchRecentJobs(); // the job keeps running server-side; refresh its row
  };

  // Re-attach to a job from the Recent list (e.g. after navigating away).
  const handleMonitorJob = (id) => {
    stopPolling();
    setJob(null);
    setPollError(null);
    setJobId(id);
    setPolling(true);
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

  // Refresh the list once a monitored job finishes so its row shows final
  // counts (the polling effect stops itself on complete/failed).
  const prevJobStatusRef = React.useRef(null);
  useEffect(() => {
    const status = job?.status;
    if (status && prevJobStatusRef.current === 'running' && status !== 'running') {
      fetchRecentJobs();
    }
    prevJobStatusRef.current = status || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Section 1: Force Price Update ── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <RefreshCw size={18} className="text-purple-400" />
            Update Database Prices
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

              <p className="text-xs text-gray-500">
                Every card is re-priced on each run — cards with an existing price are never skipped.
              </p>

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
                  {job.options?.fullData && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-900/50 text-purple-300 border border-purple-700/50">
                      full data
                    </span>
                  )}
                </div>
                {job.startedAt && (
                  <span className="text-xs text-gray-500">
                    Started {new Date(job.startedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <ProgressBar completed={jobCompleted(job)} total={job.total ?? 0} />

              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                <span><span className="text-green-400 font-medium">{job.updated ?? 0}</span> updated</span>
                <span><span className="text-yellow-400 font-medium">{job.skipped ?? 0}</span> skipped</span>
                <span><span className="text-red-400 font-medium">{job.failed ?? 0}</span> failed</span>
                {jobDuration(job) && (
                  <span className="text-gray-500">took {jobDuration(job)}</span>
                )}
              </div>

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
                        {/* Backend stores { card, error } objects; older jobs
                            stored plain strings — handle both. */}
                        {typeof err === 'string' ? err : `${err.card}: ${err.error}`}
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

      {/* ── Section 2: Recent Price Jobs ── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock size={18} className="text-purple-400" />
              Recent Price Jobs
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Jobs run in the background and are recorded here even across restarts.
            </p>
          </div>
          <button
            onClick={fetchRecentJobs}
            title="Refresh"
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="p-5">
          {recentJobsLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : recentJobsError ? (
            <div className="flex items-start gap-2 p-3 bg-yellow-900/30 border border-yellow-700/40 rounded-lg text-sm text-yellow-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{recentJobsError}</span>
            </div>
          ) : recentJobs.length === 0 ? (
            <p className="text-gray-400 text-sm">No price update jobs yet — start one above.</p>
          ) : (
            <div className="space-y-2">
              {recentJobs.map((j) => (
                <div
                  key={j.jobId}
                  className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border ${
                    jobId === j.jobId
                      ? 'bg-purple-900/20 border-purple-700/50'
                      : 'bg-gray-900/50 border-gray-700/40'
                  }`}
                >
                  <StatusBadge status={j.status} />
                  <span className="text-xs text-gray-500 font-mono">{j.jobId}</span>
                  {j.options?.fullData && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-900/50 text-purple-300 border border-purple-700/50">
                      full data
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    <span className="text-green-400 font-medium">{j.updated ?? 0}</span> upd ·{' '}
                    <span className="text-yellow-400 font-medium">{j.skipped ?? 0}</span> skip ·{' '}
                    <span className="text-red-400 font-medium">{j.failed ?? 0}</span> failed
                    {j.total > 0 && <> / {j.total}</>}
                  </span>
                  <span className="text-xs text-gray-500">
                    {j.status === 'running' ? 'started ' : 'ran '}
                    {j.startedAt ? new Date(j.startedAt).toLocaleString() : '—'}
                    {j.completedAt && <> · {jobDuration(j)}</>}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {j.status === 'running' && jobId !== j.jobId && (
                      <button
                        onClick={() => handleMonitorJob(j.jobId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Activity size={12} />
                        Monitor
                      </button>
                    )}
                    {jobId === j.jobId && polling && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-300">
                        <RefreshCw size={12} className="animate-spin" />
                        Monitoring
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Price Source Health ── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700/50">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Activity size={18} className="text-purple-400" />
            Price Source Health
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Which pricing source recent updates actually resolved to, over the last 30 days.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {sourceHealthLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : !sourceHealth || sourceHealth.totalFetches === 0 ? (
            <p className="text-gray-400 text-sm">No price fetches recorded in the last 30 days yet — this fills in as prices are updated.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <SourceStatCard label="Scryfall" count={sourceHealth.bySource.Scryfall.count} percentage={sourceHealth.bySource.Scryfall.percentage} tone="good" />
                <SourceStatCard label="MTGGoldfish Backup" count={sourceHealth.bySource['MTGGoldfish (backup)'].count} percentage={sourceHealth.bySource['MTGGoldfish (backup)'].percentage} tone="warn" />
                <SourceStatCard label="Not Found" count={sourceHealth.bySource['None (not found)'].count} percentage={sourceHealth.bySource['None (not found)'].percentage} tone="bad" />
              </div>
              <DailyTrendChart dailyTrend={sourceHealth.dailyTrend} />
            </>
          )}
        </div>
      </div>

    </div>
  );
}

export default PricingAdminTab;
