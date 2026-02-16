import React, { useState } from 'react';
import { Search, BookOpen, Filter, Tag } from 'lucide-react';

const KeywordGlossary = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedKeyword, setExpandedKeyword] = useState(null);

  const toggleKeyword = (keywordName) => {
    setExpandedKeyword(expandedKeyword === keywordName ? null : keywordName);
  };

  // Comprehensive list of MTG keywords with categories
  const keywords = [
    {
      name: 'Flying',
      category: 'Combat',
      description: 'Can only be blocked by creatures with flying or reach.',
      example: 'A creature with flying can only be blocked by other creatures with flying or reach abilities.',
      advanced: 'Creatures with flying deal damage to players directly if not blocked.'
    },
    {
      name: 'Trample',
      category: 'Combat',
      description: 'Excess combat damage carries over to defending player.',
      example: 'A 6/4 creature with trample attacking a 2/3 creature assigns 2 damage to the blocker and 4 to the defending player.',
      advanced: 'Damage assignment is strategic - you must assign lethal damage to blockers first.'
    },
    {
      name: 'First Strike',
      category: 'Combat',
      description: 'Deals combat damage before creatures without first strike.',
      example: 'A creature with first strike deals damage in the first strike damage step.',
      advanced: 'If both creatures have first strike, they deal damage simultaneously in the first strike step.'
    },
    {
      name: 'Double Strike',
      category: 'Combat',
      description: 'Deals combat damage during both first strike and normal combat damage steps.',
      example: 'A creature with double strike deals damage twice during combat.',
      advanced: 'Can deal lethal damage in first strike step, preventing opponent from dealing damage back.'
    },
    {
      name: 'Haste',
      category: 'Timing',
      description: 'Can attack and use tap abilities the turn it comes into play.',
      example: 'A creature with haste can attack on the turn it was played.',
      advanced: 'Does not remove summoning sickness for abilities that don\'t require tapping.'
    },
    {
      name: 'Vigilance',
      category: 'Combat',
      description: 'Doesn\'t tap when attacking.',
      example: 'A creature with vigilance remains untapped after attacking.',
      advanced: 'Allows the creature to block on opponent\'s turn after attacking.'
    },
    {
      name: 'Deathtouch',
      category: 'Combat',
      description: 'Any amount of damage is enough to destroy a creature.',
      example: 'A 1/1 creature with deathtouch deals lethal damage to any creature.',
      advanced: 'Applies to combat damage only, not other damage sources.'
    },
    {
      name: 'Hexproof',
      category: 'Protection',
      description: 'Can\'t be targeted by opponents\' spells or abilities.',
      example: 'Opponents cannot target a creature with hexproof with their spells.',
      advanced: 'Owner of the permanent can still target it with their own spells.'
    },
    {
      name: 'Indestructible',
      category: 'Protection',
      description: 'Can\'t be destroyed by damage or destroy effects.',
      example: 'A creature with indestructible survives lethal damage and destroy effects.',
      advanced: 'Still affected by exile effects and effects that say "put to graveyard".'
    },
    {
      name: 'Lifelink',
      category: 'Abilities',
      description: 'Damage dealt by this creature also causes you to gain that much life.',
      example: 'A 3/2 creature with lifelink deals 3 damage and you gain 3 life.',
      advanced: 'Applies to all damage dealt by the source, not just combat damage.'
    },
    {
      name: 'Reach',
      category: 'Combat',
      description: 'Can block creatures with flying.',
      example: 'A creature with reach can block flying creatures.',
      advanced: 'Also granted by the ability "can block as though it had flying".'
    },
    {
      name: 'Menace',
      category: 'Combat',
      description: 'Can\'t be blocked except by two or more creatures.',
      example: 'A creature with menace requires at least two blockers.',
      advanced: 'If only one creature can block, the creature with menace cannot be blocked.'
    },
    {
      name: 'Prowess',
      category: 'Abilities',
      description: 'Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.',
      example: 'Casting an instant gives a creature with prowess +1/+1.',
      advanced: 'Stacks with each noncreature spell cast.'
    },
    {
      name: 'Flash',
      category: 'Timing',
      description: 'Can be played at any time you could play an instant.',
      example: 'A creature with flash can be played during opponent\'s turn.',
      advanced: 'Often used for surprise blockers or last-second threats.'
    },
    {
      name: 'Equip',
      category: 'Abilities',
      description: 'Activated ability that attaches the Equipment to a target creature you control.',
      example: 'Pay the equip cost to attach an Equipment to a creature.',
      advanced: 'Only one Equipment of the same name can be attached to a single creature.'
    },
    {
      name: 'Channel',
      category: 'Abilities',
      description: 'Activated ability that destroys the permanent to activate an effect.',
      example: 'Sacrifice a land with channel to deal damage.',
      advanced: 'Can only be activated while the card is on the battlefield.'
    },
    {
      name: 'Convoke',
      category: 'Spells',
      description: 'Tap creatures to pay for generic mana costs.',
      example: 'Tap creatures to pay for generic mana in a spell\'s cost.',
      advanced: 'Each tapped creature pays for one mana of any color.'
    },
    {
      name: 'Dash',
      category: 'Spells',
      description: 'Cast for its dash cost to give a creature +1/+1 and haste until end of turn.',
      example: 'Pay the dash cost to temporarily boost a creature.',
      advanced: 'Returns to owner\'s hand at the beginning of the next end step.'
    },
    {
      name: 'Surge',
      category: 'Spells',
      description: 'Reduced cost if you or a teammate cast another spell this turn.',
      example: 'Cast a spell earlier in the turn to reduce surge cost.',
      advanced: 'Only applies to the player who cast the previous spell, not teammates in multiplayer.'
    },
    {
      name: 'Cycling',
      category: 'Spells',
      description: 'Pay the cycling cost and discard the card to draw a card.',
      example: 'Pay the cycling cost to replace the card with a new one.',
      advanced: 'Can be activated any time you could play an instant.'
    }
  ];

  const categories = ['all', ...new Set(keywords.map(k => k.category))];

  const filteredKeywords = keywords.filter(keyword => {
    const matchesSearch = keyword.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         keyword.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || keyword.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Keyword Glossary</h1>
        <p className="text-gray-400">
          Comprehensive guide to Magic: The Gathering keywords and abilities
        </p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search keywords..."
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="pl-10 pr-8 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredKeywords.length > 0 ? (
          filteredKeywords.map((keyword) => (
            <div key={keyword.name} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleKeyword(keyword.name)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <Tag className="text-purple-400" size={20} />
                  <div>
                    <h2 className="text-lg font-semibold text-white">{keyword.name}</h2>
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                      {keyword.category}
                    </span>
                  </div>
                </div>
                <div className="text-gray-400 text-sm">{keyword.description}</div>
              </button>
              
              {expandedKeyword === keyword.name && (
                <div className="p-4 pt-0 space-y-4">
                  <div className="border-t border-white/10 pt-4">
                    <h3 className="font-medium text-purple-300 mb-2">Description</h3>
                    <p className="text-gray-300">{keyword.description}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-purple-300 mb-2">Example</h3>
                    <p className="text-gray-300">{keyword.example}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-purple-300 mb-2">Advanced Rules</h3>
                    <p className="text-gray-300">{keyword.advanced}</p>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No keywords found</h3>
            <p className="text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/30">
        <h3 className="text-xl font-semibold text-white mb-4">About Keywords</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
          <div>
            <h4 className="font-medium text-purple-300 mb-2">What are Keywords?</h4>
            <p className="text-sm">
              Keywords in Magic: The Gathering are shorthand terms that represent complex rules. 
              Each keyword has a specific meaning that is defined in the comprehensive rules.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-purple-300 mb-2">Why Learn Keywords?</h4>
            <p className="text-sm">
              Understanding keywords is essential for playing Magic effectively. 
              They appear on thousands of cards and knowing their meanings helps 
              you understand card interactions and build better decks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeywordGlossary;