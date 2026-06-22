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
      description: 'Uses only cards from the most recent sets, rotating annually to keep the format fresh.',
      rules: [
        'Maximum 4 copies of any card (except basic lands)',
        'Only cards from sets released in the last two years are legal',
        'Rotates each autumn when new sets replace the oldest legal sets',
        'Currently around 1,500–2,000 legal cards at any given time'
      ],
      bannedList: [
        'Invoke Despair',
        'Reckoner Bankbuster',
        'Fable of the Mirror-Breaker',
        'The Meathook Massacre'
      ],
      rotationSchedule: 'Rotates each autumn with the third set of the year',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Most accessible and beginner-friendly competitive format',
        'Rotation keeps the meta constantly evolving with new sets',
        'Smallest card pool means simpler gameplay decisions',
        'Most widely supported format at local game stores and on Arena'
      ],
      tips: [
        'Follow rotation announcements to know when your cards become illegal',
        'Budget builds are viable since the card pool is intentionally limited',
        'Watch newly released sets — Standard shifts dramatically with each release',
        'Many past banned cards have since rotated; always check mtg.wizards.com for the current official list'
      ]
    },
    {
      name: 'Pioneer',
      icon: Zap,
      description: 'Uses cards from Return to Ravnica (2012) onward — a non-rotating format designed as a middle ground between Standard and Modern.',
      rules: [
        'Maximum 4 copies of any card (except basic lands)',
        'All cards from Return to Ravnica (October 2012) onward are legal',
        'No rotation — cards stay legal indefinitely',
        'Original fetchlands are not in the legal card pool (their printings predate 2012)'
      ],
      bannedList: [
        'Balustrade Spy',
        'Dig Through Time',
        'Felidar Guardian',
        'Gitaxian Probe',
        'Inverter of Truth',
        'Kethis, the Hidden Hand',
        'Leyline of Abundance',
        'Nexus of Fate',
        'Oko, Thief of Crowns',
        'Once Upon a Time',
        'Smuggler\'s Copter',
        'Teferi, Time Raveler',
        'Treasure Cruise',
        'Undercity Informer',
        'Uro, Titan of Nature\'s Wrath',
        'Veil of Summer'
      ],
      rotationSchedule: 'No rotation — cards never rotate out',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Designed as an accessible entry point to non-rotating formats',
        'No original fetchlands reduces mana base explosiveness vs. Modern',
        'Strong midrange, control, and combo archetypes',
        'Less expensive than Modern due to cheaper mana bases'
      ],
      tips: [
        'Good stepping stone between Standard and Modern',
        'The absence of original fetchlands reduces the power ceiling but also the cost',
        'Many Standard staples remain powerful in Pioneer after rotating out',
        'Check MTG Goldfish or MTGO Challenge results for current tier decks'
      ]
    },
    {
      name: 'Modern',
      icon: Zap,
      description: 'Uses cards from Eighth Edition (2003) onward — a high-power, fast-paced format with a massive card pool.',
      rules: [
        'Maximum 4 copies of any card (except basic lands)',
        'All sets from Eighth Edition (July 2003) onward are legal',
        'No rotation — once legal, always legal',
        'One of the most popular competitive constructed formats'
      ],
      bannedList: [
        'Ancient Den',
        'Arcum\'s Astrolabe',
        'Blazing Shoal',
        'Bridge from Below',
        'Cloudpost',
        'Dark Depths',
        'Deathrite Shaman',
        'Dig Through Time',
        'Eye of Ugin',
        'Gitaxian Probe',
        'Glimpse of Nature',
        'Golgari Grave-Troll',
        'Great Furnace',
        'Green Sun\'s Zenith',
        'Hogaak, Arisen Necropolis',
        'Hypergenesis',
        'Krark-Clan Ironworks',
        'Mental Misstep',
        'Mox Opal',
        'Oko, Thief of Crowns',
        'Once Upon a Time',
        'Ponder',
        'Preordain',
        'Punishing Fire',
        'Rite of Flame',
        'Second Sunrise',
        'Seat of the Synod',
        'Seething Song',
        'Simian Spirit Guide',
        'Skullclamp',
        'Splinter Twin',
        'Summer Bloom',
        'Treasure Cruise',
        'Tree of Tales',
        'Vault of Whispers',
        'Violent Outburst'
      ],
      rotationSchedule: 'No rotation — cards never rotate out',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Fast-paced — most games end by turns 3–5',
        'Enormous diversity of viable archetypes (Burn, Jund, Affinity, Humans, etc.)',
        'Fetchland + shockland mana bases enable consistent multi-color decks',
        'Regular ban announcements keep the format evolving'
      ],
      tips: [
        'The format is fast — interactive decks need cheap, efficient spells',
        'Fetch + shock mana bases are expensive but standard for competitive play',
        'Study the Modern tier list regularly; the meta shifts with each ban announcement',
        'Sideboard construction is critical given the format\'s enormous diversity'
      ]
    },
    {
      name: 'Commander',
      icon: Users,
      description: 'Multiplayer singleton format led by a legendary creature commander. The most popular casual format in Magic.',
      rules: [
        'Exactly 100 cards in the deck including the commander',
        'Only one copy of each card, except basic lands',
        'All cards must fit within the commander\'s color identity',
        'Start with 40 life',
        'Commander can be recast from the command zone; each recasting costs 2 additional mana'
      ],
      bannedList: [
        'Ancestral Recall',
        'Balance',
        'Biorhythm',
        'Black Lotus',
        'Braids, Cabal Minion',
        'Channel',
        'Chaos Orb',
        'Coalition Victory',
        'Emrakul, the Aeons Torn',
        'Erayo, Soratami Ascendant',
        'Falling Star',
        'Fastbond',
        'Flash',
        'Golos, Tireless Pilgrim',
        'Griselbrand',
        'Hullbreacher',
        'Iona, Shield of Emeria',
        'Karakas',
        'Leovold, Emissary of Trest',
        'Library of Alexandria',
        'Limited Resources',
        'Lutri, the Spellchaser',
        'Mana Crypt',
        'Mox Emerald',
        'Mox Jet',
        'Mox Pearl',
        'Mox Ruby',
        'Mox Sapphire',
        'Panoptic Mirror',
        'Paradox Engine',
        'Prophet of Kruphix',
        'Recurring Nightmare',
        'Rofellos, Llanowar Emissary',
        'Shahrazad',
        'Sway of the Stars',
        'Time Vault',
        'Time Walk',
        'Tinker',
        'Tolarian Academy',
        'Trade Secrets',
        'Upheaval',
        'Yawgmoth\'s Bargain'
      ],
      rotationSchedule: 'Ban list updated quarterly by the Commander Rules Committee',
      deckSize: '100 cards (exactly)',
      lifeTotal: '40',
      uniqueFeatures: [
        'Designed for multiplayer (typically 4 players)',
        'Commander tax prevents easy recasting of powerful commanders',
        'Color identity restricts deckbuilding based on your commander\'s colors',
        'Over 1,500 legal commanders creates near-infinite deck variety'
      ],
      tips: [
        'Build around your commander\'s strengths and synergies',
        'Include at least 10 sources of card draw and 10 sources of ramp',
        'Politics and threat assessment are as important as deck power in multiplayer',
        'Match your deck\'s power level to your playgroup for the best experience'
      ]
    },
    {
      name: 'Legacy',
      icon: BookOpen,
      description: 'Almost all Magic cards ever printed are legal, creating one of the most powerful and historically rich formats.',
      rules: [
        'Maximum 4 copies of any card (except basic lands)',
        'Nearly all cards ever printed are legal, with a targeted banned list',
        'Original dual lands, Force of Will, and historical staples are all legal',
        'One of the most powerful non-restricted formats in Magic'
      ],
      bannedList: [
        'Ancestral Recall',
        'Balance',
        'Black Lotus',
        'Channel',
        'Chaos Orb',
        'Contract from Below',
        'Darkpact',
        'Demonic Attorney',
        'Dig Through Time',
        'Earthcraft',
        'Falling Star',
        'Fastbond',
        'Flash',
        'Frantic Search',
        'Goblin Recruiter',
        'Jeweled Bird',
        'Library of Alexandria',
        'Memory Jar',
        'Mental Misstep',
        'Mind\'s Desire',
        'Mind Over Matter',
        'Mox Emerald',
        'Mox Jet',
        'Mox Pearl',
        'Mox Ruby',
        'Mox Sapphire',
        'Oath of Druids',
        'Panoptic Mirror',
        'Rebirth',
        'Sensei\'s Divining Top',
        'Shahrazad',
        'Skullclamp',
        'Strip Mine',
        'Survival of the Fittest',
        'Time Vault',
        'Time Walk',
        'Timetwister',
        'Tolarian Academy',
        'Treasure Cruise',
        'Yawgmoth\'s Bargain',
        'Yawgmoth\'s Will'
      ],
      rotationSchedule: 'No rotation — cards never rotate out',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Enormous card pool spanning all of Magic\'s history',
        'Dual lands and Force of Will are essential format staples',
        'High entry cost due to reserved list cards like original dual lands',
        'Diverse metagame: ANT, Reanimator, Miracles, Death & Taxes, Delver, and more'
      ],
      tips: [
        'Force of Will defines the format — learn to play with and around it',
        'Brainstorm + fetchlands is the fundamental blue card selection engine',
        'The reserved list makes some Legacy staples very expensive in paper',
        'MTGO is a cost-effective way to learn and test Legacy before buying in paper'
      ]
    },
    {
      name: 'Vintage',
      icon: Calendar,
      description: 'All Magic cards ever printed are legal, with the most powerful cards restricted to 1 copy. The highest-power format.',
      rules: [
        'Almost all cards are legal — only a tiny list of ante and dexterity cards are banned',
        'A restricted list limits the most powerful cards to 1 copy per deck',
        'The Power 9 are restricted (1 copy each), not banned outright',
        'Many tournaments allow proxy cards to lower the financial barrier to entry'
      ],
      bannedList: [
        'Bronze Tablet',
        'Contract from Below',
        'Darkpact',
        'Demonic Attorney',
        'Chaos Orb',
        'Falling Star',
        'Jeweled Bird',
        'Rebirth',
        'Shahrazad'
      ],
      restrictedList: [
        'Ancestral Recall',
        'Balance',
        'Black Lotus',
        'Brainstorm',
        'Channel',
        'Demonic Consultation',
        'Demonic Tutor',
        'Dig Through Time',
        'Fastbond',
        'Flash',
        'Gitaxian Probe',
        'Gush',
        'Imperial Seal',
        'Karn, the Great Creator',
        'Library of Alexandria',
        'Lion\'s Eye Diamond',
        'Lotus Petal',
        'Mana Crypt',
        'Mana Vault',
        'Memory Jar',
        'Mental Misstep',
        'Mind\'s Desire',
        'Mishra\'s Workshop',
        'Mox Emerald',
        'Mox Jet',
        'Mox Pearl',
        'Mox Ruby',
        'Mox Sapphire',
        'Mystical Tutor',
        'Narset, Parter of Veils',
        'Necropotence',
        'Ponder',
        'Sol Ring',
        'Strip Mine',
        'Time Vault',
        'Time Walk',
        'Timetwister',
        'Tinker',
        'Tolarian Academy',
        'Treasure Cruise',
        'Trinisphere',
        'Vampiric Tutor',
        'Wheel of Fortune',
        'Windfall',
        'Yawgmoth\'s Will'
      ],
      rotationSchedule: 'No rotation — cards never rotate out',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Highest power level in Magic — games often end on turn 1 or 2',
        'The Power 9 are restricted (not banned): each deck gets 1 Mox, 1 Lotus, etc.',
        'Restricted list (not bans) is the primary balance mechanism',
        'Extremely expensive in paper; Magic Online makes it accessible at low cost'
      ],
      tips: [
        'Mishra\'s Workshop and Bazaar of Baghdad define two of the major archetypes',
        'Force of Will is still important but speed is even higher than Legacy',
        'Many tournaments allow a certain number of proxies — check before attending',
        'Study the restricted list carefully; each deck gets exactly 1 copy of each restricted card'
      ]
    },
    {
      name: 'Pauper',
      icon: BookOpen,
      description: 'Only common-rarity cards are legal — a surprisingly deep and budget-friendly format with a rich competitive scene.',
      rules: [
        'Only cards printed at common rarity (in at least one official printing) are legal',
        'Maximum 4 copies of any card (except basic lands)',
        'Cards from all sets ever printed are legal if they were printed at common',
        'One of the most budget-friendly competitive formats in Magic'
      ],
      bannedList: [
        'Atog',
        'Chatterstorm',
        'Cloudpost',
        'Cranial Plating',
        'Empty the Warrens',
        'Frantic Search',
        'Grapeshot',
        'High Tide',
        'Invigorate',
        'Peregrine Drake',
        'Rite of Flame',
        'Temporal Fissure',
        'Treasure Cruise'
      ],
      rotationSchedule: 'No rotation — cards never rotate out',
      deckSize: '60+ cards',
      lifeTotal: '20',
      uniqueFeatures: [
        'Most budget-friendly competitive format in Magic',
        'Surprisingly complex and deep despite the restriction to commons',
        'Monarch and Initiative mechanics add political elements',
        'MTGO Pauper is extremely popular due to near-zero cost'
      ],
      tips: [
        'Don\'t underestimate the power level — many efficient spells exist at common',
        'Blue is the dominant color due to excellent card draw and counterspells at common',
        'Delver of Secrets, Snuff Out, and Galvanic Blast are key format staples',
        'Affinity (artifact-based) and Faeries are historically dominant archetypes'
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