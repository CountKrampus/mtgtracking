import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, TrendingUp, TrendingDown, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import useSettings from '../hooks/useSettings';
import { API_URL } from '../config';

const CONDITION_COLORS = {
  NM: 'bg-green-500',
  LP: 'bg-lime-500',
  MP: 'bg-yellow-500',
  HP: 'bg-orange-500',
  DMG: 'bg-red-500'
};

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];

function ConditionBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-12 text-white/70 flex-shrink-0">{label}</div>
      <div className="flex-1 bg-white/10 rounded-full h-4 overflow-hidden">
        <div className={`h-4 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-14 text-white/80 text-right flex-shrink-0">{value}</div>
      <div className="w-10 text-white/40 text-right flex-shrink-0 text-xs">{pct.toFixed(0)}%</div>
    </div>
  );
}

export default function CollectionHealthReportView() {
  const navigate = useNavigate();
  const { authFetch } = useAuthContext();
  const { settings } = useSettings();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatPrice = (priceUSD) => {
    if (priceUSD == null || isNaN(priceUSD)) priceUSD = 0;
    if (settings.displayCurrency === 'CAD') return `C$${(priceUSD / settings.cadToUsdRate).toFixed(2)}`;
    if (settings.displayCurrency === 'EUR') return `€${(priceUSD * settings.usdToEurRate).toFixed(2)}`;
    return `$${priceUSD.toFixed(2)}`;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/health-report`);
        if (res.status === 404) {
          if (!cancelled) { setReport(null); setLoading(false); }
          return;
        }
        if (!res.ok) throw new Error('Failed to load collection health report');
        const data = await res.json();
        if (!cancelled) { setReport(data); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [authFetch]);

  if (loading) {
    return <div className="text-white/60 p-6">Loading collection health report...</div>;
  }

  if (error) {
    return <div className="text-red-400 p-6">{error}</div>;
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HeartPulse size={24} /> Collection Health Report
        </h1>
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 text-white/70">
          No report yet. Enable "Weekly collection health report" under Account Settings → Notifications
          to receive one, or check back after the next weekly run.
        </div>
      </div>
    );
  }

  const { conditionBreakdown, valueChange, upgradeSuggestions } = report;
  const totalCards = CONDITIONS.reduce((sum, c) => sum + (conditionBreakdown[c] || 0), 0);
  const deltaPositive = valueChange.delta >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HeartPulse size={24} /> Collection Health Report
        </h1>
        <button onClick={() => navigate('/dashboard')} className="text-white/60 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
      <div className="text-white/50 text-sm">Week of {new Date(report.weekOf).toLocaleDateString()}</div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          {deltaPositive ? <TrendingUp size={18} className="text-green-400" /> : <TrendingDown size={18} className="text-red-400" />}
          Value Change This Week
        </h2>
        <div className="flex items-baseline gap-3">
          <span className={`text-2xl font-bold ${deltaPositive ? 'text-green-400' : 'text-red-400'}`}>
            {deltaPositive ? '+' : ''}{formatPrice(valueChange.delta)}
          </span>
          <span className={`text-sm ${deltaPositive ? 'text-green-400' : 'text-red-400'}`}>
            ({deltaPositive ? '+' : ''}{valueChange.deltaPercent.toFixed(1)}%)
          </span>
        </div>
        <div className="text-white/40 text-xs mt-1">
          {formatPrice(valueChange.from)} → {formatPrice(valueChange.to)}
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Condition Breakdown</h2>
        <div className="space-y-2">
          {CONDITIONS.map(cond => (
            <ConditionBar
              key={cond}
              label={cond}
              value={conditionBreakdown[cond] || 0}
              total={totalCards}
              color={CONDITION_COLORS[cond]}
            />
          ))}
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" /> Worth a Look ({upgradeSuggestions.length})
        </h2>
        {upgradeSuggestions.length === 0 ? (
          <p className="text-white/50 text-sm">Nothing needs attention this week.</p>
        ) : (
          <div className="space-y-2">
            {upgradeSuggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition">
                <span className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${
                  s.reason === 'price_drop' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {s.reason === 'price_drop' ? 'Price Drop' : 'Poor Condition'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{s.name}</div>
                  <div className="text-white/40 text-xs">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
