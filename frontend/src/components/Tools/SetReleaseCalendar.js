import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Package, Users, Clock, MapPin, Star, Award, ExternalLink, Loader2 } from 'lucide-react';
import axios from 'axios';

// Scryfall set types that aren't playable sets (same exclusions as backend/utils/scryfallSets.js)
const EXCLUDED_SET_TYPES = new Set(['token', 'memorabilia', 'art_series', 'promo']);

const TYPE_LABELS = {
  expansion: 'Standard Set',
  core: 'Standard Set',
  commander: 'Commander Set',
  duel_commander: 'Commander Set',
  masters: 'Masters Set',
  draft_innovation: 'Draft Innovation Set',
  eternal: 'Eternal Set',
  box: 'Box Set',
  masterpiece: 'Masterpiece Series',
  funny: 'Un-Set / Humor',
  starter: 'Starter Set',
  spellbook: 'Spellbook Series',
  duel_deck: 'Duel Deck',
  from_the_vault: 'From the Vault',
  planechase: 'Planechase',
  premium_deck: 'Premium Deck',
  archenemy: 'Archenemy',
  minigame: 'Minigame',
  arsenal: 'Arsenal',
  vanguard: 'Vanguard'
};

const humanizeType = (type) => type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const typeLabel = (type) => TYPE_LABELS[type] || humanizeType(type);

const categoryFor = (type) => {
  if (type === 'expansion' || type === 'core') return 'standard';
  if (type === 'commander' || type === 'duel_commander') return 'commander';
  return 'other';
};

// Scryfall doesn't publish prerelease dates; prerelease weekend is
// traditionally one week before release day, so derive that offset.
const prereleaseDateFor = (releaseDate) => {
  const d = new Date(`${releaseDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
};

const SetReleaseCalendar = () => {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'

  const loadSets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('https://api.scryfall.com/sets');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recentCutoff = new Date(today);
      recentCutoff.setDate(recentCutoff.getDate() - 120);

      const usable = (data?.data || []).filter(
        (s) => !s.digital && s.released_at && !EXCLUDED_SET_TYPES.has(s.set_type)
      );

      // Upcoming sets first (soonest first), then what released recently so
      // the "Released" status still has something to show.
      const upcoming = usable
        .filter((s) => new Date(s.released_at) >= today)
        .sort((a, b) => a.released_at.localeCompare(b.released_at));
      const recentlyReleased = usable
        .filter((s) => {
          const d = new Date(s.released_at);
          return d < today && d >= recentCutoff;
        })
        .sort((a, b) => b.released_at.localeCompare(a.released_at));

      setSets(
        [...upcoming, ...recentlyReleased].map((s) => ({
          id: s.code,
          name: s.name,
          code: s.code.toUpperCase(),
          type: typeLabel(s.set_type),
          category: categoryFor(s.set_type),
          releaseDate: s.released_at,
          prereleaseDate: prereleaseDateFor(s.released_at),
          cardCount: s.card_count,
          icon: s.icon_svg_uri,
          scryfallUrl: s.scryfall_uri
        }))
      );
    } catch (err) {
      setError(
        err.response?.status === 429
          ? 'Scryfall is rate-limiting requests right now — wait a minute and try again.'
          : 'Could not reach Scryfall. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const filteredSets = sets.filter(set => {
    const matchesType = filterType === 'all' || set.category === filterType;
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
          Upcoming MTG set releases with prerelease dates and card information — live from Scryfall
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
                  <option value="commander">Commander Sets</option>
                  <option value="other">Other Sets</option>
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
                    Prerelease events are typically held a week before the official release date. Prerelease dates shown are that typical offset — Scryfall only publishes the release date.
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

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p>Loading set calendar from Scryfall...</p>
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={loadSets}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Retry
                </button>
              </div>
            ) : filteredSets.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p>No sets match your filters.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSets.map((set) => {
                  const status = getStatus(set.releaseDate);
                  const days = daysUntilRelease(set.releaseDate);

                  return (
                    <div key={set.id} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            {set.icon && (
                              <img src={set.icon} alt="" className="w-6 h-6" />
                            )}
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

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
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
                            <span className="text-gray-400">Prerelease (typ.):</span>
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
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <div className="text-sm text-gray-400">
                          {status === 'released' && 'Released'}
                          {status === 'soon' && `Releases in ${days} days`}
                          {status === 'upcoming' && `Releases in ${days} days`}
                        </div>
                        <a
                          href={set.scryfallUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 hover:text-purple-200 px-2 py-1 rounded transition"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View on Scryfall
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
