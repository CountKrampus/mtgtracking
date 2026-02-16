import React, { useState, useEffect } from 'react';
import { Calendar, TrendingDown, AlertTriangle, Eye, Clock, DollarSign } from 'lucide-react';

const ReprintTracker = () => {
  const [reprints, setReprints] = useState([
    {
      id: 1,
      cardName: 'Black Lotus',
      originalSet: 'Alpha',
      reprintSet: 'Universes Beyond: Fallout',
      reprintDate: '2024-06-28',
      originalValue: 15000,
      estimatedValueAfterReprint: 8000,
      status: 'confirmed',
      reason: 'Universes Beyond set'
    },
    {
      id: 2,
      cardName: 'Ancestral Recall',
      originalSet: 'Alpha',
      reprintSet: 'Modern Horizons 3',
      reprintDate: '2024-06-14',
      originalValue: 8000,
      estimatedValueAfterReprint: 4500,
      status: 'rumored',
      reason: 'Modern Horizons 3 leak'
    },
    {
      id: 3,
      cardName: 'Lightning Bolt',
      originalSet: 'Alpha',
      reprintSet: 'Ultimate Masters',
      reprintDate: '2018-08-24',
      originalValue: 15,
      estimatedValueAfterReprint: 8,
      status: 'historical',
      reason: 'Ultimate Masters reprint'
    }
  ]);

  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReprints = reprints.filter(reprint => {
    const matchesStatus = filterStatus === 'all' || reprint.status === filterStatus;
    const matchesSearch = reprint.cardName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'text-green-400 bg-green-400/20';
      case 'rumored': return 'text-yellow-400 bg-yellow-400/20';
      case 'historical': return 'text-blue-400 bg-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed': return <Eye className="w-4 h-4" />;
      case 'rumored': return <Clock className="w-4 h-4" />;
      case 'historical': return <AlertTriangle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Reprint Tracker</h1>
        <p className="text-gray-400">
          Track upcoming reprints that may affect card values
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Filters</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rumored">Rumored</option>
                  <option value="historical">Historical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search card names..."
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-400">Disclaimer</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Reprint predictions and value estimates are speculative and for entertainment purposes only.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Upcoming Reprints</h2>
              <div className="text-sm text-gray-400">
                {filteredReprints.length} {filteredReprints.length === 1 ? 'card' : 'cards'} found
              </div>
            </div>

            <div className="space-y-4">
              {filteredReprints.map((reprint) => (
                <div key={reprint.id} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{reprint.cardName}</h3>
                      <p className="text-gray-400 text-sm">
                        {reprint.originalSet} → {reprint.reprintSet}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reprint.status)}`}>
                        {getStatusIcon(reprint.status)}
                        {reprint.status.charAt(0).toUpperCase() + reprint.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Original Value:</span>
                      <div className="text-white font-medium flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${reprint.originalValue.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Est. New Value:</span>
                      <div className="text-white font-medium flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${reprint.estimatedValueAfterReprint.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Expected Date:</span>
                      <div className="text-white">{new Date(reprint.reprintDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Reason:</span>
                      <div className="text-white">{reprint.reason}</div>
                    </div>
                  </div>

                  {reprint.status !== 'historical' && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Estimated Value Impact:</span>
                        <span className="text-red-400 font-medium flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" />
                          ${(reprint.originalValue - reprint.estimatedValueAfterReprint).toLocaleString()} (-{
                            Math.round(((reprint.originalValue - reprint.estimatedValueAfterReprint) / reprint.originalValue) * 100)
                          }%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            Value Protection Tips
          </h3>
          <div className="space-y-3 text-gray-300">
            <p>
              <strong>Stay Informed:</strong> Follow official Wizards of the Coast announcements and reputable MTG news sources.
            </p>
            <p>
              <strong>Diversify Holdings:</strong> Spread valuable cards across different sets to minimize risk.
            </p>
            <p>
              <strong>Timing Sales:</strong> Consider selling before confirmed reprints become widely known.
            </p>
            <p>
              <strong>Focus on Uniqueness:</strong> Cards with unique mechanics or art are less likely to be reprinted.
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            About Reprint Tracking
          </h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Reprints can significantly impact card values, especially for expensive vintage cards.
            </p>
            <p>
              This tracker helps you stay informed about potential reprints and their expected impact.
            </p>
            <p>
              Remember that rumors and leaks should be treated with skepticism until officially confirmed.
            </p>
            <p>
              Historical data shows that reprints typically reduce card values by 30-70% depending on the card and set.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReprintTracker;