import React, { useState } from 'react';
import { X, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { API_URL } from '../config';

const fp = v => `$${(v || 0).toFixed(2)}`;

function CollectionChangelog({ onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('added');

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(
        `${API_URL}/cards/changelog?from=${from}&to=${to}&priceThresholdPct=${threshold}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setData(await res.json());
      setTab('added');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">Collection Changelog</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
        </div>

        <div className="p-4 border-b border-slate-700 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-slate-400 text-xs block mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1" />
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1" />
          </div>
          <div>
            <label className="text-slate-400 text-xs block mb-1">Price change threshold</label>
            <select value={threshold} onChange={e => setThreshold(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-sm rounded px-2 py-1">
              {[5, 10, 20, 50].map(v => <option key={v} value={v}>{v}%+</option>)}
            </select>
          </div>
          <button onClick={load} disabled={loading}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition">
            {loading ? 'Loading…' : 'View'}
          </button>
        </div>

        {data && (
          <>
            <div className="flex border-b border-slate-700 text-sm">
              {[
                ['added', `Added (${data.added?.length ?? 0})`, Plus],
                ['deleted', `Removed (${data.deleted?.length ?? 0})`, Trash2],
                ['priceChanges', `Price Changes (${data.priceChanges?.length ?? 0})`, TrendingUp],
              ].map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 transition ${tab === key ? 'text-white border-b-2 border-purple-400' : 'text-slate-400 hover:text-white'}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'added' && (
                data.added?.length === 0
                  ? <p className="text-slate-500 text-sm">No cards added in this range.</p>
                  : <div className="space-y-1">
                    {data.added.map(c => (
                      <div key={c._id} className="flex items-center justify-between py-1.5 border-b border-slate-800">
                        <div>
                          <span className="text-white text-sm font-medium">{c.name}</span>
                          {c.set && <span className="text-slate-400 text-xs ml-2">{c.set}</span>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-green-400 text-xs font-semibold">{fp(c.price)}</div>
                          <div className="text-slate-500 text-xs">{new Date(c.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
              )}

              {tab === 'deleted' && (
                data.deleted?.length === 0
                  ? <p className="text-slate-500 text-sm">No cards removed in this range.</p>
                  : <div className="space-y-1">
                    {data.deleted.map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-300 text-sm">{d.name || 'Unknown card'}</span>
                        <span className="text-slate-500 text-xs">{new Date(d.deletedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
              )}

              {tab === 'priceChanges' && (
                data.priceChanges?.length === 0
                  ? <p className="text-slate-500 text-sm">No significant price changes in this range.</p>
                  : <div className="space-y-1">
                    {data.priceChanges.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).map((p, i) => {
                      const up = p.changePct >= 0;
                      return (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800">
                          <div>
                            <span className="text-white text-sm font-medium">{p.name}</span>
                            {p.set && <span className="text-slate-400 text-xs ml-2">{p.set}</span>}
                            <div className="text-slate-500 text-xs">{fp(p.oldPrice)} → {fp(p.newPrice)}</div>
                          </div>
                          <div className={`flex items-center gap-1 text-sm font-semibold flex-shrink-0 ml-4 ${up ? 'text-green-400' : 'text-red-400'}`}>
                            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {up ? '+' : ''}{p.changePct.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CollectionChangelog;
