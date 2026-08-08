export const COLOR_PIPS = { W: 'w', U: 'u', B: 'b', R: 'r', G: 'g' };

export function ManaIcon({ color, size = 14 }) {
  const key = COLOR_PIPS[color];
  if (!key) return null;
  return <i className={`ms ms-${key} ms-cost ms-shadow`} style={{ fontSize: size, verticalAlign: 'middle' }} />;
}

export const FORMAT_COLORS = {
  commander:   'bg-purple-600/30 text-purple-300 border-purple-500/40',
  standard:    'bg-blue-600/30 text-blue-300 border-blue-500/40',
  modern:      'bg-green-600/30 text-green-300 border-green-500/40',
  pioneer:     'bg-teal-600/30 text-teal-300 border-teal-500/40',
  legacy:      'bg-amber-600/30 text-amber-300 border-amber-500/40',
  vintage:     'bg-red-600/30 text-red-300 border-red-500/40',
  pauper:      'bg-gray-600/30 text-gray-300 border-gray-500/40',
  draft:       'bg-orange-600/30 text-orange-300 border-orange-500/40',
  oathbreaker: 'bg-pink-600/30 text-pink-300 border-pink-500/40',
  other:       'bg-slate-600/30 text-slate-300 border-slate-500/40',
};
