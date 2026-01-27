import React, { useState, useCallback } from 'react';
import { Dices, RotateCw } from 'lucide-react';

const DICE_TYPES = [
  { sides: 4, name: 'D4', color: '#dc2626' },
  { sides: 6, name: 'D6', color: '#2563eb' },
  { sides: 8, name: 'D8', color: '#16a34a' },
  { sides: 10, name: 'D10', color: '#9333ea' },
  { sides: 12, name: 'D12', color: '#ca8a04' },
  { sides: 20, name: 'D20', color: '#0d9488' },
  { sides: 100, name: 'D100', color: '#db2777' }
];

function DiceRoller({ onRoll, compact = false }) {
  const [result, setResult] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [selectedDice, setSelectedDice] = useState(DICE_TYPES[5]); // D20 default
  const [rollHistory, setRollHistory] = useState([]);

  const rollDice = useCallback((dice) => {
    setRolling(true);
    setSelectedDice(dice);

    // Animate through random numbers
    let count = 0;
    const interval = setInterval(() => {
      setResult(Math.floor(Math.random() * dice.sides) + 1);
      count++;
      if (count > 10) {
        clearInterval(interval);
        const finalResult = Math.floor(Math.random() * dice.sides) + 1;
        setResult(finalResult);
        setRolling(false);

        // Add to history
        const roll = {
          dice: dice.name,
          result: finalResult,
          timestamp: Date.now()
        };
        setRollHistory(prev => [roll, ...prev.slice(0, 9)]);

        if (onRoll) {
          onRoll(roll);
        }
      }
    }, 50);
  }, [onRoll]);

  const flipCoin = useCallback(() => {
    setRolling(true);
    setSelectedDice({ sides: 2, name: 'Coin', color: '#f59e0b' });

    let count = 0;
    const interval = setInterval(() => {
      setResult(Math.random() < 0.5 ? 'Heads' : 'Tails');
      count++;
      if (count > 8) {
        clearInterval(interval);
        const finalResult = Math.random() < 0.5 ? 'Heads' : 'Tails';
        setResult(finalResult);
        setRolling(false);

        const roll = {
          dice: 'Coin',
          result: finalResult,
          timestamp: Date.now()
        };
        setRollHistory(prev => [roll, ...prev.slice(0, 9)]);

        if (onRoll) {
          onRoll(roll);
        }
      }
    }, 100);
  }, [onRoll]);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {DICE_TYPES.slice(0, 3).map(dice => (
          <button
            key={dice.sides}
            onClick={() => rollDice(dice)}
            disabled={rolling}
            className="w-10 h-10 rounded-lg font-bold text-xs text-white transition hover:scale-105 disabled:opacity-50"
            style={{ backgroundColor: dice.color }}
          >
            {dice.name}
          </button>
        ))}
        <button
          onClick={flipCoin}
          disabled={rolling}
          className="w-10 h-10 rounded-lg font-bold text-xs bg-yellow-600 text-white transition hover:scale-105 disabled:opacity-50"
        >
          🪙
        </button>
        {result !== null && (
          <div
            className={`px-3 py-1 rounded-lg font-bold text-lg ${rolling ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: `${selectedDice.color}40`, color: selectedDice.color }}
          >
            {result}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Dices size={20} className="text-purple-400" />
        <h3 className="text-white font-semibold">Dice Roller</h3>
      </div>

      {/* Dice Buttons */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {DICE_TYPES.map(dice => (
          <button
            key={dice.sides}
            onClick={() => rollDice(dice)}
            disabled={rolling}
            className={`py-3 rounded-xl font-bold text-white transition hover:scale-105 disabled:opacity-50 ${
              selectedDice.sides === dice.sides && !rolling ? 'ring-2 ring-white' : ''
            }`}
            style={{ backgroundColor: dice.color }}
          >
            {dice.name}
          </button>
        ))}
        <button
          onClick={flipCoin}
          disabled={rolling}
          className="py-3 rounded-xl font-bold bg-yellow-600 text-white transition hover:scale-105 disabled:opacity-50"
        >
          🪙 Flip
        </button>
      </div>

      {/* Result Display */}
      {result !== null && (
        <div
          className={`text-center py-6 rounded-xl mb-4 transition-all ${
            rolling ? 'animate-bounce' : 'animate-none'
          }`}
          style={{ backgroundColor: `${selectedDice.color}30` }}
        >
          <div className="text-white/60 text-sm mb-1">{selectedDice.name}</div>
          <div
            className={`text-5xl font-bold ${rolling ? 'opacity-50' : ''}`}
            style={{ color: selectedDice.color }}
          >
            {result}
          </div>
        </div>
      )}

      {/* Roll History */}
      {rollHistory.length > 0 && (
        <div>
          <div className="text-white/60 text-xs mb-2">Recent Rolls</div>
          <div className="flex gap-2 flex-wrap">
            {rollHistory.map((roll, index) => (
              <div
                key={roll.timestamp}
                className="px-2 py-1 bg-white/10 rounded text-white/70 text-xs"
              >
                {roll.dice}: {roll.result}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Roll Button */}
      <button
        onClick={() => rollDice(selectedDice)}
        disabled={rolling}
        className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <RotateCw size={18} className={rolling ? 'animate-spin' : ''} />
        Roll {selectedDice.name}
      </button>
    </div>
  );
}

export default DiceRoller;
