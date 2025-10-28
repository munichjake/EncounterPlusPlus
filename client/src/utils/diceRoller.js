/**
 * Universal Dice Rolling Wrapper
 * Automatically uses 2D or 3D dice based on user settings
 * Handles advantage/disadvantage and history logging
 */

let diceRollerCallback = null;
let addHistoryCallback = null;
let settingsRef = null;

/**
 * Initialize the dice roller with callbacks
 * @param {Function} onRoll - Callback to trigger dice roller UI (2D or 3D)
 * @param {Function} onAddHistory - Callback to add entry to history log
 * @param {Object} settings - User settings object (contains diceRollerType)
 */
export function initializeDiceRoller(onRoll, onAddHistory, settings) {
  diceRollerCallback = onRoll;
  addHistoryCallback = onAddHistory;
  settingsRef = settings;
}

/**
 * Roll dice with automatic 2D/3D selection
 * @param {Object} options - Roll options
 * @param {string} options.notation - Dice notation (e.g., "1d20+5")
 * @param {string} options.rollMode - 'normal', 'advantage', or 'disadvantage'
 * @param {boolean} options.critical - If true, doubles dice count (for damage)
 * @param {string} options.label - Text for history log (e.g., "Attack Roll")
 * @param {string} options.character - Character name for history
 * @param {Function} options.onResult - Optional callback for result
 * @returns {Promise<Object>} Roll result
 */
export async function rollDice({
  notation,
  rollMode = 'normal',
  critical = false,
  label = '',
  character = '',
  onResult = null
}) {
  if (!diceRollerCallback) {
    console.error('Dice roller not initialized. Call initializeDiceRoller() first.');
    return null;
  }

  // Handle critical hits: double dice, keep modifier
  let finalNotation = notation;
  if (critical) {
    const match = notation.match(/^(\d+)d(\d+)([+\-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1]);
      const sides = match[2];
      const modifier = match[3] || '';
      finalNotation = `${count * 2}d${sides}${modifier}`;
    }
  }

  return new Promise((resolve) => {
    // Callback that handles the roll result
    const handleResult = (result) => {
      // Add to history log
      if (addHistoryCallback && label) {
        const historyEntry = {
          type: 'dice',
          timestamp: new Date().toISOString(),
          character: character || 'Unknown',
          label: critical ? `${label} (CRIT)` : label,
          notation: result.notation || finalNotation,
          rolls: result.rolls,
          total: result.total,
          modifier: result.modifier || 0,
          rollMode
        };
        addHistoryCallback(historyEntry);
      }

      // Call custom callback if provided
      if (onResult) {
        onResult(result);
      }

      resolve(result);
    };

    // Trigger the dice roller (will use 2D or 3D based on settings)
    // Format: "Label | Notation" if label exists, otherwise just notation
    const displayNotation = label ? `${label} | ${finalNotation}` : finalNotation;

    diceRollerCallback({
      notation: finalNotation,
      label,
      character,
      rollMode,
      onResult: handleResult
    });
  });
}

/**
 * Quick roll functions for common scenarios
 */
export const quickRoll = {
  d20: (modifier = 0, label = 'D20 Roll', character = '') =>
    rollDice({
      notation: modifier ? `1d20${modifier > 0 ? '+' : ''}${modifier}` : '1d20',
      label,
      character
    }),

  attack: (modifier = 0, character = '') =>
    rollDice({
      notation: modifier ? `1d20${modifier > 0 ? '+' : ''}${modifier}` : '1d20',
      label: 'Attack Roll',
      character
    }),

  advantage: (modifier = 0, label = 'Roll with Advantage', character = '') =>
    rollDice({
      notation: modifier ? `1d20${modifier > 0 ? '+' : ''}${modifier}` : '1d20',
      rollMode: 'advantage',
      label,
      character
    }),

  disadvantage: (modifier = 0, label = 'Roll with Disadvantage', character = '') =>
    rollDice({
      notation: modifier ? `1d20${modifier > 0 ? '+' : ''}${modifier}` : '1d20',
      rollMode: 'disadvantage',
      label,
      character
    }),

  damage: (notation, label = 'Damage Roll', character = '') =>
    rollDice({
      notation,
      label,
      character
    }),

  custom: (notation, label = 'Custom Roll', character = '') =>
    rollDice({
      notation,
      label,
      character
    })
};


// Make available in browser console for debugging/testing
if (typeof window !== 'undefined') {
  window.diceRoller = {
    roll: rollDice,
    quick: quickRoll,
    init: initializeDiceRoller
  };
}
