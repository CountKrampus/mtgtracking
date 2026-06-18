import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// Lightweight SVG line chart (no external charting dependency) showing
// collection value over time. Uses the existing /api/stats/value-history
// endpoint which returns { value, cardCount, createdAt } snapshots.
export default function ValueHistoryChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_URL}/stats/value-history`);
        const points = res.data.map(item => ({
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

    fetchHistory();
  }, []);

  if (loading) {
    return <div className="text-slate-400">Loading chart...</div>;
  }

  if (!data.length) {
    return (
      <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-2">Collection Value History</h3>
        <p className="text-slate-400 text-sm">
          No value history yet. Snapshots are recorded automatically over time.
        </p>
      </div>
    );
  }

  const width = 600;
  const height = 220;
  const padding = 40;
  const values = data.map(d => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;
  const pointAt = (i, v) => {
    const x = padding + i * xStep;
    const y = height - padding - ((v - minValue) / range) * (height - padding * 2);
    return { x, y };
  };

  const linePath = data
    .map((d, i) => {
      const { x, y } = pointAt(i, d.value);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">Collection Value History</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 300 }}>
        {/* Axes */}
        <line
          x1={padding} y1={height - padding} x2={width - padding} y2={height - padding}
          stroke="rgba(255,255,255,0.2)" strokeWidth="1"
        />
        <line
          x1={padding} y1={padding} x2={padding} y2={height - padding}
          stroke="rgba(255,255,255,0.2)" strokeWidth="1"
        />
        {/* Value labels */}
        <text x={padding - 6} y={padding + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">
          ${maxValue.toFixed(0)}
        </text>
        <text x={padding - 6} y={height - padding} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.5)">
          ${minValue.toFixed(0)}
        </text>
        {/* Line */}
        <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" />
        {/* Points */}
        {data.map((d, i) => {
          const { x, y } = pointAt(i, d.value);
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="#a78bfa">
              <title>{`$${d.value.toFixed(2)} on ${d.date}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
