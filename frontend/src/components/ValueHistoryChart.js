import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

export default function ValueHistoryChart() {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = useState(toDateInputValue(thirtyDaysAgo));
  const [to, setTo] = useState(toDateInputValue(today));
  const [earliest, setEarliest] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async (fromVal, toVal) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/stats/value-history?from=${fromVal}&to=${toVal}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('mtg_access_token')}` }
      });
      const { snapshots, earliest: e } = res.data;
      if (e && !earliest) setEarliest(e);
      const points = (snapshots || []).map(item => ({
        date: new Date(item.createdAt).toLocaleDateString(),
        value: item.value,
        count: item.cardCount
      }));
      setData(points);
    } catch (err) {
      console.error('Error fetching value history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(from, to);
  }, [from, to]);

  const startValue = data.length ? data[0].value : null;
  const endValue = data.length ? data[data.length - 1].value : null;
  const netChange = startValue != null && endValue != null ? endValue - startValue : null;
  const netChangePct = startValue ? ((netChange / startValue) * 100) : null;

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading chart…</div>;
  }

  const width = 600;
  const height = 220;
  const padding = 40;

  const renderChart = () => {
    if (!data.length) return null;
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
    const pointAt = (i, v) => ({
      x: padding + i * xStep,
      y: height - padding - ((v - minValue) / range) * (height - padding * 2)
    });
    const linePath = data
      .map((d, i) => {
        const { x, y } = pointAt(i, d.value);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 300 }}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <text x={padding - 6} y={padding + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">${maxValue.toFixed(0)}</text>
        <text x={padding - 6} y={height - padding} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">${minValue.toFixed(0)}</text>
        <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" />
        {data.map((d, i) => {
          const { x, y } = pointAt(i, d.value);
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="#a78bfa">
              <title>{`$${d.value.toFixed(2)} on ${d.date}`}</title>
            </circle>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3">Collection Value History</h3>

      {/* Date range picker */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-slate-400 text-sm">From</label>
        <input
          type="date"
          value={from}
          min={earliest || undefined}
          max={to}
          onChange={e => setFrom(e.target.value)}
          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
        <label className="text-slate-400 text-sm">To</label>
        <input
          type="date"
          value={to}
          min={from}
          max={toDateInputValue(new Date())}
          onChange={e => setTo(e.target.value)}
          className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {!data.length ? (
        <p className="text-slate-400 text-sm">No snapshots in this date range.</p>
      ) : (
        <>
          {renderChart()}

          {/* Summary stats */}
          {netChange != null && (
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-white font-semibold text-sm">${startValue.toFixed(2)}</div>
                <div className="text-slate-500 text-xs mt-0.5">Start</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className="text-white font-semibold text-sm">${endValue.toFixed(2)}</div>
                <div className="text-slate-500 text-xs mt-0.5">End</div>
              </div>
              <div className="bg-slate-700/50 rounded p-2">
                <div className={`font-semibold text-sm ${netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {netChange >= 0 ? '+' : ''}{netChange.toFixed(2)}
                  {netChangePct != null && (
                    <span className="text-xs ml-1">({netChangePct >= 0 ? '+' : ''}{netChangePct.toFixed(1)}%)</span>
                  )}
                </div>
                <div className="text-slate-500 text-xs mt-0.5">Change</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
