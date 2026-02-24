import React from 'react';

function ManaCurveChart({ manaCurve, selectedCmc, onCmcClick }) {
  if (!manaCurve) return null;

  const sortedEntries = Object.entries(manaCurve).sort((a, b) => {
    if (a[0] === '7+') return 1;
    if (b[0] === '7+') return -1;
    return parseInt(a[0]) - parseInt(b[0]);
  });

  const maxCount = Math.max(...sortedEntries.map(([, count]) => count), 1);

  return (
    <div className="flex items-end justify-around h-48 gap-2">
      {sortedEntries.map(([cmc, count]) => {
        const height = (count / maxCount) * 100;
        const isSelected = selectedCmc === cmc;

        return (
          <button
            key={cmc}
            onClick={() => onCmcClick && onCmcClick(isSelected ? null : cmc)}
            className="flex flex-col items-center gap-1 flex-1 focus:outline-none"
            title={`${count} card${count !== 1 ? 's' : ''} at CMC ${cmc}`}
          >
            <div className={`text-xs ${isSelected ? 'text-yellow-400 font-bold' : 'text-white/60'}`}>
              {count}
            </div>
            <div
              className={`w-full rounded-t transition-all duration-150 ${
                isSelected
                  ? 'bg-gradient-to-t from-yellow-500 to-orange-400 ring-1 ring-yellow-400'
                  : 'bg-gradient-to-t from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400'
              } ${onCmcClick ? 'cursor-pointer' : ''}`}
              style={{ height: `${height}%`, minHeight: count > 0 ? '8px' : '0' }}
            />
            <div className={`text-sm font-semibold ${isSelected ? 'text-yellow-400' : 'text-white/80'}`}>
              {cmc}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default ManaCurveChart;
