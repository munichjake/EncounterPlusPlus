// Sort encounter combatants by initiative
export function sortByInitiative(enc, combatMode = true) {
  // Handle empty or incomplete encounter data (e.g., during optimistic creation)
  if (!enc || !enc.combatants) {
    return [];
  }

  if (!enc.initiativeOrder || enc.initiativeOrder.length === 0) {
    // Fallback: sort combatants by initiative, then by tie-breaker
    const entries = Object.values(enc.combatants);
    return entries.sort((a, b) => {
      const initDiff = (b.initiative ?? 0) - (a.initiative ?? 0);
      if (initDiff !== 0) return initDiff;
      return (b.initiativeTieBreaker ?? 0) - (a.initiativeTieBreaker ?? 0);
    });
  }

  // Map initiativeOrder to actual combatants or lair action markers
  return enc.initiativeOrder.map(id => {
    if (typeof id === 'object' && id.type === 'lair') {
      // This is a lair action marker - only show in combat mode
      if (!combatMode) {
        return null;
      }
      return {
        id: id.id,
        type: 'lair',
        initiative: id.initiative,
        initiativeTieBreaker: 0, // Lair actions always lose ties
        name: `🏰 Lair Actions`,
        isLairAction: true,
        visibleToPlayers: false, // Always hidden from players
      };
    } else {
      // Regular combatant
      return enc.combatants[id];
    }
  }).filter(Boolean); // Remove any undefined entries
}

// Helper function to capitalize first letter of each word
export function capitalizeDefense(text) {
  if (!text) return text;
  return text.split(', ').map(item => {
    return item.trim().split(' ').map(word => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }).join(', ');
}

// Helper function to format action name with recharge notation
export function formatActionName(name) {
  if (!name) return name;

  // Replace {@recharge N} with formatted badge (with or without number)
  const rechargeMatchWithNum = name.match(/\{@recharge (\d+)\}/i);
  if (rechargeMatchWithNum) {
    const num = parseInt(rechargeMatchWithNum[1]);
    const range = num === 6 ? "6" : `${num}-6`;
    // Return without the recharge tag - will be added as badge separately
    return {
      name: name.replace(/\{@recharge \d+\}/i, '').trim(),
      recharge: range
    };
  }

  // Handle {@recharge} without number (default is 5-6)
  const rechargeMatchNoNum = name.match(/\{@recharge\}/i);
  if (rechargeMatchNoNum) {
    return {
      name: name.replace(/\{@recharge\}/i, '').trim(),
      recharge: "5-6"
    };
  }

  return { name, recharge: null };
}

// Helper function to parse defense arrays with special formatting
// Returns an array of defense strings (to preserve grouping)
export function parseDefenseArray(defenseArray) {
  if (!defenseArray) return undefined;
  if (!Array.isArray(defenseArray)) {
    // If it's already a string, split by comma and capitalize
    return defenseArray.split(',').map(item => capitalizeDefense(item.trim()));
  }
  // Empty array means no defenses - return undefined to hide section
  if (defenseArray.length === 0) {
    return undefined;
  }

  const parsed = defenseArray.map(item => {
    if (typeof item === 'string' && item.startsWith("['") && item.endsWith("']")) {
      // Special format: ['bludgeoning', 'piercing', 'slashing'] -> "bludgeoning, piercing, slashing from non-magical weapons"
      const inner = item.slice(2, -2); // Remove [' and ']
      const types = inner.split("', '");
      return capitalizeDefense(types.join(", ") + " from non-magical weapons");
    }
    return capitalizeDefense(item);
  });

  return parsed;
}

// Unified HP change logic - always applies temp HP first for damage
export function applyHPChange(combatant, inputValue) {
  const trimmed = inputValue.trim();
  const currentHP = combatant.hp ?? 0;
  const currentTempHP = combatant.tempHP || 0;
  const maxHP = combatant.baseHP;

  if (trimmed.startsWith('+')) {
    // Healing - only affects normal HP
    const amount = parseInt(trimmed.substring(1)) || 0;
    return {
      hp: Math.min(maxHP, currentHP + amount)
    };
  } else if (trimmed.startsWith('-')) {
    // Damage - ALWAYS applies to temp HP first
    const damage = parseInt(trimmed.substring(1)) || 0;

    if (currentTempHP > 0) {
      if (damage <= currentTempHP) {
        // All damage absorbed by temp HP
        return {
          tempHP: currentTempHP - damage
        };
      } else {
        // Temp HP absorbed, rest goes to normal HP
        const remaining = damage - currentTempHP;
        return {
          tempHP: 0,
          hp: Math.max(0, currentHP - remaining)
        };
      }
    } else {
      // No temp HP, damage goes straight to normal HP
      return {
        hp: Math.max(0, currentHP - damage)
      };
    }
  } else {
    // Absolute value - set HP directly (doesn't touch temp HP)
    const amount = parseInt(trimmed) || 0;
    return {
      hp: Math.max(0, Math.min(maxHP, amount))
    };
  }
}
