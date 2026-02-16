import React, { useState, useEffect } from 'react';
import { Calendar, Package, Users, Clock, MapPin, Star, Award, TrendingUp } from 'lucide-react';

const SetReleaseCalendar = () => {
  const [sets, setSets] = useState([
    {
      id: 1,
      name: 'Duskmourn: House of Horror',
      code: 'DMU',
      type: 'Standard Set',
      releaseDate: '2024-09-20',
      prereleaseDate: '2024-09-14',
      cardCount: 275,
      theme: 'Horror, Dungeons',
      keywords: ['Dungeon', 'Disturb'],
      estimatedCards: 101,
      rareMythicSplit: '1:3.75',
      hasPromos: true,
      hasTokens: true,
      hasArtSeries: true
    },
    {
      id: 2,
      name: 'Murders at Karlov Manor',
      code: 'MKM',
      type: 'Standard Set',
      releaseDate: '2024-01-26',
      prereleaseDate: '2024-01-20',
      cardCount: 276,
      theme: 'Detective, Gothic',
      keywords: ['Investigate', 'Crew'],
      estimatedCards: 101,
      rareMythicSplit: '1:3.75',
      hasPromos: true,
      hasTokens: true,
      hasArtSeries: false
    },
    {
      id: 3,
      name: 'Outlaws of Thunder Junction',
      code: 'OTJ',
      type: 'Standard Set',
      releaseDate: '2024-04-19',
      prereleaseDate: '2024-04-13',
      cardCount: 274,
      theme: 'Wild West, Outlaws',
      keywords: ['Town', 'Raider'],
      estimatedCards: 101,
      rareMythicSplit: '1:3.75',
      hasPromos: true,
      hasTokens: true,
      hasArtSeries: false
    },
    {
      id: 4,
      name: 'Modern Horizons 3',
      code: 'MH3',
      type: 'Non-Standard Set',
      releaseDate: '2024-06-14',
      prereleaseDate: '2024-06-08',
      cardCount: 513,
      theme: 'Modern-legal reimaginings',
      keywords: ['Casualty', 'Escape'],
      estimatedCards: 200,
      rareMythicSplit: '1:3.75',
      hasPromos: true,
      hasTokens: true,
      hasArtSeries: true
    },
    {
      id: 5,
      name: 'Bloomburrow',
      code: 'BLB',
      type: 'Standard Set',
      releaseDate: '2024-07-19',
      prereleaseDate: '2024-07-13',
      cardCount: 275,
      theme: 'Anthropomorphic Animals',
      keywords: ['Buckle', 'Gnaw'],
      estimatedCards: 101,
      rareMythicSplit: '1:3.75',
      hasPromos: true,
      hasTokens: true,
      hasArtSeries: false
    },
    {
      id: 6,
      name: 'Thunder Junction: Big Score',
      code: 'TJK',
      type: 'Universes Beyond',
      releaseDate: '2024-08-23',
      prereleaseDate: '2024-08-17',
      cardCount: 165,
      theme: 'Heist, Western',
      keywords: ['Job', 'Score'],
      estimatedCards: 63,
      rareMythicSplit: '1:3.75',
      hasPromos: true,
      hasTokens: true,
      hasArtSeries: false
    }
  ]);

  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'

  const filteredSets = sets.filter(set => {
    const matchesType = filterType === 'all' || set.type.toLowerCase().includes(filterType.toLowerCase());
    const matchesSearch = set.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         set.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getStatus = (releaseDate) => {
    const today = new Date();
    const release = new Date(releaseDate);
    
    if (release < today) return 'released';
    if (release.getTime() - today.getTime() < 7 * 24 * 60 * 60 * 1000) return 'soon';
    return 'upcoming';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'released': return 'text-green-400 bg-green-400/20';
      case 'soon': return 'text-yellow-400 bg-yellow-400/20';
      case 'upcoming': return 'text-blue-400 bg-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const daysUntilRelease = (date) => {
    const today = new Date();
    const release = new Date(date);
    const diffTime = release - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Set Release Calendar</h1>
        <p className="text-gray-400">
          Upcoming MTG set releases with prerelease dates and card information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Filters</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Set Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Types</option>
                  <option value="standard">Standard Sets</option>
                  <option value="non-standard">Non-Standard Sets</option>
                  <option value="universes">Universes Beyond</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search sets..."
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">View Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      viewMode === 'list'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      viewMode === 'calendar'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    Calendar
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-400">Pro Tip</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Prerelease events are typically held a week before the official release date.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Upcoming Releases</h2>
              <div className="text-sm text-gray-400">
                {filteredSets.length} {filteredSets.length === 1 ? 'set' : 'sets'} found
              </div>
            </div>

            <div className="space-y-4">
              {filteredSets.map((set) => {
                const status = getStatus(set.releaseDate);
                const days = daysUntilRelease(set.releaseDate);
                
                return (
                  <div key={set.id} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          {set.name}
                          <span className="text-xs bg-gray-600/30 text-gray-300 px-2 py-1 rounded">
                            {set.code}
                          </span>
                        </h3>
                        <p className="text-gray-400 text-sm">{set.type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {status === 'released' ? <Package className="w-3 h-3" /> :
                           status === 'soon' ? <Clock className="w-3 h-3" /> :
                           <Calendar className="w-3 h-3" />}
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-gray-400">Release:</span>
                          <div className="text-white">{formatDate(set.releaseDate)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-gray-400">Prerelease:</span>
                          <div className="text-white">{formatDate(set.prereleaseDate)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-gray-400">Cards:</span>
                          <div className="text-white">{set.cardCount}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-gray-400">Est. Commons:</span>
                          <div className="text-white">{set.estimatedCards}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {set.keywords.map((keyword, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded">
                          {keyword}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      <div className="text-sm text-gray-400">
                        {status === 'released' && 'Released'}
                        {status === 'soon' && `Releases in ${days} days`}
                        {status === 'upcoming' && `Releases in ${days} days`}
                      </div>
                      <div className="flex gap-2">
                        {set.hasPromos && <span className="text-xs bg-yellow-600/20 text-yellow-300 px-2 py-1 rounded">Promos</span>}
                        {set.hasTokens && <span className="text-xs bg-green-600/20 text-green-300 px-2 py-1 rounded">Tokens</span>}
                        {set.hasArtSeries && <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded">Art Series</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Set Release Insights
          </h3>
          <div className="space-y-3 text-gray-300">
            <p>
              <strong>Standard Rotation:</strong> Sets typically rotate out of Standard after ~2 years.
            </p>
            <p>
              <strong>Collector Boosters:</strong> Contain more foils and premium cards than Draft Boosters.
            </p>
            <p>
              <strong>Prerelease Events:</strong> Great way to get early access to new cards and participate in tournaments.
            </p>
            <p>
              <strong>Set Themes:</strong> Each set introduces new mechanics and themes that influence the metagame.
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            About Set Releases
          </h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Magic: The Gathering typically releases 4-6 sets per year across different product lines.
            </p>
            <p>
              Standard sets are designed for the Standard format and rotate regularly.
            </p>
            <p>
              Special sets like Modern Horizons or Universes Beyond have different release schedules.
            </p>
            <p>
              Prerelease events offer players the chance to play with new cards before the official release.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetReleaseCalendar;