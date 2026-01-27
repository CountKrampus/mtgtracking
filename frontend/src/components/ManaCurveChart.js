import React from 'react';

function ManaCurveChart({ manaCurve }) {
  if (!manaCurve) return null;

  const maxCount = Math.max(...Object.values(manaCurve));

  return (
    <div className="flex items-end justify-around h-48 gap-2">
      {Object.entries(manaCurve).map(([cmc, count]) => {
        const height = maxCount > 0 ? (count / maxCount) * 100 : 0;

        return (
          <div key={cmc} className="flex flex-col items-center gap-1 flex-1">
            <div className="text-white/60 text-xs">{count}</div>
            <div
              className="bg-gradient-to-t from-purple-600 to-blue-500 w-full rounded-t"
              style={{ height: `${height}%`, minHeight: count > 0 ? '8px' : '0' }}
            />
            <div className="text-white/80 text-sm font-semibold">{cmc}</div>
          </div>
        );
      })}
    </div>
  );
}

export default ManaCurveChart;
