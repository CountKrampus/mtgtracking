import React, { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../../contexts/AuthContext';
import { API_URL } from '../../../config';
import { Activity, AlertTriangle, Database, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

export default function PerformanceTab() {
  const { authFetch } = useAuthContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedQuery, setExpandedQuery] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/admin/performance`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatMs = ms => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  const getSeverity = ms =>
    ms >= 1000 ? 'text-red-400 bg-red-500/10' :
    ms >= 500  ? 'text-orange-400 bg-orange-500/10' :
    ms >= 100  ? 'text-yellow-400 bg-yellow-500/10' :
                 'text-green-400 bg-green-500/10';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Database Performance</h2>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">{error}</div>
      )}

      {data && (
        <>
          {/* Index Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold">
                <AlertTriangle size={16} />
                {data.recommendations.length} Index Recommendation{data.recommendations.length !== 1 ? 's' : ''}
              </div>
              {data.recommendations.map((rec, i) => (
                <div key={i} className="bg-black/20 rounded-lg p-3 space-y-1">
                  <p className="text-white/70 text-xs">{rec.reason} on <span className="text-white font-mono">{rec.collection}</span></p>
                  <code className="text-green-400 text-xs font-mono block bg-black/30 rounded px-2 py-1">{rec.suggestion}</code>
                </div>
              ))}
            </div>
          )}

          {data.recommendations.length === 0 && !loading && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm flex items-center gap-2">
              <Database size={14} /> No collection scans detected — indexes look healthy.
            </div>
          )}

          {/* Slow Queries */}
          <div>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
              Recent Slow Queries ({data.queries.length})
            </h3>
            {data.queries.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">No slow queries logged yet (threshold: 100ms)</p>
            ) : (
              <div className="space-y-2">
                {data.queries.map((q, i) => (
                  <div key={i} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setExpandedQuery(expandedQuery === i ? null : i)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverity(q.millis)}`}>{formatMs(q.millis)}</span>
                      <span className="text-white/80 text-sm font-mono flex-1 truncate">{q.ns}</span>
                      <span className="text-white/40 text-xs">{q.op}</span>
                      <span className="text-white/40 text-xs">{q.docsExamined} examined / {q.docsReturned} returned</span>
                      {expandedQuery === i ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
                    </button>
                    {expandedQuery === i && (
                      <div className="px-4 pb-3 space-y-2 border-t border-white/10">
                        <p className="text-white/40 text-xs mt-2">Plan: <span className="text-white/70">{q.planSummary || 'N/A'}</span></p>
                        <p className="text-white/40 text-xs">Keys examined: <span className="text-white/70">{q.keysExamined}</span></p>
                        <p className="text-white/40 text-xs">Timestamp: <span className="text-white/70">{new Date(q.ts).toLocaleString()}</span></p>
                        {Object.keys(q.query).length > 0 && (
                          <pre className="text-green-400 text-xs font-mono bg-black/30 rounded p-2 overflow-x-auto">
                            {JSON.stringify(q.query, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {loading && !data && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
        </div>
      )}
    </div>
  );
}
