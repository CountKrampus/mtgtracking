import React from 'react';

export default function SparklinePopup({ sparkline }) {
  if (!sparkline || sparkline.history.length < 2) return null;

  const w = 200, h = 80, pad = 8;
  const prices = sparkline.history.map(p => p.price);
  const maxP = Math.max(...prices);
  const minP = Math.min(...prices);
  const range = maxP - minP || 1;
  const xStep = (w - pad * 2) / (prices.length - 1);
  const pt = (i, p) => ({
    x: pad + i * xStep,
    y: h - pad - ((p - minP) / range) * (h - pad * 2)
  });
  const linePath = prices.map((p, i) => {
    const { x, y } = pt(i, p);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div
      style={{
        position: 'fixed',
        top: sparkline.pos.top - 100,
        left: sparkline.pos.left - 100,
        zIndex: 9999,
        width: 200,
        pointerEvents: 'none'
      }}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2"
    >
      <div className="text-xs text-slate-400 mb-1 truncate">{sparkline.cardName} · 30d</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
        {prices.map((p, i) => {
          const { x, y } = pt(i, p);
          return <circle key={i} cx={x} cy={y} r="2" fill="#a78bfa" />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>${minP.toFixed(2)}</span>
        <span>${maxP.toFixed(2)}</span>
      </div>
    </div>
  );
}
