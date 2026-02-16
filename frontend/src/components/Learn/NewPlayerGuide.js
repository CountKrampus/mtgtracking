import React, { useState } from 'react';
import { BookOpen, Play, Eye, Trophy, Users, Zap, ChevronDown, ChevronRight } from 'lucide-react';

const NewPlayerGuide = () => {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const guideSections = [
    {
      id: 'basics',
      title: 'MTG Basics',
      icon: BookOpen,
      content: [
        {
          title: 'What is Magic: The Gathering?',
          content: 'Magic: The Gathering (MTG) is a collectible card game where players take on the role of powerful wizards called planeswalkers. Players use cards representing creatures, spells, and artifacts to defeat their opponents.'
        },
        {
          title: 'Objective',
          content: 'The goal is to reduce your opponent\'s life total from 20 to 0, though some cards may offer alternative win conditions. Games typically last 30-60 minutes.'
        },
        {
          title: 'Components',
          content: 'Each player needs a deck of 60+ cards, basic land cards, life counters, and any tokens or markers needed for specific cards.'
        }
      ]
    },
    {
      id: 'phases',
      title: 'Game Phases',
      icon: Play,
      content: [
        {
          title: 'Beginning Phase',
          content: 'Consists of three steps: Untap (untap permanents), Upkeep (trigger upkeep abilities), and Draw (draw a card).'
        },
        {
          title: 'Main Phase 1',
          content: 'Play lands (one per turn), cast sorceries, instants, artifacts, enchantments, and creatures. Activate abilities.'
        },
        {
          title: 'Combat Phase',
          content: 'Declare attackers, declare blockers, assign and deal combat damage. Only instants and abilities can be played during combat.'
        },
        {
          title: 'Main Phase 2',
          content: 'Same as Main Phase 1, after combat.'
        },
        {
          title: 'Ending Phase',
          content: 'Final step where end-of-turn triggers resolve, and players discard down to 7 cards if needed.'
        }
      ]
    },
    {
      id: 'card-types',
      title: 'Card Types',
      icon: Eye,
      content: [
        {
          title: 'Lands',
          content: 'Generate mana, the resource used to cast spells. Basic lands (Plains, Island, Swamp, Mountain, Forest) produce colored mana. Non-basic lands often have additional abilities.'
        },
        {
          title: 'Creatures',
          content: 'Can attack and block opponents. Have power/toughness (e.g., 2/3 means 2 damage dealt, 3 damage to destroy). Come into play tapped unless specified.'
        },
        {
          title: 'Instants',
          content: 'Can be played at any time, including during opponent\'s turn. Go directly to graveyard after resolving.'
        },
        {
          title: 'Sorceries',
          content: 'Can only be played during your main phase when nothing else is on the stack. Go to graveyard after resolving.'
        },
        {
          title: 'Enchantments',
          content: 'Permanent spells that stay on the battlefield. Provide ongoing effects. Can be attached to other permanents (Auras) or exist independently.'
        },
        {
          title: 'Artifacts',
          content: 'Permanent spells that stay on the battlefield. Often have activated abilities. Can be equipped to creatures (Equipment).'
        },
        {
          title: 'Planeswalkers',
          content: 'Powerful permanents with loyalty counters. Have abilities that can be activated based on loyalty costs. Can be attacked like players.'
        }
      ]
    },
    {
      id: 'keywords',
      title: 'Common Keywords',
      icon: Trophy,
      content: [
        {
          title: 'Flying',
          content: 'Can only be blocked by creatures with flying or reach. Allows evasion of ground creatures.'
        },
        {
          title: 'Trample',
          content: 'Excess combat damage carries over to defending player if blocker can\'t stop all damage.'
        },
        {
          title: 'First Strike',
          content: 'Deals combat damage before creatures without first strike (or double strike).'
        },
        {
          title: 'Double Strike',
          content: 'Deals combat damage during both first strike and normal combat damage steps.'
        },
        {
          title: 'Haste',
          content: 'Can attack and use tap abilities the turn it comes into play.'
        },
        {
          title: 'Vigilance',
          content: 'Doesn\'t tap when attacking.'
        },
        {
          title: 'Deathtouch',
          content: 'Any amount of damage is enough to destroy a creature.'
        },
        {
          title: 'Hexproof',
          content: 'Can\'t be targeted by opponents\' spells or abilities.'
        },
        {
          title: 'Indestructible',
          content: 'Can\'t be destroyed by damage or destroy effects.'
        }
      ]
    },
    {
      id: 'formats',
      title: 'Popular Formats',
      icon: Users,
      content: [
        {
          title: 'Standard',
          content: 'Uses cards from the most recent sets (usually the last 2-3 years). Rotates regularly. Most competitive format.'
        },
        {
          title: 'Modern',
          content: 'Uses cards from Eighth Edition onward. Larger card pool than Standard but excludes older rarities.'
        },
        {
          title: 'Commander',
          content: 'Singleton format (1 copy of each card except basic lands). Starts with 40 life. Uses legendary creature as commander.'
        },
        {
          title: 'Limited',
          content: 'Play with randomly opened cards (Booster Draft, Sealed Deck). Builds decks on the spot from limited pool.'
        }
      ]
    },
    {
      id: 'tips',
      title: 'Beginner Tips',
      icon: Zap,
      content: [
        {
          title: 'Start Simple',
          content: 'Begin with preconstructed decks to learn the game before building your own. Focus on one or two colors initially.'
        },
        {
          title: 'Learn the Rules',
          content: 'Understand the comprehensive rules, but don\'t feel pressured to know everything immediately. Ask questions!'
        },
        {
          title: 'Practice',
          content: 'Play regularly to improve. Online platforms like MTG Arena offer free ways to practice.'
        },
        {
          title: 'Budget',
          content: 'Start with affordable cards. Magic can become expensive, so set limits early.'
        },
        {
          title: 'Community',
          content: 'Join local game stores, online communities, or clubs. Magic has a welcoming community eager to teach newcomers.'
        }
      ]
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">New Player Guide</h1>
        <p className="text-gray-400">
          Everything you need to know to start playing Magic: The Gathering
        </p>
      </div>

      <div className="space-y-4">
        {guideSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <Icon className="text-purple-400" size={20} />
                  <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                </div>
                {expandedSection === section.id ? 
                  <ChevronDown className="text-gray-400" size={20} /> : 
                  <ChevronRight className="text-gray-400" size={20} />
                }
              </button>
              
              {expandedSection === section.id && (
                <div className="p-4 pt-0 space-y-6">
                  {section.content.map((item, index) => (
                    <div key={index} className="border-l-2 border-purple-500 pl-4">
                      <h3 className="font-medium text-purple-300 mb-2">{item.title}</h3>
                      <p className="text-gray-300 leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/30">
        <h3 className="text-xl font-semibold text-white mb-4">Need More Help?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 p-4 rounded-lg">
            <h4 className="font-medium text-purple-300 mb-2">Official Resources</h4>
            <ul className="text-gray-300 space-y-1 text-sm">
              <li>• <a href="https://magic.wizards.com/en/how-to-play-magic" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Wizards of the Coast Official Guide</a></li>
              <li>• Magic: The Gathering Comprehensive Rules</li>
              <li>• MTG Arena for Digital Practice</li>
            </ul>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <h4 className="font-medium text-purple-300 mb-2">Community Resources</h4>
            <ul className="text-gray-300 space-y-1 text-sm">
              <li>• Local Game Store Events</li>
              <li>• Magic: The Gathering Subreddit</li>
              <li>• Commander Community Resources</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewPlayerGuide;