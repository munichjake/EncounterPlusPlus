export function numberOr(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Helper function to process spell entries that might be strings or {choose} objects
export function processSpellEntry(spellRaw) {
  // If it's a string, process normally
  if (typeof spellRaw === 'string') {
    return {
      type: 'spell',
      name: spellRaw
        .replace(/\{@spell ([^}|]+)(?:\|[^}]+)?\}/gi, "$1")
        .replace(/\*/g, "")
        .trim()
    };
  }

  // If it's a {choose} object
  if (typeof spellRaw === 'object' && spellRaw?.choose) {
    return {
      type: 'choose',
      count: spellRaw.choose.count,
      from: spellRaw.choose.from
    };
  }

  // Fallback for unknown formats
  return {
    type: 'unknown',
    raw: spellRaw
  };
}

// Helper function to extract spell names from various formats
export function extractSpellNames(spellcastingArray) {
  const spellNames = [];

  if (!spellcastingArray || !Array.isArray(spellcastingArray))
    return spellNames;

  spellcastingArray.forEach((spellInfo) => {
    // Format 1: spellsByLevel
    if (spellInfo.spellsByLevel && Array.isArray(spellInfo.spellsByLevel)) {
      spellInfo.spellsByLevel.forEach((levelData) => {
        // Support both 'list' and 'spells' formats
        const spellList = levelData.list || levelData.spells;
        if (spellList && Array.isArray(spellList)) {
          spellList.forEach((spellRaw) => {
            const spellName = spellRaw
              .replace(/\{@spell ([^}|]+)(?:\|[^}]+)?\}/gi, "$1")
              .replace(/\*/g, "")
              .trim();
            spellNames.push(spellName);
          });
        }
      });
    }

    // Format 2: will (at will)
    if (spellInfo.will && Array.isArray(spellInfo.will)) {
      spellInfo.will.forEach((spellRaw) => {
        const spellName = spellRaw
          .replace(/\{@spell ([^}|]+)(?:\|[^}]+)?\}/gi, "$1")
          .replace(/\*/g, "")
          .trim();
        spellNames.push(spellName);
      });
    }

    // Format 3: daily
    if (spellInfo.daily) {
      Object.values(spellInfo.daily).forEach((spellList) => {
        if (Array.isArray(spellList)) {
          spellList.forEach((spellRaw) => {
            const spellName = spellRaw
              .replace(/\{@spell ([^}|]+)(?:\|[^}]+)?\}/gi, "$1")
              .replace(/\*/g, "")
              .trim();
            spellNames.push(spellName);
          });
        }
      });
    }
  });

  return [...new Set(spellNames)]; // Remove duplicates
}

// Get spell slots for a given caster level and spell level
export function getSpellSlotsForLevel(casterLevel, spellLevel) {
  // Standard spell slot table for full casters
  const spellSlotTable = {
    1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
    3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
    11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
    18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
  };

  const slots = spellSlotTable[casterLevel];
  if (!slots) return 0;

  return slots[spellLevel - 1] || 0;
}
