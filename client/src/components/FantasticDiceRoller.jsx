import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function FantasticDiceRoller({ onClose, onResult, initialNotation, autoRoll = false, initialRollMode = 'normal' }) {  const [dicePool, setDicePool] = useState([]);
  const [rollMode, setRollMode] = useState('normal'); // 'normal', 'advantage', 'disadvantage'
  const [modifier, setModifier] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingDice, setRollingDice] = useState([]);
  const diceBoxRef = useRef(null);
  const diceBoxInstance = useRef(null);
  const [isInitialized, setIsInitialized] = useState(true); // Start as true to enable button immediately
  const [initialNotationLoaded, setInitialNotationLoaded] = useState(false);
  const [autoRolled, setAutoRolled] = useState(false);
  const [notationInput, setNotationInput] = useState('');
  const [showPanel, setShowPanel] = useState(!autoRoll); // Hide panel if auto-rolling

  // Preload audio files for reliable playback
  const tickSoundRef = useRef(null);
  const finishSoundRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  // Preload audio files on component mount
  useEffect(() => {
    // Preload tick sound
    tickSoundRef.current = new Audio('/assets/sounds/tick.mp3');
    tickSoundRef.current.volume = 0.3;
    tickSoundRef.current.load(); // Force preload

    // Preload finish sound
    finishSoundRef.current = new Audio('/assets/sounds/finish.mp3');
    finishSoundRef.current.volume = 0.2; // Leiser - war zu laut
    finishSoundRef.current.load(); // Force preload

    // Unlock audio on first user interaction (browser autoplay policy)
    const unlockAudio = () => {
      if (!audioUnlockedRef.current) {
        // Play and immediately pause to unlock audio context
        if (tickSoundRef.current) {
          tickSoundRef.current.play().then(() => {
            tickSoundRef.current.pause();
            tickSoundRef.current.currentTime = 0;
          }).catch(() => {});
        }
        if (finishSoundRef.current) {
          finishSoundRef.current.play().then(() => {
            finishSoundRef.current.pause();
            finishSoundRef.current.currentTime = 0;
          }).catch(() => {});
        }
        audioUnlockedRef.current = true;
      }
    };

    // Unlock on any click or key press
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      // Cleanup on unmount
      if (tickSoundRef.current) {
        tickSoundRef.current.pause();
        tickSoundRef.current = null;
      }
      if (finishSoundRef.current) {
        finishSoundRef.current.pause();
        finishSoundRef.current = null;
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Load initial notation if provided
  useEffect(() => {
    if (initialNotation && !initialNotationLoaded) {
      // Parse notation like "2d6+3" or "1d20+5"
      const parts = initialNotation.split(/([+-])/);
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
          if (initialNotation.includes('-' + part)) {
            currentModifier = -currentModifier;
          }
        }
      });

      setDicePool(dice);
      setModifier(currentModifier);
      setInitialNotationLoaded(true);
    }
  }, [initialNotation, initialNotationLoaded]);

  // Auto-roll if requested and dice are loaded
  useEffect(() => {
    if (autoRoll && initialNotationLoaded && !autoRolled && dicePool.length > 0) {
      // Small delay to ensure DiceBox is ready
      setTimeout(() => {
        roll();
        setAutoRolled(true);
      }, 300);
    }
  }, [autoRoll, initialNotationLoaded, autoRolled, dicePool.length]);

  // Set initial roll mode from prop
  useEffect(() => {
    if (initialRollMode) {
      setRollMode(initialRollMode);
    }
  }, [initialRollMode]);

  const addDie = (sides) => {
    setDicePool([...dicePool, { sides, id: Date.now() + Math.random() }]);
  };

  const removeDie = (id) => {
    setDicePool(dicePool.filter(d => d.id !== id));
  };

  const clearPool = () => {
    setDicePool([]);
    setModifier(0);
    setRollingDice([]); // Clear animation state
  };

  const buildNotation = () => {
    if (dicePool.length === 0) return '';

    // Count dice by type
    const counts = {};
    dicePool.forEach(d => {
      counts[d.sides] = (counts[d.sides] || 0) + 1;
    });

    // Build notation like "2d20+1d6"
    const parts = Object.entries(counts).map(([sides, count]) => `${count}d${sides}`);
    let notation = parts.join('+');

    if (modifier !== 0) {
      notation += modifier > 0 ? `+${modifier}` : modifier;
    }

    return notation;
  };

  const parseNotation = (notation) => {
    // Parse notation like "2d6+3" or "1d20+5"
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

    setDicePool(dice);
    setModifier(currentModifier);
  };

  const roll = async () => {
    if (dicePool.length === 0) {      return;
    }

    if (isRolling) {      return;
    }    setIsRolling(true);

    // Hide panel immediately when roll starts
    setShowPanel(false);

    try {
      let notation = buildNotation();
      // Handle advantage/disadvantage for d20 rolls
      if (rollMode === 'advantage' && dicePool.some(d => d.sides === 20)) {
        // Roll 2d20 and keep highest
        const d20Count = dicePool.filter(d => d.sides === 20).length;
        notation = `${d20Count * 2}d20`;
        if (modifier !== 0) {
          notation += modifier > 0 ? `+${modifier}` : modifier;
        }
      } else if (rollMode === 'disadvantage' && dicePool.some(d => d.sides === 20)) {
        // Roll 2d20 and keep lowest
        const d20Count = dicePool.filter(d => d.sides === 20).length;
        notation = `${d20Count * 2}d20`;
        if (modifier !== 0) {
          notation += modifier > 0 ? `+${modifier}` : modifier;
        }
      }

      // Animate rolling dice      // For advantage/disadvantage, animate all dice including extras
      let animationPool = [...dicePool];
      if (rollMode !== 'normal' && dicePool.some(d => d.sides === 20)) {
        const d20s = dicePool.filter(d => d.sides === 20);
        animationPool = [...dicePool, ...d20s.map(d => ({ ...d, id: Date.now() + Math.random() }))];
      }
      const animationDice = animationPool.map((d, i) => ({
        id: d.id,
        sides: d.sides,
        value: '?',
        rolling: true
      }));      setRollingDice(animationDice);

      // Roll dice with animation
      const animationDuration = 500; // ms - schnellere Animation
      const animationSteps = 15; // mehr Steps für mehr "Rumrollen"
      const stepDuration = animationDuration / animationSteps;

      for (let step = 0; step < animationSteps; step++) {
        // Play tick sound at the START of the step, not after the delay
        // Play every 2nd step to avoid overwhelming the audio system
        if (step % 2 === 0 && tickSoundRef.current) {
          try {
            const tick = tickSoundRef.current.cloneNode();
            tick.volume = 0.3;
            tick.play().catch(() => {});
          } catch (e) {
            // Fallback if cloning fails
            tickSoundRef.current.currentTime = 0;
            tickSoundRef.current.play().catch(() => {});
          }
        }

        await new Promise(resolve => setTimeout(resolve, stepDuration));
        setRollingDice(prev => prev.map(d => ({
          ...d,
          value: Math.floor(Math.random() * d.sides) + 1
        })));
      }

      // Final roll      // For advantage/disadvantage, actually roll the extra dice
      let dicesToRoll = [...dicePool];
      if (rollMode !== 'normal' && dicePool.some(d => d.sides === 20)) {
        // Add extra d20s for advantage/disadvantage
        const d20s = dicePool.filter(d => d.sides === 20);
        dicesToRoll = [...dicePool, ...d20s.map(d => ({ ...d, id: Date.now() + Math.random() }))];
      }
      const rolls = dicesToRoll.map(d => Math.floor(Math.random() * d.sides) + 1);      setRollingDice(rolls.map((value, i) => ({
        id: dicesToRoll[i].id,
        sides: dicesToRoll[i].sides,
        value,
        rolling: false
      })));

      // Wait a moment to show final result      await new Promise(resolve => setTimeout(resolve, 300));

      // Finish sound disabled - was too loud/annoying
      // if (finishSoundRef.current) {
      //   finishSoundRef.current.currentTime = 0;
      //   finishSoundRef.current.play().catch(() => {});
      // }

      handleRollComplete(rolls.map((value, i) => ({ value, sides: dicesToRoll[i].sides })));
    } catch (error) {
      console.error('Roll failed:', error);
      setIsRolling(false);
      setRollingDice([]);
    }
  };

  const handleRollComplete = (results) => {
    const rolls = results.map(r => r.value);
    let rollsForDisplay = rolls;
    let total = rolls.reduce((sum, val) => sum + val, 0);

    // Handle advantage/disadvantage
    if (rollMode === 'advantage' && rolls.length >= 2) {
      // For advantage, we rolled 2 d20s - take the max
      const d20Count = results.filter(r => r.sides === 20).length;
      if (d20Count >= 2) {
        const d20Values = results.filter(r => r.sides === 20).map(r => r.value);
        const max = Math.max(...d20Values);
        total = max + (modifier || 0);
        rollsForDisplay = d20Values; // Show both d20 values
      } else {
        total = total + (modifier || 0);
      }
    } else if (rollMode === 'disadvantage' && rolls.length >= 2) {
      // For disadvantage, we rolled 2 d20s - take the min
      const d20Count = results.filter(r => r.sides === 20).length;
      if (d20Count >= 2) {
        const d20Values = results.filter(r => r.sides === 20).map(r => r.value);
        const min = Math.min(...d20Values);
        total = min + (modifier || 0);
        rollsForDisplay = d20Values; // Show both d20 values
      } else {
        total = total + (modifier || 0);
      }
    } else {
      // Normal roll - add modifier
      total = total + (modifier || 0);
    }

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

    // Reset rolling state but keep dice visible
    setIsRolling(false);

    // Keep dice visible for 2 seconds before closing
    setTimeout(() => {
      setRollingDice([]);
      onClose();
    }, 2000);
  };

  const diceButtons = [
    { sides: 4, label: 'd4', color: 'from-red-500 to-red-600' },
    { sides: 6, label: 'd6', color: 'from-orange-500 to-orange-600' },
    { sides: 8, label: 'd8', color: 'from-yellow-500 to-yellow-600' },
    { sides: 10, label: 'd10', color: 'from-green-500 to-green-600' },
    { sides: 12, label: 'd12', color: 'from-blue-500 to-blue-600' },
    { sides: 20, label: 'd20', color: 'from-purple-500 to-purple-600' },
    { sides: 100, label: 'd100', color: 'from-pink-500 to-pink-600' },
  ];

  return (
    <>
      {/* Dice Tray - Left Panel - Slides up from button */}
      {showPanel && (
      <div className="dice-roller-container fixed left-6 z-[60] bg-slate-800/98 backdrop-blur-lg border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden transition-opacity duration-200" style={{ width: '140px', bottom: '96px', opacity: showPanel ? 1 : 0 }}>
        {/* Dice Buttons - Vertical Stack */}
        <div className="p-2 space-y-1.5">
          {diceButtons.map(({ sides, label }, index) => (
            <button
              key={sides}
              className="relative w-full h-9 bg-slate-700/80 hover:bg-slate-600 rounded-lg font-bold text-white text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center"
              onClick={() => addDie(sides)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (sides === 20) {
                  setRollMode(prev => {
                    if (prev === 'normal') return 'advantage';
                    if (prev === 'advantage') return 'disadvantage';
                    return 'normal';
                  });
                }
              }}
            >
              <span className="text-sm">{label}</span>
              {dicePool.filter(d => d.sides === sides).length > 0 && (
                <div className="absolute right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold animate-[scaleIn_0.2s_ease-out]">
                  {dicePool.filter(d => d.sides === sides).length}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Close Button */}
        <button
          className="w-full py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white text-xs font-semibold uppercase tracking-wide transition-colors border-t border-slate-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      )}

      {/* Roll Display Panel - Right of Dice Tray */}
      {showPanel && dicePool.length > 0 && (
        <div className="dice-roller-container fixed left-[162px] z-[60] bg-slate-800/98 backdrop-blur-lg border-2 border-slate-700 rounded-2xl shadow-2xl p-3 animate-[slideInLeft_0.3s_ease-out]" style={{ width: '240px', bottom: '96px' }}>
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wide text-center">Roll Formula</div>

          {/* Editable Notation Input */}
          <input
            type="text"
            className="w-full bg-slate-900/80 rounded-lg p-2 mb-3 font-mono text-base font-bold text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={notationInput || buildNotation()}
            onChange={(e) => setNotationInput(e.target.value)}
            onBlur={() => {
              if (notationInput) {
                parseNotation(notationInput);
                setNotationInput('');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (notationInput) {
                  parseNotation(notationInput);
                  setNotationInput('');
                }
                e.target.blur();
              }
            }}
            placeholder="1d20+5"
          />

          {/* Advantage/Disadvantage Buttons */}
          <div className="flex gap-2 mb-3">
            <button
              className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase transition-all ${
                rollMode === 'advantage'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
              }`}
              onClick={() => setRollMode(rollMode === 'advantage' ? 'normal' : 'advantage')}
            >
              ADV
            </button>
            <button
              className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase transition-all ${
                rollMode === 'disadvantage'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
              }`}
              onClick={() => setRollMode(rollMode === 'disadvantage' ? 'normal' : 'disadvantage')}
            >
              DIS
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-3">
            <button
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm"
              onClick={() => {                roll();
              }}
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

          {/* Modifier Controls - Larger buttons, smaller center field */}
          <div className="flex items-center justify-center gap-2">
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

      {/* 2D Dice Animation Display - Shows during rolling */}
      {rollingDice.length > 0 && (
        <>
          {/* Dark Overlay */}
          <div className="fixed inset-0 bg-black/60 z-40 animate-[fadeIn_0.2s_ease-out]" />

          {/* Dice Display */}
          <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <div className="flex flex-wrap gap-4 max-w-2xl justify-center">
              {rollingDice.map((die, idx) => (
                <div
                  key={die.id}
                  className={`w-24 h-24 rounded-xl flex items-center justify-center text-4xl font-bold shadow-2xl transition-all duration-100 ${
                    die.rolling
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white animate-pulse scale-110'
                      : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white scale-100'
                  }`}
                >
                  {die.value}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
