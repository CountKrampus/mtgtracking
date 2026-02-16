import React, { useState } from 'react';
import { Zap, Star, Search, Filter } from 'lucide-react';

const ComboTutorials = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [expandedCombo, setExpandedCombo] = useState(null);

  const toggleCombo = (comboId) => {
    setExpandedCombo(expandedCombo === comboId ? null : comboId);
  };

  // Sample combo data
  const combos = [
    {
      id: 1,
      name: 'Infinite Storm Combo',
      cards: ['Laboratory Maniac', 'Stroke of Genius'],
      description: 'Win the game by decking yourself with Laboratory Maniac in play',
      format: 'Commander',
      difficulty: 'Intermediate',
      prerequisites: ['Laboratory Maniac in play', 'Stroke of Genius in hand', 'Sufficient storm count'],
      steps: [
        'Cast Stroke of Genius targeting yourself',
        'Trigger Laboratory Maniac\'s ability',
        'Draw your entire library to win the game'
      ],
      variations: ['Can use other "stroke" effects', 'Requires protection from opponents'],
      notes: 'This combo wins immediately when you cast Stroke of Genius targeting yourself'
    },
    {
      id: 2,
      name: 'Kiki-Pod Combo',
      cards: ['Kiki-Jiki, Mirror-Breaker', 'Cloudstone Curio'],
      description: 'Generate infinite ETB triggers for card advantage',
      format: 'Legacy',
      difficulty: 'Advanced',
      prerequisites: ['Kiki-Jiki and Cloudstone Curio in play', 'Another creature to copy'],
      steps: [
        'Activate Kiki-Jiki to copy another creature',
        'Use Cloudstone Curio to flicker the copy',
        'Repeat to generate infinite triggers'
      ],
      variations: ['Works with any ETB trigger creature', 'Can be used for infinite damage'],
      notes: 'This combo generates infinite value through ETB triggers'
    },
    {
      id: 3,
      name: 'Melira Pod Combo',
      cards: ['Melira, Sylvok Outcast', 'Kitchen Finks', 'Pestermite'],
      description: 'Infinite loop generating poison counters',
      format: 'Modern',
      difficulty: 'Advanced',
      prerequisites: ['Melira in play', 'Kitchen Finks and Pestermite in hand/library'],
      steps: [
        'Cast Kitchen Finks',
        'Use Pestermite to flicker Kitchen Finks',
        'Repeat to generate infinite -1/-1 counters'
      ],
      variations: ['Can use other persist creatures', 'Alternative win condition'],
      notes: 'This combo creates an infinite loop that generates poison counters'
    },
    {
      id: 4,
      name: 'Ad Nauseam',
      cards: ['Ad Nauseam', 'Angel\'s Grace', 'Phyrexian Unlife'],
      description: 'Find your win condition by drawing your entire deck',
      format: 'Vintage',
      difficulty: 'Expert',
      prerequisites: ['Ad Nauseam in hand', 'Angel\'s Grace or Phyrexian Unlife', 'Win condition in deck'],
      steps: [
        'Cast Ad Nauseam',
        'Draw cards until you find your win condition',
        'Use Angel\'s Grace to prevent death from damage',
        'Execute your win condition'
      ],
      variations: ['Different win conditions', 'Alternative life preservation'],
      notes: 'This combo allows you to find any card in your deck regardless of life total'
    },
    {
      id: 5,
      name: 'Breya Equipment Combo',
      cards: ['Breya, Etherium Shaper', 'Blade of Selves', 'Mirrorworks'],
      description: 'Create infinite ETB triggers with Breya\'s combo',
      format: 'Commander',
      difficulty: 'Intermediate',
      prerequisites: ['Breya in play', 'Blade of Selves equipped', 'Mirrorworks in play'],
      steps: [
        'Attack with Breya equipped with Blade of Selves',
        'Trigger Blade of Selves to create token',
        'Mirrorworks creates copy of the token',
        'Repeat for infinite triggers'
      ],
      variations: ['Other equipment combinations', 'Alternative ETB triggers'],
      notes: 'This combo generates infinite value through ETB triggers'
    },
    {
      id: 6,
      name: 'Storm Combo',
      cards: ['Grapeshot', 'Brain Freeze', 'Desertion'],
      description: 'Generate infinite storm count for massive damage',
      format: 'Legacy',
      difficulty: 'Expert',
      prerequisites: ['Grapeshot in hand', 'Brain Freeze in hand', 'Desertion in play'],
      steps: [
        'Cast Brain Freeze targeting opponent',
        'Use Desertion to steal their spell',
        'Cast Grapeshot for massive damage'
      ],
      variations: ['Different storm spells', 'Alternative win conditions'],
      notes: 'This combo generates infinite storm count for massive damage'
    }
  ];

  const formats = ['all', ...new Set(combos.map(c => c.format))];
  const difficulties = ['all', ...new Set(combos.map(c => c.difficulty))];

  const filteredCombos = combos.filter(combo => {
    const matchesSearch = combo.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         combo.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         combo.cards.some(card => card.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFormat = selectedFormat === 'all' || combo.format === selectedFormat;
    const matchesDifficulty = selectedDifficulty === 'all' || combo.difficulty === selectedDifficulty;
    return matchesSearch && matchesFormat && matchesDifficulty;
  });

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Combo Tutorials</h1>
        <p className="text-gray-400">
          Step-by-step explanations of popular Magic: The Gathering combos
        </p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search combos..."
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="pl-10 pr-8 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
          >
            {formats.map(format => (
              <option key={format} value={format}>
                {format === 'all' ? 'All Formats' : format}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="pl-10 pr-8 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
          >
            {difficulties.map(difficulty => (
              <option key={difficulty} value={difficulty}>
                {difficulty === 'all' ? 'All Difficulties' : difficulty}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredCombos.length > 0 ? (
          filteredCombos.map((combo) => (
            <div key={combo.id} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleCombo(combo.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <Zap className="text-yellow-400" size={20} />
                  <div>
                    <h2 className="text-lg font-semibold text-white">{combo.name}</h2>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                        {combo.format}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                        {combo.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-gray-400 text-sm">{combo.description}</div>
              </button>
              
              {expandedCombo === combo.id && (
                <div className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-purple-300 mb-2">Cards Required</h3>
                      <div className="flex flex-wrap gap-2">
                        {combo.cards.map((card, index) => (
                          <span key={index} className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
                            {card}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-purple-300 mb-2">Prerequisites</h3>
                      <ul className="text-gray-300 text-sm space-y-1">
                        {combo.prerequisites.map((prereq, index) => (
                          <li key={index} className="flex items-start">
                            <Star size={12} className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                            {prereq}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-purple-300 mb-2">Steps</h3>
                    <ol className="text-gray-300 text-sm space-y-2">
                      {combo.steps.map((step, index) => (
                        <li key={index} className="flex items-start">
                          <span className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-purple-300 mb-2">Variations</h3>
                      <ul className="text-gray-300 text-sm space-y-1">
                        {combo.variations.map((variation, index) => (
                          <li key={index} className="flex items-start">
                            <Zap size={12} className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                            {variation}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-purple-300 mb-2">Important Notes</h3>
                      <p className="text-gray-300 text-sm">{combo.notes}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <Zap className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No combos found</h3>
            <p className="text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/30">
        <h3 className="text-xl font-semibold text-white mb-4">About Combos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
          <div>
            <h4 className="font-medium text-purple-300 mb-2">What are Combos?</h4>
            <p className="text-sm">
              Combos in Magic: The Gathering are combinations of cards that work together 
              to create powerful effects, sometimes winning the game immediately. 
              They often involve loops or explosive interactions.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-purple-300 mb-2">Learning Combos</h4>
            <p className="text-sm">
              Understanding combos is important for both competitive play and casual formats. 
              Knowing how to execute your own combos and disrupt your opponents' combos 
              is a key skill in Magic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComboTutorials;