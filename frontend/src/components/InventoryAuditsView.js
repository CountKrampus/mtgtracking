import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, ClipboardCheck, Loader2, Play, Save } from 'lucide-react';
import { API_URL } from '../config';

export default function InventoryAuditsView({ locations = [] }) {
  const [locationId, setLocationId] = useState('');
  const [audits, setAudits] = useState([]);
  const [audit, setAudit] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!locationId && locations.length) setLocationId(locations[0]._id);
  }, [locations, locationId]);

  useEffect(() => {
    if (!locationId) {
      setAudits([]);
      setAudit(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    axios.get(`${API_URL}/inventory-audits`, { params: { locationId } })
      .then(({ data }) => {
        if (cancelled) return;
        const records = Array.isArray(data) ? data : [];
        setAudits(records);
        const active = records.find(item => item.status === 'in_progress') || null;
        setAudit(active);
        setCounts(Object.fromEntries((active?.items || []).map(item => [
          item.cardId,
          item.countedQuantity == null ? '' : String(item.countedQuantity)
        ])));
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load inventory audits.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [locationId]);

  const countedCount = useMemo(() => {
    if (!audit) return 0;
    return audit.items.filter(item => counts[item.cardId] !== '' && counts[item.cardId] !== undefined).length;
  }, [audit, counts]);
  const hasUnsavedCounts = Boolean(audit?.items.some(item => {
    const raw = counts[item.cardId] ?? '';
    return item.countedQuantity == null ? raw !== '' : raw === '' || Number(raw) !== item.countedQuantity;
  }));

  const changeLocation = event => {
    const nextLocationId = event.target.value;
    if (hasUnsavedCounts && !window.confirm('Discard unsaved counts for this audit?')) return;
    setAudit(null);
    setAudits([]);
    setCounts({});
    setLocationId(nextLocationId);
    setNotice('');
  };

  const saveCounts = async () => {
    if (!audit) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const items = audit.items.map(item => {
        const raw = counts[item.cardId];
        return { cardId: item.cardId, countedQuantity: raw === '' || raw === undefined ? null : Number(raw) };
      });
      const { data } = await axios.put(`${API_URL}/inventory-audits/${audit._id}/counts`, { items });
      setAudit(data);
      setNotice('Counts saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save audit counts.');
    } finally {
      setSaving(false);
    }
  };

  const startAudit = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await axios.post(`${API_URL}/inventory-audits`, { locationId });
      setAudit(data);
      setAudits(previous => [data, ...previous]);
      setCounts(Object.fromEntries(data.items.map(item => [item.cardId, ''])));
    } catch (err) {
      if (err.response?.data?.audit) {
        const existing = err.response.data.audit;
        setAudit(existing);
        setCounts(Object.fromEntries(existing.items.map(item => [
          item.cardId,
          item.countedQuantity == null ? '' : String(item.countedQuantity)
        ])));
      } else {
        setError(err.response?.data?.message || 'Could not start an inventory audit.');
      }
    } finally {
      setSaving(false);
    }
  };

  const completeAudit = async () => {
    if (countedCount !== audit?.items.length) {
      setError('Enter a count for every card before completing the audit.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const items = audit.items.map(item => ({ cardId: item.cardId, countedQuantity: Number(counts[item.cardId]) }));
      await axios.put(`${API_URL}/inventory-audits/${audit._id}/counts`, { items });
      const { data } = await axios.post(`${API_URL}/inventory-audits/${audit._id}/complete`);
      setAudit(null);
      setAudits(previous => [data, ...previous.filter(item => item._id !== data._id)]);
      setNotice('Audit completed. Your collection quantities were not changed.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not complete the audit.');
    } finally {
      setSaving(false);
    }
  };

  const selectedLocation = locations.find(location => location._id === locationId);
  const completedAudits = audits.filter(item => item.status === 'completed');

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-3">
          <ClipboardCheck className="text-teal-300" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">Location inventory audits</h1>
            <p className="text-sm text-white/55 mt-1">Count what is physically stored and review differences from your collection records.</p>
          </div>
        </div>
      </header>

      <section className="bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
        <label className="block text-sm text-white/75">
          Storage location
          <select
            value={locationId}
            onChange={changeLocation}
            className="mt-1 w-full sm:max-w-md px-3 py-2 rounded-lg bg-slate-900 text-white border border-white/20"
          >
            <option value="">Choose a location</option>
            {locations.map(location => <option key={location._id} value={location._id}>{location.name}</option>)}
          </select>
        </label>

        {!locations.length && <p className="text-amber-200 text-sm">Create a storage location in Settings before starting an audit.</p>}
        {loading && <p className="text-white/60 text-sm flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Loading audits...</p>}
        {!loading && locationId && !audit && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-white/60 text-sm">{selectedLocation?.name}: {completedAudits.length} completed audit{completedAudits.length === 1 ? '' : 's'}.</p>
            <button onClick={startAudit} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white">
              <Play size={16} />Start audit
            </button>
          </div>
        )}
        {audit && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">{audit.locationName} audit</h2>
                <p className="text-xs text-white/50 mt-1">
                  {countedCount} of {audit.items.length} card entries counted
                  {hasUnsavedCounts && <span className="text-amber-300"> · Unsaved changes</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={saveCounts} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white disabled:opacity-50">
                  <Save size={16} />Save counts
                </button>
                <button onClick={completeAudit} disabled={saving || countedCount !== audit.items.length} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50">
                  <CheckCircle2 size={16} />Complete
                </button>
              </div>
            </div>
            {audit.items.length === 0 ? (
              <p className="rounded-lg bg-black/15 p-4 text-sm text-white/60">No collection entries are assigned to this location. You can complete this empty audit.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-black/20 text-white/60">
                    <tr><th className="text-left p-3">Card</th><th className="text-center p-3">Recorded</th><th className="text-center p-3">Counted</th><th className="text-right p-3">Difference</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {audit.items.map(item => {
                      const raw = counts[item.cardId] ?? '';
                      const difference = raw === '' ? null : Number(raw) - item.expectedQuantity;
                      return (
                        <tr key={item.cardId} className="text-white/85">
                          <td className="p-3">
                            <span className="block font-medium">{item.name}{item.isFoil ? ' (Foil)' : ''}</span>
                            <span className="block text-xs text-white/45">{[item.set, item.condition].filter(Boolean).join(' · ')}</span>
                          </td>
                          <td className="p-3 text-center">{item.expectedQuantity}</td>
                          <td className="p-3 text-center">
                            <input type="number" min="0" step="1" inputMode="numeric" aria-label={`Count ${item.name}`} value={raw}
                              onChange={event => setCounts(previous => ({ ...previous, [item.cardId]: event.target.value }))}
                              className="w-20 px-2 py-1 rounded bg-slate-900 text-white text-center border border-white/20" />
                          </td>
                          <td className={`p-3 text-right font-semibold ${difference == null || difference === 0 ? 'text-white/45' : difference < 0 ? 'text-red-300' : 'text-amber-300'}`}>
                            {difference == null ? '—' : difference > 0 ? `+${difference}` : difference}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-teal-400/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-100">{notice}</p>}

      {completedAudits.length > 0 && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h2 className="font-semibold text-white mb-3">Recent completed audits</h2>
          <ul className="space-y-2">
            {completedAudits.slice(0, 5).map(record => {
              const discrepancies = record.items.filter(item => item.countedQuantity !== item.expectedQuantity).length;
              return <li key={record._id} className="flex justify-between gap-3 text-sm text-white/70">
                <span>{new Date(record.completedAt).toLocaleDateString()} · {record.items.length} card entries</span>
                <span className={discrepancies ? 'text-amber-300' : 'text-teal-300'}>{discrepancies} {discrepancies === 1 ? 'discrepancy' : 'discrepancies'}</span>
              </li>;
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
