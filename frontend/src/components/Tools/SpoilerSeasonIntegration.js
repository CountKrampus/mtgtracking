import React, { useState, useEffect } from 'react';
import { Eye, AlertTriangle, Star, TrendingUp, Search, Filter, Calendar, Users } from 'lucide-react';

const SpoilerSeasonIntegration = () => {
  const [spoilers, setSpoilers] = useState([
    {
      id: 1,
      name: 'Cosmic Horror',
      set: 'Duskmourn: House of Horror',
      rarity: 'Mythic Rare',
      type: 'Sorcery',
      manaCost: '{3}{B}{B}',
      text: 'Destroy all creatures. Each opponent loses 3 life and discards 3 cards. You gain 3 life.',
      power: null,
      toughness: null,
      flavorText: 'The void remembers what was stolen from it.',
      imageUrl: '',
      spoilerDate: '2024-08-15',
      status: 'confirmed',
      communityRating: 4.8,
      predictedPrice: '$45.00',
      hasArtVariants: true,
      relatedCards: ['Mind Flayer', 'Eldritch Abomination']
    },
    {
      id: 2,
      name: 'Moonlit Cavalry',
      set: 'Duskmourn: House of Horror',
      rarity: 'Uncommon',
      type: 'Creature — Human Knight',
      manaCost: '{2}{W}',
      text: 'Flying, vigilance\nWhen Moonlit Cavalry enters the battlefield, you may search your library for a Plains card, reveal it, put it into your hand, then shuffle.',
      power: '2',
      toughness: '3',
      flavorText: '"The moon guides our blades."',
      imageUrl: '',
      spoilerDate: '2024-08-10',
      status: 'confirmed',
      communityRating: 4.2,
      predictedPrice: '$2.50',
      hasArtVariants: false,
      relatedCards: ['Knight of the Kitchen Sink']
    },
    {
      id: 3,
      name: 'Dungeon Delver',
      set: 'Duskmourn: House of Horror',
      rarity: 'Common',
      type: 'Creature — Human Rogue',
      manaCost: '{1}{R}',
      text: 'When Dungeon Delver enters the battlefield, you may activate an ability of a permanent you control once more this turn.',
      power: '2',
      toughness: '1',
      flavorText: 'Experience is the best teacher, especially when the lesson is survival.',
      imageUrl: '',
      spoilerDate: '2024-08-05',
      status: 'confirmed',
      communityRating: 3.9,
      predictedPrice: '$0.50',
      hasArtVariants: false,
      relatedCards: ['Goblin Guide', 'Monastery Swiftspear']
    },
    {
      id: 4,
      name: 'Phantom Librarian',
      set: 'Duskmourn: House of Horror',
      rarity: 'Rare',
      type: 'Creature — Spirit Wizard',
      manaCost: '{1}{U}',
      text: 'Flying\nWhenever you cast a spell, you may pay {1}. If you do, draw a card.',
      power: '1',
      toughness: '3',
      flavorText: 'Knowledge haunts the living.',
      imageUrl: '',
      spoilerDate: '2024-08-12',
      status: 'confirmed',
      communityRating: 4.5,
      predictedPrice: '$8.00',
      hasArtVariants: true,
      relatedCards: ['Archmage of Echoes', 'Stormscape Familiar']
    }
  ]);

  const [filterRarity, setFilterRarity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const filteredSpoilers = spoilers.filter(spoiler => {
    const matchesRarity = filterRarity === 'all' || spoiler.rarity.toLowerCase().includes(filterRarity.toLowerCase());
    const matchesType = filterType === 'all' || spoiler.type.toLowerCase().includes(filterType.toLowerCase());
    const matchesSearch = spoiler.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         spoiler.set.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRarity && matchesType && matchesSearch;
  });

  const sortedSpoilers = [...filteredSpoilers].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.spoilerDate) - new Date(a.spoilerDate);
      case 'rating':
        return b.communityRating - a.communityRating;
      case 'price':
        return parseFloat(b.predictedPrice.replace('$', '')) - parseFloat(a.predictedPrice.replace('$', ''));
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
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

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Spoiler Season Integration</h1>
        <p className="text-gray-400">
          View and track newly spoiled cards from upcoming sets
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
                  <option value="date">Most Recent</option>
                  <option value="rating">Community Rating</option>
                  <option value="price">Predicted Price</option>
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Spoiled Cards</h2>
              <div className="text-sm text-gray-400">
                {sortedSpoilers.length} {sortedSpoilers.length === 1 ? 'card' : 'cards'} found
              </div>
            </div>

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
                    <p className="text-sm text-white leading-relaxed">{card.text}</p>
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
                      <span className="text-gray-400">Rating:</span>
                      <div className="text-yellow-400 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        {card.communityRating}/5.0
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Predicted:</span>
                      <div className="text-green-400 font-medium">{card.predictedPrice}</div>
                    </div>
                  </div>

                  {card.relatedCards && card.relatedCards.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <span className="text-xs text-gray-400">Related:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {card.relatedCards.map((related, idx) => (
                          <span key={idx} className="text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded">
                            {related}
                          </span>
                        ))}
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