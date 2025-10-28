import React, { useState, useEffect, useRef } from 'react';
import { ThreeDDice, ThreeDDiceAPI } from 'dddice-js';

export default function DiceRollerDDDice({ onClose, onResult, initialNotation, autoRoll = false, initialRollMode = 'normal', dddiceInstance, dddiceReady }) {
  const [dicePool, setDicePool] = useState([]);
  const [modifier, setModifier] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [showUI, setShowUI] = useState(!autoRoll); // Hide UI if auto-rolling
  const [rollMode, setRollMode] = useState('normal'); // 'normal', 'advantage', 'disadvantage'
  const [notationInput, setNotationInput] = useState('');
  const rolledDiceInfo = useRef([]); // Track what dice were rolled
  const [initialNotationLoaded, setInitialNotationLoaded] = useState(false);
  const [autoRolled, setAutoRolled] = useState(false);

  // Use passed dddice instance
  const dddice = dddiceInstance?.dddice;
  const theme = dddiceInstance?.theme || 'dddice-standard';

  // Set up event listeners when dddice is ready
  useEffect(() => {
    if (!dddice) return;

    const handleRollFinished = (data) => {      handleRollComplete(data);
    };

    const handleDiceRolled = (data) => {      handleRollComplete(data);
    };

    dddice.on('roll-finished', handleRollFinished);
    dddice.on('dice-rolled', handleDiceRolled);

    return () => {
      // Clean up listeners
      dddice.off('roll-finished', handleRollFinished);
      dddice.off('dice-rolled', handleDiceRolled);
    };
  }, [dddice]);

  // Load initial notation
  useEffect(() => {    if (initialNotation && !initialNotationLoaded) {      const parsed = parseNotation(initialNotation);      setDicePool(parsed.dice);
      setModifier(parsed.modifier);
      setInitialNotationLoaded(true);
    }
  }, [initialNotation, initialNotationLoaded]);

  // Set initial roll mode from prop
  useEffect(() => {
    if (initialRollMode) {
      setRollMode(initialRollMode);
    }
  }, [initialRollMode]);

  // Auto-roll
  useEffect(() => {
    if (autoRoll && initialNotationLoaded && !autoRolled && dicePool.length > 0 && dddiceReady) {
      setTimeout(() => {
        roll();
        setAutoRolled(true);
      }, 500);
    }
  }, [autoRoll, initialNotationLoaded, autoRolled, dicePool.length, dddiceReady]);

  const parseNotation = (notation) => {
    const parts = notation.split(/([+-])/);
    let currentModifier = 0;
    const dice = [];

    parts.forEach(part => {
      if (part === '+' || part === '-') return;

      const diceMatch = part.match(/(\d+)d(\d+)/i);
      if (diceMatch) {
        const count = parseInt(diceMatch[1]);
        const sides = parseInt(diceMatch[2]);
        for (let i = 0; i < count; i++) {
          dice.push({ sides, id: Date.now() + Math.random() + i });
        }
      } else if (part.match(/\d+/)) {
        currentModifier = parseInt(part);
        if (notation.includes('-' + part)) {
          currentModifier = -currentModifier;
        }
      }
    });

    return { dice, modifier: currentModifier };
  };

  const addDie = (sides) => {
    setDicePool([...dicePool, { sides, id: Date.now() + Math.random() }]);
  };

  const clearPool = () => {
    setDicePool([]);
    setModifier(0);
  };

  const buildNotation = () => {
    if (dicePool.length === 0) return '';
    const counts = {};
    dicePool.forEach(d => {
      counts[d.sides] = (counts[d.sides] || 0) + 1;
    });
    const parts = Object.entries(counts).map(([sides, count]) => `${count}d${sides}`);
    let notation = parts.join('+');
    if (modifier !== 0) {
      notation += modifier > 0 ? `+${modifier}` : modifier;
    }
    return notation;
  };

  const roll = async () => {
    if (!dddice || dicePool.length === 0 || isRolling) return;

    setIsRolling(true);
    setShowUI(false); // Hide UI immediately when rolling

    try {
      // Handle advantage/disadvantage for d20 rolls
      let rollsToMake = [...dicePool];
      if (rollMode !== 'normal' && dicePool.some(d => d.sides === 20)) {
        // Add extra d20 for advantage/disadvantage
        const d20s = dicePool.filter(d => d.sides === 20);
        rollsToMake = [...dicePool, ...d20s.map(d => ({ ...d, id: Date.now() + Math.random() }))];
      }

      // Store dice info for later identification (which dice are d20s)
      rolledDiceInfo.current = rollsToMake.map(die => die.sides);

      // Build roll array for dddice using theme from user's dice box
      const rolls = rollsToMake.map(die => ({
        type: `d${die.sides}`,
        theme: theme
      }));
      // Roll using dddice
      const result = await dddice.roll(rolls);
      // Process result directly after delay for animation to complete
      if (result?.data) {
        setTimeout(() => {
          handleRollComplete(result.data);
        }, 3000);
      }

    } catch (error) {
      console.error('Roll failed:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      if (error.response?.data?.data) {
        console.error('Error message:', error.response.data.data);
      }
      setIsRolling(false);
    }
  };

  const handleRollComplete = (data) => {
    // Extract roll values from dddice data
    // dddice returns data in format: { uuid, values: [{value, type, ...}], total_value }
    const values = data.values || [];

    // Map values to their original sides using the stored info
    let allRolls = values.map((v, index) => ({
      value: v.value,
      sides: rolledDiceInfo.current[index] || 0
    }));
    // Handle advantage/disadvantage for d20 rolls
    let finalRolls = allRolls;
    let rollsForDisplay = allRolls.map(r => r.value);
    if (rollMode !== 'normal') {      const d20Rolls = allRolls.filter(r => r.sides === 20).map(r => r.value);
      const otherRolls = allRolls.filter(r => r.sides !== 20);
      if (d20Rolls.length >= 2) {
        // Take highest or lowest d20
        const selectedD20 = rollMode === 'advantage'
          ? Math.max(...d20Rolls)
          : Math.min(...d20Rolls);
        // For display, keep both d20s; for calculation, use only selected
        rollsForDisplay = d20Rolls;
        finalRolls = [...otherRolls, { value: selectedD20, sides: 20 }];
        console.log(`${rollMode}, using ${selectedD20}`);
      }
    }

    const rolls = finalRolls.map(r => r.value);
    let total = rolls.reduce((sum, val) => sum + val, 0) + (modifier || 0);
    if (onResult) {
      onResult({
        rolls: rollsForDisplay,
        total,
        modifier,
        notation: buildNotation(),
        rollMode
      });
    }

    // Call the wrapper callback if it exists
    if (window.__diceRollerCallback) {
      window.__diceRollerCallback({
        rolls: rollsForDisplay,
        total,
        modifier,
        notation: buildNotation(),
        rollMode
      });
      window.__diceRollerCallback = null; // Clear after use
    }

    setIsRolling(false);

    // Clear dice from the canvas after a short delay
    setTimeout(() => {      if (dddice) {
        dddice.clear();
      }
      onClose();
    }, 1500);
  };

  const diceButtons = [
    { sides: 4, label: 'd4' },
    { sides: 6, label: 'd6' },
    { sides: 8, label: 'd8' },
    { sides: 10, label: 'd10' },
    { sides: 12, label: 'd12' },
    { sides: 20, label: 'd20' },
    { sides: 100, label: 'd100' },
  ];

  return (
    <>
      {/* Dice Tray Panel - hide when rolling */}
      {showUI && (
      <div className="dice-roller-container fixed left-6 z-[60] bg-slate-800/98 backdrop-blur-lg border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden" style={{ width: '140px', bottom: '96px' }}>
        <div className="p-2 space-y-1.5">
          {diceButtons.map(({ sides, label }) => (
            <button
              key={sides}
              className="relative w-full h-9 bg-slate-700/80 hover:bg-slate-600 rounded-lg font-bold text-white text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center"
              onClick={() => addDie(sides)}
            >
              <span className="text-sm">{label}</span>
              {dicePool.filter(d => d.sides === sides).length > 0 && (
                <div className="absolute right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {dicePool.filter(d => d.sides === sides).length}
                </div>
              )}
            </button>
          ))}
        </div>
        <button
          className="w-full py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white text-xs font-semibold uppercase tracking-wide transition-colors border-t border-slate-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      )}

      {/* Roll Panel - hide when rolling */}
      {showUI && dicePool.length > 0 && (
        <div className="dice-roller-container fixed left-[162px] z-[60] bg-slate-800/98 backdrop-blur-lg border-2 border-slate-700 rounded-2xl shadow-2xl p-3" style={{ width: '280px', bottom: '96px' }}>
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wide text-center">Roll Formula</div>
          <input
            type="text"
            className="w-full bg-slate-900/80 rounded-lg p-2 mb-3 font-mono text-base font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={notationInput || buildNotation()}
            onChange={(e) => setNotationInput(e.target.value)}
            onBlur={() => {
              if (notationInput) {
                const parsed = parseNotation(notationInput);
                setDicePool(parsed.dice);
                setModifier(parsed.modifier);
              }
            }}
            placeholder="1d20+5"
          />

          {/* Advantage/Disadvantage buttons */}
          {dicePool.some(d => d.sides === 20) && (
            <div className="flex gap-1 mb-3">
              <button
                className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${
                  rollMode === 'advantage'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                onClick={() => setRollMode(rollMode === 'advantage' ? 'normal' : 'advantage')}
              >
                ADV
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${
                  rollMode === 'normal'
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                onClick={() => setRollMode('normal')}
              >
                NORMAL
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${
                  rollMode === 'disadvantage'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                onClick={() => setRollMode(rollMode === 'disadvantage' ? 'normal' : 'disadvantage')}
              >
                DIS
              </button>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <button
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm"
              onClick={roll}
              disabled={dicePool.length === 0 || isRolling}
            >
              {isRolling ? '...' : 'Roll'}
            </button>
            <button
              className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center justify-center transition-colors"
              onClick={clearPool}
              title="Clear All"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold text-xl transition-all hover:scale-105 active:scale-95"
              onClick={() => setModifier(Math.max(-99, modifier - 1))}
            >
              −
            </button>
            <input
              type="number"
              className="w-14 h-10 bg-slate-700 text-white rounded-lg px-1 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={modifier}
              onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
              placeholder="±0"
            />
            <button
              className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold text-xl transition-all hover:scale-105 active:scale-95"
              onClick={() => setModifier(Math.min(99, modifier + 1))}
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  );
}
