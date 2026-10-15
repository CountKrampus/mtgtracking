import React, { useState, useEffect, useCallback } from 'react';
import { Eye, AlertTriangle, Star, TrendingUp, Search, Calendar, Users, Loader2 } from 'lucide-react';
import axios from 'axios';

// Scryfall set types that aren't playable sets (same exclusions as backend/utils/scryfallSets.js)
const EXCLUDED_SET_TYPES = new Set(['token', 'memorabilia', 'art_series', 'promo']);
const MAX_UPCOMING_SETS = 4;
const MAX_PAGES_PER_SET = 4;
const SPOILER_WINDOW_DAYS = 60;

const RARITY_LABELS = {
  mythic: 'Mythic Rare',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
  bonus: 'Bonus',
  special: 'Special'
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const firstFace = (card) => (card.card_faces && card.card_faces[0]) || {};

const mapCard = (card, setName) => ({
  id: card.id,
  name: card.name,
  set: setName,
  rarity: RARITY_LABELS[card.rarity] || card.rarity,
  type: card.type_line || firstFace(card).type_line || '',
  manaCost: card.mana_cost || firstFace(card).mana_cost || '',
  text:
    card.oracle_text ||
    (card.card_faces || []).map((face) => face.oracle_text).filter(Boolean).join('\n//\n'),
  power: card.power ?? firstFace(card).power ?? null,
  toughness: card.toughness ?? firstFace(card).toughness ?? null,
  flavorText: card.flavor_text || firstFace(card).flavor_text || null,
  // Preorder prices are often still null during spoiler season — show '—'.
  price: card.prices?.usd || card.prices?.usd_foil || null,
  collectorNumber: card.collector_number || '',
  hasArtVariants: !!card.variation || !!card.full_art
});

const SpoilerSeasonIntegration = () => {
  const [spoilerSets, setSpoilerSets] = useState([]); // sets that already have cards on Scryfall
  const [activeCode, setActiveCode] = useState(null);
  const [nextSet, setNextSet] = useState(null); // nearest upcoming set when nothing is spoiled yet
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterRarity, setFilterRarity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('number');

  const fetchSpoilers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get('https://api.scryfall.com/sets');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const windowCutoff = new Date(today);
      windowCutoff.setDate(windowCutoff.getDate() + SPOILER_WINDOW_DAYS);

      // Nearest few sets that haven't released yet — that's where spoiler
      // season is (or is about to be).
      const upcoming = (data?.data || [])
        .filter(
          (s) =>
            !s.digital &&
            s.released_at &&
            !EXCLUDED_SET_TYPES.has(s.set_type) &&
            new Date(s.released_at) >= today &&
            new Date(s.released_at) <= windowCutoff
        )
        .sort((a, b) => a.released_at.localeCompare(b.released_at))
        .slice(0, MAX_UPCOMING_SETS);

      if (upcoming.length === 0) {
        setSpoilerSets([]);
        setActiveCode(null);
        setNextSet(null);
        return;
      }

      const collected = [];
      let anyFailure = false;

      for (const s of upcoming) {
        const cards = [];
        let total = 0;
        let url = `https://api.scryfall.com/cards/search?q=e:${s.code}`;
        try {
          for (let page = 0; page < MAX_PAGES_PER_SET && url; page++) {
            const res = await axios.get(url);
            total = res.data?.total_cards ?? cards.length;
            cards.push(...(res.data?.data || []));
            url = res.data?.has_more ? res.data?.next_page : null;
            if (url) await delay(100); // keep to Scryfall's requested spacing
          }
        } catch (err) {
          // 404 just means no cards spoiled yet for this set
          if (err.response?.status !== 404) {
            anyFailure = true;
          }
        }
        collected.push({ set: s, cards, total });
      }

      const withSpoilers = collected.filter((entry) => entry.total > 0);

      if (withSpoilers.length === 0 && anyFailure) {
        setError('Could not reach Scryfall. Check your connection and try again.');
        return;
      }

      setSpoilerSets(
        withSpoilers.map((entry) => ({
          code: entry.set.code,
          name: entry.set.name,
          releaseDate: entry.set.released_at,
          total: entry.total,
          cards: entry.cards.map((c) => mapCard(c, entry.set.name))
        }))
      );
      setActiveCode(withSpoilers.length > 0 ? withSpoilers[0].set.code : null);
      setNextSet(
        withSpoilers.length === 0
          ? { name: collected[0].set.name, releaseDate: collected[0].set.released_at }
          : null
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
    fetchSpoilers();
  }, [fetchSpoilers]);

  const activeSet = spoilerSets.find((s) => s.code === activeCode) || spoilerSets[0] || null;
  const activeCards = activeSet ? activeSet.cards : [];

  const filteredSpoilers = activeCards.filter(spoiler => {
    const matchesRarity = filterRarity === 'all' || spoiler.rarity.toLowerCase().includes(filterRarity.toLowerCase());
    const matchesType = filterType === 'all' || spoiler.type.toLowerCase().includes(filterType.toLowerCase());
    const matchesSearch = spoiler.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         spoiler.set.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRarity && matchesType && matchesSearch;
  });

  const sortedSpoilers = [...filteredSpoilers].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
      case 'name':
        return a.name.localeCompare(b.name);
      case 'number':
      default:
        return String(a.collectorNumber).localeCompare(String(b.collectorNumber), undefined, {
          numeric: true,
          sensitivity: 'base'
        });
    }
  });

  const getRarityColor = (rarity) => {
    switch (rarity.toLowerCase()) {
      case 'mythic rare':
        return 'border-yellow-500 bg-gradient-to-r from-yellow-500/20 to-orange-500/20';
      case 'rare':
        return 'border-blue-500 bg-blue-500/20';
      case 'uncommon':
        return 'border-silver-500 bg-silver-500/20';
      case 'common':
        return 'border-black-500 bg-black-500/20';
      default:
        return 'border-gray-500 bg-gray-500/20';
    }
  };

  const getTypeIcon = (type) => {
    if (type.includes('Creature')) return <Users className="w-4 h-4 text-green-400" />;
    if (type.includes('Instant') || type.includes('Sorcery')) return <TrendingUp className="w-4 h-4 text-red-400" />;
    if (type.includes('Artifact') || type.includes('Enchantment')) return <Star className="w-4 h-4 text-yellow-400" />;
    return <Star className="w-4 h-4 text-gray-400" />;
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const renderSpoilers = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Loading spoilers from Scryfall...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="py-12 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchSpoilers}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!activeSet) {
      return (
        <div className="py-12 text-center max-w-lg mx-auto">
          <Eye className="w-8 h-8 text-purple-400 mx-auto mb-3" />
          <p className="text-white font-semibold mb-2">No spoilers yet</p>
          {nextSet ? (
            <p className="text-gray-400 text-sm">
              {nextSet.name} releases {formatDate(nextSet.releaseDate)}. Officially revealed cards will
              appear here automatically as spoiler season starts.
            </p>
          ) : (
            <p className="text-gray-400 text-sm">No upcoming sets were found on Scryfall.</p>
          )}
        </div>
      );
    }

    if (sortedSpoilers.length === 0) {
      return <div className="py-12 text-center text-gray-400">No cards match your filters.</div>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedSpoilers.map((card) => (
          <div 
            key={card.id} 
            className={`p-4 rounded-lg border-2 ${getRarityColor(card.rarity)} hover:scale-105 transition-transform`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{card.name}</h3>
                <p className="text-gray-400 text-sm">{card.set}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-600/30 text-gray-300 px-2 py-1 rounded">
                  {card.rarity}
                </span>
                {card.hasArtVariants && (
                  <span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded">
                    Variants
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              {getTypeIcon(card.type)}
              <span className="text-sm text-gray-300">{card.type}</span>
              <span className="text-sm text-gray-300 ml-auto">{card.manaCost}</span>
            </div>

            <div className="mb-3 p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-white leading-relaxed whitespace-pre-line">{card.text}</p>
              {card.power && card.toughness && (
                <div className="mt-2 text-right">
                  <span className="text-sm font-bold text-white">{card.power}/{card.toughness}</span>
                </div>
              )}
            </div>

            {card.flavorText && (
              <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs italic text-yellow-300">
                "{card.flavorText}"
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400">Price:</span>
                <div className="text-green-400 font-medium">{card.price ? `$${card.price}` : '—'}</div>
              </div>
              <div>
                <span className="text-gray-400">Collector №:</span>
                <div className="text-white font-medium">{card.collectorNumber || '—'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Spoiler Season Integration</h1>
        <p className="text-gray-400">
          Newly revealed cards from upcoming sets — live from Scryfall
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Filters</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rarity</label>
                <select
                  value={filterRarity}
                  onChange={(e) => setFilterRarity(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Rarities</option>
                  <option value="mythic rare">Mythic Rare</option>
                  <option value="rare">Rare</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="common">Common</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Card Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Types</option>
                  <option value="creature">Creatures</option>
                  <option value="instant">Instants</option>
                  <option value="sorcery">Sorceries</option>
                  <option value="artifact">Artifacts</option>
                  <option value="enchantment">Enchantments</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="number">Set Order</option>
                  <option value="price">Price (USD)</option>
                  <option value="name">Card Name</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search cards..."
                    className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Eye className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-purple-400">Spoiler Season Tips</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Spoiler seasons typically begin 2-3 weeks before set release. Prices fluctuate based on reception.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-white">Spoiled Cards</h2>
                {spoilerSets.length > 1 && (
                  <select
                    value={activeSet ? activeSet.code : ''}
                    onChange={(e) => setActiveCode(e.target.value)}
                    className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {spoilerSets.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name} ({formatDate(s.releaseDate)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="text-sm text-gray-400">
                {sortedSpoilers.length} {sortedSpoilers.length === 1 ? 'card' : 'cards'} found
                {activeSet && activeSet.total > activeSet.cards.length && (
                  <span> · showing first {activeSet.cards.length} of {activeSet.total}</span>
                )}
              </div>
            </div>

            {renderSpoilers()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Spoiler Season Strategy
          </h3>
          <div className="space-y-3 text-gray-300">
            <p>
              <strong>Early Access:</strong> Spoiler seasons provide early insight into upcoming cards and potential format shifts.
            </p>
            <p>
              <strong>Price Watching:</strong> Monitor how community reception affects predicted prices.
            </p>
            <p>
              <strong>Deck Building:</strong> Start planning new deck ideas with upcoming cards.
            </p>
            <p>
              <strong>Collection Planning:</strong> Decide which cards to prioritize for your collection.
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            About Spoiler Seasons
          </h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Spoiler seasons typically begin 2-3 weeks before a set's official release.
            </p>
            <p>
              Cards are revealed gradually, often starting with rares and mythics.
            </p>
            <p>
              Community reaction and professional coverage influence card valuations.
            </p>
            <p>
              Spoiler seasons are a great time to research and plan for the new format.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpoilerSeasonIntegration;
