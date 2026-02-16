import React, { useState } from 'react';
import { Trophy, Users, Zap, BookOpen, Search, Calendar } from 'lucide-react';

const FormatGuides = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFormat, setExpandedFormat] = useState(null);

  const toggleFormat = (formatName) => {
    setExpandedFormat(expandedFormat === formatName ? null : formatName);
  };

  // Format information
  const formats = [
    {
      name: 'Standard',
      icon: Trophy,
      description: 'Uses cards from the most recent sets (usually the last 2-3 years)',
      rules: [
        'Maximum 4 copies of any card (except basic lands)',
        'Only cards from recent sets are legal',
        'Rotates regularly with new set releases'
      ],
      bannedList: [
        'Field of the Dead',
        'Oko, Thief of Crowns',
        'Once Upon a Time',
        'Ragavan, Nimble Pilferer',
        'Urza, Lord High Artificer'
      ],
      rotationSchedule: 'Typically rotates in April and October',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Most competitive format',
        'Regular rotation keeps meta fresh',
        'Focus on newer cards and strategies'
      ],
      tips: [
        'Stay updated on rotation announcements',
        'Focus on versatile cards that work in multiple matchups',
        'Watch for new archetypes with each set release'
      ]
    },
    {
      name: 'Modern',
      icon: Zap,
      description: 'Uses cards from Eighth Edition onward',
      rules: [
        'Maximum 4 copies of any card (except basic lands)',
        'All sets from Eighth Edition (2003) onward are legal',
        'No rotation schedule - cards never rotate out'
      ],
      bannedList: [
        'Arcum Dagsson',
        'Bridge from Below',
        'Cloud of Faeries',
        'Dark Depths',
        'Deathrite Shaman',
        'Dig Through Time',
        'Eye of Ugin',
        'Faithless Looting',
        'Field of the Dead',
        'Golgari Grave-Troll',
        'Great Furnace',
        'Krark-Clan Ironworks',
        'Mental Misstep',
        'Oko, Thief of Crowns',
        'Once Upon a Time',
        'Peroxys, Reality Sculptor',
        'Ponder',
        'Seat of the Synod',
        'Simian Spirit Guide',
        'Skullclamp',
        'Stoneforge Mystic',
        'Sword of the Meek',
        'Tree of Tales',
        'Umezawa\'s Jitte',
        'Warren Weirding',
        'Wild Mongrel'
      ],
      rotationSchedule: 'No rotation - cards never rotate out',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Much larger card pool than Standard',
        'More diverse range of strategies',
        'Home to many powerful linear decks'
      ],
      tips: [
        'Learn the extensive banned list',
        'Focus on efficient threats and answers',
        'Understand the format\'s fast pace'
      ]
    },
    {
      name: 'Commander',
      icon: Users,
      description: 'Singleton format with a legendary creature commander',
      rules: [
        'Deck must contain exactly 100 cards (including commander)',
        'Only one copy of each card (except basic lands)',
        'Deck must match commander\'s colors',
        'Start with 40 life',
        'Commander can be cast from command zone'
      ],
      bannedList: [
        'Braids, Conjurer Adept',
        'Flash',
        'Lutri, the Spellchaser',
        'Mana Crypt',
        'Mana Vault',
        'Maralen of the Mornsong',
        'Metalworker',
        'Necropotence',
        'Oko, Thief of Crowns',
        'Panoptic Mirror',
        'Paradox Engine',
        'Rofellos, Llanowar Emissary',
        'Sassari, Fiendish Snooper',
        'Sensei\'s Divining Top',
        'Skullclamp',
        'Smuggler\'s Copter',
        'Sundering Titan',
        'Swords to Plowshares',
        'Thrasios, Triton Hero',
        'Time Walk',
        'Tolarian Academy',
        'Treasure Cruise',
        'Vampiric Tutor',
        'Wheel of Fortune'
      ],
      rotationSchedule: 'Quarterly updates to banned list',
      deckSize: '100 cards (exactly)',
      lifeTotal: '40',
      uniqueFeatures: [
        'Emphasizes social play',
        'Commander tax increases casting cost each time',
        'Casual format with competitive elements',
        'Many sub-formats (Tiny Leaders, Brawl, etc.)'
      ],
      tips: [
        'Build around your commander\'s strengths',
        'Include plenty of card draw',
        'Consider politics and board state management',
        'Know when to hold back on board wipes'
      ]
    },
    {
      name: 'Legacy',
      icon: BookOpen,
      description: 'Almost all Magic cards ever printed are legal',
      rules: [
        'Maximum 4 copies of any card (except basic lands)',
        'Nearly all cards ever printed are legal',
        'Very few restrictions beyond the 4-copy rule'
      ],
      bannedList: [
        'Ancestral Recall',
        'Balance',
        'Bayou',
        'Black Lotus',
        'Blightsteel Colossus',
        'Blue Mana Battery',
        'Braids, Conjurer Adept',
        'Channel',
        'Chaos Orb',
        'Contract from Below',
        'Crash Landing',
        'Demonic Attorney',
        'Demonic Consultation',
        'Demonic Tutor',
        'Dig Time',
        'Earthcraft',
        'Edge of Autumn',
        'Fastbond',
        'Flash',
        'Frantic Search',
        'Gaea\'s Cradle',
        'Goblin Recruiter',
        'Grim Monolith',
        'Hermit Druid',
        'Imperial Seal',
        'Intuition',
        'Jeweled Bird',
        'Library of Alexandria',
        'Lion\'s Eye Diamond',
        'Lurrus of the Dream-Den',
        'Mana Crypt',
        'Mana Drain',
        'Mana Vault',
        'Memory Jar',
        'Mind Over Matter',
        'Mox Emerald',
        'Mox Jet',
        'Mox Pearl',
        'Mox Ruby',
        'Mox Sapphire',
        'Nether Void',
        'Nevinyrral\'s Disk',
        'Oko, Thief of Crowns',
        'Painter\'s Servant',
        'Panoptic Mirror',
        'Peek',
        'Personal Tutor',
        'Pool of Knowledge',
        'Power Artifact',
        'Power Leak',
        'Proxy Creature',
        'Rebirth',
        'Regrowth',
        'Relearn',
        'Sassari, Fiendish Snooper',
        'Scheme Stone',
        'Scroll Rack',
        'Scrubland',
        'Shahrazad',
        'Sneak Attack',
        'Sol Ring',
        'Strip Mine',
        'Sundering Titan',
        'Swords to Plowshares',
        'Taiga',
        'Time Spiral',
        'Time Vault',
        'Time Walk',
        'Timetwister',
        'Tolarian Academy',
        'Trade Secrets',
        'Tropical Island',
        'Underground Sea',
        'Vampiric Tutor',
        'Volcanic Island',
        'Wheel of Fortune',
        'Windfall',
        'World Championship Series',
        'Worldgorger Dragon',
        'Yawgmoth\'s Will'
      ],
      rotationSchedule: 'No rotation - cards never rotate out',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Largest card pool in Magic',
        'Most powerful format (besides Vintage)',
        'Extremely high power level',
        'Complex and diverse metagame'
      ],
      tips: [
        'Master the extensive banned list',
        'Focus on efficient disruption',
        'Understand the high power level of the format',
        'Be prepared for any possible card'
      ]
    },
    {
      name: 'Vintage',
      icon: Calendar,
      description: 'All Magic cards ever printed are legal with restricted list',
      rules: [
        'Most cards are legal',
        'Restricted list limits certain powerful cards to 1 copy',
        'Some cards are banned entirely'
      ],
      bannedList: [
        'Bronze Tablet',
        'Contract from Below',
        'Demonic Pet',
        'Demonic Tutorial',
        'Edge of Autumn',
        'Fastbond',
        'Hefty',
        'Jeweled Bird',
        'Mind Twist',
        'Mox Emerald',
        'Mox Jet',
        'Mox Pearl',
        'Mox Ruby',
        'Mox Sapphire',
        'Narset\'s Wheel',
        'Pandora\'s Box',
        'Pool of Knowledge',
        'Power Leak',
        'Shahrazad',
        'Sorceress Queen',
        'Timetwister',
        'World Championship Series',
        'Yawgmoth\'s Embrace'
      ],
      restrictedList: [
        'Ancestral Recall',
        'Black Lotus',
        'Channel',
        'Contract from Below',
        'Demonic Consultation',
        'Demonic Tutor',
        'Earthcraft',
        'Gaea\'s Cradle',
        'Goblin Recruiter',
        'Griselbrand',
        'Hermit Druid',
        'Imperial Seal',
        'Jeweled Bird',
        'Lotus Petal',
        'Mana Crypt',
        'Mana Drain',
        'Mana Vault',
        'Memory Jar',
        'Mental Misstep',
        'Mind Over Matter',
        'Mishra\'s Workshop',
        'Necropotence',
        'Nether Void',
        'Nevinyrral\'s Disk',
        'Oko, Thief of Crowns',
        'Polymorph',
        'Power Artifact',
        'Rebirth',
        'Regrowth',
        'Sassari, Fiendish Snooper',
        'Scheme Stone',
        'Serra\'s Embrace',
        'Sol Ring',
        'Strip Mine',
        'Sundering Titan',
        'Swords to Plowshares',
        'Time Spiral',
        'Time Vault',
        'Time Walk',
        'Timetwister',
        'Tolarian Academy',
        'Treasure Cruise',
        'Vampiric Tutor',
        'Wheel of Fortune',
        'Windfall',
        'Worldgorger Dragon',
        'Yawgmoth\'s Will'
      ],
      rotationSchedule: 'No rotation - cards never rotate out',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Most powerful format in Magic',
        'Restricted list balances the most powerful cards',
        'Highest power level and fastest games',
        'Historic and prestigious format'
      ],
      tips: [
        'Understand the restricted list implications',
        'Focus on fast, efficient strategies',
        'Prepare for the highest power level games',
        'Master the most iconic Vintage cards'
      ]
    }
  ];

  const filteredFormats = formats.filter(format => 
    format.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    format.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Format Guides</h1>
        <p className="text-gray-400">
          Overview of Magic: The Gathering formats with rules and guidelines
        </p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search formats..."
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredFormats.length > 0 ? (
          filteredFormats.map((format) => {
            const Icon = format.icon;
            return (
              <div key={format.name} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => toggleFormat(format.name)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="text-purple-400" size={20} />
                    <div>
                      <h2 className="text-lg font-semibold text-white">{format.name}</h2>
                      <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                        {format.deckSize}
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">{format.description}</div>
                </button>
                
                {expandedFormat === format.name && (
                  <div className="p-4 pt-0 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-medium text-purple-300 mb-3">Basic Rules</h3>
                        <ul className="space-y-2">
                          {format.rules.map((rule, index) => (
                            <li key={index} className="flex items-start">
                              <Trophy size={16} className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                              <span className="text-gray-300">{rule}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-purple-300 mb-3">Format Details</h3>
                        <div className="space-y-2 text-gray-300">
                          <div className="flex justify-between">
                            <span>Life Total:</span>
                            <span className="font-medium">{format.lifeTotal}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Rotation Schedule:</span>
                            <span className="font-medium">{format.rotationSchedule}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Deck Size:</span>
                            <span className="font-medium">{format.deckSize}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-purple-300 mb-3">Banned Cards</h3>
                      <div className="flex flex-wrap gap-2">
                        {format.bannedList.length > 0 ? (
                          format.bannedList.map((card, index) => (
                            <span key={index} className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm">
                              {card}
                            </span>
                          ))
                        ) : (
                          <p className="text-gray-500 italic">No banned cards</p>
                        )}
                      </div>
                    </div>
                    
                    {format.name === 'Vintage' && (
                      <div>
                        <h3 className="font-medium text-purple-300 mb-3">Restricted Cards (1 copy allowed)</h3>
                        <div className="flex flex-wrap gap-2">
                          {format.restrictedList.map((card, index) => (
                            <span key={index} className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm">
                              {card}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="font-medium text-purple-300 mb-3">Unique Features</h3>
                      <ul className="space-y-2">
                        {format.uniqueFeatures.map((feature, index) => (
                          <li key={index} className="flex items-start">
                            <Zap size={16} className="text-blue-400 mt-1 mr-2 flex-shrink-0" />
                            <span className="text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-purple-300 mb-3">Tips for Success</h3>
                      <ul className="space-y-2">
                        {format.tips.map((tip, index) => (
                          <li key={index} className="flex items-start">
                            <BookOpen size={16} className="text-green-400 mt-1 mr-2 flex-shrink-0" />
                            <span className="text-gray-300">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Trophy className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No formats found</h3>
            <p className="text-gray-500">
              Try adjusting your search criteria
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/30">
        <h3 className="text-xl font-semibold text-white mb-4">About Magic Formats</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
          <div>
            <h4 className="font-medium text-purple-300 mb-2">Format Selection</h4>
            <p className="text-sm">
              Different formats offer different experiences in Magic: The Gathering. 
              Choose a format based on your budget, time commitment, and preferred play style. 
              Standard is great for beginners, while Legacy and Vintage offer the highest power level.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-purple-300 mb-2">Getting Started</h4>
            <p className="text-sm">
              Start with Standard or Commander if you're new to the game. 
              These formats have active communities and plenty of resources for learning. 
              As you become more experienced, you can explore other formats.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormatGuides;