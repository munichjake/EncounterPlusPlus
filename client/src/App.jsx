import React, { useEffect, useMemo, useState, useRef } from "react";
import MonsterManager from "./components/MonsterManager.jsx";
import FantasticDiceRoller from "./components/FantasticDiceRoller.jsx";
import DiceRollerDDDice from "./components/DiceRollerDDDice.jsx";
import Login from "./components/Login.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";
import { API, apiGet, apiPost, apiPut, apiDelete } from "./utils/api.js";
import { normalizeCreatureForForm } from "./utils/creatureNormalizer.js";
import { PlayerCharacterTab } from "./components/PlayerCharacterTab.jsx";
import { CompactParticipantRow } from "./components/CompactParticipantRow.jsx";
import { useModal } from "./components/Modal.jsx";
import { Settings, useSettings } from "./components/Settings.jsx";
import { initializeDiceRoller, rollDice } from "./utils/diceRoller.js";
import { ThreeDDice, ThreeDDiceAPI } from "dddice-js";
import CampaignManager from "./components/CampaignManager.jsx";
import EncounterTreeView from "./components/EncounterTreeView.jsx";
import { ShareCodeModal } from "./components/ShareCodeModal.jsx";

// jQuery and Select2 are loaded via CDN in index.html

// Creature adjectives will be loaded from JSON file
let CREATURE_ADJECTIVES = [];

// Load adjectives from JSON file
async function loadCreatureAdjectives() {
  try {
    const response = await fetch(API('/data/creature-adjectives.json'));
    const data = await response.json();
    CREATURE_ADJECTIVES = data.adjectives || [];
  } catch (error) {
    console.error('Failed to load creature adjectives:', error);
    // Fallback to a few basic adjectives if loading fails
    CREATURE_ADJECTIVES = ["Brave", "Cunning", "Fierce", "Swift", "Mighty"];
  }
}

// Convert number to Roman numerals
function toRomanNumeral(num) {
  const romanMap = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  for (const [value, numeral] of romanMap) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

// Get unique identifier for duplicate creatures based on naming mode
function getUniqueIdentifier(baseName, existingNames, namingMode = 'adjective') {
  const duplicates = existingNames.filter(name =>
    name === baseName || name.match(new RegExp(`^(.+\\s)?${baseName}$`))
  );
  const index = duplicates.length + 1;

  switch (namingMode) {
    case 'letter':
      // A-Z, then AA, AB, etc.
      const letter = index <= 26
        ? String.fromCharCode(64 + index)
        : String.fromCharCode(64 + Math.floor((index - 1) / 26)) + String.fromCharCode(65 + ((index - 1) % 26));
      return letter;

    case 'number':
      return index.toString();

    case 'roman':
      return toRomanNumeral(index);

    case 'adjective':
    default:
      // Get unused adjectives for this creature type
      const usedAdjectives = existingNames
        .filter(name => name.includes(baseName))
        .map(name => name.replace(baseName, '').trim())
        .filter(adj => CREATURE_ADJECTIVES.includes(adj));

      const availableAdjectives = CREATURE_ADJECTIVES.filter(adj => !usedAdjectives.includes(adj));

      if (availableAdjectives.length === 0) {
        // If all adjectives used, append a number
        const maxNumber = existingNames
          .filter(name => name.includes(baseName))
          .map(name => {
            const match = name.match(/(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          })
          .reduce((max, num) => Math.max(max, num), 0);
        return `${CREATURE_ADJECTIVES[Math.floor(Math.random() * CREATURE_ADJECTIVES.length)]} ${maxNumber + 1}`;
      }

      return availableAdjectives[Math.floor(Math.random() * availableAdjectives.length)];
  }
}

// Format creature name based on naming mode
function formatCreatureName(identifier, baseName, namingMode = 'adjective') {
  if (namingMode === 'adjective') {
    return `${identifier} ${baseName}`;
  } else {
    return `${baseName} ${identifier}`;
  }
}

// Source abbreviation vocabulary with colors
const SOURCE_VOCAB = {
  MM: { name: "Monster Manual", color: "red" },
  BGDIA: { name: "Baldur's Gate: Descent into Avernus", color: "orange" },
  VGM: { name: "Volo's Guide to Monsters", color: "amber" },
  MTF: { name: "Mordenkainen's Tome of Foes", color: "yellow" },
  MPMM: {
    name: "Mordenkainen Presents: Monsters of the Multiverse",
    color: "lime",
  },
  PHB: { name: "Player's Handbook", color: "green" },
  DMG: { name: "Dungeon Master's Guide", color: "emerald" },
  XPHB: { name: "Player's Handbook (2024)", color: "teal" },
  XDMG: { name: "Dungeon Master's Guide (2024)", color: "cyan" },
  XMM: { name: "Monster Manual (2024)", color: "sky" },
  VRGR: { name: "Van Richten's Guide to Ravenloft", color: "blue" },
  TCE: { name: "Tasha's Cauldron of Everything", color: "indigo" },
  XGE: { name: "Xanathar's Guide to Everything", color: "violet" },
  FTD: { name: "Fizban's Treasury of Dragons", color: "purple" },
  MGELFT: { name: "Mordenkainen's Fiendish Folio", color: "fuchsia" },
  TOA: { name: "Tomb of Annihilation", color: "pink" },
  SKT: { name: "Storm King's Thunder", color: "rose" },
  OOTA: { name: "Out of the Abyss", color: "red" },
  PotA: { name: "Princes of the Apocalypse", color: "orange" },
  HotDQ: { name: "Hoard of the Dragon Queen", color: "amber" },
  RoT: { name: "The Rise of Tiamat", color: "yellow" },
  CoS: { name: "Curse of Strahd", color: "lime" },
  LMoP: { name: "Lost Mine of Phandelver", color: "green" },
  GoS: { name: "Ghosts of Saltmarsh", color: "emerald" },
  DIP: { name: "Dragon of Icespire Peak", color: "teal" },
  SLW: { name: "Storm Lord's Wrath", color: "cyan" },
  SDW: { name: "Sleeping Dragon's Wake", color: "sky" },
  DC: { name: "Divine Contention", color: "blue" },
  ERLW: { name: "Eberron: Rising from the Last War", color: "indigo" },
  EGW: { name: "Explorer's Guide to Wildemount", color: "violet" },
  MOT: { name: "Mythic Odysseys of Theros", color: "purple" },
  IDRotF: { name: "Icewind Dale: Rime of the Frostmaiden", color: "fuchsia" },
  CM: { name: "Candlekeep Mysteries", color: "pink" },
  WBtW: { name: "The Wild Beyond the Witchlight", color: "rose" },
  CRCotN: { name: "Critical Role: Call of the Netherdeep", color: "red" },
  JttRC: { name: "Journeys through the Radiant Citadel", color: "orange" },
  DSotDQ: { name: "Dragonlance: Shadow of the Dragon Queen", color: "amber" },
  KftGV: { name: "Keys from the Golden Vault", color: "yellow" },
  BMT: { name: "The Book of Many Things", color: "lime" },
  PaBTSO: {
    name: "Phandelver and Below: The Shattered Obelisk",
    color: "green",
  },
  SatO: { name: "Spelljammer: Adventures in Space", color: "emerald" },
  AAG: { name: "Astral Adventurer's Guide", color: "teal" },
  BAM: { name: "Boo's Astral Menagerie", color: "cyan" },
  LLoK: { name: "Lost Laboratory of Kwalish", color: "sky" },
  GGR: { name: "Guildmasters' Guide to Ravnica", color: "blue" },
  AI: { name: "Acquisitions Incorporated", color: "indigo" },
  OGA: { name: "One Grung Above", color: "violet" },
  TFTYP: { name: "Tales from the Yawning Portal", color: "purple" },
  WDH: { name: "Waterdeep: Dragon Heist", color: "fuchsia" },
  WDMM: { name: "Waterdeep: Dungeon of the Mad Mage", color: "pink" },
};

// Helper function to get color classes for a source
function getSourceColorClasses(source) {
  const colorMap = {
    red: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
    orange:
      "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    amber:
      "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    yellow:
      "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
    lime: "bg-lime-100 dark:bg-lime-900/40 text-lime-800 dark:text-lime-300 border-lime-300 dark:border-lime-700",
    green:
      "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
    emerald:
      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
    teal: "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700",
    cyan: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700",
    sky: "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700",
    blue: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    indigo:
      "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
    violet:
      "bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300 border-violet-300 dark:border-violet-700",
    purple:
      "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    fuchsia:
      "bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-300 dark:border-fuchsia-700",
    pink: "bg-pink-100 dark:bg-pink-900/40 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-700",
    rose: "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700",
  };

  const sourceData = SOURCE_VOCAB[source];
  const color = sourceData?.color || "blue";
  return colorMap[color] || colorMap["blue"];
}

function numberOr(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Helper function to process spell entries that might be strings or {choose} objects
function processSpellEntry(spellRaw) {
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
function extractSpellNames(spellcastingArray) {
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

// Calculate spell slots for a given caster level and spell level
function getSpellSlotsForLevel(casterLevel, spellLevel) {
  // D&D 5e spell slot progression table
  const slotTable = {
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
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
  };

  if (spellLevel === 0) return null; // Cantrips don't have slots
  if (casterLevel < 1 || casterLevel > 20) return null;
  if (spellLevel < 1 || spellLevel > 9) return null;

  return slotTable[casterLevel][spellLevel - 1];
}

// Dice roller using crypto.getRandomValues for true randomness
function rollSingleDie(sides) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % sides) + 1;
}

function rollD20() {
  return rollSingleDie(20);
}

function parseDiceRoll(notation) {
  // Support formats like "2d6+3" or "1d20"
  const match = notation.match(/^(\d+)d(\d+)([+\-]\d+)?$/i);
  if (!match) return null;

  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  let total = modifier;
  const rolls = [];
  for (let i = 0; i < count; i++) {
    const roll = rollSingleDie(sides);
    rolls.push(roll);
    total += roll;
  }

  return { rolls, total, notation, modifier };
}

function SlotEditor({ slots, onChange }) {
  const [levels, setLevels] = useState(() =>
    Object.keys(slots || {})
      .map((l) => Number(l))
      .sort((a, b) => a - b)
  );
  useEffect(() => {
    setLevels(
      Object.keys(slots || {})
        .map((l) => Number(l))
        .sort((a, b) => a - b)
    );
  }, [slots]);
  return (
    <div className="space-y-2">
      {levels.map((l) => (
        <div key={l} className="flex items-center gap-2">
          <span className="w-10">L{l}</span>
          <input
            type="number"
            className="input"
            value={slots[l]?.current ?? 0}
            onChange={(e) =>
              onChange({
                ...slots,
                [l]: {
                  ...(slots[l] || { max: 0 }),
                  current: numberOr(e.target.value),
                },
              })
            }
          />
          <span>/</span>
          <input
            type="number"
            className="input"
            value={slots[l]?.max ?? 0}
            onChange={(e) =>
              onChange({
                ...slots,
                [l]: {
                  current: slots[l]?.current ?? 0,
                  max: numberOr(e.target.value),
                },
              })
            }
          />
          <button
            className="btn"
            onClick={() =>
              onChange({
                ...slots,
                [l]: {
                  current: Math.max(0, (slots[l]?.current ?? 0) - 1),
                  max: slots[l]?.max ?? 0,
                },
              })
            }
          >
            ‑1
          </button>
          <button
            className="btn"
            onClick={() =>
              onChange({
                ...slots,
                [l]: {
                  current: Math.min(
                    slots[l]?.max ?? 0,
                    (slots[l]?.current ?? 0) + 1
                  ),
                  max: slots[l]?.max ?? 0,
                },
              })
            }
          >
            +1
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          id="newlvl"
          className="input w-20"
          placeholder="Lvl"
          type="number"
        />
        <button
          className="btn"
          onClick={() => {
            const el = document.getElementById("newlvl");
            const lvl = Number(el.value);
            if (!Number.isFinite(lvl) || lvl <= 0) return;
            onChange({ ...(slots || {}), [lvl]: { current: 0, max: 0 } });
            el.value = "";
          }}
        >
          Level hinzufügen
        </button>
      </div>
    </div>
  );
}

function useEncounter(id, onEncounterUpdate) {
  const [enc, setEnc] = useState(null);
  useEffect(() => {
    if (!id) return;

    // Skip API call for temporary IDs (optimistic creation)
    if (typeof id === 'string' && id.startsWith('temp_')) {
      // Create empty encounter structure for temporary ID
      setEnc({
        id: id,
        name: 'Encounter',
        combatants: {},
        initiativeOrder: [],
        round: 1,
        turnIndex: 0
      });
      return;
    }

    apiGet(`/api/encounters/${id}`)
      .then((r) => r.json())
      .then((data) => {
        // Normalize combatants to fix any object fields that should be primitives
        if (data && data.combatants) {
          const normalizedCombatants = {};
          Object.entries(data.combatants).forEach(([key, c]) => {
            normalizedCombatants[key] = {
              ...c,
              // Ensure hp and baseHP are numbers, not objects
              hp:
                typeof c.hp === "object"
                  ? c.hp?.average || c.hp?.formula || 0
                  : c.hp || 0,
              baseHP:
                typeof c.baseHP === "object"
                  ? c.baseHP?.average || c.baseHP?.formula || 0
                  : c.baseHP || 0,
              // Ensure ac is a number
              ac: typeof c.ac === "object" ? c.ac?.value || 10 : c.ac || 10,
              // Ensure senses is a string, not an object
              senses:
                typeof c.senses === "object" && c.senses !== null
                  ? Object.entries(c.senses)
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(", ")
                  : c.senses,
            };
          });
          data.combatants = normalizedCombatants;
        }
        setEnc(data);
      })
      .catch((err) => {
        console.error('Failed to load encounter:', err);
        // Create empty encounter on error
        setEnc({
          id: id,
          name: 'Encounter',
          combatants: {},
          initiativeOrder: [],
          round: 1,
          turnIndex: 0
        });
      });
  }, [id]);
  const save = async (next) => {
    // Optimistic update: Update UI immediately
    const previous = enc;
    setEnc(next);

    // Update encounters list immediately (optimistic)
    if (onEncounterUpdate && next.id && next.name) {
      onEncounterUpdate(next.id, next.name);
    }

    // Background API call
    try {
      await apiPut(`/api/encounters/${id}`, next);
    } catch (err) {
      console.error('Failed to save encounter:', err);
      // Rollback on error
      setEnc(previous);
      if (onEncounterUpdate && previous.id && previous.name) {
        onEncounterUpdate(previous.id, previous.name);
      }
    }
  };
  return { enc, setEnc, save };
}

function sortByInitiative(enc, combatMode = true) {
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
function capitalizeDefense(text) {
  if (!text) return text;
  return text.split(', ').map(item => {
    return item.trim().split(' ').map(word => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  }).join(', ');
}

// Helper function to format action name with recharge notation
function formatActionName(name) {
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
function parseDefenseArray(defenseArray) {
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

export default function App() {
  const { user, loading, logout } = useAuth();
  const [diceContextMenu, setDiceContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    notation: "",
    type: "damage",
    onRoll: null,
  }); // Context menu for dice rolls
  const { alert, confirm, prompt, initiativePrompt, hpManagement, modal } = useModal(rollDice, setDiceContextMenu);

  // Unified HP change logic - always applies temp HP first for damage
  function applyHPChange(combatant, inputValue) {
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

  const [encounters, setEncounters] = useState([]);
  const [encountersLoading, setEncountersLoading] = useState(true);
  const [currentId, setCurrentId] = useState(null);
  const [selectedCombatantId, setSelectedCombatantId] = useState(null);
  const [ecrData, setEcrData] = useState(null); // ML-predicted eCR for selected combatant
  const [combatMode, setCombatMode] = useState(false);
  const [diceRollResult, setDiceRollResult] = useState(null);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [diceRollerStep, setDiceRollerStep] = useState("select"); // 'select' or 'result'
  const [diceRollerInitialNotation, setDiceRollerInitialNotation] =
    useState(null);
  const [diceRollerAutoRoll, setDiceRollerAutoRoll] = useState(false);
  const [diceRollerInitialRollMode, setDiceRollerInitialRollMode] =
    useState("normal");
  const [diceRollerLabel, setDiceRollerLabel] = useState('');
  const [diceRollerCharacter, setDiceRollerCharacter] = useState('');
  const [selectedDice, setSelectedDice] = useState(null);
  const [showCreatureManager, setShowCreatureManager] = useState(false);
  const [editingCreature, setEditingCreature] = useState(null);
  const [creatureManagerInitialTab, setCreatureManagerInitialTab] =
    useState("browse");
  const [creatureManagerInitialSearch, setCreatureManagerInitialSearch] =
    useState("");
  const [showCampaignManager, setShowCampaignManager] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignForBulkAdd, setSelectedCampaignForBulkAdd] = useState(null);
  const [isAddingCampaignPlayers, setIsAddingCampaignPlayers] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [encounterSearchTerm, setEncounterSearchTerm] = useState('');
  const [encounterFolderFilter, setEncounterFolderFilter] = useState('all');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });
  const [rollHistory, setRollHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("rollHistory");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to load roll history from localStorage:", error);
      return [];
    }
  });
  const [showRollHistory, setShowRollHistory] = useState(false);
  const [toastDismissTimer, setToastDismissTimer] = useState(null);
  const [rechargeNotifications, setRechargeNotifications] = useState([]); // Array of {id, message, success, timestamp}
  const [spellTooltip, setSpellTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    spell: null,
  });
  const [showShareCodeModal, setShowShareCodeModal] = useState(false);

  // Helper function for spell tooltip handlers
  const getSpellTooltipHandlers = (spellName) => ({
    onMouseEnter: (e) => {
      const spellData = combatantSpellCache[selectedCombatantId]?.[spellName.toLowerCase()];
      if (spellData) {
        setSpellTooltip({
          show: true,
          x: e.clientX,
          y: e.clientY,
          spell: spellData,
        });
      }
    },
    onMouseMove: (e) => {
      setSpellTooltip(prev => ({
        ...prev,
        x: e.clientX,
        y: e.clientY,
      }));
    },
    onMouseLeave: () => {
      setSpellTooltip({ show: false, x: 0, y: 0, spell: null });
    },
  });

  // Condition tooltip and modal state
  const [conditionsData, setConditionsData] = useState({});
  const [conditionTooltip, setConditionTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    condition: null,
  });
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [conditionName, setConditionName] = useState(null);
  const [showConditionModal, setShowConditionModal] = useState(false);

  // Helper function for condition tooltip handlers
  const getConditionTooltipHandlers = (conditionName) => ({
    onMouseEnter: (e) => {
      const conditionData = conditionsData[conditionName.toLowerCase()];
      if (conditionData) {
        setConditionTooltip({
          show: true,
          x: e.clientX,
          y: e.clientY,
          condition: conditionData,
          name: conditionName,
        });
      }
    },
    onMouseMove: (e) => {
      setConditionTooltip(prev => ({
        ...prev,
        x: e.clientX,
        y: e.clientY,
      }));
    },
    onMouseLeave: () => {
      setConditionTooltip({ show: false, x: 0, y: 0, condition: null, name: null });
    },
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState(null);
  const [showSpellModal, setShowSpellModal] = useState(false);

  // Collapse states for panels
  const [encounterTreeCollapsed, setEncounterTreeCollapsed] = useState(false);
  const [quickActionsCollapsed, setQuickActionsCollapsed] = useState(false);
  const [playerScreenControlsCollapsed, setPlayerScreenControlsCollapsed] = useState(false);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState(null); // 'encounters', 'quickActions', 'players', null
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [monsterBrowserCollapsed, setMonsterBrowserCollapsed] = useState(false);
  const [sourceTooltip, setSourceTooltip] = useState({
    source: null,
    fullName: null,
    x: 0,
    y: 0,
  });
  const [combatantSpellCache, setCombatantSpellCache] = useState({}); // Cache spell data by combatant ID
  const [lairActionsCache, setLairActionsCache] = useState({}); // Cache lair actions by legendary group name
  const [initiativeTooltip, setInitiativeTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    roll: 0,
    bonus: 0,
    total: 0,
  }); // Custom tooltip for initiative
  const [acTooltip, setAcTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    ac: 0,
    armorType: null,
  }); // Custom tooltip for AC
  const [hpTooltip, setHpTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    current: 0,
    max: 0,
    tempHP: 0,
    maxHPModifier: 0,
    hitDice: null,
  }); // Custom tooltip for HP
  const [crTooltip, setCrTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    cr: 0,
    eCRData: null,
    loading: false,
    error: null,
  }); // Custom tooltip for CR with eCR
  const [showECRModal, setShowECRModal] = useState(false);
  const [ecrModalData, setECRModalData] = useState(null);
  const [damageModifier, setDamageModifier] = useState({
    show: false,
    combatantId: null,
    x: 0,
    y: 0,
  }); // Damage modifier tooltip
  const [bloodiedToasts, setBloodiedToasts] = useState([]); // Toast notifications for bloodied creatures
  const settings = useSettings();

  // Callback to update encounters list when encounter name changes
  const updateEncounterInList = React.useCallback((encId, newName) => {
    setEncounters((prev) =>
      prev.map((e) => (e.id === encId ? { ...e, name: newName } : e))
    );
  }, []);

  const { enc, setEnc, save } = useEncounter(currentId, updateEncounterInList);
  const order = useMemo(() => (enc ? sortByInitiative(enc, combatMode) : []), [enc, combatMode]);
  const selectedCombatant = useMemo(() => {
    if (!enc || !selectedCombatantId) return null;

    // Check if it's a lair action marker
    if (selectedCombatantId.startsWith('lair_')) {
      // Find the lair action marker in the order
      return order.find(c => c.id === selectedCombatantId);
    }

    return enc.combatants[selectedCombatantId];
  }, [enc, selectedCombatantId, order]);

  const dddiceRef = useRef(null);
  const dddiceCanvasRef = useRef(null);
  const [dddiceReady, setDddiceReady] = useState(false);

  // Load eCR for selected combatant
  useEffect(() => {
    if (!selectedCombatant || !selectedCombatant.name) {
      setEcrData(null);
      return;
    }

    // Only fetch eCR for monster combatants (not players or lair actions)
    if (selectedCombatant.is_player || selectedCombatantId?.startsWith('lair_')) {
      setEcrData(null);
      return;
    }

    // Fetch eCR prediction from server
    const fetchECR = async () => {
      try {
        const response = await fetch(API('/api/ecr/predict'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(selectedCombatant),
        });

        if (response.ok) {
          const data = await response.json();
          setEcrData(data);
        } else {
          console.error('Failed to fetch eCR:', response.statusText);
          setEcrData(null);
        }
      } catch (error) {
        console.error('Error fetching eCR:', error);
        setEcrData(null);
      }
    };

    fetchECR();
  }, [selectedCombatant, selectedCombatantId]);

  // Load creature adjectives on app start
  useEffect(() => {
    loadCreatureAdjectives();
  }, []);

  // Load conditions on app start
  useEffect(() => {
    const loadConditions = async () => {
      try {
        const response = await fetch(API('/api/conditions'));
        const data = await response.json();

        // Create a lookup map by condition name (case-insensitive)
        // Store both PHB and XPHB versions if available
        const conditionsMap = {};
        if (data.condition && Array.isArray(data.condition)) {
          data.condition.forEach(cond => {
            const name = cond.name.toLowerCase();

            if (!conditionsMap[name]) {
              // First entry for this condition
              conditionsMap[name] = {
                legacy: null,
                reprinted: null,
              };
            }

            // Store based on source
            if (cond.source === 'PHB') {
              conditionsMap[name].legacy = cond;
            } else if (cond.source === 'XPHB') {
              conditionsMap[name].reprinted = cond;
            }
          });
        }
        setConditionsData(conditionsMap);
      } catch (error) {
        console.error('Failed to load conditions:', error);
      }
    };
    loadConditions();
  }, []);

  useEffect(() => {
    const initDddice = async () => {
      if (dddiceRef.current) return;
      const saved = localStorage.getItem("app-settings");
      let settings = { diceRollerType: "2d" };
      if (saved)
        try {
          settings = JSON.parse(saved);
        } catch (e) {}      if (settings.diceRollerType !== "3d") {        return;
      }
      try {
        const apiKey = import.meta.env.VITE_DDDICE_API_KEY || "";        if (!apiKey) return;
        const api = new ThreeDDiceAPI(apiKey, "Encounter++");
        let themeId = "dddice-standard";
        try {
          const box = await api.diceBox.list();
          if (box?.data?.[0]) themeId = box.data[0].id;        } catch (e) {}
        const room = await api.room.create();
        const slug = room?.data?.slug || room?.data?.id;        const canvas = document.createElement("canvas");
        canvas.style.cssText =
          "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:45;pointer-events:none";
        document.body.appendChild(canvas);
        dddiceCanvasRef.current = canvas;
        const dddice = new ThreeDDice(canvas, apiKey);
        await dddice.start();
        await dddice.connect(slug);
        dddiceRef.current = { dddice, theme: themeId };
        setDddiceReady(true);
        window.__dddiceInstance = dddiceRef.current;
        window.__dddiceReady = true;      } catch (err) {
        console.error("❌ dddice failed:", err);
      }
    };
    initDddice();
    const handleChange = (e) => {
      if (e.detail.diceRollerType === "3d" && !dddiceRef.current) initDddice();
      else if (e.detail.diceRollerType !== "3d" && dddiceRef.current) {
        dddiceRef.current.dddice.stop();
        dddiceRef.current = null;
        setDddiceReady(false);
        if (dddiceCanvasRef.current)
          document.body.removeChild(dddiceCanvasRef.current);
      }
    };
    window.addEventListener("settings-changed", handleChange);
    return () => window.removeEventListener("settings-changed", handleChange);
  }, []);

  // Handle roll function - defined at component level for use in JSX
  const handleRoll = ({ notation, label, character, rollMode, onResult }) => {
    setDiceRollerInitialNotation(notation);
    setDiceRollerLabel(label || '');
    setDiceRollerCharacter(character || '');
    setDiceRollerInitialRollMode(rollMode || "normal");
    setDiceRollerAutoRoll(true);
    setShowDiceRoller(true);

    // Store callback for when roll completes
    window.__diceRollerCallback = onResult;
  };

  // Initialize dice roller wrapper
  useEffect(() => {

    const handleAddHistory = (entry) => {
      // TODO: Add to history log
      console.log('History entry:', entry);
    };

    initializeDiceRoller(handleRoll, handleAddHistory, settings);
  }, [settings]);

  // Load and cache all spells for the selected combatant
  useEffect(() => {
    if (!selectedCombatant || !selectedCombatant.spellcasting) return;

    // Check if already cached
    if (combatantSpellCache[selectedCombatantId]) return;

    // Extract all spell names from all formats
    const spellNames = extractSpellNames(selectedCombatant.spellcasting);

    if (spellNames.length === 0) return;

    // Load all spells with delay to avoid rate limiting
    const loadSpells = async () => {
      try {
        // Helper function to add delay between requests
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Load spells sequentially with small delay
        const results = [];
        for (let i = 0; i < spellNames.length; i++) {
          const spellName = spellNames[i];
          try {
            const response = await apiGet(
              `/api/spells/${encodeURIComponent(spellName)}`
            );
            const spell = await response.json();
            results.push({ name: spellName, data: spell });
          } catch (error) {
            console.error(`Failed to load spell: ${spellName}`, error);
            results.push(null);
          }

          // Add 50ms delay between requests (except after the last one)
          if (i < spellNames.length - 1) {
            await delay(50);
          }
        }
        const spellsMap = {};

        results.forEach((result) => {
          if (result && result.data) {
            spellsMap[result.name.toLowerCase()] = result.data;
          }
        });

        // Categorize spells by casting time
        const categorized = {
          actions: [],
          bonusActions: [],
          reactions: [],
          other: [],
        };

        Object.entries(spellsMap).forEach(([name, spell]) => {
          // encounterpp format - castingTime is a string
          if (spell.castingTime) {
            const castingTime = spell.castingTime.toLowerCase();

            if (
              castingTime.includes("action") &&
              !castingTime.includes("bonus") &&
              !castingTime.includes("reaction")
            ) {
              categorized.actions.push({ name, spell });
            } else if (castingTime.includes("bonus")) {
              categorized.bonusActions.push({ name, spell });
            } else if (castingTime.includes("reaction")) {
              categorized.reactions.push({ name, spell });
            } else {
              categorized.other.push({ name, spell });
            }
            return;
          }

          // 5e.tools format fallback - time is an array of objects
          if (!spell.time || !spell.time[0]) {
            categorized.other.push({ name, spell });
            return;
          }

          const time = spell.time[0];
          const unit = time.unit?.toLowerCase() || "";
          const number = time.number || 1;

          if (unit === "action" && number === 1) {
            categorized.actions.push({ name, spell });
          } else if (unit === "bonus") {
            categorized.bonusActions.push({ name, spell });
          } else if (unit === "reaction") {
            categorized.reactions.push({ name, spell });
          } else {
            categorized.other.push({ name, spell });
          }
        });

        console.log("Spell categorization for", selectedCombatant.name, ":", {
          actions: categorized.actions.map((s) => s.name),
          bonusActions: categorized.bonusActions.map((s) => s.name),
          reactions: categorized.reactions.map((s) => s.name),
          other: categorized.other.map((s) => s.name),
        });

        setCombatantSpellCache((prev) => ({
          ...prev,
          [selectedCombatantId]: {
            ...spellsMap,
            _categorized: categorized
          },
        }));
      } catch (error) {
        console.error("Error loading spells:", error);
      }
    };

    loadSpells();
  }, [selectedCombatant, selectedCombatantId, combatantSpellCache]);

  // Load lair actions from legendary group
  useEffect(() => {
    if (!selectedCombatant || !selectedCombatant.legendaryGroup) return;

    const groupName = selectedCombatant.legendaryGroup.name || selectedCombatant.legendaryGroup;

    // Check if already cached
    if (lairActionsCache[groupName]) return;

    const loadLairActions = async () => {
      try {
        const response = await apiGet(`/api/legendary-groups/${encodeURIComponent(groupName)}`);
        const groupData = await response.json();

        setLairActionsCache((prev) => ({
          ...prev,
          [groupName]: groupData,
        }));
      } catch (error) {
        console.error("Error loading lair actions:", error);
      }
    };

    loadLairActions();
  }, [selectedCombatant, lairActionsCache]);

  // Auto-initialize spell slots from spellcasting data
  useEffect(() => {
    if (!selectedCombatant || !selectedCombatant.spellcasting) return;

    // Only initialize if spellSlots is empty or undefined
    if (
      selectedCombatant.spellSlots &&
      Object.keys(selectedCombatant.spellSlots).length > 0
    )
      return;

    const spellSlots = {};
    let foundSlots = false;

    selectedCombatant.spellcasting.forEach((spellInfo) => {
      // Check for spellsByLevel format (prepared spellcasters)
      if (spellInfo.spellsByLevel && Array.isArray(spellInfo.spellsByLevel)) {
        spellInfo.spellsByLevel.forEach((levelData) => {
          const level = levelData.level || 0;

          // Skip cantrips (level 0)
          if (level === 0) return;

          // Get slots from data or calculate from caster level
          let slots = levelData.slots;
          if (!slots && level > 0 && spellInfo.notes) {
            // Try to extract caster level from notes like "18th-level spellcaster"
            const levelMatch = spellInfo.notes.match(
              /(\d+)(?:st|nd|rd|th)-level spellcaster/i
            );
            if (levelMatch) {
              const casterLevel = parseInt(levelMatch[1]);
              slots = getSpellSlotsForLevel(casterLevel, level);
            }
          }

          if (slots && slots > 0) {
            spellSlots[level] = { max: slots, current: slots };
            foundSlots = true;
          }
        });
      }
    });

    // Update combatant with initialized spell slots
    if (foundSlots) {
      updateCombatant(selectedCombatant.id, { spellSlots });
    }
  }, [selectedCombatant]);

  useEffect(() => {    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");    } else {
      document.documentElement.classList.remove("dark");    }  }, [darkMode]);

  // Save roll history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("rollHistory", JSON.stringify(rollHistory));
    } catch (error) {
      console.error("Failed to save roll history to localStorage:", error);
    }
  }, [rollHistory]);

  useEffect(() => {
    // Wait for auth to finish loading before making API calls
    if (loading || !user) return;
    setEncountersLoading(true);
    apiGet("/api/encounters")
      .then((r) => r.json())
      .then((data) => {
        setEncounters(data);
        setEncountersLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load encounters:', err);
        setEncountersLoading(false);
      });
  }, [user, loading]);

  // Close menus/modals when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close profile menu
      if (showProfileMenu && !event.target.closest(".profile-menu-container")) {
        setShowProfileMenu(false);
      }

      // Close dice roller
      if (
        showDiceRoller &&
        !event.target.closest(".dice-roller-container") &&
        !event.target.closest(".dice-roller-button")
      ) {
        setShowDiceRoller(false);
      }

      // Close roll history
      if (
        showRollHistory &&
        !event.target.closest(".roll-history-container") &&
        !event.target.closest(".roll-history-button")
      ) {
        setShowRollHistory(false);
      }

      // Close creature manager
      if (
        showCreatureManager &&
        !event.target.closest(".creature-manager-container") &&
        !event.target.closest(".creature-manager-button")
      ) {
        setShowCreatureManager(false);
        setEditingCreature(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu, showDiceRoller, showRollHistory, showCreatureManager]);

  // Handle Delete key to remove selected combatant
  useEffect(() => {
    const handleKeyDown = async (event) => {
      // Check if combat is completed
      const isCompleted = enc?.combatStatus === 'completed';

      // Check if Delete or Backspace key is pressed
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedCombatantId &&
        enc &&
        !isCompleted  // Don't allow deletion if combat is completed
      ) {
        // Don't trigger if user is typing in an input/textarea
        if (
          event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA"
        ) {
          return;
        }

        event.preventDefault();

        const combatant = enc.combatants[selectedCombatantId];
        const confirmed = await confirm(
          `${
            combatant?.name || "Diesen Combatant"
          } wirklich aus der Liste entfernen?`
        );

        if (confirmed) {
          deleteCombatant(selectedCombatantId);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedCombatantId, enc, confirm]);

  // Load campaigns
  useEffect(() => {
    // Wait for auth to finish loading before making API calls
    if (loading || !user) return;
    async function loadCampaigns() {
      try {
        const data = await apiGet('/api/campaigns');
        setCampaigns(await data.json());
      } catch (err) {
        console.error('Failed to load campaigns:', err);
      }
    }
    loadCampaigns();
  }, [user, loading]);

  // Show login screen if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Lade...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  async function createEncounter() {
    // Optimistic update: Create encounter immediately with temporary ID
    const tempId = `temp_${Date.now()}`;
    const optimisticEncounter = {
      id: tempId,
      name: "Encounter",
      updatedAt: new Date().toISOString()
    };

    setEncounters((prev) => [...prev, optimisticEncounter]);
    setCurrentId(tempId);

    // Background API call
    try {
      const r = await apiPost("/api/encounters", { name: "Encounter" });
      const created = await r.json();

      // Replace temporary encounter with real one
      setEncounters((prev) =>
        prev.map((e) => (e.id === tempId ? { id: created.id, name: created.name, updatedAt: created.updatedAt } : e))
      );
      setCurrentId(created.id);
    } catch (err) {
      console.error('Failed to create encounter:', err);
      // Rollback: Remove optimistic encounter
      setEncounters((prev) => prev.filter((e) => e.id !== tempId));
      setCurrentId(null);
    }
  }

  // Add all campaign players to encounter
  async function addCampaignPlayersToEncounter(campaignId) {
    if (!enc) {
      await alert('Bitte wähle erst ein Encounter aus');
      return;
    }

    setIsAddingCampaignPlayers(true);
    try {
      const response = await apiGet(`/api/campaigns/${campaignId}/characters`);
      const characters = await response.json();

      if (characters.length === 0) {
        await alert('Diese Kampagne hat keine Spielercharaktere');
        setIsAddingCampaignPlayers(false);
        return;
      }

      const combatants = { ...enc.combatants };
      let addedCount = 0;
      let skippedCount = 0;

      characters.forEach((pc) => {
        // Check if character already exists (by name)
        const exists = Object.values(combatants).some(c => c.name === pc.name);

        if (!exists || allowDuplicates) {
          const id = crypto.randomUUID();
          combatants[id] = {
            id,
            name: pc.name,
            ac: pc.ac || 10,
            baseHP: pc.hp || 10,
            hp: pc.hp || 10,
            tempHP: 0,
            initiativeMod: pc.initiativeMod || 0,
            initiative: 0,
            initiativeTieBreaker: 0,
            player: true,
            notes: '',
            concentration: false,
            concentrationMod: 0,
            spellSlots: {},
            dailySpellUses: {},
            deathSaves: { successes: 0, failures: 0 },
            reactionUsed: false,
            sidekickOf: null,
          };
          addedCount++;
        } else {
          skippedCount++;
        }
      });

      // Save the updated encounter
      const updateResponse = await apiPut(`/api/encounters/${enc.id}`, {
        ...enc,
        combatants,
      });

      if (updateResponse.ok) {
        const updatedEnc = await updateResponse.json();
        setEnc(updatedEnc);

        let message = `${addedCount} Spieler hinzugefügt`;
        if (skippedCount > 0) {
          message += `, ${skippedCount} bereits vorhanden (übersprungen)`;
        }
        await alert(message);
      }
    } catch (err) {
      console.error('Failed to add campaign players:', err);
      await alert('Fehler beim Hinzufügen der Spieler');
    } finally {
      setIsAddingCampaignPlayers(false);
    }
  }

  async function importEncounter(file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    const r = await apiPost("/api/import/encounter", payload);
    const created = await r.json();
    setEncounters((prev) => [
      ...prev,
      { id: created.id, name: created.name, updatedAt: created.updatedAt },
    ]);
    setCurrentId(created.id);
  }

  function updateCombatant(id, patch) {
    const combatant = enc.combatants[id];
    const oldHP = combatant.hp;
    const oldTempHP = combatant.tempHP || 0;
    const newHP = patch.hp !== undefined ? patch.hp : oldHP;
    const newTempHP = patch.tempHP !== undefined ? patch.tempHP : oldTempHP;

    // If baseHP is changing, adjust current HP proportionally (keep damage constant)
    if (patch.baseHP !== undefined && patch.baseHP !== combatant.baseHP) {
      const oldBaseHP = combatant.baseHP;
      const newBaseHP = patch.baseHP;
      const damage = oldBaseHP - oldHP; // How much damage has been taken
      const newCurrentHP = Math.max(0, newBaseHP - damage); // Apply same damage to new max
      patch = { ...patch, hp: newCurrentHP };
    }

    // Check for concentration break on damage (when HP or tempHP decreases)
    if (combatant.concentration && (newHP < oldHP || newTempHP < oldTempHP)) {
      // Calculate total damage taken (from both HP and tempHP)
      const hpDamage = oldHP - newHP;
      const tempHPDamage = oldTempHP - newTempHP;
      const damage = Math.max(hpDamage, tempHPDamage, hpDamage + tempHPDamage);

      const dc = Math.max(10, Math.floor(damage / 2));
      const conMod = combatant.concentrationMod || 0;

      // Check if this is a player character or sidekick
      const isPC = combatant.player || combatant.isPC || combatant.source === "ddb-import" || combatant.source === "player-character";
      const isSidekick = combatant.sidekickOf;

      if (isPC || isSidekick) {
        // For PCs and sidekicks, show notification if enabled
        if (settings.concentrationCheckReminder) {
          setDiceRollResult({
            type: "concentration",
            name: combatant.name,
            combatantId: id, // Store ID to update concentration later
            roll: null, // No auto-roll for PCs
            modifier: conMod,
            total: null,
            dc,
            passed: null, // DM will decide
            isPlayerCharacter: true, // Flag to show different UI
          });
        }
      } else {
        // For NPCs/monsters, auto-roll if enabled
        if (settings.autoRollConcentrationNPCs) {
          const roll = rollD20();
          const total = roll + conMod;
          const passed = total >= dc;

          setDiceRollResult({
            type: "concentration",
            name: combatant.name,
            roll,
            modifier: conMod,
            total,
            dc,
            passed,
          });

          if (!passed) {
            patch = { ...patch, concentration: false };
          }
        }
      }
    }

    const next = {
      ...enc,
      combatants: {
        ...enc.combatants,
        [id]: { ...enc.combatants[id], ...patch },
      },
    };

    // Check if creature became bloodied (HP < 50%)
    const updatedCombatant = next.combatants[id];
    const effectiveMaxHP = (updatedCombatant.baseHP || 0) + (updatedCombatant.maxHPModifier || 0);
    const oldHPPercent = effectiveMaxHP > 0 ? (oldHP / effectiveMaxHP) * 100 : 100;
    const newHPPercent = effectiveMaxHP > 0 ? (newHP / effectiveMaxHP) * 100 : 100;
    const wasNotBloodied = oldHPPercent >= 50;
    const isNowBloodied = newHPPercent < 50 && newHPPercent > 0;

    if (wasNotBloodied && isNowBloodied) {
      // Show bloodied toast
      const toastId = `${id}-${Date.now()}`;
      setBloodiedToasts(prev => [...prev, { id: toastId, name: combatant.name }]);
      // Auto-remove toast after 4 seconds
      setTimeout(() => {
        setBloodiedToasts(prev => prev.filter(t => t.id !== toastId));
      }, 4000);
    }

    // If initiative was changed and this combatant has sidekicks, sync them
    if (patch.initiative !== undefined) {
      Object.values(next.combatants).forEach(c => {
        if (c.sidekickOf === id) {
          next.combatants[c.id] = {
            ...c,
            initiative: patch.initiative,
            initiativeTieBreaker: (patch.initiativeTieBreaker || 0) - 0.5
          };
        }
      });
    }

    // If this is a sidekick and its assignment changed, sync initiative
    if (patch.sidekickOf !== undefined && patch.sidekickOf) {
      const assignedPlayer = next.combatants[patch.sidekickOf];
      if (assignedPlayer && assignedPlayer.initiative !== undefined) {
        next.combatants[id] = {
          ...next.combatants[id],
          initiative: assignedPlayer.initiative,
          initiativeTieBreaker: (assignedPlayer.initiativeTieBreaker || 0) - 0.5
        };
      }
    }

    next.initiativeOrder = Object.values(next.combatants)
      .sort((a, b) => {
        const initDiff = (b.initiative ?? 0) - (a.initiative ?? 0);
        if (initDiff !== 0) return initDiff;
        return (b.initiativeTieBreaker ?? 0) - (a.initiativeTieBreaker ?? 0);
      })
      .map((c) => c.id);
    save(next);
  }

  function applyDamage(id, damage) {
    const c = enc.combatants[id];
    const tempHP = c.tempHP || 0;

    if (tempHP > 0) {
      const remainingDamage = damage - tempHP;
      if (remainingDamage <= 0) {
        updateCombatant(id, { tempHP: tempHP - damage });
      } else {
        updateCombatant(id, {
          tempHP: 0,
          hp: Math.max(0, c.hp - remainingDamage),
        });
      }
    } else {
      updateCombatant(id, { hp: Math.max(0, c.hp - damage) });
    }
  }

  async function deleteCombatant(id) {
    if (!enc) return;

    // Remove the combatant from the combatants object
    const { [id]: removed, ...remainingCombatants } = enc.combatants;

    // Check if the removed combatant had lair actions
    const removedHadLairActions = removed?.legendaryGroup;

    // If removed combatant had lair actions, check if any remaining combatants have the same legendary group
    let shouldRemoveLairMarkers = false;
    if (removedHadLairActions) {
      const removedGroupName = removed.legendaryGroup.name || removed.legendaryGroup;
      const otherWithSameLair = Object.values(remainingCombatants).some(c => {
        const groupName = c.legendaryGroup?.name || c.legendaryGroup;
        return groupName === removedGroupName;
      });
      shouldRemoveLairMarkers = !otherWithSameLair;
    }

    // Remove from initiative order (and lair action markers if needed)
    const newInitiativeOrder = enc.initiativeOrder.filter((cid) => {
      // Always remove the deleted combatant
      if (cid === id) return false;

      // Remove lair action markers if no more creatures have lair actions
      if (shouldRemoveLairMarkers && typeof cid === 'object' && cid.type === 'lair') {
        return false;
      }

      return true;
    });

    // Adjust turnIndex if necessary
    let newTurnIndex = enc.turnIndex;
    if (
      newTurnIndex >= newInitiativeOrder.length &&
      newInitiativeOrder.length > 0
    ) {
      newTurnIndex = newInitiativeOrder.length - 1;
    }

    // Clear selection if the deleted combatant was selected
    if (selectedCombatantId === id) {
      setSelectedCombatantId(null);
    }

    save({
      ...enc,
      combatants: remainingCombatants,
      initiativeOrder: newInitiativeOrder,
      turnIndex: newTurnIndex,
    });
  }

  async function rollInitiativeForAll() {
    const updated = { ...enc };
    const combatants = Object.values(updated.combatants);

    // Separate PCs from monsters
    const playerCharacters = combatants.filter(
      (c) => (c.player || c.isPC || c.source === "ddb-import" || c.source === "player-character") && !c.sidekickOf
    );
    const monsters = combatants.filter(
      (c) => !c.player && !c.isPC && c.source !== "ddb-import" && c.source !== "player-character" && !c.sidekickOf
    );

    // Auto-roll initiative for monsters (excluding sidekicks - they'll be handled later)
    monsters.forEach((c) => {
      const roll = rollD20();
      const init = roll + (c.initiativeMod || 0);
      updated.combatants[c.id] = { ...c, initiative: init, initiativeRoll: roll };
    });

    // Show modal for player characters if there are any (sidekicks excluded)
    if (playerCharacters.length > 0) {      const initiatives = await initiativePrompt(playerCharacters);
      // If user cancelled, don't update anything
      if (!initiatives) return;

      // Apply the initiative values from the modal
      Object.entries(initiatives).forEach(([id, initiative]) => {
        updated.combatants[id] = { ...updated.combatants[id], initiative };
      });
    }

    // Sync sidekick initiatives with their assigned players
    combatants.filter(c => c.sidekickOf).forEach((sidekick) => {
      const assignedPlayer = updated.combatants[sidekick.sidekickOf];
      if (assignedPlayer && assignedPlayer.initiative !== undefined) {
        updated.combatants[sidekick.id] = {
          ...sidekick,
          initiative: assignedPlayer.initiative,
          initiativeTieBreaker: (assignedPlayer.initiativeTieBreaker || 0) - 0.5 // Sidekick goes slightly after player
        };
      }
    });

    // Sort initiative order (by initiative, then by tie-breaker descending)
    const sortedCombatants = Object.values(updated.combatants)
      .sort((a, b) => {
        const initDiff = (b.initiative ?? 0) - (a.initiative ?? 0);
        if (initDiff !== 0) return initDiff;
        // If initiative is the same, sort by tie-breaker (higher goes first)
        return (b.initiativeTieBreaker ?? 0) - (a.initiativeTieBreaker ?? 0);
      });

    // Load lair actions for any combatants that have legendary groups
    const loadedLairActions = { ...lairActionsCache };
    const lairActionsToLoad = [];
    for (const combatant of sortedCombatants) {
      if (combatant.legendaryGroup) {
        const groupName = combatant.legendaryGroup.name || combatant.legendaryGroup;
        if (!loadedLairActions[groupName]) {
          lairActionsToLoad.push(groupName);
        }
      }
    }

    // Load all missing lair actions before proceeding
    if (lairActionsToLoad.length > 0) {
      for (const groupName of lairActionsToLoad) {
        try {
          const response = await apiGet(`/api/legendary-groups/${encodeURIComponent(groupName)}`);
          const groupData = await response.json();
          loadedLairActions[groupName] = groupData;
        } catch (error) {
          console.error(`Error loading lair actions for ${groupName}:`, error);
        }
      }
      // Update the cache state
      setLairActionsCache(loadedLairActions);
    }

    // Check if any combatants have lair actions
    const lairActionInitiatives = new Set();
    for (const combatant of sortedCombatants) {
      if (combatant.legendaryGroup) {
        const groupName = combatant.legendaryGroup.name || combatant.legendaryGroup;
        const groupData = loadedLairActions[groupName];
        if (groupData?.lairActions && groupData.lairActions.length > 0) {
          // Parse initiative count from lair actions
          const firstAction = typeof groupData.lairActions[0] === 'string' ? groupData.lairActions[0] : '';
          const initiativeMatch = firstAction.match(/initiative count (\d+)/i);
          const initiativeCount = initiativeMatch ? parseInt(initiativeMatch[1]) : 20;
          lairActionInitiatives.add(initiativeCount);
        }
      }
    }

    // Build initiative order with lair action markers
    // Lair actions lose initiative ties (come after creatures with the same initiative)
    const initiativeOrder = [];
    for (const combatant of sortedCombatants) {
      // Check if we need to insert a lair action marker before this combatant
      for (const lairInit of lairActionInitiatives) {
        // Lair actions are inserted AFTER creatures with the SAME initiative (lose ties)
        if (combatant.initiative <= lairInit &&
            !initiativeOrder.some(id => typeof id === 'object' && id.type === 'lair' && id.initiative === lairInit)) {
          // Check if this is the last combatant with this initiative or higher
          const nextCombatantIndex = sortedCombatants.indexOf(combatant) + 1;
          const nextCombatant = sortedCombatants[nextCombatantIndex];

          // Insert lair action if:
          // - there's no next combatant, OR
          // - next combatant has lower initiative than lair action
          if (!nextCombatant || nextCombatant.initiative < lairInit) {
            initiativeOrder.push({ type: 'lair', initiative: lairInit, id: `lair_${lairInit}` });
          }
        }
      }
      initiativeOrder.push(combatant.id);
    }

    // Add any remaining lair actions at the end (if initiative is lower than all combatants)
    for (const lairInit of lairActionInitiatives) {
      if (!initiativeOrder.some(id => typeof id === 'object' && id.type === 'lair' && id.initiative === lairInit)) {
        initiativeOrder.push({ type: 'lair', initiative: lairInit, id: `lair_${lairInit}` });
      }
    }

    updated.initiativeOrder = initiativeOrder;

    save(updated);
  }

  async function resetCombat() {
    if (
      !(await confirm(
        "Möchtest du den Combat zurücksetzen? Alle Initiative-Werte, HP-Änderungen und Conditions werden zurückgesetzt."
      ))
    )
      return;

    const updated = { ...enc };

    // Reset all combatants
    Object.values(updated.combatants).forEach((c) => {
      updated.combatants[c.id] = {
        ...c,
        initiative: undefined,
        currentHp: c.hp || c.maxHp,
        tempHp: 0,
        conditions: [],
      };
    });

    // Reset combat state
    updated.round = 1;
    updated.turnIndex = 0;
    updated.initiativeOrder = [];

    // Remove completed status
    delete updated.combatStatus;
    delete updated.completedAt;

    save(updated);
  }

  async function deleteEncounter(id) {
    if (!(await confirm("Möchtest du dieses Encounter wirklich löschen?")))
      return;

    // Save for rollback
    const deletedEncounter = encounters.find(e => e.id === id);
    const wasCurrentId = currentId === id;

    // Optimistic update: Remove from list immediately
    setEncounters((prev) => prev.filter((e) => e.id !== id));
    if (wasCurrentId) setCurrentId(null);

    // Background API call
    try {
      await apiDelete(`/api/encounters/${id}`);
    } catch (err) {
      console.error('Failed to delete encounter:', err);
      // Rollback: Restore encounter
      if (deletedEncounter) {
        setEncounters((prev) => [...prev, deletedEncounter]);
        if (wasCurrentId) setCurrentId(id);
      }
    }
  }

  // Duplicate an encounter
  async function duplicateEncounter(id) {
    try {
      // Load full encounter data
      const response = await apiGet(`/api/encounters/${id}`);
      const encounter = await response.json();

      // Create duplicate with modified name
      const tempId = `temp_${Date.now()}`;
      const duplicateName = `${encounter.name} (Kopie)`;
      const optimisticEncounter = {
        id: tempId,
        name: duplicateName,
        updatedAt: new Date().toISOString(),
        folder: encounter.folder,
        campaignId: encounter.campaignId
      };

      // Optimistic update: Add to list immediately
      setEncounters((prev) => [...prev, optimisticEncounter]);
      setCurrentId(tempId);

      // Background API call
      const duplicateData = {
        ...encounter,
        name: duplicateName,
        // Reset combat status for duplicate
        combatStatus: 'prep',
        turnIndex: 0,
        roundNumber: 1
      };
      delete duplicateData.id; // Let server generate new ID
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;

      const createResponse = await apiPost('/api/encounters', duplicateData);
      const created = await createResponse.json();

      // Replace temporary encounter with real one
      setEncounters((prev) =>
        prev.map((e) => (e.id === tempId ? { id: created.id, name: created.name, updatedAt: created.updatedAt, folder: created.folder, campaignId: created.campaignId } : e))
      );
      setCurrentId(created.id);
    } catch (err) {
      console.error('Failed to duplicate encounter:', err);
      await alert('Fehler beim Duplizieren des Encounters');
      // Rollback: Remove optimistic encounter and refresh
      setEncounters((prev) => prev.filter((e) => !e.id.startsWith('temp_')));
    }
  }

  // Helper function to convert 5e.tools entries array to desc string
  function convertEntriesToDesc(feature) {
    if (!feature) return feature;

    // If it already has a desc, use it
    if (feature.desc) return feature;

    // If it has entries, convert them to desc
    if (feature.entries) {
      const desc = Array.isArray(feature.entries)
        ? feature.entries.map(entry => {
            if (typeof entry === 'string') return entry;
            if (typeof entry === 'object' && entry.entries) {
              // Nested entries
              return convertEntriesToDesc(entry).desc || '';
            }
            return JSON.stringify(entry);
          }).join(' ')
        : String(feature.entries);

      return { ...feature, desc };
    }

    return feature;
  }

  // Helper function to convert an array of features (traits, actions, etc.)
  function convertFeaturesArray(features) {
    if (!features || !Array.isArray(features)) return features;
    return features.map(convertEntriesToDesc);
  }

  function formatCR(cr) {
    if (cr === null || cr === undefined) return '—';
    const crStr = String(cr);

    // Check if it's already a fraction
    if (crStr.includes('/')) return crStr;

    // Convert decimals to fractions
    const crNum = parseFloat(cr);
    if (crNum === 0.125) return '1/8';
    if (crNum === 0.25) return '1/4';
    if (crNum === 0.5) return '1/2';

    // Return as integer or original string
    return Number.isInteger(crNum) ? String(Math.round(crNum)) : crStr;
  }

  async function fetchECRForMonster(monster) {
    if (!monster) return null;

    try {
      const response = await apiPost('/api/ecr/calculate', { monster });
      if (!response.ok) throw new Error('Failed to calculate eCR');
      return await response.json();
    } catch (err) {
      console.error('eCR calculation error:', err);
      return null;
    }
  }

  async function addMonster(mon) {
    console.log('Adding monster:', mon.name, 'bonus:', mon.bonus);

    // HOTFIX: Fix Chasme's Drone ability (should be bonus action, not trait)
    // This is a temporary fix until compact data is regenerated with correct structure
    if (mon.name === 'Chasme' && (!mon.bonus || mon.bonus.length === 0)) {
      const droneIndex = (mon.traits || []).findIndex(t => t.name === 'Drone' || t.n === 'Drone');
      if (droneIndex >= 0) {
        const droneTrait = mon.traits[droneIndex];
        mon.bonus = [droneTrait];
        mon.traits = mon.traits.filter((_, i) => i !== droneIndex);
        console.log('Fixed Chasme: Moved Drone from traits to bonus');
      }
    }

    // Check if an encounter is loaded
    if (!enc) {
      await alert("Bitte erstelle oder wähle zuerst ein Encounter aus.");
      return;
    }

    const id = crypto.randomUUID();
    // Handle HP - could be a number or an object with {formula, average}
    const hpValue =
      typeof mon.hp === "object" && mon.hp !== null
        ? mon.hp.average || mon.hpAvg || 0
        : mon.hp || mon.hpAvg || 0;
    const hpFormula =
      typeof mon.hp === "object" && mon.hp !== null
        ? mon.hp.formula || null
        : null;
    // Handle AC - could be a number, an object with {value, notes}, or an array of AC objects
    let acValue = 10; // Default AC
    let acFrom = null; // AC source (armor type, natural armor, etc.)
    if (Array.isArray(mon.ac) && mon.ac.length > 0) {
      // AC is an array - take the first entry's value and notes
      acValue = mon.ac[0].value || mon.ac[0].ac || 10;
      // Extract notes and parse {@item ...} tags
      if (mon.ac[0].notes) {
        let notes = mon.ac[0].notes;
        // Remove {@item ...} tags and extract item names
        notes = notes.replace(/\{@item ([^|]+)(?:\|[^}]+)?\}/g, '$1');
        acFrom = [notes.trim()];
      } else if (mon.ac[0].from) {
        acFrom = Array.isArray(mon.ac[0].from) ? mon.ac[0].from : [mon.ac[0].from];
      }
    } else if (typeof mon.ac === "object" && mon.ac !== null) {
      // AC is an object
      acValue = mon.ac.value || mon.ac.ac || 10;
      if (mon.ac.notes) {
        let notes = mon.ac.notes;
        notes = notes.replace(/\{@item ([^|]+)(?:\|[^}]+)?\}/g, '$1');
        acFrom = [notes.trim()];
      } else if (mon.ac.from) {
        acFrom = Array.isArray(mon.ac.from) ? mon.ac.from : [mon.ac.from];
      }
    } else if (typeof mon.ac === "number") {
      // AC is a plain number
      acValue = mon.ac;
    }

    // Calculate initiative modifier from DEX
    const dexValue = mon.abilities?.dex || mon.dex || 10;
    const initiativeModValue = mon.initiativeMod ?? Math.floor((dexValue - 10) / 2);

    // Handle speed - could be a string or an object
    let speedValue = "";
    let flySpeed = null;
    let swimSpeed = null;
    let climbSpeed = null;
    let burrowSpeed = null;

    if (typeof mon.speed === "object" && mon.speed !== null) {
      // Extract all speed types from object
      speedValue = mon.speed.walk || "";
      flySpeed = mon.speed.fly || null;
      swimSpeed = mon.speed.swim || null;
      climbSpeed = mon.speed.climb || null;
      burrowSpeed = mon.speed.burrow || null;
    } else {
      // Plain string or number
      speedValue = mon.speed || mon.spd || "";
    }
    // Handle senses - could be a string or an object with {darkvision, passivePerception}
    const sensesValue =
      typeof mon.senses === "object" && mon.senses !== null
        ? Object.entries(mon.senses)
            .map(([key, val]) => `${key}: ${val}`)
            .join(", ")
        : mon.senses ||
          (mon.darkvision ? `Darkvision ${mon.darkvision} ft.` : "");

    // Auto-generate unique name based on settings if duplicate exists
    const baseName = mon.name || mon.n;
    const existingNames = Object.values(enc.combatants).map(c => c.name);
    const nameCount = existingNames.filter(name =>
      name === baseName || name.endsWith(baseName)
    ).length;

    let finalName = baseName;
    const namingMode = settings.creatureNamingMode || 'adjective';

    // Only rename if mode is not 'none' and there are duplicates
    if (nameCount > 0 && namingMode !== 'none') {
      // Duplicate detected - add identifier to new creature
      const identifier = getUniqueIdentifier(baseName, existingNames, namingMode);
      finalName = formatCreatureName(identifier, baseName, namingMode);

      // Also add identifier to the first creature if it doesn't have one yet
      const firstCreature = Object.values(enc.combatants).find(c => c.name === baseName);
      if (firstCreature) {
        const firstIdentifier = getUniqueIdentifier(baseName, [...existingNames, finalName], namingMode);
        firstCreature.name = formatCreatureName(firstIdentifier, baseName, namingMode);
      }
    }

    // Create combatant with selective monster data (avoid copying object fields that break React rendering)
    const c = {
      // Combat-specific fields
      id,
      initiative: 0,
      initiativeTieBreaker: 0,
      hp: hpValue,
      baseHP: hpValue,
      hpFormula: hpFormula,
      tempHP: 0,
      player: false,
      notes: "",
      concentration: false,
      concentrationMod: 0,
      spellSlots: {},
      dailySpellUses: {},
      rechargeAbilities: {},
      deathSaves: { successes: 0, failures: 0 },
      sidekickOf: null, // ID of player this is a sidekick for
      // Legendary action points tracking
      legendaryPoints: mon.legendary?.pts || mon.legendary?.points || 0,
      legendaryPointsMax: mon.legendary?.pts || mon.legendary?.points || 0,
      legendaryActionsRemaining: mon.legendary?.actions?.length > 0 ? 3 : undefined,
      // Legendary Resistance tracking
      ...(() => {
        // Parse "Legendary Resistance (X/Day)" from traits
        const legendaryResistanceTrait = (mon.traits || mon.trait || []).find(t =>
          t.name && t.name.match(/Legendary Resistance\s*\((\d+)\/Day\)/i)
        );
        if (legendaryResistanceTrait) {
          const match = legendaryResistanceTrait.name.match(/Legendary Resistance\s*\((\d+)\/Day\)/i);
          const uses = match ? parseInt(match[1]) : 0;
          return {
            legendaryResistanceRemaining: uses,
            legendaryResistanceMax: uses
          };
        }
        return {};
      })(),
      // Reaction tracking (boolean: has reaction been used this round?)
      reactionUsed: false,
      // Basic info
      name: finalName,
      ac: acValue,
      acFrom: acFrom,
      initiativeMod: initiativeModValue,
      // Map 5e.tools compact format to full format
      size: mon.size || mon.sz,
      type: mon.type || mon.t,
      alignment: mon.alignment || mon.al,
      cr: mon.cr,
      source: mon.source || mon.src || mon.meta?.source,
      meta: mon.meta,
      // Ability scores - check both abilities.str and direct str fields
      str: mon.abilities?.str || mon.str,
      dex: mon.abilities?.dex || mon.dex,
      con: mon.abilities?.con || mon.con,
      int: mon.abilities?.int || mon.int,
      wis: mon.abilities?.wis || mon.wis,
      cha: mon.abilities?.cha || mon.cha,
      // Skills and saves (already correct format)
      skill: mon.skill || mon.skills,
      save: mon.save || mon.saves || mon.savingThrows,
      // Senses
      passive: mon.passive || mon.pp,
      senses: sensesValue,
      languages:
        mon.languages ||
        (mon.lang
          ? Array.isArray(mon.lang)
            ? mon.lang.join(", ")
            : mon.lang
          : ""),
      // Speed (make sure it's a string or number, not an object)
      speed: speedValue || (mon.spd ? `${mon.spd} ft.` : "30 ft."),
      fly: flySpeed,
      swim: swimSpeed,
      climb: climbSpeed,
      burrow: burrowSpeed,
      // Defenses - convert arrays to strings with special formatting
      // Support both expanded format (damageImmunities) and compact format (immune)
      vulnerabilities: parseDefenseArray(mon.damageVulnerabilities || mon.vulnerable),
      resistances: parseDefenseArray(mon.damageResistances || mon.resist || mon.res),
      immunities: parseDefenseArray(mon.damageImmunities || mon.immune),
      conditionImmunities: parseDefenseArray(mon.conditionImmunities || mon.conditionImmune || mon.condImm),
      // Keep original fields for runtime parsing in UI
      damageVulnerabilities: mon.damageVulnerabilities,
      vulnerable: mon.vulnerable,
      damageResistances: mon.damageResistances,
      resist: mon.resist,
      res: mon.res,
      damageImmunities: mon.damageImmunities,
      immune: mon.immune,
      conditionImmune: mon.conditionImmune,
      condImm: mon.condImm,
      // Traits, Actions, etc. (keep as arrays for proper rendering)
      // Convert 5e.tools entries arrays to desc strings
      traits: convertFeaturesArray(mon.traits || mon.trait),
      actions: convertFeaturesArray(mon.actions || mon.action),
      bonusActions: (() => {
        // Support both compact format (bonus) and expanded format (bonusActions)
        const converted = convertFeaturesArray(mon.bonusActions || mon.bonus);
        if (converted && converted.length > 0) {
          console.log('Bonus Actions converted:', mon.name, converted);
        }
        return converted;
      })(),
      reactions: convertFeaturesArray(mon.reaction),
      legendary: mon.legendary,
      legendaryActions: mon.legendaryActions,
      legendaryGroup: mon.legendaryGroup,
      // Spellcasting
      spellcasting: mon.spellcasting,
      // Token and image URLs - always use proxy to bypass CORS
      // Extract source from either mon.source or mon.meta.source
      tokenUrl: (() => {
        const source = mon.source || mon.meta?.source;
        const name = mon.name;
        // If custom URL provided that's not 5e.tools, use it directly
        if (mon.meta?.tokenUrl && !mon.meta.tokenUrl.includes('5e.tools')) {
          return mon.meta.tokenUrl;
        }
        // Otherwise use proxy
        if (name && source) {
          return `${API('')}/api/token/${encodeURIComponent(source)}/${encodeURIComponent(name)}`;
        }
        return null;
      })(),
      imageUrl: (() => {
        const source = mon.source || mon.meta?.source;
        const name = mon.name;
        // If custom URL provided that's not 5e.tools, use it directly
        if (mon.meta?.imageUrl && !mon.meta.imageUrl.includes('5e.tools')) {
          return mon.meta.imageUrl;
        }
        // Otherwise use proxy
        if (name && source) {
          return `${API('')}/api/token/${encodeURIComponent(source)}/${encodeURIComponent(name)}`;
        }
        return null;
      })(),
    };

    const next = { ...enc, combatants: { ...enc.combatants, [id]: c } };

    // If initiative has already been rolled, add the new combatant to the initiative order
    if (next.initiativeOrder && next.initiativeOrder.length > 0) {
      // Insert the new combatant into the initiative order at the correct position
      // based on its initiative (which is 0 initially, so it goes at the end)
      const newInitiativeOrder = [...next.initiativeOrder];

      // Find the correct position based on initiative and tie-breaker
      let insertIndex = newInitiativeOrder.length;
      for (let i = 0; i < newInitiativeOrder.length; i++) {
        const orderId = newInitiativeOrder[i];
        let otherCombatant;

        if (typeof orderId === 'object' && orderId.type === 'lair') {
          // Lair action marker
          otherCombatant = { initiative: orderId.initiative, initiativeTieBreaker: 0 };
        } else {
          // Regular combatant
          otherCombatant = next.combatants[orderId];
        }

        if (otherCombatant) {
          const otherInit = otherCombatant.initiative ?? 0;
          const otherTie = otherCombatant.initiativeTieBreaker ?? 0;
          const newInit = c.initiative ?? 0;
          const newTie = c.initiativeTieBreaker ?? 0;

          // If the new combatant has higher initiative (or same with higher tie-breaker), insert before
          if (newInit > otherInit || (newInit === otherInit && newTie > otherTie)) {
            insertIndex = i;
            break;
          }
        }
      }

      newInitiativeOrder.splice(insertIndex, 0, id);
      next.initiativeOrder = newInitiativeOrder;
    }

    save(next);
  }

  async function addCustom() {
    const name = await prompt("Name des Combatants?", "Neuer Combatant");
    if (!name) return; // User cancelled

    const id = crypto.randomUUID();
    const c = {
      id,
      name,
      ac: 10,
      baseHP: 10,
      hp: 10,
      tempHP: 0,
      initiativeMod: 0,
      initiative: 0,
      initiativeTieBreaker: 0,
      player: true,
      notes: "",
      concentration: false,
      concentrationMod: 0,
      spellSlots: {},
      dailySpellUses: {},
      rechargeAbilities: {},
      deathSaves: { successes: 0, failures: 0 },
      legendaryPoints: 0,
      legendaryPointsMax: 0,
      reactionUsed: false,
    };
    const next = { ...enc, combatants: { ...enc.combatants, [id]: c } };

    // If initiative has already been rolled, add the new combatant to the initiative order
    if (next.initiativeOrder && next.initiativeOrder.length > 0) {
      const newInitiativeOrder = [...next.initiativeOrder];
      let insertIndex = newInitiativeOrder.length;
      for (let i = 0; i < newInitiativeOrder.length; i++) {
        const orderId = newInitiativeOrder[i];
        let otherCombatant;
        if (typeof orderId === 'object' && orderId.type === 'lair') {
          otherCombatant = { initiative: orderId.initiative, initiativeTieBreaker: 0 };
        } else {
          otherCombatant = next.combatants[orderId];
        }
        if (otherCombatant) {
          const otherInit = otherCombatant.initiative ?? 0;
          const otherTie = otherCombatant.initiativeTieBreaker ?? 0;
          const newInit = c.initiative ?? 0;
          const newTie = c.initiativeTieBreaker ?? 0;
          if (newInit > otherInit || (newInit === otherInit && newTie > otherTie)) {
            insertIndex = i;
            break;
          }
        }
      }
      newInitiativeOrder.splice(insertIndex, 0, id);
      next.initiativeOrder = newInitiativeOrder;
    }

    save(next);
  }

  function rollDeathSave(id) {
    const roll = rollD20();
    const c = enc.combatants[id];
    const deathSaves = { ...c.deathSaves };

    if (roll === 20) {
      // Nat 20: regain 1 HP
      updateCombatant(id, { hp: 1, deathSaves: { successes: 0, failures: 0 } });
      setDiceRollResult({
        type: "deathSave",
        name: c.name,
        roll,
        total: roll,
        passed: true,
        critical: true,
      });
    } else if (roll === 1) {
      // Nat 1: two failures
      deathSaves.failures = Math.min(3, deathSaves.failures + 2);
      updateCombatant(id, { deathSaves });
      setDiceRollResult({
        type: "deathSave",
        name: c.name,
        roll,
        total: roll,
        passed: false,
        critical: true,
      });
    } else if (roll >= 10) {
      // Success
      deathSaves.successes++;
      if (deathSaves.successes >= 3) {
        // Stabilized
        deathSaves.successes = 0;
        deathSaves.failures = 0;
      }
      updateCombatant(id, { deathSaves });
      setDiceRollResult({
        type: "deathSave",
        name: c.name,
        roll,
        total: roll,
        passed: true,
      });
    } else {
      // Failure
      deathSaves.failures++;
      updateCombatant(id, { deathSaves });
      setDiceRollResult({
        type: "deathSave",
        name: c.name,
        roll,
        total: roll,
        passed: false,
      });
    }
  }

  function nextTurn() {
    const count = Object.keys(enc?.combatants || {}).length;
    if (!count || !enc) return;
    let { round, turnIndex } = enc;
    turnIndex = (turnIndex + 1) % count;
    const isNewRound = turnIndex === 0;
    if (isNewRound) round += 1;

    // Reset legendary actions at the top of each round (initiative count 20)
    let updatedCombatants = { ...enc.combatants };
    if (isNewRound) {
      Object.keys(updatedCombatants).forEach(id => {
        const combatant = updatedCombatants[id];
        // Reset legendary actions if the combatant has them
        if (combatant.legendary && combatant.legendary.actions && combatant.legendary.actions.length > 0) {
          updatedCombatants[id] = {
            ...combatant,
            legendaryActionsRemaining: 3,
          };
        }
        // Also reset old legendary points system for backwards compatibility
        if (combatant.legendaryPointsMax > 0) {
          updatedCombatants[id] = {
            ...updatedCombatants[id],
            legendaryPoints: combatant.legendaryPointsMax,
          };
        }
      });
    }

    // Get the combatant who is now active
    const nextCombatantId = enc.initiativeOrder[turnIndex];
    const nextCombatant = updatedCombatants[nextCombatantId];

    // Reset reaction for the creature whose turn it is
    if (nextCombatant && !nextCombatant.isLairAction) {
      updatedCombatants[nextCombatantId] = {
        ...nextCombatant,
        reactionUsed: false
      };
    }

    // Check for recharge abilities that need to be rolled
    if (
      nextCombatant &&
      nextCombatant.actions &&
      Array.isArray(nextCombatant.actions)
    ) {
      const rechargeRolls = [];

      nextCombatant.actions.forEach((action, idx) => {
        const actionName = action.n || action.name || "";

        // Check for recharge using formatActionName
        const formatted = formatActionName(actionName);
        if (formatted.recharge) {
          // Parse the recharge threshold (e.g., "5-6" -> 5, "6" -> 6)
          const rechargeTrigger = parseInt(formatted.recharge.split('-')[0]);
          const rechargeKey = `recharge_action_${idx}`;
          const rechargeAbilities = nextCombatant.rechargeAbilities || {};
          const isAvailable = rechargeAbilities[rechargeKey] ?? true; // Default to available

          // If not available (used), queue for rolling
          if (!isAvailable) {
            rechargeRolls.push({
              actionName: formatted.name,
              rechargeTrigger,
              combatantId: nextCombatantId,
              rechargeKey,
              rechargeAbilities,
            });
          }
        }
      });

      // Roll for all recharge abilities simultaneously
      if (rechargeRolls.length > 0) {
        setTimeout(() => {
          const newRechargeAbilities = { ...nextCombatant.rechargeAbilities };
          const notifications = [];

          rechargeRolls.forEach((rechargeInfo) => {
            // Roll 1d6 for each recharge ability
            const roll = Math.floor(Math.random() * 6) + 1;
            const success = roll >= rechargeInfo.rechargeTrigger;

            // Update the recharge status
            newRechargeAbilities[rechargeInfo.rechargeKey] = success;

            // Create notification
            const message = `${nextCombatant.name}: ${rechargeInfo.actionName} (rolled ${roll}, need ${rechargeInfo.rechargeTrigger}+)`;
            notifications.push({
              id: Date.now() + Math.random(),
              message,
              success,
              timestamp: Date.now()
            });
          });

          // Update combatant with all recharge results
          updateCombatant(nextCombatantId, { rechargeAbilities: newRechargeAbilities });

          // Show all notifications
          setRechargeNotifications(notifications);

          // Auto-dismiss notifications after 5 seconds
          setTimeout(() => {
            setRechargeNotifications([]);
          }, 5000);
        }, 500); // Small delay to let the turn change render first
      }
    }

    save({ ...enc, combatants: updatedCombatants, round, turnIndex });
  }

  function prevTurn() {
    const count = Object.keys(enc?.combatants || {}).length;
    if (!count || !enc) return;
    let { round, turnIndex } = enc;
    turnIndex = (turnIndex - 1 + count) % count;
    if (turnIndex === count - 1) round = Math.max(1, round - 1);
    save({ ...enc, round, turnIndex });
  }

  // Function to load spell details
  async function loadSpellDetails(spellName) {
    try {
      // Clean up spell name from {@spell Name} format
      const cleanName = spellName
        .replace(/\{@spell ([^}|]+)(?:\|[^}]+)?\}/gi, "$1")
        .trim();

      const response = await apiGet(
        `/api/spells/${encodeURIComponent(cleanName)}`
      );
      const spell = await response.json();
      setSelectedSpell(spell);
      setShowSpellModal(true);
    } catch (error) {
      console.error("Error loading spell:", error);
      await alert(`Spell "${spellName}" nicht gefunden`);
    }
  }

  // Component to render text with clickable spell names
  function ClickableSpellText({ text }) {
    if (!text) return null;

    const parts = [];
    let lastIndex = 0;

    // Pattern 1: {@spell Name|Source} or {@spell Name}
    const markupPattern = /\{@spell ([^}|]+)(?:\|([^}]+))?\}/g;

    // Pattern 2: "Spell Name|SOURCE" (capitalized spell followed by |UPPERCASE)
    // This catches things like "Misty Step|XPHB" or "Counterspell|XPHB or Shield|XPHB"
    const plainPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\|([A-Z]+)\b/g;

    // Combine both patterns
    const combinedPattern = new RegExp(
      `(${markupPattern.source})|(${plainPattern.source})`,
      "g"
    );

    // Simpler approach: find both patterns separately
    const matches = [];

    // Find markup patterns
    let match;
    while ((match = markupPattern.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        spellName: match[1],
      });
    }

    // Reset and find plain patterns
    while ((match = plainPattern.exec(text)) !== null) {
      // Check if this isn't already captured by markup pattern
      const overlaps = matches.some(
        (m) => match.index >= m.index && match.index < m.index + m.length
      );
      if (!overlaps) {
        matches.push({
          index: match.index,
          length: match[0].length,
          spellName: match[1], // First capture group is the spell name without |SOURCE
        });
      }
    }

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);

    // Build parts array
    matches.forEach((match) => {
      // Add text before this match
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.slice(lastIndex, match.index),
        });
      }

      // Add the spell
      parts.push({ type: "spell", content: match.spellName });

      lastIndex = match.index + match.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.slice(lastIndex) });
    }

    // If no spells found, just return text
    if (parts.length === 0) {
      return <span>{text}</span>;
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (part.type === "spell") {
            return (
              <span
                key={idx}
                className="underline decoration-purple-500 dark:decoration-purple-400 decoration-2 underline-offset-2 text-purple-700 dark:text-purple-300 cursor-pointer hover:text-purple-900 dark:hover:text-purple-100 font-medium"
                onMouseEnter={async (e) => {
                  try {
                    const response = await apiGet(
                      `/api/spells/${encodeURIComponent(part.content)}`
                    );
                    const spell = await response.json();

                    // Position tooltip to the left of cursor
                    // If mouse is in lower half of screen, position above cursor, otherwise below
                    const tooltipWidth = 634; // 384px + 50px = 434px
                    const x = e.clientX - tooltipWidth - 15;
                    const y =
                      e.clientY > window.innerHeight / 2
                        ? e.clientY - 200 // Upper position if in lower half
                        : e.clientY + 15; // Lower position if in upper half

                    setSpellTooltip({ spell, x, y });
                  } catch (error) {
                    console.error("Error loading spell:", error);
                  }
                }}
                onMouseMove={(e) => {
                  if (spellTooltip.spell) {
                    const tooltipWidth = 634;
                    const x = e.clientX - tooltipWidth - 15;
                    const y =
                      e.clientY > window.innerHeight / 2
                        ? e.clientY - 200
                        : e.clientY + 15;
                    setSpellTooltip((prev) => ({ ...prev, x, y }));
                  }
                }}
                onMouseLeave={() => {
                  setSpellTooltip({ spell: null, x: 0, y: 0 });
                }}
              >
                {part.content}
              </span>
            );
          }
          return <span key={idx}>{part.content}</span>;
        })}
      </>
    );
  }

  // Parse action description to extract structured attack information
  function parseActionDescription(desc) {
    if (!desc) return null;

    // Try to match standard attack pattern (e.g., "mw +5 to hit, reach 5 ft., one target")
    let attackMatch = desc.match(/^(mw|ms|rw|rs|mw,rw|rw,mw)\s*([+-]?\d+)\s*to hit,?\s*(?:reach\s+([\d\s/]+ft\.)|range\s+([\d\s/]+ft\.))?.*?(?:one|two|three)\s+(\w+)/i);

    // If not found, try abbreviated format (e.g., "m 5, reach 5 ft." or "r 8, range 150 ft.")
    if (!attackMatch) {
      attackMatch = desc.match(/^(m|r|mw|rw|ms|rs)\s*([+-]?\d+),?\s*(?:reach\s+([\d\s/]+ft\.)|range\s+([\d\s/]+ft\.))?/i);
      if (attackMatch) {
        // For abbreviated format, we need to expand the attack type and extract target from context
        const [, attackTypeShort, toHit, reach, range] = attackMatch;

        // Expand attack type: m -> mw, r -> rw
        let attackType = attackTypeShort.toLowerCase();
        if (attackType === 'm') attackType = 'mw';
        if (attackType === 'r') attackType = 'rw';

        // Add + sign if missing
        const toHitWithSign = toHit.startsWith('+') || toHit.startsWith('-') ? toHit : `+${toHit}`;

        // Extract target - default to "target" if not found
        const targetMatch = desc.match(/(?:one|two|three|any number of)\s+(\w+)/i);
        const target = targetMatch ? targetMatch[1] : 'target';

        attackMatch = [null, attackType, toHitWithSign, reach, range, target];
      }
    }

    if (!attackMatch) {
      // Check for abbreviated saving throw format: "con 12, each creature in a 30-foot Emanation..."
      const abbreviatedSaveMatch = desc.match(/^(str|dex|con|int|wis|cha)\s+(\d+),?\s+each creature in a/i);
      if (abbreviatedSaveMatch) {
        const [, ability, dc] = abbreviatedSaveMatch;

        // Extract target info: "each creature in a 30-foot Emanation [Area of Effect]"
        // Look for the full area description until "originating" or similar words
        const fullAreaMatch = desc.match(/each creature in a\s+(.+?)\s+(?:originating|centered)/i);
        let targetInfo = null;
        if (fullAreaMatch) {
          let areaText = fullAreaMatch[1];
          // Clean up 5e.tools references like "Emanation [Area of Effect]|XPHB|Emanation"
          areaText = areaText.replace(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+\[[^\]]+\])?)\|(XPHB|PHB|XDMG|DMG|XMM|MM|TCE|TCoE|XGE|SCAG|VGM|MTF|FTD|MOT|VRGR|ERLW|EGTW|AI|IDRotF|WBtW|SCC|AAG|BMT|CoS|SKT|ToA|WDH|WDMM|GoS|SDW|BGDIA|OotA|PotA|RoT|ToD)(?:\|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?/g, "$1");
          targetInfo = `each creature in a ${areaText}`;
        } else {
          // Fallback to simpler pattern
          const simpleMatch = desc.match(/each creature in a\s+(\d+-foot(?:\s+\w+)?(?:\s+\[[^\]]+\])?)/i);
          if (simpleMatch) {
            targetInfo = `each creature in a ${simpleMatch[1]}`;
          }
        }

        // Extract area (e.g., "30-foot-long, 5-foot-wide Line")
        const areaMatch = desc.match(/(\d+)-foot-long,\s*(\d+)-foot-wide\s+(\w+)/i);
        let area = null;
        if (areaMatch) {
          area = `${areaMatch[1]}-foot ${areaMatch[3]} (${areaMatch[2]} ft. wide)`;
        }

        // Extract damage with {@actSaveFail} tag or standard format
        let damageMatch = desc.match(/\{@actSaveFail\}\s*(\d+)\s*\(([^)]+)\)\s*(\w+)\s*damage/i);
        if (!damageMatch) {
          damageMatch = desc.match(/(\d+)\s*\(([^)]+)\)\s*(\w+)\s*damage/i);
        }

        let damage = null;
        if (damageMatch) {
          damage = {
            average: damageMatch[1],
            dice: damageMatch[2],
            type: damageMatch[3]
          };
        }

        // Extract failure and success effects separately
        let failureEffect = null;
        let successEffect = null;

        // Look for "On a failed save" section (can be followed by comma or colon)
        const failMatch = desc.match(/On a failed save[,:]\s*(.+?)(?=\.\s*On a successful save|On a successful save|$)/is);
        if (failMatch) {
          failureEffect = failMatch[1].trim();
        }

        // Look for "On a successful save" section (can be followed by comma or colon)
        const succMatch = desc.match(/On a successful save[,:]\s*(.+?)$/is);
        if (succMatch) {
          successEffect = succMatch[1].trim();
        }

        return {
          type: 'save',
          dc,
          ability: ability.toLowerCase(),
          targetInfo,
          area,
          damage: damage ? { ...damage, halfOnSuccess: successEffect?.includes("half damage") } : null,
          failureEffect,
          successEffect,
          fullDesc: desc
        };
      }

      // Check if this is a saving throw action (e.g., "DC 12 Dexterity saving throw")
      const saveMatch = desc.match(/(?:make a|must succeed on a|succeed on a)?\s*(?:DC\s*)?(\d+)\s+(\w+)\s+saving throw/i);
      if (saveMatch) {
        const [, dc, ability] = saveMatch;

        // Extract target information (e.g., "one creature", "each creature in a 30-foot Emanation")
        const targetMatch = desc.match(/(?:targets?|targeting)\s+(one|two|three|up to \w+|any number of)\s+(\w+)/i);
        let targetInfo = null;
        if (targetMatch) {
          targetInfo = `${targetMatch[1]} ${targetMatch[2]}`;
        } else {
          // Try to match "each creature in a X-foot [area type]"
          const areaTargetMatch = desc.match(/(?:each|all)\s+creature(?:s)?\s+in\s+a\s+([\d-]+(?:-foot)?(?:\s+\w+)?(?:\s+\[[^\]]+\])?)/i);
          if (areaTargetMatch) {
            targetInfo = `each creature in a ${areaTargetMatch[1]}`;
          } else {
            // Try to match "The target" or "Each target"
            const simpleTargetMatch = desc.match(/(?:the|each)\s+target/i);
            if (simpleTargetMatch) {
              targetInfo = "target";
            }
          }
        }

        // Extract range/distance (e.g., "within 120 feet")
        const rangeMatch = desc.match(/within\s+(\d+)\s+feet?/i);
        let range = null;
        if (rangeMatch) {
          range = `${rangeMatch[1]} ft.`;
        }

        // Extract conditions (e.g., "it can see", "that it can hear")
        const conditionMatch = desc.match(/(?:creature[s]?|target[s]?)\s+(it can see|that it can see|it can hear|that it can hear|within range)/i);
        let condition = null;
        if (conditionMatch) {
          condition = conditionMatch[1].replace(/^that /, '');
        }

        // Extract damage
        const damageMatch = desc.match(/(?:taking|take)\s+(\d+)\s*\(([^)]+)\)\s*(\w+)\s*damage/i);
        let damage = null;
        if (damageMatch) {
          damage = {
            average: damageMatch[1],
            dice: damageMatch[2],
            type: damageMatch[3]
          };
        }

        // Extract effect area (e.g., "30-foot line that is 5 feet wide" or "20-foot radius")
        const areaMatch = desc.match(/(\d+)-foot(?:-(?:long|wide))?\s+(line|cone|cube|sphere|cylinder|radius)/i);
        let area = null;
        if (areaMatch) {
          const sizeMatch = desc.match(/(\d+)(?:-foot)?(?:-long)?\s+(\w+)\s+(?:that is|wide|in)\s+(\d+)\s+feet?\s+wide/i);
          if (sizeMatch) {
            area = `${sizeMatch[1]}-foot ${sizeMatch[2]} (${sizeMatch[3]} ft. wide)`;
          } else {
            area = `${areaMatch[1]}-foot ${areaMatch[2]}`;
          }
        }

        // Extract failure and success effects separately
        let failureEffect = null;
        let successEffect = null;

        // Look for "On a failed save" section (can be followed by comma or colon)
        const failMatch = desc.match(/On a failed save[,:]\s*(.+?)(?=\.\s*On a successful save|On a successful save|$)/is);
        if (failMatch) {
          failureEffect = failMatch[1].trim();
        }

        // Look for "On a successful save" section (can be followed by comma or colon)
        const succMatch = desc.match(/On a successful save[,:]\s*(.+?)$/is);
        if (succMatch) {
          successEffect = succMatch[1].trim();
        }

        return {
          type: 'save',
          dc,
          ability,
          targetInfo,
          range,
          condition,
          area,
          damage: damage ? { ...damage, halfOnSuccess: successEffect?.includes("half damage") } : null,
          failureEffect,
          successEffect,
          fullDesc: desc
        };
      }

      return null;
    }

    const [, attackType, toHit, reach, range, target] = attackMatch;

    // Extract all damage instances from Hit: or {@h} notation
    // This handles cases like "8 (1d10 + 3) piercing damage plus 3 (1d6) lightning damage"
    const damagePattern = /(\d+)\s*\(([^)]+)\)\s*(\w+)\s*damage/gi;
    const damages = [];
    let damageMatch;

    // Find the {@h} or Hit: marker first
    const hitMarker = desc.match(/{@h}|Hit:/i);
    const damageStartIndex = hitMarker ? desc.indexOf(hitMarker[0]) + hitMarker[0].length : 0;
    const damageSection = desc.substring(damageStartIndex);

    while ((damageMatch = damagePattern.exec(damageSection)) !== null) {
      damages.push({
        average: damageMatch[1],
        dice: damageMatch[2],
        type: damageMatch[3]
      });
    }

    // Get remaining description (after all damage)
    let remainingDesc = desc;
    if (damages.length > 0) {
      // Find the last damage match and get text after it
      const lastDamageText = damages[damages.length - 1];
      const lastDamagePattern = new RegExp(`${lastDamageText.average}\\s*\\(${lastDamageText.dice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*${lastDamageText.type}\\s*damage`, 'i');
      const lastMatch = damageSection.match(lastDamagePattern);
      if (lastMatch) {
        const endOfDamage = damageSection.indexOf(lastMatch[0]) + lastMatch[0].length;
        remainingDesc = damageSection.substring(endOfDamage).trim();

        // Clean up leading "plus" or punctuation
        remainingDesc = remainingDesc.replace(/^(?:plus|and|,|\.)?\s*/i, '').trim();
      }
    }

    return {
      type: 'attack',
      attackType,
      toHit,
      reach: reach || range || null,
      target,
      damages, // Array of damage objects
      remainingDesc
    };
  }

  // Component to render text with clickable dice notation (but NOT attack rolls as those are handled separately)
  function RollableText({
    text,
    skipAttackRolls = true,
    removeAttackText = false,
    character = '',
    actionName = '',
    onRoll = null,
  }) {
    if (!text) return null;

    // First, clean up 5e.tools markup tags like {@h}, {@atk mw}, {@damage 2d6}, etc.
    // Special handling for {@h} Hit: - extract the dice notation (this is typically damage)
    let cleanText = text.replace(/\{@h\}\s*(\d+)\s*\(([^)]+)\)/g, "$1 ($2)");
    // Special handling for {@damage XdY} - extract the dice notation
    cleanText = cleanText.replace(/\{@damage ([^}]+)\}/g, "$1");
    // Special handling for {@dice XdY} - extract the dice notation
    cleanText = cleanText.replace(/\{@dice ([^}]+)\}/g, "$1");
    // Special handling for {@dc N} - extract the DC number
    cleanText = cleanText.replace(/\{@dc (\d+)\}/g, "DC $1");
    // Special handling for {@actSave ABILITY} - convert to saving throw text
    cleanText = cleanText.replace(/\{@actSave\s+(\w+)\}/gi, (match, ability) => {
      const abilityUpper = ability.charAt(0).toUpperCase() + ability.slice(1).toLowerCase();
      return `${abilityUpper} saving throw`;
    });
    // Fix malformed saving throw format: "con 12" -> "DC 12 Con saving throw"
    cleanText = cleanText.replace(/\b(str|dex|con|int|wis|cha)\s+(\d+)/gi, (match, ability, dc) => {
      const abilityUpper = ability.charAt(0).toUpperCase() + ability.slice(1).toLowerCase();
      return `DC ${dc} ${abilityUpper} saving throw`;
    });
    // Special handling for {@actSaveFail} - convert to "on a failed save" (with period before)
    cleanText = cleanText.replace(/\.\s*\{@actSaveFail\}/g, ". On a failed save");
    cleanText = cleanText.replace(/\{@actSaveFail\}/g, " On a failed save,");
    // Special handling for {@actSaveSuccess} - convert to "on a successful save" (with period before)
    cleanText = cleanText.replace(/\.\s*\{@actSaveSuccess\}/g, ". On a successful save");
    cleanText = cleanText.replace(/\{@actSaveSuccess\}/g, " On a successful save,");
    // Special handling for {@condition NAME} - extract the condition name
    cleanText = cleanText.replace(/\{@condition ([^}|]+)(?:\|[^}]+)?\}/g, "$1");
    // Special handling for {@creature NAME} - extract the creature name
    cleanText = cleanText.replace(/\{@creature ([^}|]+)(?:\|\|[^}|]+)?(?:\|[^}]+)?\}/g, "$1");
    // Special handling for {@quickref ...||X} - extract the reference name and remove ||X notation
    cleanText = cleanText.replace(/\{@quickref ([^}|]+)(?:\|\|[^}|]+)?(?:\|[^}]+)?\}/g, "$1");
    // Special handling for {@variantrule NAME} - extract the rule name
    cleanText = cleanText.replace(/\{@variantrule ([^}|]+)(?:\|[^}]+)?\}/g, "$1");
    // Remove other tags entirely (recharge tags are handled in formatActionName)
    cleanText = cleanText.replace(/\{@[^}]+\}/g, "");

    // Clean up 5e.tools link references like "Hit Points|XPHB|Hit Point" or "Disadvantage|XPHB"
    // Pattern matches text (including brackets) followed by source reference and optional alternate text
    // Examples: "Hit Points|XPHB|Hit Point" -> "Hit Points", "Emanation [Area of Effect]|XPHB|Emanation" -> "Emanation [Area of Effect]"
    cleanText = cleanText.replace(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+\[[^\]]+\])?)\|(XPHB|PHB|XDMG|DMG|XMM|MM|TCE|TCoE|XGE|SCAG|VGM|MTF|FTD|MOT|VRGR|ERLW|EGTW|AI|IDRotF|WBtW|SCC|AAG|BMT|CoS|SKT|ToA|WDH|WDMM|GoS|SDW|BGDIA|OotA|PotA|RoT|ToD)(?:\|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?/g, "$1");

    // Remove remaining ||X patterns that might have been left over
    cleanText = cleanText.replace(/\|\|\d+/g, "");

    // Fix duplicate dice notations by removing consecutive identical dice rolls:
    // [1d10][1d10] -> [1d10], but keeps [1d10] if it appears only once
    cleanText = cleanText.replace(/(\[\d+d\d+(?:[+-]\d+)?\])(?:\1)+/g, "$1");
    // (1d10)(1d10) -> (1d10), but keeps (1d10) if it appears only once
    cleanText = cleanText.replace(/(\(\d+d\d+(?:[+-]\d+)?\))(?:\1)+/g, "$1");

    // If removeAttackText is true, remove "to hit" attack patterns and damage descriptions
    // to avoid duplication when they're already shown as buttons
    if (removeAttackText) {
      // Remove patterns like "mw +7 to hit, reach 5 ft., one target."
      cleanText = cleanText.replace(
        /(?:mw|ms|rw|rs|Melee Weapon Attack|Melee Spell Attack|Ranged Weapon Attack|Ranged Spell Attack):?\s*[+-]?\d+\s*to hit[^.]*\.\s*/gi,
        ""
      );
      // Remove patterns like "Hit: 9 (2d6 + 2) slashing damage"
      cleanText = cleanText.replace(
        /(?:Hit|{@h}):\s*\d+\s*\([^)]+\)\s*\w+\s*damage[^.]*\.\s*/gi,
        ""
      );
      // Clean up any leading/trailing whitespace or commas
      cleanText = cleanText.trim().replace(/^[,.\s]+|[,.\s]+$/g, "");
    }

    // Match attack rolls (mw/rw/ms/rs/mw,rw +X to hit) and dice notation (XdY, XdY+Z, XdY-Z)
    const attackPattern = /(?:mw|ms|rw|rs|mw,rw|mw,rs|rw,mw|rs,mw)[\s,]+([+-]?\d+)\s+to hit/gi;
    const dicePattern = /(\d+d\d+(?:\s*[+-]\s*\d+)?)/gi;

    // First, extract attack rolls
    const attackMatches = [];
    let match;
    while ((match = attackPattern.exec(cleanText)) !== null) {
      attackMatches.push({
        fullMatch: match[0],
        bonus: match[1],
        index: match.index
      });
    }

    // Split text by both attack rolls and dice notation
    // We need to remove the capturing group from dicePattern to avoid duplicate entries
    const dicePatternNonCapturing = /\d+d\d+(?:\s*[+-]\s*\d+)?/gi;
    const combinedPattern = new RegExp(`(${attackPattern.source}|${dicePatternNonCapturing.source})`, 'gi');
    const parts = cleanText.split(combinedPattern).filter((p) => p); // Remove empty strings

    return (
      <>
        {parts.map((part, idx) => {
          // Check if it's an attack roll (mw/rw/ms/rs +X to hit)
          const attackMatch = part.match(attackPattern);
          if (attackMatch) {
            // Extract the bonus
            const bonusMatch = part.match(/([+-]?\d+)\s+to hit/i);
            const bonus = bonusMatch ? bonusMatch[1] : '+0';
            const notation = bonus.startsWith('+') || bonus.startsWith('-')
              ? `1d20${bonus}`
              : `1d20+${bonus}`;

            return (
              <button
                key={idx}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/60 text-green-800 dark:text-green-300 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border border-green-300 dark:border-green-700"
                onClick={() => {
                  // Left click: Roll attack
                  let label = actionName ? `${character} - ${actionName} - Attack` : `Attack ${notation}`;
                  rollDice({
                    notation: notation,
                    rollMode: "normal",
                    label: label,
                    character: character || undefined,
                  });
                  if (onRoll) onRoll();
                }}
                onContextMenu={(e) => {
                  // Right click: Show context menu for advantage/disadvantage
                  e.preventDefault();
                  e.stopPropagation();
                  let label = actionName ? `${character} - ${actionName} - Attack` : `Attack ${notation}`;
                  setDiceContextMenu({
                    show: true,
                    x: e.clientX,
                    y: e.clientY,
                    notation: notation,
                    type: "d20",
                    label: label,
                    onRoll: onRoll,
                    character: character || undefined,
                  });
                }}
                title="Left: Roll Attack | Right: Adv/Dis"
              >
                ⚔️ {part}
              </button>
            );
          }

          // Check if it's dice notation (XdY)
          if (part.match(dicePattern)) {
            // Normalize notation by removing spaces for the roller
            const normalizedNotation = part.replace(/\s+/g, "");

            // Determine if this is a d20 roll (for advantage/disadvantage) or damage roll (for crit)
            const isD20 = normalizedNotation.match(/\d*d20/i);

            return (
              <button
                key={idx}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60 text-blue-800 dark:text-blue-300 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border border-blue-300 dark:border-blue-700"
                onClick={() => {
                  // Left click: Roll immediately using universal function
                  let label = actionName ? `${character} - ${actionName}` : (character || '');
                  if (!isD20 && label) label += ' - Damage';
                  rollDice({
                    notation: normalizedNotation,
                    rollMode: "normal",
                    label: label || undefined,
                    character: character || undefined,
                  });
                  // Call onRoll callback if provided
                  if (onRoll) onRoll();
                }}
                onContextMenu={(e) => {
                  // Right click: Show context menu
                  e.preventDefault();
                  e.stopPropagation();
                  let label = actionName ? `${character} - ${actionName}` : (character || '');
                  if (!isD20 && label) label += ' - Damage';
                  setDiceContextMenu({
                    show: true,
                    x: e.clientX,
                    y: e.clientY,
                    notation: normalizedNotation,
                    type: isD20 ? "d20" : "damage",
                    label: label || undefined,
                    onRoll: onRoll,
                  });
                }}
                title={
                  isD20
                    ? "Left: Roll | Right: Adv/Dis"
                    : "Left: Roll | Right: Crit"
                }
              >
                🎲 {part}
              </button>
            );
          }

          return <span key={idx}>{part}</span>;
        })}
      </>
    );
  }

  // Check if combat is completed (for disabling controls)
  const isCompleted = enc?.combatStatus === 'completed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100 transition-colors">
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Encounter++ Logo" className="w-8 h-8" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Encounter++
            </h1>
          </div>

          {/* Mode Toggle - Always visible */}
          {enc && (
            <div className="flex items-center gap-1 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-1">
              <button
                className={`py-1.5 px-3 rounded-md font-medium text-sm transition-all ${
                  !combatMode
                    ? "bg-white dark:bg-slate-700 shadow text-orange-700 dark:text-orange-300"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50"
                }`}
                onClick={() => setCombatMode(false)}
              >
                📝 Prep
              </button>
              <button
                className={`py-1.5 px-3 rounded-md font-medium text-sm transition-all ${
                  combatMode
                    ? "bg-white dark:bg-slate-700 shadow text-red-700 dark:text-red-300"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50"
                }`}
                onClick={() => setCombatMode(true)}
              >
                ⚔️ Combat
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              className="btn w-10 h-10 p-0 flex items-center justify-center"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button
              className="btn bg-purple-600 text-white hover:bg-purple-700 border-purple-600"
              onClick={() => setShowCampaignManager(true)}
              title="Kampagnen verwalten"
            >
              📚 Kampagnen
            </button>
            <button
              className="btn bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
              onClick={createEncounter}
            >
              + New Encounter
            </button>
            <label className="btn cursor-pointer">
              📥 Import
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && importEncounter(e.target.files[0])
                }
              />
            </label>

            {/* Profile Menu */}
            <div className="relative profile-menu-container">
              <button
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold flex items-center justify-center hover:from-purple-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title={user.email}
              >
                {user.email
                  .match(/[a-zA-Z]/g)
                  ?.slice(0, 2)
                  .join("")
                  .toUpperCase() || "US"}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-40">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Angemeldet als
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 truncate">
                      {user.email}
                    </div>
                  </div>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowSettings(true);
                    }}
                  >
                    <span>⚙️</span>
                    <span>Einstellungen</span>
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                  >
                    <span>🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main
        className="mx-auto p-6 grid gap-6"
        style={{
          maxWidth: '100%',
          gridTemplateColumns: sidebarVisible
            ? "400px minmax(0, 2fr) 400px"  // 3 columns: Sidebar (400px) + Middle + Right (400px)
            : "64px minmax(0, 2fr) 400px",  // 3 columns collapsed: Mini sidebar + Middle + Right
          transition: 'grid-template-columns 700ms ease-in-out'
        }}
      >
        {/* Left Column - Sidebar (Full or Mini) */}
        <aside className="space-y-4 transition-all duration-700 ease-in-out relative overflow-y-auto h-[calc(100vh-80px)] sticky top-20">
          {/* Sidebar Toggle Button */}
          <button
            className={`h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-700 sticky top-0 z-20 group relative overflow-hidden mb-4 ${
              sidebarVisible ? 'w-full' : 'w-14'
            }`}
            onClick={() => {
              setSidebarVisible(!sidebarVisible);
              if (!sidebarVisible) setActiveSidebarPanel(null);
            }}
            title={sidebarVisible ? "Sidebar ausblenden" : "Sidebar einblenden"}
          >
            {/* Animated background gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Icon and Text */}
            <div className="relative flex items-center gap-2">
              {/* Custom Sidebar Icons */}
              <img
                src={sidebarVisible ? "/icons8-sidebar-50.png" : "/icons8-sidebar-50-2.png"}
                alt={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                className="w-5 h-5 transition-opacity duration-700 filter brightness-0 invert"
              />
              {sidebarVisible && (
                <span className="text-sm font-semibold tracking-wide transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                  Hide
                </span>
              )}
            </div>
          </button>

          {/* Full Sidebar Content - fades and scales */}
          <div className={`transition-all duration-700 ease-in-out origin-left space-y-4 ${
            sidebarVisible
              ? 'opacity-100 scale-100 max-h-[9999px]'
              : 'opacity-0 scale-75 pointer-events-none max-h-0 overflow-hidden'
          }`}>
              {/* Combat Mode Quick Actions - Top of Sidebar */}
              {combatMode && enc && (
                <div className={`card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 transition-all duration-300 ${quickActionsCollapsed ? 'pb-0' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-red-900 dark:text-red-300">
                      ⚔️ Quick Actions
                      {enc.combatStatus === 'completed' && <span className="ml-2 text-xs text-green-600">(Completed)</span>}
                    </h2>
                    <button
                      onClick={() => setQuickActionsCollapsed(!quickActionsCollapsed)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                      title={quickActionsCollapsed ? "Ausklappen" : "Einklappen"}
                    >
                      {quickActionsCollapsed ? '▼' : '▲'}
                    </button>
                  </div>
                  {!quickActionsCollapsed && (() => {
                    const isCompleted = enc.combatStatus === 'completed';
                    return (
                    <div className="space-y-2">
                      <button
                        disabled={isCompleted}
                        className={`btn w-full bg-red-600 text-white hover:bg-red-700 border-red-600 text-sm py-1 ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={rollInitiativeForAll}
                      >
                        🎲 Roll Initiative
                      </button>
                      <button
                        className="btn w-full bg-yellow-600 text-white hover:bg-yellow-700 border-yellow-600 text-sm py-1"
                        onClick={resetCombat}
                      >
                        🔄 Reset Combat
                      </button>
                      <button
                        disabled={isCompleted}
                        className={`btn w-full bg-green-600 text-white hover:bg-green-700 border-green-600 text-sm py-1 ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={async () => {
                          if (!enc) return;
                          try {
                            const updated = {
                              ...enc,
                              combatStatus: 'completed',
                              completedAt: new Date().toISOString()
                            };
                            setEnc(updated);
                            await apiPut(`/api/encounters/${enc.id}`, updated);
                            // Refresh encounters list to show checkmark
                            const encountersResponse = await apiGet('/api/encounters');
                            const encountersData = await encountersResponse.json();
                            setEncounters(encountersData);
                          } catch (error) {
                            console.error('Failed to finish combat:', error);
                          }
                        }}
                      >
                        ✅ Finish Combat
                      </button>
                      <button
                        disabled={isCompleted}
                        className={`btn w-full bg-orange-500 text-white hover:bg-orange-600 border-orange-500 text-sm py-1 ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={addCustom}
                      >
                        ➕ Add Custom
                      </button>
                    </div>
                    );
                  })()}
                </div>
              )}

              {/* Player Screen Controls - Second position when active */}
              {combatMode && enc && (
                <div className={`card bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 transition-all duration-300 ${playerScreenControlsCollapsed ? 'h-12 pb-0' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-bold text-cyan-900 dark:text-cyan-300">
                      🖥️ Player Screen Controls
                      {enc.combatStatus === 'completed' && <span className="ml-2 text-xs text-green-600">(Combat Completed)</span>}
                    </h2>
                    <button
                      onClick={() => setPlayerScreenControlsCollapsed(!playerScreenControlsCollapsed)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-cyan-200 dark:hover:bg-cyan-800 transition-colors"
                      title={playerScreenControlsCollapsed ? "Ausklappen" : "Einklappen"}
                    >
                      {playerScreenControlsCollapsed ? '▼' : '▲'}
                    </button>
                  </div>

                  {!playerScreenControlsCollapsed && (() => {
                    const isCompleted = enc.combatStatus === 'completed';
                    return (
                    <div className="space-y-3">
                      {/* Open Player Screen Button */}
                      <button
                        disabled={isCompleted}
                        className={`w-full btn bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700 border-none shadow-lg text-sm ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={async () => {
                          try {
                            // Generate a secure token
                            const response = await apiPost('/api/player-screen/token');
                            const data = await response.json();
                            const token = data.token;

                            // Open player screen with token
                            const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
                            const url = `${baseUrl}player.html?follow=true&token=${encodeURIComponent(token)}`;
                            window.open(url, 'playerScreen', 'width=800,height=600,menubar=no,toolbar=no,location=no');
                          } catch (error) {
                            console.error('Failed to generate player screen token:', error);
                            alert('Failed to open player screen');
                          }
                        }}
                      >
                        📺 Open Player Screen (Auto-Follow)
                      </button>

                      {/* Share to Mobile Button */}
                      <button
                        disabled={isCompleted}
                        className={`w-full btn bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 border-none shadow-lg text-sm ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => setShowShareCodeModal(true)}
                      >
                        📱 Share to Mobile
                      </button>

                      <hr className="border-cyan-200 dark:border-cyan-700" />

                      {/* Blank Screen Toggle - Always enabled */}
                      <div>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-slate-700 dark:text-slate-300">Blank Screen</span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={enc.playerScreenSettings?.blankScreen || false}
                              onChange={(e) => {
                                const updated = {
                                  ...enc,
                                  playerScreenSettings: {
                                    ...enc.playerScreenSettings,
                                    blankScreen: e.target.checked
                                  }
                                };
                                setEnc(updated);
                                apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </label>
                      </div>

                      {/* Black Mode Toggle - Disabled when completed */}
                      <div>
                        <label className={`flex items-center justify-between ${isCompleted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <span className="text-sm text-slate-700 dark:text-slate-300">Black Background</span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              disabled={isCompleted}
                              checked={enc.playerScreenSettings?.blackMode || false}
                              onChange={(e) => {
                                const updated = {
                                  ...enc,
                                  playerScreenSettings: {
                                    ...enc.playerScreenSettings,
                                    blackMode: e.target.checked
                                  }
                                };
                                setEnc(updated);
                                apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </label>
                      </div>

                      {/* Rotation Control - Disabled when completed */}
                      <div className={isCompleted ? 'opacity-50' : ''}>
                        <label className="text-sm text-slate-700 dark:text-slate-300 block mb-2">
                          Rotation: {enc.playerScreenSettings?.rotation || 0}°
                        </label>
                        <div className="flex gap-2">
                          <button
                            disabled={isCompleted}
                            onClick={() => {
                              const current = enc.playerScreenSettings?.rotation || 0;
                              const newRotation = (current - 90 + 360) % 360;
                              const updated = {
                                ...enc,
                                playerScreenSettings: {
                                  ...enc.playerScreenSettings,
                                  rotation: newRotation
                                }
                              };
                              setEnc(updated);
                              apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                            }}
                            className="btn flex-1 bg-slate-600 text-white hover:bg-slate-700 text-xs py-2"
                          >
                            ↶ Left
                          </button>
                          <button
                            disabled={isCompleted}
                            onClick={() => {
                              const current = enc.playerScreenSettings?.rotation || 0;
                              const newRotation = (current + 90) % 360;
                              const updated = {
                                ...enc,
                                playerScreenSettings: {
                                  ...enc.playerScreenSettings,
                                  rotation: newRotation
                                }
                              };
                              setEnc(updated);
                              apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                            }}
                            className="btn flex-1 bg-slate-600 text-white hover:bg-slate-700 text-xs py-2"
                          >
                            Right ↷
                          </button>
                        </div>
                      </div>

                      {/* All other toggles - disabled when completed */}
                      <div className={isCompleted ? 'opacity-50 pointer-events-none' : ''}>
                      {/* Current Turn Image */}
                      <div>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-slate-700 dark:text-slate-300">Current Turn Image</span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              disabled={isCompleted}
                              checked={enc.playerScreenSettings?.showCurrentTurnImage !== false}
                              onChange={(e) => {
                                const updated = {
                                  ...enc,
                                  playerScreenSettings: {
                                    ...enc.playerScreenSettings,
                                    showCurrentTurnImage: e.target.checked
                                  }
                                };
                                setEnc(updated);
                                apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </label>
                      </div>

                      {/* Initiative Order Images */}
                      <div>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-slate-700 dark:text-slate-300">Initiative Order Images</span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              disabled={isCompleted}
                              checked={enc.playerScreenSettings?.showInitiativeImages !== false}
                              onChange={(e) => {
                                const updated = {
                                  ...enc,
                                  playerScreenSettings: {
                                    ...enc.playerScreenSettings,
                                    showInitiativeImages: e.target.checked
                                  }
                                };
                                setEnc(updated);
                                apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </label>
                      </div>

                      {/* Show Turn Button */}
                      <div>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-slate-700 dark:text-slate-300">Show Turn Button</span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              disabled={isCompleted}
                              checked={enc.playerScreenSettings?.showTurnButton !== false}
                              onChange={(e) => {
                                const updated = {
                                  ...enc,
                                  playerScreenSettings: {
                                    ...enc.playerScreenSettings,
                                    showTurnButton: e.target.checked
                                  }
                                };
                                setEnc(updated);
                                apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                              }}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </label>
                      </div>

                      {/* Hide Scrollbars */}
                      <div>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-slate-700 dark:text-slate-300">Hide Scrollbars</span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              disabled={isCompleted}
                              checked={enc.playerScreenSettings?.hideScrollbars || false}
                              onChange={(e) => {
                                const updated = {
                                  ...enc,
                                playerScreenSettings: {
                                  ...enc.playerScreenSettings,
                                  hideScrollbars: e.target.checked
                                }
                              };
                              setEnc(updated);
                              apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                            }}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        </label>
                      </div>

                      {/* Zoom Level */}
                      <div>
                        <label className="text-sm text-slate-700 dark:text-slate-300 block mb-1">
                          Zoom: {Math.round((enc.playerScreenSettings?.zoom || 100))}%
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          step="5"
                          disabled={isCompleted}
                          value={enc.playerScreenSettings?.zoom || 100}
                          onChange={(e) => {
                            const updated = {
                              ...enc,
                              playerScreenSettings: {
                                ...enc.playerScreenSettings,
                                zoom: parseInt(e.target.value)
                              }
                            };
                            setEnc(updated);
                            apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                          }}
                          className="w-full"
                        />
                      </div>

                      {/* Bloodied Status */}
                      <div>
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-slate-700 dark:text-slate-300">🩸 Bloodied Status</span>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              disabled={isCompleted}
                              checked={enc.playerScreenSettings?.showBloodiedInPlayerView || false}
                              onChange={(e) => {
                                const updated = {
                                ...enc,
                                playerScreenSettings: {
                                  ...enc.playerScreenSettings,
                                  showBloodiedInPlayerView: e.target.checked
                                }
                              };
                              setEnc(updated);
                              apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                            }}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        </label>
                      </div>
                      </div>
                    </div>
                    );
                  })()}
                </div>
              )}

              <section className={`card flex flex-col overflow-hidden transition-all duration-300 ${encounterTreeCollapsed ? 'h-12' : (combatMode ? 'h-[600px]' : 'h-[calc(100vh-180px)]')}`}>
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <h2 className="text-lg font-bold">📁 Encounters</h2>
                  <button
                    onClick={() => setEncounterTreeCollapsed(!encounterTreeCollapsed)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title={encounterTreeCollapsed ? "Ausklappen" : "Einklappen"}
                  >
                    {encounterTreeCollapsed ? '▼' : '▲'}
                  </button>
                </div>
                {!encounterTreeCollapsed && (
                  <div className="flex-1 overflow-hidden">
                    <EncounterTreeView
                      encounters={encounters}
                      loading={encountersLoading}
                      currentId={currentId}
                      onSelectEncounter={setCurrentId}
                      onDeleteEncounter={deleteEncounter}
                      onDuplicateEncounter={duplicateEncounter}
                      onCreateEncounter={createEncounter}
                      campaigns={campaigns}
                      onRefreshEncounters={async () => {
                        setEncountersLoading(true);
                        try {
                          const r = await apiGet("/api/encounters");
                          setEncounters(await r.json());
                        } catch (err) {
                          console.error('Failed to refresh encounters:', err);
                        } finally {
                          setEncountersLoading(false);
                        }
                      }}
                      onMoveEncounter={(encounterId, folderPath) => {
                        setEncounters(prev => prev.map(e =>
                          e.id === encounterId ? { ...e, folder: folderPath } : e
                        ));
                      }}
                    />
                  </div>
                )}
              </section>

              {/* Combat Mode - Compact Monster Browser */}
              {combatMode && (
                <div className={`card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 flex flex-col overflow-hidden transition-all duration-300 ${monsterBrowserCollapsed ? 'h-12' : 'max-h-[800px]'}`}>
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <h2 className="text-sm font-bold text-red-900 dark:text-red-300">
                      🐉 Quick Add Monsters
                    </h2>
                    <button
                      onClick={() => setMonsterBrowserCollapsed(!monsterBrowserCollapsed)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                      title={monsterBrowserCollapsed ? "Ausklappen" : "Einklappen"}
                    >
                      {monsterBrowserCollapsed ? '▼' : '▲'}
                    </button>
                  </div>
                  {!monsterBrowserCollapsed && (
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <MonsterBrowser
                        onPick={addMonster}
                        onEdit={(monster) => {
                          setEditingCreature(monster);
                          setShowCreatureManager(true);
                        }}
                        RollableText={RollableText}
                        combatMode={combatMode}
                        selectedCombatant={selectedCombatant}
                      />
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Mini Icon Mode - fades in when sidebar collapsed */}
          <div className={`transition-all duration-700 ease-in-out space-y-2 sticky top-36 ${
            !sidebarVisible
              ? 'opacity-100 scale-100 max-h-[9999px]'
              : 'opacity-0 scale-0 pointer-events-none max-h-0 overflow-hidden'
          }`}>
              <div className="flex flex-col gap-2">
                {/* Encounters Icon */}
                <button
                  className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${
                    activeSidebarPanel === 'encounters'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                  onClick={() => setActiveSidebarPanel(activeSidebarPanel === 'encounters' ? null : 'encounters')}
                  title="Encounters"
                >
                  📁
                </button>

                {/* Quick Actions Icon (Combat Mode Only) */}
                {combatMode && enc && (
                  <button
                    className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${
                      activeSidebarPanel === 'quickActions'
                        ? 'bg-red-500 text-white shadow-lg'
                        : 'bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                    onClick={() => setActiveSidebarPanel(activeSidebarPanel === 'quickActions' ? null : 'quickActions')}
                    title="Quick Actions"
                  >
                    ⚔️
                  </button>
                )}

                {/* Monster Browser Icon (Combat Mode Only) */}
                {combatMode && (
                  <button
                    disabled={isCompleted}
                    className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${
                      activeSidebarPanel === 'monsters'
                        ? 'bg-green-500 text-white shadow-lg'
                        : 'bg-white dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    } ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => setActiveSidebarPanel(activeSidebarPanel === 'monsters' ? null : 'monsters')}
                    title="Quick Add Monsters"
                  >
                    🐉
                  </button>
                )}

                {/* Player Characters Icon (Combat Mode Only) */}
                {combatMode && enc && (
                  <button
                    disabled={isCompleted}
                    className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${
                      activeSidebarPanel === 'players'
                        ? 'bg-purple-500 text-white shadow-lg'
                        : 'bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    } ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => setActiveSidebarPanel(activeSidebarPanel === 'players' ? null : 'players')}
                    title="Player Characters"
                  >
                    👥
                  </button>
                )}

                {/* Player Screen Controls Icon (Combat Mode Only) */}
                {combatMode && enc && (
                  <button
                    className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl transition-all ${
                      activeSidebarPanel === 'playerScreen'
                        ? 'bg-cyan-500 text-white shadow-lg'
                        : 'bg-white dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                    onClick={() => setActiveSidebarPanel(activeSidebarPanel === 'playerScreen' ? null : 'playerScreen')}
                    title="Player Screen Controls"
                  >
                    🖥️
                  </button>
                )}
              </div>
          </div>
        </aside>

        {/* Floating Sidebar Panels (Mini Mode Only) */}
        {!sidebarVisible && activeSidebarPanel && (
          <>
            {/* Encounters Panel */}
            {activeSidebarPanel === 'encounters' && (
              <div className="fixed left-20 top-24 w-80 max-h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 flex flex-col overflow-hidden transition-all duration-300 ease-out">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-lg font-bold">📁 Encounters</h2>
                  <button
                    onClick={() => setActiveSidebarPanel(null)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-hidden p-4">
                  <EncounterTreeView
                    encounters={encounters}
                    loading={encountersLoading}
                    currentId={currentId}
                    onSelectEncounter={(id) => {
                      setCurrentId(id);
                      setActiveSidebarPanel(null);
                    }}
                    onDeleteEncounter={deleteEncounter}
                    onDuplicateEncounter={duplicateEncounter}
                    onCreateEncounter={createEncounter}
                    campaigns={campaigns}
                    onRefreshEncounters={async () => {
                      setEncountersLoading(true);
                      try {
                        const r = await apiGet("/api/encounters");
                        setEncounters(await r.json());
                      } catch (err) {
                        console.error('Failed to refresh encounters:', err);
                      } finally {
                        setEncountersLoading(false);
                      }
                    }}
                    onMoveEncounter={(encounterId, folderPath) => {
                      setEncounters(prev => prev.map(e =>
                        e.id === encounterId ? { ...e, folder: folderPath } : e
                      ));
                    }}
                  />
                </div>
              </div>
            )}

            {/* Quick Actions Panel */}
            {activeSidebarPanel === 'quickActions' && (
              <div className="fixed left-20 top-24 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 p-4 transition-all duration-300 ease-out">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-red-900 dark:text-red-300">⚔️ Quick Actions</h2>
                  <button
                    onClick={() => setActiveSidebarPanel(null)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2">
                  <button
                    className="btn w-full bg-red-600 text-white hover:bg-red-700 border-red-600"
                    onClick={() => {
                      rollInitiativeForAll();
                      setActiveSidebarPanel(null);
                    }}
                  >
                    🎲 Roll Initiative
                  </button>
                  <button
                    className="btn w-full bg-yellow-600 text-white hover:bg-yellow-700 border-yellow-600"
                    onClick={() => {
                      resetCombat();
                      setActiveSidebarPanel(null);
                    }}
                  >
                    🔄 Reset Combat
                  </button>
                  <button
                    disabled={isCompleted}
                    className={`btn w-full bg-orange-500 text-white hover:bg-orange-600 border-orange-500 ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      addCustom();
                      setActiveSidebarPanel(null);
                    }}
                  >
                    ➕ Add Custom
                  </button>
                </div>
              </div>
            )}

            {/* Monster Browser Panel */}
            {activeSidebarPanel === 'monsters' && (
              <div className="fixed left-20 top-24 w-96 max-h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 flex flex-col overflow-hidden transition-all duration-300 ease-out">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-lg font-bold text-green-900 dark:text-green-300">🐉 Quick Add Monsters</h2>
                  <button
                    onClick={() => setActiveSidebarPanel(null)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-hidden p-4">
                  <MonsterBrowser
                    onPick={(mon) => {
                      addMonster(mon);
                      setActiveSidebarPanel(null);
                    }}
                    onEdit={(monster) => {
                      setEditingCreature(monster);
                      setShowCreatureManager(true);
                      setActiveSidebarPanel(null);
                    }}
                    RollableText={RollableText}
                    combatMode={combatMode}
                    selectedCombatant={selectedCombatant}
                  />
                </div>
              </div>
            )}

            {/* Player Characters Panel */}
            {activeSidebarPanel === 'players' && (
              <div className="fixed left-20 top-24 w-96 max-h-[calc(100vh-120px)] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 flex flex-col overflow-hidden transition-all duration-300 ease-out">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-lg font-bold text-purple-900 dark:text-purple-300">👥 Player Characters</h2>
                  <button
                    onClick={() => setActiveSidebarPanel(null)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <PlayerCharacterTab
                    campaigns={campaigns}
                    onAddToEncounter={async (pc) => {
                      if (!enc) return;
                      const id = crypto.randomUUID();
                      const c = {
                        id,
                        name: pc.name,
                        initiative: 0,
                        initiativeTieBreaker: 0,
                        hp: pc.hp || 0,
                        baseHP: pc.hp || 0,
                        tempHP: 0,
                        ac: pc.ac || 10,
                        isPlayer: true,
                        level: pc.level,
                        class: pc.class,
                        race: pc.race,
                        ...pc
                      };
                      await save({
                        ...enc,
                        combatants: { ...enc.combatants, [id]: c }
                      });
                      setActiveSidebarPanel(null);
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Player Screen Controls Panel - Visible regardless of sidebar state */}
        {activeSidebarPanel === 'playerScreen' && enc && (
              <div className={`fixed top-24 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-40 p-4 transition-all duration-300 ${
                sidebarVisible ? 'left-[340px]' : 'left-20'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-cyan-900 dark:text-cyan-300">🖥️ Player Screen</h2>
                  <button
                    onClick={() => setActiveSidebarPanel(null)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Open Player Screen Button */}
                  <button
                    className="w-full btn bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700 border-none shadow-lg"
                    onClick={() => {
                      const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
                      const url = `${baseUrl}player.html?encounter=${encodeURIComponent(currentId)}`;
                      window.open(url, 'playerScreen', 'width=800,height=600,menubar=no,toolbar=no,location=no');
                    }}
                  >
                    📺 Open Player Screen
                  </button>

                  {/* Share to Mobile Button */}
                  <button
                    className="w-full btn bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 border-none shadow-lg"
                    onClick={() => setShowShareCodeModal(true)}
                  >
                    📱 Share to Mobile
                  </button>

                  <hr className="border-slate-200 dark:border-slate-700" />

                  {/* Black Mode Toggle */}
                  <div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Black Mode (Extra Dark)</span>
                      <input
                        type="checkbox"
                        checked={enc.playerScreenSettings?.blackMode || false}
                        onChange={(e) => {
                          const updated = {
                            ...enc,
                            playerScreenSettings: {
                              ...enc.playerScreenSettings,
                              blackMode: e.target.checked
                            }
                          };
                          setEnc(updated);
                          apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                        }}
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600"
                      />
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Makes the player screen background completely black
                    </p>
                  </div>

                  {/* Rotation Control */}
                  <div>
                    <label className="text-sm text-slate-700 dark:text-slate-300 block mb-2">
                      Rotation: {enc.playerScreenSettings?.rotation || 0}°
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const current = enc.playerScreenSettings?.rotation || 0;
                          const newRotation = (current - 90 + 360) % 360;
                          const updated = {
                            ...enc,
                            playerScreenSettings: {
                              ...enc.playerScreenSettings,
                              rotation: newRotation
                            }
                          };
                          setEnc(updated);
                          apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                        }}
                        className="btn flex-1 bg-slate-600 text-white hover:bg-slate-700 text-xs py-2"
                      >
                        ↶ Left
                      </button>
                      <button
                        onClick={() => {
                          const current = enc.playerScreenSettings?.rotation || 0;
                          const newRotation = (current + 90) % 360;
                          const updated = {
                            ...enc,
                            playerScreenSettings: {
                              ...enc.playerScreenSettings,
                              rotation: newRotation
                            }
                          };
                          setEnc(updated);
                          apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                        }}
                        className="btn flex-1 bg-slate-600 text-white hover:bg-slate-700 text-xs py-2"
                      >
                        Right ↷
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Rotates the screen in 90° increments
                    </p>
                  </div>

                  {/* Show Current Turn Image */}
                  <div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Current Turn Image</span>
                      <input
                        type="checkbox"
                        checked={enc.playerScreenSettings?.showCurrentTurnImage !== false}
                        onChange={(e) => {
                          const updated = {
                            ...enc,
                            playerScreenSettings: {
                              ...enc.playerScreenSettings,
                              showCurrentTurnImage: e.target.checked
                            }
                          };
                          setEnc(updated);
                          apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                        }}
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600"
                      />
                    </label>
                  </div>

                  {/* Show Initiative Order Images */}
                  <div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Initiative Order Images</span>
                      <input
                        type="checkbox"
                        checked={enc.playerScreenSettings?.showInitiativeImages !== false}
                        onChange={(e) => {
                          const updated = {
                            ...enc,
                            playerScreenSettings: {
                              ...enc.playerScreenSettings,
                              showInitiativeImages: e.target.checked
                            }
                          };
                          setEnc(updated);
                          apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                        }}
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600"
                      />
                    </label>
                  </div>

                  {/* Show Turn Button */}
                  <div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Show Turn Button</span>
                      <input
                        type="checkbox"
                        checked={enc.playerScreenSettings?.showTurnButton !== false}
                        onChange={(e) => {
                          const updated = {
                            ...enc,
                            playerScreenSettings: {
                              ...enc.playerScreenSettings,
                              showTurnButton: e.target.checked
                            }
                          };
                          setEnc(updated);
                          apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                        }}
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600"
                      />
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Shows/hides the 180° rotation button on player screen
                    </p>
                  </div>

                  {/* Hide Scrollbars */}
                  <div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-slate-700 dark:text-slate-300">Hide Scrollbars</span>
                      <input
                        type="checkbox"
                        checked={enc.playerScreenSettings?.hideScrollbars || false}
                        onChange={(e) => {
                          const updated = {
                            ...enc,
                            playerScreenSettings: {
                              ...enc.playerScreenSettings,
                              hideScrollbars: e.target.checked
                            }
                          };
                          setEnc(updated);
                          apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                        }}
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600"
                      />
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Hides scrollbars for a cleaner display
                    </p>
                  </div>

                  {/* Zoom Level Control */}
                  <div>
                    <label className="text-sm text-slate-700 dark:text-slate-300 block mb-2">
                      Zoom Level: {Math.round((enc.playerScreenSettings?.zoom || 100))}%
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      step="10"
                      value={enc.playerScreenSettings?.zoom || 100}
                      onChange={(e) => {
                        const updated = {
                          ...enc,
                          playerScreenSettings: {
                            ...enc.playerScreenSettings,
                            zoom: parseInt(e.target.value)
                          }
                        };
                        setEnc(updated);
                        apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>50%</span>
                      <span>200%</span>
                    </div>
                  </div>

                  <hr className="border-slate-200 dark:border-slate-700" />

                  {/* Bloodied Status Toggle */}
                  <div>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-slate-700 dark:text-slate-300">🩸 Bloodied Status anzeigen</span>
                      <input
                        type="checkbox"
                        checked={enc.playerScreenSettings?.showBloodiedInPlayerView || false}
                        onChange={(e) => {
                          const updated = {
                            ...enc,
                            playerScreenSettings: {
                              ...enc.playerScreenSettings,
                              showBloodiedInPlayerView: e.target.checked
                            }
                          };
                          setEnc(updated);
                          apiPut(`/api/encounters/${enc.id}`, updated).catch(console.error);
                        }}
                        className="w-5 h-5"
                      />
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Zeigt die rote Border-Animation bei Kreaturen unter 50% HP
                    </p>
                  </div>
                </div>
              </div>
            )}

        {/* Middle Column - Creature Database (Prep Mode only) */}
        {!combatMode && (
          <div className="space-y-4">
            <div className="card bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 h-[calc(100vh-120px)] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h2 className="text-xl font-bold text-green-900 dark:text-green-300">
                  🐉 Creature Database
                </h2>
                <div className="flex gap-2">
                  <button
                    className="btn bg-purple-600 text-white hover:bg-purple-700 border-purple-600 text-xs px-2 py-1"
                    onClick={() => {
                      setEditingCreature(null);
                      setCreatureManagerInitialTab("players");
                      setShowCreatureManager(true);
                    }}
                    title="Player Characters"
                  >
                    👥
                  </button>
                  <button
                    disabled={isCompleted}
                    className={`btn bg-orange-500 text-white hover:bg-orange-600 border-orange-500 text-xs px-2 py-1 ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={addCustom}
                    title="Add Custom Creature"
                  >
                    ➕
                  </button>
                  <button
                    className="btn bg-green-600 text-white hover:bg-green-700 border-green-600 text-xs px-2 py-1"
                    onClick={() => {
                      setEditingCreature(null);
                      setShowCreatureManager(true);
                    }}
                    title="Manage Creatures"
                  >
                    ⚙️
                  </button>
                </div>
              </div>

              {/* Campaign Players Quick Add */}
              {campaigns.length > 0 && enc && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 flex-shrink-0">
                  <div className="flex gap-2 items-center">
                    <select
                      value={selectedCampaignForBulkAdd || ''}
                      onChange={(e) => setSelectedCampaignForBulkAdd(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="">Kampagne wählen...</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedCampaignForBulkAdd) {
                          addCampaignPlayersToEncounter(selectedCampaignForBulkAdd);
                        }
                      }}
                      disabled={!selectedCampaignForBulkAdd || !enc || isAddingCampaignPlayers}
                      className="btn bg-blue-600 text-white hover:bg-blue-700 border-blue-600 text-xs px-3 py-1 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[80px]"
                    >
                      {isAddingCampaignPlayers ? (
                        <span className="inline-block animate-spin">⏳</span>
                      ) : (
                        '+ Spieler'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Monster Browser - takes remaining space */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <MonsterBrowser
                  onPick={addMonster}
                  onEdit={(monster) => {
                    setEditingCreature(monster);
                    setShowCreatureManager(true);
                  }}
                  RollableText={RollableText}
                  combatMode={combatMode}
                  selectedCombatant={selectedCombatant}
                />
              </div>
            </div>
          </div>
        )}

        {/* Middle/Right Column - Initiative Tracker (Combat) or Encounter Details (Prep) */}
        <section className="space-y-4 transition-all duration-500 ease-in-out">
          {!enc ? (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">⚔️</div>
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                No encounter selected
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Create a new encounter or select one from the sidebar
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Encounter Header - Compact in Combat Mode */}
              {!combatMode && (
                <div className="card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      className="input flex-1 min-w-[200px] text-xl font-bold"
                      value={enc.name}
                      onChange={(e) => setEnc({ ...enc, name: e.target.value })}
                      placeholder="Encounter Name"
                    />
                    <button
                      className="btn bg-blue-500 text-white hover:bg-blue-600 border-blue-500 flex items-center gap-1"
                      onClick={async () => {
                        await save(enc);
                      }}
                      title="Speichern"
                    >
                      💾 Save
                    </button>
                  </div>
                </div>
              )}

              {/* Participants/Initiative - Always on right */}
              {order.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-slate-500 dark:text-slate-400">
                    No combatants yet. Add monsters or custom combatants to
                    start!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Round Counter - Only in Combat Mode */}
                  {combatMode && (
                    <div className="sticky top-[4.5rem] z-[5] card bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/90 dark:to-amber-900/90 border-orange-200 dark:border-orange-700 shadow-lg">
                      <div className="flex items-center gap-6 justify-center">
                        <button
                          disabled={isCompleted}
                          className={`w-10 h-10 flex items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800 hover:bg-orange-300 dark:hover:bg-orange-700 transition-colors text-orange-700 dark:text-orange-300 font-bold ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={prevTurn}
                        >
                          ◀
                        </button>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wide">
                              Round
                            </div>
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                              {enc.round}
                            </div>
                          </div>
                          <div className="w-px h-10 bg-orange-300 dark:bg-orange-700"></div>
                          <div className="text-center">
                            <div className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wide">
                              Turn
                            </div>
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                              {enc.turnIndex + 1}/{order.length}
                            </div>
                          </div>
                        </div>
                        <button
                          disabled={isCompleted}
                          className={`w-10 h-10 flex items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800 hover:bg-orange-300 dark:hover:bg-orange-700 transition-colors text-orange-700 dark:text-orange-300 font-bold ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={nextTurn}
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Combatants - Show differently based on mode */}
                  {combatMode ? (
                    /* Combat Mode - Full detailed cards */
                    <div className="grid gap-4">
                      {order.map((c, idx) => (
                        <div key={c.id} className={c.sidekickOf ? 'ml-12' : ''}>
                          <CombatantRow
                            c={c}
                            idx={idx}
                            active={
                              enc.initiativeOrder[idx] ===
                              enc.initiativeOrder[enc.turnIndex]
                            }
                            isSelected={selectedCombatantId === c.id}
                            onSelect={() =>
                              setSelectedCombatantId(
                                selectedCombatantId === c.id ? null : c.id
                              )
                            }
                            onChange={(patch) => updateCombatant(c.id, patch)}
                            onDamage={(amount) => applyDamage(c.id, amount)}
                            combatMode={combatMode}
                            allPlayers={order.filter(p => p.player)}
                            hpManagement={hpManagement}
                            conditionsData={conditionsData}
                            getConditionTooltipHandlers={getConditionTooltipHandlers}
                            setSelectedCondition={setSelectedCondition}
                            setConditionName={setConditionName}
                            setShowConditionModal={setShowConditionModal}
                            settings={settings}
                            isCompleted={isCompleted}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Prep Mode - Compact list */
                    <div className="card">
                      <h2 className="text-lg font-semibold mb-3">
                        📋 Participants
                      </h2>
                      <div className="space-y-1">
                        {order.map((c, idx) => (
                          <CompactParticipantRow
                            key={c.id}
                            c={c}
                            idx={idx}
                            active={
                              enc.initiativeOrder[idx] ===
                              enc.initiativeOrder[enc.turnIndex]
                            }
                            isSelected={selectedCombatantId === c.id}
                            onSelect={() =>
                              setSelectedCombatantId(
                                selectedCombatantId === c.id ? null : c.id
                              )
                            }
                            showDelete={!combatMode && !isCompleted}
                            onDelete={() => deleteCombatant(c.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column - Combatant Details (Combat only) */}
        {combatMode && (
          <aside className="space-y-4">
            {selectedCombatant && !selectedCombatant.isLair ? (
              <div className="card h-[calc(100vh-120px)] overflow-y-auto">
                {/* This will be moved from the fixed overlay below */}
                <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                  Combatant Details (wird hierher verschoben)
                </div>
              </div>
            ) : (
              <div className="card h-[calc(100vh-120px)] overflow-y-auto">
                <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                  Select a combatant to view details
                </div>
              </div>
            )}
          </aside>
        )}

      </main>

      {/* Recharge Notifications - Top Right */}
      {rechargeNotifications.length > 0 && (
        <div className="fixed top-20 right-6 z-50 space-y-2 max-w-md">
          {rechargeNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`card shadow-2xl border-2 animate-[slideInFromRight_0.3s_ease-out] ${
                notification.success
                  ? 'bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-600'
                  : 'bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">
                  {notification.success ? '✅' : '❌'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm mb-1 ${
                    notification.success
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {notification.success ? 'Recharged!' : 'Not Recharged'}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 break-words">
                    {notification.message}
                  </div>
                </div>
                <button
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0"
                  onClick={() => {
                    setRechargeNotifications(prev =>
                      prev.filter(n => n.id !== notification.id)
                    );
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dice Roll Toast - Right of the button - 384px width */}
      {diceRollResult && diceRollResult.type === "generic" && (
        <div
          className="fixed bottom-6 left-24 z-40"
          style={{
            animation: "slideInFromBottom 0.25s ease-out, fadeOutScale 0.3s ease-in 2.7s forwards",
          }}
        >
          <div className="relative bg-slate-800 dark:bg-slate-900 border-2 border-slate-700 dark:border-slate-600 rounded-2xl shadow-2xl p-4 w-96 overflow-hidden">
            {/* Close button */}
            <button
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full hover:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-xs"
              onClick={() => {
                setDiceRollResult(null);
                if (toastDismissTimer) clearTimeout(toastDismissTimer);
              }}
            >
              ✕
            </button>

            {/* Header */}
            <div className="flex items-center justify-between mb-2 pr-6">
              <div className="flex items-center gap-1.5">
                <span className="text-lg">🎲</span>
                {diceRollResult.label && (
                  <span className="text-sm font-bold text-blue-300">{diceRollResult.label}</span>
                )}
                {diceRollResult.character && (
                  <span className="text-xs text-slate-400">({diceRollResult.character})</span>
                )}
                <span className="font-mono text-xs text-blue-400 dark:text-blue-300 font-bold">
                  {diceRollResult.notation}
                </span>
              </div>
              {diceRollResult.rollMode &&
                diceRollResult.rollMode !== "normal" && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      diceRollResult.rollMode === "advantage"
                        ? "bg-green-600"
                        : "bg-red-600"
                    } text-white font-semibold`}
                  >
                    {diceRollResult.rollMode === "advantage" ? "ADV" : "DIS"}
                  </span>
                )}
            </div>

            {/* Calculation breakdown - same as in history */}
            {diceRollResult.rolls &&
              diceRollResult.rolls.length > 0 &&
              (() => {
                const modifierMatch =
                  diceRollResult.notation?.match(/([+-]\d+)$/);
                const modifier = modifierMatch ? parseInt(modifierMatch[1]) : 0;
                const diceTotal = diceRollResult.rolls.reduce(
                  (sum, val) => sum + val,
                  0
                );

                return (
                  <div className="mb-2 text-center">
                    <div className="text-sm text-slate-300 dark:text-slate-400 font-mono">
                      {diceRollResult.rolls.length > 1 ? (
                        <>
                          [{diceRollResult.rolls.join(" + ")}]
                          {modifier !== 0 &&
                            ` ${modifier >= 0 ? "+" : ""}${modifier}`}
                          {" = "}
                          {diceTotal}
                          {modifier !== 0 &&
                            ` ${modifier >= 0 ? "+" : ""}${modifier} = ${
                              diceRollResult.total
                            }`}
                        </>
                      ) : (
                        <>
                          {diceRollResult.rolls[0]}
                          {modifier !== 0 &&
                            ` ${modifier >= 0 ? "+" : ""}${modifier} = ${
                              diceRollResult.total
                            }`}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* Total */}
            <div className="text-center mb-1">
              <div className="text-4xl font-bold text-white">
                {diceRollResult.total}
              </div>
              {diceRollResult.rechargeResult && (
                <div
                  className={`text-sm font-semibold mt-2 ${
                    diceRollResult.rechargeResult.includes("✅")
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {diceRollResult.rechargeResult}
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/50">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-[shrinkWidth_3s_linear]"></div>
            </div>
          </div>
        </div>
      )}

      {/* Other roll notifications (concentration, death saves) */}
      {diceRollResult && diceRollResult.type !== "generic" && (
        <div className="fixed top-20 right-1/2 translate-x-1/2 z-40 animate-[bounceIn_0.4s_cubic-bezier(0.68,-0.55,0.265,1.55)]">
          <div
            className={`card min-w-[300px] ${
              diceRollResult.passed !== undefined
                ? diceRollResult.passed
                  ? "bg-green-50 dark:bg-green-900 border-green-300 dark:border-green-700"
                  : "bg-red-50 dark:bg-red-900 border-red-300 dark:border-red-700"
                : "bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-700"
            }`}
          >
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {diceRollResult.type === "concentration" &&
                  "🎲 Concentration Check"}
                {diceRollResult.type === "deathSave" && "💀 Death Save"}
              </div>
              {diceRollResult.name && (
                <div className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                  {diceRollResult.name}
                </div>
              )}

              {/* For PC/Sidekick concentration checks - show only DC */}
              {diceRollResult.isPlayerCharacter && diceRollResult.type === "concentration" ? (
                <>
                  <div className="text-lg text-slate-700 dark:text-slate-300 mb-2">
                    Concentration check required!
                  </div>
                  <div className="mb-2">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                      Difficulty Class (DC):
                    </div>
                    <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                      {diceRollResult.dc}
                    </div>
                  </div>
                  {diceRollResult.modifier !== 0 && (
                    <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                      Constitution Mod: {diceRollResult.modifier >= 0 ? '+' : ''}{diceRollResult.modifier}
                    </div>
                  )}
                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 italic">
                    Player must roll this check themselves
                  </div>
                </>
              ) : (
                <>
                  {/* Original display for NPCs and other rolls */}
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {diceRollResult.roll}
                    </span>
                    {diceRollResult.modifier && diceRollResult.modifier !== 0 && (
                      <>
                        <span className="text-xl text-slate-400">+</span>
                        <span className="text-2xl font-semibold">
                          {diceRollResult.modifier}
                        </span>
                      </>
                    )}
                    {diceRollResult.total && (
                      <>
                        <span className="text-xl text-slate-400">=</span>
                        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                          {diceRollResult.total}
                        </span>
                      </>
                    )}
                  </div>
                  {diceRollResult.dc && (
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      DC {diceRollResult.dc} •{" "}
                      {diceRollResult.passed ? "✅ Success" : "❌ Failed"}
                    </div>
                  )}
                  {!diceRollResult.passed &&
                    diceRollResult.type === "concentration" && (
                      <div className="mt-2 text-sm text-red-700 dark:text-red-300 font-medium">
                        Concentration lost!
                      </div>
                    )}
                  {diceRollResult.critical &&
                    diceRollResult.type === "deathSave" && (
                      <div
                        className={`mt-2 text-sm font-medium ${
                          diceRollResult.passed
                            ? "text-green-700 dark:text-green-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {diceRollResult.passed
                          ? "🎉 Natural 20! Regain 1 HP"
                          : "💀 Natural 1! Two failures"}
                      </div>
                    )}
                </>
              )}

              {/* Different buttons for PC concentration checks vs other rolls */}
              {diceRollResult.isPlayerCharacter && diceRollResult.type === "concentration" ? (
                <>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        // Player succeeded - just dismiss
                        setDiceRollResult(null);
                      }}
                    >
                      ✅ Success
                    </button>
                    <button
                      className="btn flex-1 bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => {
                        // Player failed - remove concentration
                        if (diceRollResult.combatantId) {
                          updateCombatant(diceRollResult.combatantId, { concentration: false });
                        }
                        setDiceRollResult(null);
                      }}
                    >
                      ❌ Failure
                    </button>
                  </div>
                  <button
                    className="mt-2 btn w-full bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500"
                    onClick={() => setDiceRollResult(null)}
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <button
                  className="mt-3 btn w-full"
                  onClick={() => setDiceRollResult(null)}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dice Roller - 2D or 3D based on settings */}
      {showDiceRoller && settings.diceRollerType === "2d" && (
        <FantasticDiceRoller
          initialNotation={diceRollerInitialNotation}
          autoRoll={diceRollerAutoRoll}
          initialRollMode={diceRollerInitialRollMode}
          dddiceInstance={dddiceRef.current}
          dddiceReady={dddiceReady}
          onClose={() => {
            setShowDiceRoller(false);
            setDiceRollerInitialNotation(null);
            setDiceRollerAutoRoll(false);
            setDiceRollerInitialRollMode("normal");
            setDiceRollerLabel('');
            setDiceRollerCharacter('');
          }}
          onResult={(result) => {
            // Check if this is an auto-recharge roll (from Next Turn)
            if (window._pendingAutoRecharge && result.notation === "1d6") {
              const {
                actionName,
                combatantName,
                rechargeTrigger,
                combatantId,
                rechargeKey,
                rechargeAbilities,
              } = window._pendingAutoRecharge;
              const roll = result.total; // Use the REAL dice roller result
              const success = roll >= rechargeTrigger;

              // Update combatant recharge status with REAL result
              updateCombatant(combatantId, {
                rechargeAbilities: { ...rechargeAbilities, [rechargeKey]: success },
              });

              // Show result notification with full context
              const rollResult = {
                type: "generic",
                roll: result.rolls[0],
                total: result.total,
                rolls: result.rolls,
                notation: `${combatantName}: ${actionName} (Recharge ${rechargeTrigger}+)`,
                rollMode: result.rollMode,
                timestamp: Date.now(),
                rechargeResult: success ? "✅ Recharged!" : "❌ Not recharged",
              };
              setDiceRollResult(rollResult);
              setRollHistory((prev) => [rollResult, ...prev].slice(0, 10));

              // Clear auto-recharge context
              delete window._pendingAutoRecharge;

              // Auto-dismiss after 3 seconds
              if (toastDismissTimer) clearTimeout(toastDismissTimer);
              const timer = setTimeout(() => {
                setDiceRollResult(null);
              }, 3000);
              setToastDismissTimer(timer);
            }
            // Check if this is a manual recharge roll (from detail panel)
            else if (window._pendingRecharge && result.notation === "1d6") {
              const { combatantId, rechargeKey, rechargeTrigger, rechargeAbilities } =
                window._pendingRecharge;
              const roll = result.total;
              const success = roll >= rechargeTrigger;

              // Update combatant
              updateCombatant(combatantId, {
                rechargeAbilities: { ...rechargeAbilities, [rechargeKey]: success },
              });

              // Show result notification
              const rollResult = {
                type: "generic",
                roll: result.rolls[0],
                total: result.total,
                rolls: result.rolls,
                notation: `${result.notation} (Recharge ${rechargeTrigger}+)`,
                rollMode: result.rollMode,
                timestamp: Date.now(),
                rechargeResult: success ? "✅ Recharged!" : "❌ Not recharged",
              };
              setDiceRollResult(rollResult);
              setRollHistory((prev) => [rollResult, ...prev].slice(0, 10));

              // Clear pending recharge
              delete window._pendingRecharge;

              // Auto-dismiss after 3 seconds
              if (toastDismissTimer) clearTimeout(toastDismissTimer);
              const timer = setTimeout(() => {
                setDiceRollResult(null);
              }, 3000);
              setToastDismissTimer(timer);
            } else {
              // Normal roll
              const rollResult = {
                type: "generic",
                roll: result.rolls[0],
                total: result.total,
                rolls: result.rolls,
                notation: result.notation,
                rollMode: result.rollMode,
                label: diceRollerLabel,
                character: diceRollerCharacter,
                timestamp: Date.now(),
              };

              // Check if we should delay the toast (for dice animation to finish)
              const toastDelay = result.__delayToast || 0;

              if (toastDelay > 0) {
                // Wait for animation to complete before showing toast
                setTimeout(() => {
                  setDiceRollResult(rollResult);
                  // Add to history (keep last 10 rolls)
                  setRollHistory((prev) => [rollResult, ...prev].slice(0, 10));

                  // Auto-dismiss after 3 seconds
                  if (toastDismissTimer) clearTimeout(toastDismissTimer);
                  const timer = setTimeout(() => {
                    setDiceRollResult(null);
                  }, 3000);
                  setToastDismissTimer(timer);
                }, toastDelay);
              } else {
                // Show immediately (for 3D dice or other cases)
                setDiceRollResult(rollResult);
                // Add to history (keep last 10 rolls)
                setRollHistory((prev) => [rollResult, ...prev].slice(0, 10));

                // Auto-dismiss after 3 seconds
                if (toastDismissTimer) clearTimeout(toastDismissTimer);
                const timer = setTimeout(() => {
                  setDiceRollResult(null);
                }, 3000);
                setToastDismissTimer(timer);
              }
            }
          }}
        />
      )}

      {/* 3D Dice Roller */}
      {showDiceRoller && settings.diceRollerType === "3d" && (
        <DiceRollerDDDice
          initialNotation={diceRollerInitialNotation}
          initialRollMode={diceRollerInitialRollMode}
          dddiceInstance={dddiceRef.current}
          dddiceReady={dddiceReady}
          autoRoll={diceRollerAutoRoll}
          onClose={() => {
            setShowDiceRoller(false);
            setDiceRollerInitialNotation(null);
            setDiceRollerAutoRoll(false);
            setDiceRollerInitialRollMode("normal");
          }}
          onResult={(result) => {
            // Check if this is an auto-recharge roll (from Next Turn)
            if (window._pendingAutoRecharge && result.notation === "1d6") {
              const {
                actionName,
                combatantName,
                rechargeTrigger,
                combatantId,
                rechargeKey,
                rechargeAbilities,
              } = window._pendingAutoRecharge;
              const roll = result.total;
              const success = roll >= rechargeTrigger;

              updateCombatant(combatantId, {
                rechargeAbilities: { ...rechargeAbilities, [rechargeKey]: success },
              });

              const rollResult = {
                type: "generic",
                roll: result.rolls[0],
                total: result.total,
                rolls: result.rolls,
                notation: `${combatantName}: ${actionName} (Recharge ${rechargeTrigger}+)`,
                rollMode: result.rollMode,
                timestamp: Date.now(),
                rechargeResult: success ? "✅ Recharged!" : "❌ Not recharged",
              };
              setDiceRollResult(rollResult);
              setRollHistory((prev) => [rollResult, ...prev].slice(0, 10));

              delete window._pendingAutoRecharge;

              if (toastDismissTimer) clearTimeout(toastDismissTimer);
              const timer = setTimeout(() => {
                setDiceRollResult(null);
              }, 3000);
              setToastDismissTimer(timer);
            } else {
              const rollResult = {
                type: "generic",
                roll: result.rolls[0],
                total: result.total,
                rolls: result.rolls,
                notation: result.notation,
                rollMode: result.rollMode,
                label: diceRollerLabel,
                character: diceRollerCharacter,
                timestamp: Date.now(),
              };
              setDiceRollResult(rollResult);
              setRollHistory((prev) => [rollResult, ...prev].slice(0, 10));

              if (toastDismissTimer) clearTimeout(toastDismissTimer);
              const timer = setTimeout(() => {
                setDiceRollResult(null);
              }, 3000);
              setToastDismissTimer(timer);
            }
          }}
        />
      )}

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 left-6 z-30 flex flex-col gap-3">
        <button
          className="dice-roller-button w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl transition-all hover:scale-110 active:scale-95"
          onClick={() => setShowDiceRoller(!showDiceRoller)}
          title="Dice Roller"
        >
          🎲
        </button>
        {rollHistory.length > 0 && (
          <button
            className="roll-history-button w-12 h-12 bg-slate-700 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 text-white rounded-full shadow-xl flex items-center justify-center text-lg transition-all hover:scale-110 active:scale-95 relative"
            onClick={() => setShowRollHistory(!showRollHistory)}
            title="Roll History"
          >
            📜
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {rollHistory.length}
            </span>
          </button>
        )}
      </div>

      {/* Roll History Panel */}
      {showRollHistory && (
        <div className="roll-history-container fixed bottom-24 left-6 z-40 bg-slate-800/98 dark:bg-slate-900/98 backdrop-blur-lg border-2 border-slate-700 dark:border-slate-600 rounded-2xl shadow-2xl p-4 w-80 max-h-96 overflow-y-auto animate-[slideInLeft_0.3s_ease-out]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-lg">Roll History</h3>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                onClick={async () => {
                  if (
                    await confirm(
                      "Möchtest du die gesamte Würfel-Historie wirklich löschen?"
                    )
                  ) {
                    setRollHistory([]);
                  }
                }}
                title="Clear History"
              >
                Clear
              </button>
              <button
                className="w-6 h-6 rounded-full hover:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowRollHistory(false)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {rollHistory.map((roll, index) => (
              <div
                key={roll.timestamp}
                className="bg-slate-700/50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-600 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {roll.label && (
                        <span className="text-sm font-bold text-blue-300">{roll.label}</span>
                      )}
                      {roll.character && (
                        <span className="text-xs text-slate-400">({roll.character})</span>
                      )}
                      <span className="font-mono text-xs text-blue-400 dark:text-blue-300 font-semibold">
                        {roll.notation}
                      </span>
                      {roll.rollMode && roll.rollMode !== "normal" && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            roll.rollMode === "advantage"
                              ? "bg-green-600"
                              : "bg-red-600"
                          } text-white font-semibold`}
                        >
                          {roll.rollMode === "advantage" ? "ADV" : "DIS"}
                        </span>
                      )}
                    </div>
                    {roll.rolls &&
                      roll.rolls.length > 0 &&
                      (() => {
                        const modifierMatch =
                          roll.notation?.match(/([+-]\d+)$/);
                        const modifier = modifierMatch
                          ? parseInt(modifierMatch[1])
                          : 0;
                        const diceTotal = roll.rolls.reduce(
                          (sum, val) => sum + val,
                          0
                        );

                        return (
                          <div className="text-xs text-slate-300 dark:text-slate-400 font-mono">
                            {roll.rolls.length > 1 ? (
                              <>
                                [{roll.rolls.join(" + ")}]
                                {modifier !== 0 &&
                                  ` ${modifier >= 0 ? "+" : ""}${modifier}`}
                                {" = "}
                                {diceTotal}
                                {modifier !== 0 &&
                                  ` ${modifier >= 0 ? "+" : ""}${modifier} = ${
                                    roll.total
                                  }`}
                              </>
                            ) : (
                              <>
                                {roll.rolls[0]}
                                {modifier !== 0 &&
                                  ` ${modifier >= 0 ? "+" : ""}${modifier} = ${
                                    roll.total
                                  }`}
                              </>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                  <div className="text-3xl font-bold text-white tabular-nums">
                    {roll.total}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spell Tooltip (Hover) */}
      {spellTooltip.spell && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border-2 border-purple-500 dark:border-purple-700 p-4 max-h-96 overflow-y-auto pointer-events-none"
          style={(() => {
            const tooltipWidth = 634;
            const tooltipHeight = 400; // max-h-96 (384px) + padding
            const offset = 15;
            const padding = 10; // padding from screen edge

            let left = spellTooltip.x + offset;
            let top = spellTooltip.y + offset;

            // Check right edge
            if (left + tooltipWidth > window.innerWidth - padding) {
              left = spellTooltip.x - tooltipWidth - offset;
            }

            // Check left edge
            if (left < padding) {
              left = padding;
            }

            // Check bottom edge
            if (top + tooltipHeight > window.innerHeight - padding) {
              top = spellTooltip.y - tooltipHeight - offset;
            }

            // Check top edge
            if (top < padding) {
              top = padding;
            }

            return {
              left: `${left}px`,
              top: `${top}px`,
              width: "634px",
              maxWidth: "90vw",
            };
          })()}
        >
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg font-bold text-purple-900 dark:text-purple-300">
                {spellTooltip.spell.name}
              </h3>
              <span className="text-xs text-purple-700 dark:text-purple-400">
                {spellTooltip.spell.level === 0
                  ? "Cantrip"
                  : `Level ${spellTooltip.spell.level}`}
                {spellTooltip.spell.school && ` • ${spellTooltip.spell.school.charAt(0).toUpperCase() + spellTooltip.spell.school.slice(1)}`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-t border-purple-200 dark:border-purple-800 pt-2">
              <div>
                <span className="font-semibold text-purple-800 dark:text-purple-300">
                  Casting:
                </span>
                <span className="ml-1 text-slate-700 dark:text-slate-300">
                  {(() => {
                    let castingTime = "";
                    // encounterpp format
                    if (spellTooltip.spell.castingTime) {
                      castingTime = spellTooltip.spell.castingTime;
                    }
                    // 5e.tools format fallback
                    else if (spellTooltip.spell.time?.[0]) {
                      castingTime = `${spellTooltip.spell.time[0].number} ${spellTooltip.spell.time[0].unit}`;
                    } else {
                      return "—";
                    }
                    // Capitalize first letter
                    return castingTime.charAt(0).toUpperCase() + castingTime.slice(1);
                  })()}
                </span>
              </div>
              <div>
                <span className="font-semibold text-purple-800 dark:text-purple-300">
                  Range:
                </span>
                <span className="ml-1 text-slate-700 dark:text-slate-300">
                  {(() => {
                    // encounterpp format (already a string)
                    if (typeof spellTooltip.spell.range === "string") {
                      return spellTooltip.spell.range;
                    }

                    // 5e.tools format fallback
                    const range = spellTooltip.spell.range;
                    if (!range) return "—";

                    // Handle point-based range
                    if (range.type === "point") {
                      const dist = range.distance;
                      if (dist.type === "self") {
                        return "Self";
                      }
                      if (dist.amount) {
                        return `${dist.amount} ${dist.type}`;
                      }
                      return dist.type;
                    }

                    // Handle area effects (cone, line, sphere, cube, etc.)
                    if (
                      range.type === "cone" ||
                      range.type === "line" ||
                      range.type === "sphere" ||
                      range.type === "cube" ||
                      range.type === "hemisphere" ||
                      range.type === "radius"
                    ) {
                      const dist = range.distance;
                      if (dist && dist.amount) {
                        return `Self (${dist.amount}-${dist.type} ${range.type})`;
                      }
                      return `Self (${range.type})`;
                    }

                    return range.type === "self" ? "Self" : range.type;
                  })()}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 border-t border-purple-200 dark:border-purple-800 pt-2 max-h-48 overflow-y-auto">
              {(() => {
                // Helper function to remove dice notation and 5etools tags
                const cleanText = (text) => {
                  if (!text) return "";
                  return (
                    text
                      // Remove 5etools tags like {@damage 2d8}, {@spell fireball}, etc.
                      .replace(/\{@[^}]+\}/g, (match) => {
                        const textMatch = match.match(
                          /\{@\w+\s+([^}|]+)(?:\|[^}]+)?\}/
                        );
                        return textMatch ? textMatch[1] : match;
                      })
                      // Remove table dict notation
                      .replace(/\{'type':\s*'table'[^}]*\}/g, "[Table]")
                      // Clean up extra whitespace
                      .replace(/\s+/g, " ")
                      .trim()
                  );
                };

                // encounterpp format
                if (spellTooltip.spell.description) {
                  return (
                    <p className="leading-relaxed">
                      {cleanText(spellTooltip.spell.description)}
                    </p>
                  );
                }
                // 5e.tools format fallback
                if (spellTooltip.spell.entries?.[0]) {
                  return (
                    <p className="leading-relaxed">
                      {typeof spellTooltip.spell.entries[0] === "string"
                        ? cleanText(spellTooltip.spell.entries[0])
                        : ""}
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-purple-200 dark:border-purple-800 pt-1">
              {(() => {
                // encounterpp format
                if (spellTooltip.spell.meta?.source) {
                  return `${spellTooltip.spell.meta.source}${
                    spellTooltip.spell.meta.page
                      ? ` p${spellTooltip.spell.meta.page}`
                      : ""
                  }`;
                }
                // 5e.tools format fallback
                return `${spellTooltip.spell.source || ""}${
                  spellTooltip.spell.page ? ` p${spellTooltip.spell.page}` : ""
                }`;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Condition Tooltip (Hover) */}
      {conditionTooltip.condition && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border-2 border-amber-500 dark:border-amber-700 p-4 max-h-96 overflow-y-auto pointer-events-none"
          style={(() => {
            const tooltipWidth = 500;
            const tooltipHeight = 400; // max-h-96 (384px) + padding
            const offset = 15;
            const padding = 10; // padding from screen edge

            let left = conditionTooltip.x + offset;
            let top = conditionTooltip.y + offset;

            // Check right edge
            if (left + tooltipWidth > window.innerWidth - padding) {
              left = conditionTooltip.x - tooltipWidth - offset;
            }

            // Check left edge
            if (left < padding) {
              left = padding;
            }

            // Check bottom edge
            if (top + tooltipHeight > window.innerHeight - padding) {
              top = conditionTooltip.y - tooltipHeight - offset;
            }

            // Check top edge
            if (top < padding) {
              top = padding;
            }

            return {
              left: `${left}px`,
              top: `${top}px`,
              width: "500px",
              maxWidth: "90vw",
            };
          })()}
        >
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300">
                {conditionTooltip.name || "Condition"}
              </h3>
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Condition
              </span>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 border-t border-amber-200 dark:border-amber-800 pt-2 max-h-64 overflow-y-auto">
              {(() => {
                const { legacy, reprinted } = conditionTooltip.condition;

                // Helper function to parse all entries (not just first)
                const parseEntries = (entries) => {
                  if (!entries || !entries.length) return null;

                  const cleanText = (text) => {
                    if (!text) return "";
                    return text
                      .replace(/\{@[^}]+\}/g, (match) => {
                        const textMatch = match.match(/\{@\w+\s+([^}|]+)(?:\|[^}]+)?\}/);
                        return textMatch ? textMatch[1] : match;
                      })
                      .trim();
                  };

                  const elements = [];

                  entries.forEach((entry, idx) => {
                    if (typeof entry === "string") {
                      elements.push(
                        <p key={idx} className="leading-relaxed mb-1">
                          {cleanText(entry)}
                        </p>
                      );
                    } else if (entry.type === "list" && entry.items) {
                      elements.push(
                        <ul key={idx} className="list-disc list-inside space-y-0.5 mb-1">
                          {entry.items.map((item, itemIdx) => (
                            <li key={itemIdx} className="leading-relaxed">{cleanText(item)}</li>
                          ))}
                        </ul>
                      );
                    } else if (entry.type === "entries" && entry.entries) {
                      entry.entries.forEach((subEntry, subIdx) => {
                        if (typeof subEntry === "string") {
                          elements.push(
                            <p key={`${idx}-${subIdx}`} className="leading-relaxed mb-1">
                              {cleanText(subEntry)}
                            </p>
                          );
                        } else if (subEntry.type === "entries") {
                          if (subEntry.name) {
                            elements.push(
                              <p key={`${idx}-${subIdx}`} className="leading-relaxed mb-1">
                                <span className="font-medium">{subEntry.name}:</span>{" "}
                                {cleanText(subEntry.entries?.join(" ") || "")}
                              </p>
                            );
                          }
                        }
                      });
                    }
                  });

                  return <div className="space-y-1">{elements}</div>;
                };

                // Check if both versions exist and are identical
                const areSame = legacy && reprinted &&
                  JSON.stringify(legacy.entries) === JSON.stringify(reprinted.entries);

                if (areSame) {
                  // Same content in both versions
                  return (
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between border-b border-amber-200 dark:border-amber-700 pb-1">
                        <div className="font-semibold text-amber-800 dark:text-amber-400 text-xs">
                          Legacy & Reprinted Rules
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          PHB p{legacy.page || "?"} / XPHB p{reprinted.page || "?"}
                        </div>
                      </div>
                      {parseEntries(legacy.entries)}
                    </div>
                  );
                } else if (legacy && reprinted) {
                  // Different content - clean separation with spacing only
                  return (
                    <>
                      <div>
                        <div className="flex items-baseline justify-between border-b border-blue-300 dark:border-blue-700 pb-1 mb-1.5">
                          <div className="font-semibold text-blue-700 dark:text-blue-400 text-xs">
                            Legacy Rules (5e2014)
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            PHB p{legacy.page || "?"}
                          </div>
                        </div>
                        {parseEntries(legacy.entries)}
                      </div>
                      <div className="mt-5">
                        <div className="flex items-baseline justify-between border-b border-green-300 dark:border-green-700 pb-1 mb-1.5">
                          <div className="font-semibold text-green-700 dark:text-green-400 text-xs">
                            Reprinted Rules (5e2024)
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            XPHB p{reprinted.page || "?"}
                          </div>
                        </div>
                        {parseEntries(reprinted.entries)}
                      </div>
                    </>
                  );
                } else if (reprinted) {
                  // Only reprinted version
                  return (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-700 text-right">
                        XPHB p{reprinted.page || "?"}
                      </div>
                      {parseEntries(reprinted.entries)}
                    </div>
                  );
                } else if (legacy) {
                  // Only legacy version
                  return (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-700 text-right">
                        PHB p{legacy.page || "?"}
                      </div>
                      {parseEntries(legacy.entries)}
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Source Tooltip (Hover) */}
      {sourceTooltip.source && (
        <div
          className="fixed z-50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-2xl border-2 border-blue-400 dark:border-blue-600 p-5 pointer-events-none"
          style={{
            left: `${sourceTooltip.x}px`,
            top: `${sourceTooltip.y}px`,
            width: "320px",
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                  Source Book
                </div>
                <div className="text-lg font-bold text-blue-900 dark:text-blue-100 leading-tight">
                  {sourceTooltip.fullName || sourceTooltip.source}
                </div>
              </div>
            </div>

            <div className="border-t-2 border-blue-200 dark:border-blue-800 pt-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2.5 py-1 bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 rounded-md font-mono font-semibold">
                  {sourceTooltip.source}
                </span>
                <span className="text-blue-600 dark:text-blue-400 text-xs">
                  abbreviation
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/50 rounded-lg px-3 py-2">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="leading-relaxed">
                Click to view all monsters from this source
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Initiative Tooltip */}
      {initiativeTooltip.show && (
        <div
          className="fixed z-50 bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 rounded-xl shadow-2xl border-2 border-blue-300 dark:border-blue-500 p-4 pointer-events-none animate-[fadeIn_0.15s_ease-out]"
          style={{
            right: `${window.innerWidth - initiativeTooltip.x + 15}px`,
            top: `${initiativeTooltip.y + 15}px`,
            minWidth: "240px",
          }}
        >
          <div className="space-y-3">
            {/* Title */}
            <div className="flex items-center gap-2 pb-2 border-b-2 border-white/30">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Initiative Roll
              </span>
            </div>

            {/* Roll Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-white">
                <span className="text-sm font-medium opacity-90">
                  🎲 d20 Roll:
                </span>
                <span className="text-xl font-bold px-3 py-1 bg-white/20 rounded-lg">
                  {initiativeTooltip.roll}
                </span>
              </div>

              <div className="flex items-center justify-center text-white text-lg">
                <span className="font-bold">+</span>
              </div>

              <div className="flex items-center justify-between text-white">
                <span className="text-sm font-medium opacity-90">
                  ⚡ Bonus:
                </span>
                <span className="text-xl font-bold px-3 py-1 bg-white/20 rounded-lg">
                  {initiativeTooltip.bonus >= 0 ? '+' : ''}{initiativeTooltip.bonus}
                </span>
              </div>

              <div className="border-t-2 border-white/30 pt-2 mt-2">
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm font-bold">
                    = Total:
                  </span>
                  <span className="text-2xl font-bold px-4 py-1 bg-white/30 rounded-lg shadow-lg">
                    {initiativeTooltip.total}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AC Tooltip */}
      {acTooltip.show && (
        <div
          className="fixed z-50 bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-700 dark:to-emerald-800 rounded-xl shadow-2xl border-2 border-green-300 dark:border-green-500 p-4 pointer-events-none animate-[fadeIn_0.15s_ease-out]"
          style={{
            right: `${window.innerWidth - acTooltip.x + 15}px`,
            top: `${acTooltip.y + 15}px`,
            minWidth: "220px",
          }}
        >
          <div className="space-y-3">
            {/* Title */}
            <div className="flex items-center gap-2 pb-2 border-b-2 border-white/30">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Armor Class
              </span>
            </div>

            {/* AC Value */}
            <div className="flex items-center justify-center">
              <span className="text-4xl font-bold text-white px-4 py-2 bg-white/20 rounded-lg shadow-lg">
                {acTooltip.ac}
              </span>
            </div>

            {/* Armor Type */}
            {acTooltip.armorType && Array.isArray(acTooltip.armorType) && acTooltip.armorType.length > 0 && (
              <div className="border-t-2 border-white/30 pt-2">
                <div className="text-white text-sm">
                  <span className="font-semibold opacity-90">🛡️ Source:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {acTooltip.armorType.map((source, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-white/20 rounded text-xs font-medium"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HP Tooltip */}
      {hpTooltip.show && (
        <div
          className="fixed z-50 bg-gradient-to-br from-red-500 to-rose-600 dark:from-red-700 dark:to-rose-800 rounded-xl shadow-2xl border-2 border-red-300 dark:border-red-500 p-4 pointer-events-none animate-[fadeIn_0.15s_ease-out]"
          style={{
            right: `${window.innerWidth - hpTooltip.x + 15}px`,
            top: `${hpTooltip.y + 15}px`,
            minWidth: "240px",
          }}
        >
          <div className="space-y-3">
            {/* Title */}
            <div className="flex items-center gap-2 pb-2 border-b-2 border-white/30">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Hit Points
              </span>
            </div>

            {/* HP Values */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-white">
                <span className="text-sm font-medium opacity-90">
                  ❤️ Current:
                </span>
                <span className="text-xl font-bold px-3 py-1 bg-white/20 rounded-lg">
                  {hpTooltip.current}
                </span>
              </div>

              <div className="flex items-center justify-between text-white">
                <span className="text-sm font-medium opacity-90">
                  💪 Maximum:
                </span>
                <span className="text-xl font-bold px-3 py-1 bg-white/20 rounded-lg">
                  {hpTooltip.max}
                </span>
              </div>

              {/* Temp HP */}
              {hpTooltip.tempHP > 0 && (
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm font-medium opacity-90">
                    🛡️ Temp HP:
                  </span>
                  <span className="text-xl font-bold px-3 py-1 bg-blue-500/40 rounded-lg">
                    {hpTooltip.tempHP}
                  </span>
                </div>
              )}

              {/* Max HP Modifier */}
              {hpTooltip.maxHPModifier && hpTooltip.maxHPModifier !== 0 && (
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm font-medium opacity-90">
                    ✨ Max HP Mod:
                  </span>
                  <span className={`text-xl font-bold px-3 py-1 rounded-lg ${hpTooltip.maxHPModifier > 0 ? 'bg-green-500/40' : 'bg-red-500/40'}`}>
                    {hpTooltip.maxHPModifier > 0 ? '+' : ''}{hpTooltip.maxHPModifier}
                  </span>
                </div>
              )}

              {/* Effective Max HP */}
              {hpTooltip.maxHPModifier && hpTooltip.maxHPModifier !== 0 && (
                <div className="flex items-center justify-between text-white border-t border-white/30 pt-2">
                  <span className="text-sm font-medium opacity-90">
                    💫 Effective Max:
                  </span>
                  <span className="text-xl font-bold px-3 py-1 bg-purple-500/40 rounded-lg">
                    {hpTooltip.max + hpTooltip.maxHPModifier}
                  </span>
                </div>
              )}

              {/* Hit Dice */}
              {hpTooltip.hitDice && (
                <div className="border-t-2 border-white/30 pt-2 mt-2">
                  <div className="text-white text-sm">
                    <span className="font-semibold opacity-90">🎲 Hit Dice:</span>
                    <div className="mt-1 px-3 py-2 bg-white/20 rounded-lg font-mono text-base font-bold text-center">
                      {hpTooltip.hitDice}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CR Tooltip with eCR */}
      {crTooltip.show && (
        <div
          className="fixed z-50 bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-700 dark:to-orange-800 rounded-lg shadow-2xl border-2 border-amber-300 dark:border-amber-500 p-3 pointer-events-none animate-[fadeIn_0.15s_ease-out]"
          style={{
            right: `${window.innerWidth - crTooltip.x + 15}px`,
            top: `${crTooltip.y + 15}px`,
            width: "360px",
          }}
        >
          <div className="space-y-3">
            {/* Title */}
            <div className="flex items-center gap-2 pb-2 border-b-2 border-white/30">
              <span className="text-2xl">🎯</span>
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Challenge Rating
              </span>
            </div>

            {/* Content */}
            {crTooltip.loading ? (
              <div className="text-center py-3 text-white">
                <div className="animate-pulse">Berechne eCR...</div>
              </div>
            ) : crTooltip.error ? (
              <div className="text-center py-3 text-red-200">
                Fehler beim Berechnen
              </div>
            ) : crTooltip.eCRData ? (
              <div className="space-y-3">
                {/* CR Comparison */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-wide text-white/70 mb-1">
                      Estimated CR
                    </div>
                    <div className="text-2xl font-bold text-yellow-200 px-3 py-1 bg-white/20 rounded-lg text-center">
                      {formatCR(crTooltip.eCRData.ecr)}
                    </div>
                  </div>
                  <div className="text-white/50 text-xl">↔️</div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-wide text-white/70 mb-1 text-right">
                      Official CR
                    </div>
                    <div className="text-2xl font-bold text-white px-3 py-1 bg-white/20 rounded-lg text-center">
                      {formatCR(crTooltip.cr)}
                    </div>
                  </div>
                </div>

                {/* Confidence Badge */}
                <div className="flex items-center gap-2 justify-center">
                  <span className="text-xs uppercase tracking-wide text-white/70">
                    Konfidenz:
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    crTooltip.eCRData.confidence === 'high'
                      ? 'bg-green-500/30 text-green-100'
                      : crTooltip.eCRData.confidence === 'medium'
                      ? 'bg-yellow-500/30 text-yellow-100'
                      : 'bg-red-500/30 text-red-100'
                  }`}>
                    {crTooltip.eCRData.confidence === 'high' ? '✓ Hoch' : crTooltip.eCRData.confidence === 'medium' ? '~ Mittel' : '✗ Niedrig'}
                  </span>
                </div>

                {/* Stats Grid */}
                {crTooltip.eCRData.features && (
                  <div className="grid grid-cols-2 gap-2 border-t-2 border-white/30 pt-3">
                    <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1">
                      <span className="text-xs text-white/70">HP:</span>
                      <span className="text-sm font-bold text-white">{crTooltip.eCRData.features.hp}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1">
                      <span className="text-xs text-white/70">EHP:</span>
                      <span className="text-sm font-bold text-white">{crTooltip.eCRData.features.ehp?.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1">
                      <span className="text-xs text-white/70">DPR (raw):</span>
                      <span className="text-sm font-bold text-white">{crTooltip.eCRData.features.dpr_raw?.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1">
                      <span className="text-xs text-white/70">DPR (eff):</span>
                      <span className="text-sm font-bold text-white">{crTooltip.eCRData.features.dpr?.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1">
                      <span className="text-xs text-white/70">AC:</span>
                      <span className="text-sm font-bold text-white">{crTooltip.eCRData.features.ac}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 rounded px-2 py-1">
                      <span className="text-xs text-white/70">Atk Bonus:</span>
                      <span className="text-sm font-bold text-white">{crTooltip.eCRData.features.attackBonus >= 0 ? '+' : ''}{crTooltip.eCRData.features.attackBonus}</span>
                    </div>
                  </div>
                )}

                {/* ML Info */}
                <div className="text-[10px] leading-relaxed text-white/70 border-t border-white/30 pt-2">
                  🤖 Die eCR wird durch ein Machine Learning Modell berechnet, das anhand des Statblocks die Challenge Rating ermittelt.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* eCR Details Modal */}
      {showECRModal && ecrModalData && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col animate-[slideUp_0.2s_ease-out]">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-700 dark:to-orange-800 rounded-t-2xl">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl">🎯</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-bold text-white mb-1">Challenge Rating Analyse</h3>
                  <p className="text-sm text-white/80">Detaillierte Statistiken und ML-basierte Schätzung</p>
                </div>
                <button
                  className="w-10 h-10 rounded-full hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors"
                  onClick={() => setShowECRModal(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* CR Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border-2 border-amber-300 dark:border-amber-700">
                    <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold mb-2">
                      Estimated CR (ML)
                    </div>
                    <div className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCR(ecrModalData.ecr)}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Konfidenz:
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ecrModalData.confidence === 'high'
                          ? 'bg-green-500/30 text-green-700 dark:text-green-300'
                          : ecrModalData.confidence === 'medium'
                          ? 'bg-yellow-500/30 text-yellow-700 dark:text-yellow-300'
                          : 'bg-red-500/30 text-red-700 dark:text-red-300'
                      }`}>
                        {ecrModalData.confidence === 'high' ? '✓ Hoch' : ecrModalData.confidence === 'medium' ? '~ Mittel' : '✗ Niedrig'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 rounded-xl p-4 border-2 border-slate-300 dark:border-slate-600">
                    <div className="text-xs uppercase tracking-wide text-slate-700 dark:text-slate-300 font-semibold mb-2">
                      Official CR
                    </div>
                    <div className="text-4xl font-bold text-slate-600 dark:text-slate-300">
                      {formatCR(ecrModalData.officialCR)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Aus dem Monster Manual
                    </div>
                  </div>
                </div>

                {/* Stats Grid with Tooltips */}
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Combat Statistics</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {/* HP */}
                    <div
                      className="group relative bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600 hover:border-red-400 dark:hover:border-red-500 transition-colors cursor-help"
                      title="Hit Points - Gesamte Trefferpunkte des Monsters"
                    >
                      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">HP</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{ecrModalData.features?.hp || '—'}</div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10 shadow-lg">
                        <div className="font-semibold mb-1">Hit Points (HP)</div>
                        <div className="text-slate-300">Gesamte Trefferpunkte des Monsters</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>

                    {/* EHP */}
                    <div
                      className="group relative bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600 hover:border-purple-400 dark:hover:border-purple-500 transition-colors cursor-help"
                      title="Effective Hit Points - HP unter Berücksichtigung von AC und Resistenzen"
                    >
                      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">EHP</div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{ecrModalData.features?.ehp?.toFixed(0) || '—'}</div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity w-64 z-10 shadow-lg">
                        <div className="font-semibold mb-1">Effective Hit Points (EHP)</div>
                        <div className="text-slate-300">HP multipliziert mit einem Faktor basierend auf AC und Resistenzen. Je höher die AC und mehr Resistenzen, desto höher die EHP.</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>

                    {/* AC */}
                    <div
                      className="group relative bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-help"
                      title="Armor Class - Rüstungsklasse"
                    >
                      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">AC</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{ecrModalData.features?.ac || '—'}</div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10 shadow-lg">
                        <div className="font-semibold mb-1">Armor Class (AC)</div>
                        <div className="text-slate-300">Schwierigkeit, das Monster zu treffen</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>

                    {/* DPR Raw */}
                    <div
                      className="group relative bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600 hover:border-orange-400 dark:hover:border-orange-500 transition-colors cursor-help"
                      title="Damage Per Round (Raw) - Maximaler theoretischer Schaden"
                    >
                      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">DPR (raw)</div>
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{ecrModalData.features?.dpr_raw?.toFixed(0) || '—'}</div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity w-64 z-10 shadow-lg">
                        <div className="font-semibold mb-1">DPR Raw</div>
                        <div className="text-slate-300">Durchschnittlicher Schaden pro Runde (roh). Basiert auf den stärksten Angriffen ohne Hit-Chance-Berücksichtigung.</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>

                    {/* DPR Effective */}
                    <div
                      className="group relative bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600 hover:border-red-400 dark:hover:border-red-500 transition-colors cursor-help"
                      title="Damage Per Round (Effective) - Realistischer Schaden mit Hit-Chance"
                    >
                      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">DPR (eff)</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{ecrModalData.features?.dpr?.toFixed(1) || '—'}</div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity w-64 z-10 shadow-lg">
                        <div className="font-semibold mb-1">DPR Effective</div>
                        <div className="text-slate-300">Effektiver Schaden pro Runde. Raw DPR multipliziert mit der Hit-Chance gegen typische AC für diese CR.</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>

                    {/* Attack Bonus */}
                    <div
                      className="group relative bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500 transition-colors cursor-help"
                      title="Attack Bonus - Höchster Angriffsbonus"
                    >
                      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">Atk Bonus</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {ecrModalData.features?.attackBonus >= 0 ? '+' : ''}{ecrModalData.features?.attackBonus || '—'}
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity w-64 z-10 shadow-lg">
                        <div className="font-semibold mb-1">Attack Bonus</div>
                        <div className="text-slate-300">Höchster Angriffsbonus des Monsters. Beeinflusst die Trefferwahrscheinlichkeit.</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ML Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">🤖</div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Machine Learning Modell</h5>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        Die eCR wird durch ein Gradient Boosting Regressor Modell mit 54 Features berechnet. Das Modell wurde auf tausenden von D&D 5e Monstern trainiert und erreicht eine Genauigkeit von ~79.5% auf dem Validierungsset.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/50 dark:bg-slate-800/50 rounded px-2 py-1">
                          <span className="text-slate-600 dark:text-slate-400">Modell-Typ:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 ml-1">GBR + Residual Learning</span>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-800/50 rounded px-2 py-1">
                          <span className="text-slate-600 dark:text-slate-400">Features:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 ml-1">54</span>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-800/50 rounded px-2 py-1">
                          <span className="text-slate-600 dark:text-slate-400">Accuracy:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 ml-1">~79.5%</span>
                        </div>
                        <div className="bg-white/50 dark:bg-slate-800/50 rounded px-2 py-1">
                          <span className="text-slate-600 dark:text-slate-400">Format:</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 ml-1">ONNX</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end">
              <button
                className="btn bg-amber-600 text-white hover:bg-amber-700 border-amber-600 px-6"
                onClick={() => setShowECRModal(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Damage Modifier Tooltip */}
      {damageModifier.show && (
        <div
          className="fixed z-[60] bg-slate-800 dark:bg-slate-900 border-2 border-red-500 rounded-lg shadow-2xl p-2"
          style={{
            left: `${damageModifier.x}px`,
            top: `${damageModifier.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex items-center gap-1">
            <button
              className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded"
              onClick={() => {
                const modifier = 2;
                const damage = Math.ceil(damageModifier.damage * modifier);
                const input = document.getElementById(`hp-quick-${damageModifier.combatantId}`);
                updateCombatant(damageModifier.combatantId, applyHPChange(
                  enc.combatants[damageModifier.combatantId],
                  `-${damage}`
                ));
                if (input) input.value = '';
                setDamageModifier({ show: false, combatantId: null, x: 0, y: 0 });
              }}
              title="Vulnerable (double damage)"
            >
              x2
            </button>
            <button
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded ring-2 ring-white"
              onClick={() => {
                const damage = damageModifier.damage;
                const input = document.getElementById(`hp-quick-${damageModifier.combatantId}`);
                updateCombatant(damageModifier.combatantId, applyHPChange(
                  enc.combatants[damageModifier.combatantId],
                  `-${damage}`
                ));
                if (input) input.value = '';
                setDamageModifier({ show: false, combatantId: null, x: 0, y: 0 });
              }}
              title="Normal damage"
            >
              x1
            </button>
            <button
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded"
              onClick={() => {
                const modifier = 0.5;
                const damage = Math.ceil(damageModifier.damage * modifier);
                const input = document.getElementById(`hp-quick-${damageModifier.combatantId}`);
                updateCombatant(damageModifier.combatantId, applyHPChange(
                  enc.combatants[damageModifier.combatantId],
                  `-${damage}`
                ));
                if (input) input.value = '';
                setDamageModifier({ show: false, combatantId: null, x: 0, y: 0 });
              }}
              title="Resistant (half damage)"
            >
              x½
            </button>
            <button
              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded"
              onClick={() => {
                const modifier = 0.25;
                const damage = Math.ceil(damageModifier.damage * modifier);
                const input = document.getElementById(`hp-quick-${damageModifier.combatantId}`);
                updateCombatant(damageModifier.combatantId, applyHPChange(
                  enc.combatants[damageModifier.combatantId],
                  `-${damage}`
                ));
                if (input) input.value = '';
                setDamageModifier({ show: false, combatantId: null, x: 0, y: 0 });
              }}
              title="Double resistant (quarter damage)"
            >
              x¼
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close damage modifier */}
      {damageModifier.show && (
        <div
          className="fixed inset-0 z-[59]"
          onClick={() => setDamageModifier({ show: false, combatantId: null, x: 0, y: 0 })}
        />
      )}

      {/* Bloodied Toast Notifications (DM Only) */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        {bloodiedToasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl border-2 border-red-800 animate-[slideInRight_0.3s_ease-out] flex items-center gap-3 pointer-events-auto"
          >
            <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-bold text-lg">{toast.name}</div>
              <div className="text-sm opacity-90">is bloodied!</div>
            </div>
          </div>
        ))}
      </div>

      {/* Spell Details Modal */}
      {showSpellModal && selectedSpell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowSpellModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border-2 border-purple-500 dark:border-purple-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-purple-600 dark:bg-purple-700 text-white p-4 flex items-center justify-between border-b-2 border-purple-700 dark:border-purple-800">
              <div>
                <h2 className="text-2xl font-bold">{selectedSpell.name}</h2>
                <div className="text-sm opacity-90 mt-1">
                  {selectedSpell.level === 0
                    ? "Cantrip"
                    : `Level ${selectedSpell.level}`}
                  {" • "}
                  {{
                    A: "Abjuration",
                    C: "Conjuration",
                    D: "Divination",
                    E: "Enchantment",
                    V: "Evocation",
                    I: "Illusion",
                    N: "Necromancy",
                    T: "Transmutation",
                  }[selectedSpell.school] || selectedSpell.school}
                </div>
              </div>
              <button
                className="w-8 h-8 rounded-full hover:bg-purple-700 dark:hover:bg-purple-600 flex items-center justify-center transition-colors"
                onClick={() => setShowSpellModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Casting info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-purple-800 dark:text-purple-300">
                    Casting Time:
                  </span>
                  <span className="ml-2 text-slate-700 dark:text-slate-300">
                    {(() => {
                      // encounterpp format
                      if (selectedSpell.castingTime) {
                        return selectedSpell.castingTime;
                      }
                      // 5e.tools format fallback
                      if (selectedSpell.time && selectedSpell.time[0]) {
                        return `${selectedSpell.time[0].number} ${selectedSpell.time[0].unit}`;
                      }
                      return "—";
                    })()}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-purple-800 dark:text-purple-300">
                    Range:
                  </span>
                  <span className="ml-2 text-slate-700 dark:text-slate-300">
                    {(() => {
                      // encounterpp format (already a string)
                      if (typeof selectedSpell.range === "string") {
                        return selectedSpell.range;
                      }
                      // 5e.tools format fallback
                      if (selectedSpell.range?.type === "point") {
                        return `${selectedSpell.range.distance.amount} ${selectedSpell.range.distance.type}`;
                      }
                      return selectedSpell.range?.type === "self"
                        ? "Self"
                        : selectedSpell.range?.type || "—";
                    })()}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-purple-800 dark:text-purple-300">
                    Components:
                  </span>
                  <span className="ml-2 text-slate-700 dark:text-slate-300">
                    {(() => {
                      // encounterpp format
                      if (
                        selectedSpell.components &&
                        typeof selectedSpell.components === "object" &&
                        ("verbal" in selectedSpell.components ||
                          "somatic" in selectedSpell.components ||
                          "material" in selectedSpell.components)
                      ) {
                        const comps = [
                          selectedSpell.components.verbal && "V",
                          selectedSpell.components.somatic && "S",
                          selectedSpell.components.material && "M",
                        ]
                          .filter(Boolean)
                          .join(", ");
                        const materialText =
                          selectedSpell.components.materialText;
                        return (
                          <>
                            {comps || "—"}
                            {materialText && (
                              <span className="text-xs italic">
                                {" "}
                                ({materialText})
                              </span>
                            )}
                          </>
                        );
                      }
                      // 5e.tools format fallback
                      const comps = [
                        selectedSpell.components?.v && "V",
                        selectedSpell.components?.s && "S",
                        selectedSpell.components?.m && "M",
                      ]
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <>
                          {comps || "—"}
                          {selectedSpell.components?.m &&
                            typeof selectedSpell.components.m === "string" && (
                              <span className="text-xs italic">
                                {" "}
                                ({selectedSpell.components.m})
                              </span>
                            )}
                        </>
                      );
                    })()}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-purple-800 dark:text-purple-300">
                    Duration:
                  </span>
                  <span className="ml-2 text-slate-700 dark:text-slate-300">
                    {(() => {
                      // encounterpp format (already a string)
                      if (typeof selectedSpell.duration === "string") {
                        return selectedSpell.duration;
                      }
                      // 5e.tools format fallback
                      if (selectedSpell.duration && selectedSpell.duration[0]) {
                        const dur = selectedSpell.duration[0];
                        if (dur.type === "instant") {
                          return "Instantaneous";
                        }
                        if (dur.concentration) {
                          return `Concentration, up to ${
                            dur.duration?.amount || ""
                          } ${dur.duration?.type || ""}`;
                        }
                        return `${dur.duration?.amount || ""} ${
                          dur.duration?.type || ""
                        }`;
                      }
                      return "—";
                    })()}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="text-slate-700 dark:text-slate-300 space-y-2">
                  {(() => {
                    // encounterpp format
                    if (selectedSpell.description) {
                      // Parse description for embedded tables (Python dict format)
                      const parseDescriptionWithTables = (desc) => {
                        // Look for table dict pattern: {'type': 'table', ...}
                        const tablePattern =
                          /\{'type':\s*'table'[^}]*'caption':\s*'([^']+)'[^}]*'colLabels':\s*\[([^\]]+)\][^}]*'rows':\s*\[(\[.*?\])\]\}/g;

                        const parts = [];
                        let lastIndex = 0;
                        let match;

                        while ((match = tablePattern.exec(desc)) !== null) {
                          // Add text before table
                          if (match.index > lastIndex) {
                            const text = desc
                              .substring(lastIndex, match.index)
                              .trim();
                            if (text) {
                              parts.push({ type: "text", content: text });
                            }
                          }

                          // Parse table
                          try {
                            const caption = match[1];
                            const colLabelsStr = match[2];
                            const rowsStr = match[3];

                            // Extract column labels
                            const colLabels = colLabelsStr
                              .match(/'([^']+)'/g)
                              .map((s) => s.slice(1, -1));

                            // Extract rows (simplified parsing)
                            const rows = [];
                            const rowMatches = rowsStr.match(/\[([^\]]+)\]/g);
                            if (rowMatches) {
                              rowMatches.forEach((rowStr) => {
                                const cells = rowStr.match(/'([^']+)'/g);
                                if (cells) {
                                  rows.push(cells.map((s) => s.slice(1, -1)));
                                }
                              });
                            }

                            parts.push({
                              type: "table",
                              caption,
                              colLabels,
                              rows,
                            });
                          } catch (e) {
                            console.error("Failed to parse table:", e);
                          }

                          lastIndex = match.index + match[0].length;
                        }

                        // Add remaining text
                        if (lastIndex < desc.length) {
                          const text = desc.substring(lastIndex).trim();
                          if (text) {
                            parts.push({ type: "text", content: text });
                          }
                        }

                        return parts.length > 0
                          ? parts
                          : [{ type: "text", content: desc }];
                      };

                      const parts = parseDescriptionWithTables(
                        selectedSpell.description
                      );

                      return (
                        <>
                          {parts.map((part, idx) => {
                            if (part.type === "table") {
                              // Clean up 5etools tags from table cells
                              const cleanCell = (cell) => {
                                return cell.replace(/\{@[^}]+\}/g, (match) => {
                                  const textMatch = match.match(
                                    /\{@\w+\s+([^}|]+)(?:\|[^}]+)?\}/
                                  );
                                  return textMatch ? textMatch[1] : match;
                                });
                              };

                              return (
                                <div key={idx} className="my-4 overflow-x-auto">
                                  <div className="font-semibold text-purple-900 dark:text-purple-300 mb-2">
                                    {part.caption}
                                  </div>
                                  <table className="min-w-full border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
                                    <thead className="bg-purple-100 dark:bg-purple-900/40">
                                      <tr>
                                        {part.colLabels.map((label, colIdx) => (
                                          <th
                                            key={colIdx}
                                            className="px-3 py-2 text-left text-xs font-semibold text-purple-900 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800"
                                          >
                                            {label}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-900">
                                      {part.rows.map((row, rowIdx) => (
                                        <tr
                                          key={rowIdx}
                                          className="border-b border-purple-100 dark:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                        >
                                          {row.map((cell, cellIdx) => (
                                            <td
                                              key={cellIdx}
                                              className="px-3 py-2 text-sm"
                                            >
                                              <RollableText
                                                text={cleanCell(cell)}
                                              />
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            } else {
                              return (
                                <p key={idx} className="leading-relaxed">
                                  <RollableText
                                    text={part.content}
                                    onRoll={() => setShowSpellModal(false)}
                                  />
                                </p>
                              );
                            }
                          })}
                          {selectedSpell.higherLevel && (
                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded p-3">
                              <div className="font-semibold text-purple-900 dark:text-purple-300 mb-1">
                                At Higher Levels
                              </div>
                              <p className="text-sm">
                                <RollableText
                                  text={selectedSpell.higherLevel}
                                  onRoll={() => setShowSpellModal(false)}
                                />
                              </p>
                            </div>
                          )}
                        </>
                      );
                    }

                    // 5e.tools format fallback
                    if (selectedSpell.entries) {
                      return selectedSpell.entries.map((entry, idx) => {
                        if (typeof entry === "string") {
                          // Clean up 5e.tools markup and make dice clickable
                          const cleanText = entry.replace(
                            /\{@[^}]+\}/g,
                            (match) => {
                              // Extract text from markup like {@damage 2d6} or {@spell fireball}
                              const textMatch = match.match(
                                /\{@\w+ ([^}|]+)(?:\|[^}]+)?\}/
                              );
                              return textMatch ? textMatch[1] : match;
                            }
                          );

                          return (
                            <p key={idx} className="leading-relaxed">
                              <RollableText
                                text={cleanText}
                                onRoll={() => setShowSpellModal(false)}
                              />
                            </p>
                          );
                        } else if (
                          entry.type === "entries" &&
                          entry.name === "At Higher Levels"
                        ) {
                          return (
                            <div
                              key={idx}
                              className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded p-3"
                            >
                              <div className="font-semibold text-purple-900 dark:text-purple-300 mb-1">
                                At Higher Levels
                              </div>
                              {entry.entries.map((subEntry, subIdx) => (
                                <p key={subIdx} className="text-sm">
                                  <RollableText
                                    text={
                                      typeof subEntry === "string"
                                        ? subEntry.replace(
                                            /\{@[^}]+\}/g,
                                            (m) =>
                                              m.match(
                                                /\{@\w+ ([^}|]+)(?:\|[^}]+)?\}/
                                              )?.[1] || m
                                          )
                                        : ""
                                    }
                                    onRoll={() => setShowSpellModal(false)}
                                  />
                                </p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      });
                    }

                    return null;
                  })()}
                </div>
              </div>

              {/* Classes that can cast this spell */}
              {selectedSpell.classes && selectedSpell.classes.fromClassList && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <span className="font-semibold text-purple-800 dark:text-purple-300">
                    Classes:
                  </span>
                  <span className="ml-2 text-slate-700 dark:text-slate-300">
                    {selectedSpell.classes.fromClassList
                      .map((c) => c.name)
                      .join(", ")}
                  </span>
                </div>
              )}

              {/* Source */}
              {(() => {
                // encounterpp format
                if (selectedSpell.meta?.source) {
                  return (
                    <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                      Source: {selectedSpell.meta.source}
                      {selectedSpell.meta.page && ` p${selectedSpell.meta.page}`}
                    </div>
                  );
                }
                // 5e.tools format
                if (selectedSpell.source) {
                  return (
                    <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                      Source: {selectedSpell.source}
                      {selectedSpell.page && ` p${selectedSpell.page}`}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Condition Modal */}
      {showConditionModal && selectedCondition && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowConditionModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border-2 border-amber-500 dark:border-amber-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-amber-600 dark:bg-amber-700 text-white p-4 flex items-center justify-between border-b-2 border-amber-700 dark:border-amber-800">
              <div>
                <h2 className="text-2xl font-bold">{selectedCondition.reprinted?.name || selectedCondition.legacy?.name || "Condition"}</h2>
                <div className="text-sm opacity-90 mt-1">
                  Condition
                </div>
              </div>
              <button
                className="w-8 h-8 rounded-full hover:bg-amber-700 dark:hover:bg-amber-600 flex items-center justify-center transition-colors"
                onClick={() => setShowConditionModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Description */}
              <div className="text-slate-700 dark:text-slate-300 space-y-4">
                {(() => {
                  const { legacy, reprinted } = selectedCondition;

                  // Helper function to remove 5etools tags
                  const cleanText = (text) => {
                    if (!text) return "";
                    return text
                      .replace(/\{@[^}]+\}/g, (match) => {
                        const textMatch = match.match(/\{@\w+\s+([^}|]+)(?:\|[^}]+)?\}/);
                        return textMatch ? textMatch[1] : match;
                      })
                      .trim();
                  };

                  // Function to parse all entries fully
                  const parseEntries = (entries) => {
                    if (!entries || !entries.length) return null;

                    const elements = [];

                    entries.forEach((entry, idx) => {
                      if (typeof entry === "string") {
                        elements.push(
                          <p key={idx} className="leading-relaxed">
                            {cleanText(entry)}
                          </p>
                        );
                      } else if (entry.type === "list" && entry.items) {
                        elements.push(
                          <ul key={idx} className="list-disc list-inside space-y-1 ml-2">
                            {entry.items.map((item, itemIdx) => (
                              <li key={itemIdx} className="leading-relaxed">
                                {cleanText(item)}
                              </li>
                            ))}
                          </ul>
                        );
                      } else if (entry.type === "entries") {
                        if (entry.name) {
                          elements.push(
                            <div key={idx} className="mb-3">
                              <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">
                                {entry.name}
                              </h4>
                              {entry.entries && entry.entries.map((subEntry, subIdx) => {
                                if (typeof subEntry === "string") {
                                  return (
                                    <p key={subIdx} className="leading-relaxed ml-2">
                                      {cleanText(subEntry)}
                                    </p>
                                  );
                                } else if (subEntry.type === "entries") {
                                  return (
                                    <div key={subIdx} className="ml-2 mb-2">
                                      {subEntry.name && (
                                        <span className="font-medium text-amber-800 dark:text-amber-400">
                                          {subEntry.name}:
                                        </span>
                                      )}{" "}
                                      {cleanText(subEntry.entries?.join(" ") || "")}
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          );
                      } else {
                        elements.push(
                          <div key={idx} className="space-y-1">
                            {entry.entries && entry.entries.map((subEntry, subIdx) => {
                              if (typeof subEntry === "string") {
                                return (
                                  <p key={subIdx} className="leading-relaxed">
                                    {cleanText(subEntry)}
                                  </p>
                                );
                              } else if (subEntry.type === "entries") {
                                return (
                                  <div key={subIdx} className="mb-2">
                                    {subEntry.name && (
                                      <span className="font-medium text-amber-800 dark:text-amber-400">
                                        {subEntry.name}:
                                      </span>
                                    )}{" "}
                                    {cleanText(subEntry.entries?.join(" ") || "")}
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        );
                      }
                    }
                  });

                  return elements;
                };

                // Check if both versions exist and are identical
                const areSame = legacy && reprinted &&
                  JSON.stringify(legacy.entries) === JSON.stringify(reprinted.entries);

                if (areSame) {
                  // Same content in both versions
                  return (
                    <>
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <div className="font-semibold text-amber-900 dark:text-amber-300 mb-2">
                          Legacy & Reprinted Rules:
                        </div>
                        <div className="space-y-2">
                          {parseEntries(legacy.entries)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-amber-200 dark:border-amber-800">
                          PHB p{legacy.page || "?"} / XPHB p{reprinted.page || "?"}
                        </div>
                      </div>
                    </>
                  );
                } else if (legacy && reprinted) {
                  // Different content
                  return (
                    <>
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                          Legacy Rules (5e2014):
                        </div>
                        <div className="space-y-2">
                          {parseEntries(legacy.entries)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-blue-200 dark:border-blue-800">
                          PHB p{legacy.page || "?"}
                        </div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="font-semibold text-green-900 dark:text-green-300 mb-2">
                          Reprinted Rules (5e2024):
                        </div>
                        <div className="space-y-2">
                          {parseEntries(reprinted.entries)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-green-200 dark:border-green-800">
                          XPHB p{reprinted.page || "?"}
                        </div>
                      </div>
                    </>
                  );
                } else if (reprinted) {
                  // Only reprinted version
                  return (
                    <>
                      <div className="space-y-2">
                        {parseEntries(reprinted.entries)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                        Source: XPHB p{reprinted.page || "?"}
                      </div>
                    </>
                  );
                } else if (legacy) {
                  // Only legacy version
                  return (
                    <>
                      <div className="space-y-2">
                        {parseEntries(legacy.entries)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                        Source: PHB p{legacy.page || "?"}
                      </div>
                    </>
                  );
                }

                return null;
              })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dice Context Menu */}
      {diceContextMenu.show && (
        <>
          {/* Backdrop to close menu on click */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() =>
              setDiceContextMenu({ ...diceContextMenu, show: false })
            }
            onContextMenu={(e) => {
              e.preventDefault();
              setDiceContextMenu({ ...diceContextMenu, show: false });
            }}
          />
          {/* Menu */}
          <div
            className="fixed z-[61] bg-white dark:bg-slate-800 rounded-lg shadow-2xl border-2 border-blue-500 dark:border-blue-700 p-2 min-w-[180px]"
            style={{
              left: `${diceContextMenu.x}px`,
              top: `${diceContextMenu.y}px`,
            }}
          >
            {diceContextMenu.type === "d20" ? (
              // d20 rolls: Advantage, Normal, Disadvantage
              <>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-2 py-1">
                  d20 Roll
                </div>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-300 rounded transition-colors"
                  onClick={async () => {
                    const creatureName = diceContextMenu.character || selectedCombatant?.name || "Unknown";
                    const result = await rollDice({
                      notation: diceContextMenu.notation,
                      rollMode: "advantage",
                      label: diceContextMenu.label || diceContextMenu.notation,
                      character: creatureName,
                    });
                    if (diceContextMenu.onRoll) diceContextMenu.onRoll(result);
                    setDiceContextMenu({ ...diceContextMenu, show: false });
                  }}
                >
                  🎲🎲 Advantage
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded transition-colors"
                  onClick={async () => {
                    const creatureName = diceContextMenu.character || selectedCombatant?.name || "Unknown";
                    const result = await rollDice({
                      notation: diceContextMenu.notation,
                      rollMode: "normal",
                      label: diceContextMenu.label || diceContextMenu.notation,
                      character: creatureName,
                    });
                    if (diceContextMenu.onRoll) diceContextMenu.onRoll(result);
                    setDiceContextMenu({ ...diceContextMenu, show: false });
                  }}
                >
                  🎲 Normal
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-300 rounded transition-colors"
                  onClick={async () => {
                    const creatureName = diceContextMenu.character || selectedCombatant?.name || "Unknown";
                    const result = await rollDice({
                      notation: diceContextMenu.notation,
                      rollMode: "disadvantage",
                      label: diceContextMenu.label || diceContextMenu.notation,
                      character: creatureName,
                    });
                    if (diceContextMenu.onRoll) diceContextMenu.onRoll(result);
                    setDiceContextMenu({ ...diceContextMenu, show: false });
                  }}
                >
                  🎲🎲 Disadvantage
                </button>
              </>
            ) : (
              // Damage rolls: Normal, Critical Hit
              <>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-2 py-1">
                  Damage Roll
                </div>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded transition-colors"
                  onClick={() => {
                    const creatureName = selectedCombatant?.name || "Unknown";
                    rollDice({
                      notation: diceContextMenu.notation,
                      rollMode: "normal",
                      label: diceContextMenu.label || diceContextMenu.notation,
                      character: creatureName,
                    });
                    if (diceContextMenu.onRoll) diceContextMenu.onRoll();
                    setDiceContextMenu({ ...diceContextMenu, show: false });
                  }}
                >
                  🎲 Normal
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded transition-colors"
                  onClick={() => {
                    const creatureName = selectedCombatant?.name || "Unknown";
                    rollDice({
                      notation: diceContextMenu.notation,
                      rollMode: "normal",
                      critical: true,
                      label: diceContextMenu.label || diceContextMenu.notation,
                      character: creatureName,
                    });
                    if (diceContextMenu.onRoll) diceContextMenu.onRoll();
                    setDiceContextMenu({ ...diceContextMenu, show: false });
                  }}
                >
                  💥 Critical Hit
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Fullscreen Creature Manager */}
      {showCreatureManager && (
        <FullscreenCreatureManager
          creature={editingCreature}
          initialTab={creatureManagerInitialTab}
          initialSearch={creatureManagerInitialSearch}
          campaigns={campaigns}
          onClose={() => {
            setShowCreatureManager(false);
            setEditingCreature(null);
            setCreatureManagerInitialTab("browse");
            setCreatureManagerInitialSearch("");
          }}
          onSave={(creature) => {
            setShowCreatureManager(false);
            setEditingCreature(null);
            setCreatureManagerInitialTab("browse");
            setCreatureManagerInitialSearch("");
          }}
          onAddMonster={addMonster}
        />
      )}

      {/* Player Screen Button */}
      {enc && combatMode && (
        <button
          className="fixed top-20 right-6 btn bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700 border-none shadow-lg z-10"
          onClick={() => {
            // Use absolute URL to ensure it works both locally and online
            const baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
            const url = `${baseUrl}player.html?encounter=${encodeURIComponent(
              currentId
            )}`;
            window.open(
              url,
              "PlayerScreen",
              "width=800,height=600,menubar=no,toolbar=no,location=no"
            );
          }}
          title="Open Player Screen"
        >
          📺 Player Screen
        </button>
      )}

      {/* Custom Modals */}
      {modal}

      {/* Campaign Manager Modal */}
      {showCampaignManager && (
        <CampaignManager onClose={() => setShowCampaignManager(false)} />
      )}

      {/* Share Code Modal */}
      {showShareCodeModal && currentId && (
        <ShareCodeModal
          encounterId={currentId}
          onClose={() => setShowShareCodeModal(false)}
        />
      )}

      {/* Statblock Sidebar - Overlay */}
      {selectedCombatant && !selectedCombatant.isLair && (
        <div
          className="fixed top-16 right-0 h-[calc(100vh-4rem)] bg-white dark:bg-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-30 translate-x-0 overflow-y-auto"
          style={{ width: '400px' }}
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-800 dark:to-indigo-800 border-b-2 border-purple-700 dark:border-purple-900 p-4 z-10">
              <button
                className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white"
                onClick={() => setSelectedCombatantId(null)}
              >
                ✕
              </button>
              <h2 className="text-xl font-bold mb-1 text-white pr-10">{selectedCombatant.name}</h2>
              <div className="flex items-center justify-between text-sm text-purple-100">
                <span>
                  {selectedCombatant.size && selectedCombatant.size.charAt(0).toUpperCase() + selectedCombatant.size.slice(1).toLowerCase()}{' '}
                  {(selectedCombatant.type?.type || selectedCombatant.type || 'creature').charAt(0).toUpperCase() + (selectedCombatant.type?.type || selectedCombatant.type || 'creature').slice(1).toLowerCase()}
                  {selectedCombatant.type?.tags && ` (${selectedCombatant.type.tags.join(', ')})`}
                  {selectedCombatant.alignment && `, ${selectedCombatant.alignment.charAt(0).toUpperCase() + selectedCombatant.alignment.slice(1).toLowerCase()}`}
                </span>
                {selectedCombatant.cr && (
                  <span
                    className="font-semibold text-white bg-white/20 px-2 py-0.5 rounded cursor-pointer hover:bg-white/30 transition-colors"
                    onClick={async () => {
                      const data = await fetchECRForMonster(selectedCombatant);
                      if (data) {
                        setECRModalData(data);
                        setShowECRModal(true);
                      }
                    }}
                    onMouseEnter={async (e) => {
                      setCrTooltip({
                        show: true,
                        x: e.clientX,
                        y: e.clientY,
                        cr: selectedCombatant.cr,
                        eCRData: null,
                        loading: true,
                        error: null
                      });
                      const data = await fetchECRForMonster(selectedCombatant);
                      if (data) {
                        setCrTooltip(prev => ({ ...prev, eCRData: data, loading: false }));
                      } else {
                        setCrTooltip(prev => ({ ...prev, error: 'Failed to load', loading: false }));
                      }
                    }}
                    onMouseMove={(e) => {
                      setCrTooltip(prev => ({
                        ...prev,
                        x: e.clientX,
                        y: e.clientY
                      }));
                    }}
                    onMouseLeave={() => {
                      setCrTooltip({ show: false, x: 0, y: 0, cr: 0, eCRData: null, loading: false, error: null });
                    }}
                  >
                    CR {formatCR(selectedCombatant.cr)}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Compact Stats Grid with HP Management */}
              <div className="grid grid-cols-3 gap-2">
                {/* Initiative */}
                <div className="card p-2"
                  onMouseEnter={(e) => {
                    setInitiativeTooltip({
                      show: true,
                      x: e.clientX,
                      y: e.clientY,
                      roll: selectedCombatant.initiativeRoll || selectedCombatant.initiative - (selectedCombatant.initiativeMod || 0),
                      bonus: selectedCombatant.initiativeMod || 0,
                      total: selectedCombatant.initiative || 0
                    });
                  }}
                  onMouseMove={(e) => {
                    setInitiativeTooltip(prev => ({
                      ...prev,
                      x: e.clientX,
                      y: e.clientY
                    }));
                  }}
                  onMouseLeave={() => {
                    setInitiativeTooltip({ show: false, x: 0, y: 0, roll: 0, bonus: 0, total: 0 });
                  }}
                >
                  <div className="lbl text-xs mb-1">Init</div>
                  {/* d20 Roll */}
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400 w-8">d20:</span>
                    <input
                      type="number"
                      className="flex-1 text-center text-base font-semibold text-blue-500 dark:text-blue-300 bg-transparent border-0 focus:ring-1 focus:ring-blue-400 rounded p-0"
                      value={selectedCombatant.initiativeRoll || ''}
                      onChange={(e) => {
                        const roll = parseInt(e.target.value) || 0;
                        const bonus = selectedCombatant.initiativeMod || 0;
                        updateCombatant(selectedCombatant.id, {
                          initiativeRoll: roll,
                          initiative: roll + bonus
                        });
                      }}
                      placeholder="—"
                      disabled={isCompleted}
                    />
                  </div>
                  {/* Bonus */}
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400 w-8">Mod:</span>
                    <div className="flex-1 text-center text-base font-semibold text-blue-600 dark:text-blue-400">
                      {selectedCombatant.initiativeMod >= 0 ? '+' : ''}{selectedCombatant.initiativeMod || 0}
                    </div>
                  </div>
                  {/* Total */}
                  <div className="flex items-center gap-1 mb-1 border-t border-blue-200 dark:border-blue-800 pt-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400 w-8">Total:</span>
                    <input
                      type="number"
                      className="flex-1 text-center text-lg font-bold text-blue-600 dark:text-blue-400 bg-transparent border-0 focus:ring-1 focus:ring-blue-400 rounded p-0"
                      value={selectedCombatant.initiative || ''}
                      onChange={(e) => updateCombatant(selectedCombatant.id, { initiative: parseInt(e.target.value) || 0 })}
                      disabled={isCompleted}
                    />
                  </div>
                  {/* Tiebreaker */}
                  <div className="flex items-center gap-1 border-t border-blue-200 dark:border-blue-800 pt-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400 w-8">Tie:</span>
                    <input
                      type="number"
                      step="0.01"
                      className="flex-1 text-center text-xs font-semibold text-blue-600 dark:text-blue-400 bg-transparent border-0 focus:ring-1 focus:ring-blue-400 rounded p-0"
                      value={selectedCombatant.initiativeTieBreaker || ''}
                      onChange={(e) => updateCombatant(selectedCombatant.id, { initiativeTieBreaker: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      disabled={isCompleted}
                    />
                  </div>
                </div>

                {/* AC */}
                <div className="card p-2"
                  onMouseEnter={(e) => {
                    setAcTooltip({
                      show: true,
                      x: e.clientX,
                      y: e.clientY,
                      ac: Array.isArray(selectedCombatant.ac) ? selectedCombatant.ac[0]?.value : selectedCombatant.ac,
                      armorType: selectedCombatant.acFrom || null
                    });
                  }}
                  onMouseMove={(e) => {
                    setAcTooltip(prev => ({
                      ...prev,
                      x: e.clientX,
                      y: e.clientY
                    }));
                  }}
                  onMouseLeave={() => {
                    setAcTooltip({ show: false, x: 0, y: 0, ac: 0, armorType: null });
                  }}
                >
                  <div className="lbl text-xs mb-0.5">AC</div>
                  <input
                    type="number"
                    className="w-full text-center text-2xl font-bold text-green-600 dark:text-green-400 bg-transparent border-0 focus:ring-1 focus:ring-green-400 rounded p-0"
                    value={Array.isArray(selectedCombatant.ac) ? selectedCombatant.ac[0]?.value : selectedCombatant.ac}
                    onChange={(e) => updateCombatant(selectedCombatant.id, { ac: parseInt(e.target.value) || 0 })}
                    disabled={isCompleted}
                  />
                </div>

                {/* HP - Compact with inline editing and quick buttons */}
                <div className="card p-2 cursor-pointer hover:ring-2 hover:ring-red-400 transition-all"
                  onClick={(e) => {
                    // Only open modal if not clicking on an input
                    if (e.target.tagName !== 'INPUT' && hpManagement) {
                      hpManagement(selectedCombatant, (patch) => updateCombatant(selectedCombatant.id, patch));
                    }
                  }}
                  onMouseEnter={(e) => {
                    setHpTooltip({
                      show: true,
                      x: e.clientX,
                      y: e.clientY,
                      current: selectedCombatant.hp || 0,
                      max: selectedCombatant.baseHP || 0,
                      tempHP: selectedCombatant.tempHP || 0,
                      maxHPModifier: selectedCombatant.maxHPModifier || 0,
                      hitDice: selectedCombatant.hpFormula || null
                    });
                  }}
                  onMouseMove={(e) => {
                    setHpTooltip(prev => ({
                      ...prev,
                      x: e.clientX,
                      y: e.clientY
                    }));
                  }}
                  onMouseLeave={() => {
                    setHpTooltip({ show: false, x: 0, y: 0, current: 0, max: 0, tempHP: 0, maxHPModifier: 0, hitDice: null });
                  }}
                  title="Klick für HP Management (oder editiere Werte direkt)"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="lbl text-xs">HP</div>
                    <div className="text-[10px] text-slate-400">💡 Click for modal</div>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-12 text-center text-xl font-bold text-red-600 dark:text-red-400 bg-transparent border-0 focus:ring-1 focus:ring-red-400 rounded p-0"
                      defaultValue={selectedCombatant.hp || ''}
                      key={`hp-${selectedCombatant.id}-${selectedCombatant.hp}-${selectedCombatant.tempHP || 0}`}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        // Handle +/- shortcuts on blur using applyHPChange
                        if (value.startsWith('+') || value.startsWith('-')) {
                          updateCombatant(selectedCombatant.id, applyHPChange(selectedCombatant, value));
                        } else {
                          // Direct number input
                          const num = parseInt(value);
                          if (!isNaN(num) || value === '') {
                            updateCombatant(selectedCombatant.id, { hp: num || 0 });
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const value = e.target.value.trim();
                          // Handle +/- shortcuts on Enter using applyHPChange
                          if (value.startsWith('+') || value.startsWith('-')) {
                            updateCombatant(selectedCombatant.id, applyHPChange(selectedCombatant, value));
                          } else {
                            // Direct number input
                            const num = parseInt(value);
                            if (!isNaN(num) || value === '') {
                              updateCombatant(selectedCombatant.id, { hp: num || 0 });
                            }
                          }
                          // Always blur on Enter
                          e.target.blur();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="text-slate-400">/</span>
                    <div className="w-12 text-center text-xl font-semibold text-slate-500 dark:text-slate-400 pointer-events-none">
                      {(selectedCombatant.baseHP || 0) + (selectedCombatant.maxHPModifier || 0)}
                    </div>
                  </div>
                  {/* Temp HP - Compact, shown as dash when 0 */}
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">Temp:</span>
                    <input
                      type="text"
                      className="w-12 text-center text-xs font-semibold text-blue-600 dark:text-blue-400 bg-transparent border-0 focus:ring-1 focus:ring-blue-400 rounded p-0"
                      value={selectedCombatant.tempHP > 0 ? selectedCombatant.tempHP : ''}
                      placeholder="—"
                      onChange={(e) => {
                        const val = e.target.value === '' || e.target.value === '—' ? 0 : parseInt(e.target.value);
                        updateCombatant(selectedCombatant.id, { tempHP: isNaN(val) ? 0 : val });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.select()}
                      title="Temporary HP - Click to edit"
                    />
                  </div>
                  <input
                    type="number"
                    className="input w-full text-center py-1 text-sm mb-1"
                    placeholder="HP Amount"
                    id={`hp-quick-${selectedCombatant.id}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.target.value;
                        if (val) {
                          updateCombatant(selectedCombatant.id, applyHPChange(selectedCombatant, val));
                          e.target.value = '';
                        }
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    disabled={isCompleted}
                  />
                  <div className="grid grid-cols-2 gap-1 relative">
                    <button
                      id={`dmg-btn-${selectedCombatant.id}`}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        const input = document.getElementById(`hp-quick-${selectedCombatant.id}`);
                        if (input && input.value) {
                          // Show damage modifier tooltip
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDamageModifier({
                            show: true,
                            combatantId: selectedCombatant.id,
                            x: rect.left + rect.width / 2,
                            y: rect.bottom + 5,
                            damage: parseInt(input.value) || 0
                          });
                        }
                      }}
                      disabled={isCompleted}
                    >
                      DMG
                    </button>
                    <button
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        const input = document.getElementById(`hp-quick-${selectedCombatant.id}`);
                        if (input && input.value) {
                          updateCombatant(selectedCombatant.id, applyHPChange(selectedCombatant, `+${input.value}`));
                          input.value = '';
                        }
                      }}
                      disabled={isCompleted}
                    >
                      HEAL
                    </button>
                  </div>
                </div>
              </div>

              {/* Ability Scores with Saves - Compact Grid */}
              <div className="card bg-blue-50/50 dark:bg-blue-950/20">
                <div className="lbl mb-2">Abilities & Saves</div>
                <div className="grid grid-cols-3 gap-2">
                  {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => {
                    // Abilities are stored directly on the combatant object, not under abilities.xxx
                    const score = selectedCombatant[ability] || selectedCombatant.abilities?.[ability] || 10;
                    const mod = Math.floor((score - 10) / 2);
                    const abilityNotation = mod >= 0 ? `1d20+${mod}` : `1d20${mod}`;
                    const abilityLabel = `${selectedCombatant.name} - ${ability.toUpperCase()} Check`;

                    // Saving throw - stored under 'save', not 'savingThrows'
                    const saveBonus = selectedCombatant.save?.[ability] ?? selectedCombatant.savingThrows?.[ability] ?? mod;
                    const saveNotation = saveBonus >= 0 ? `1d20+${saveBonus}` : `1d20${saveBonus}`;
                    const saveLabel = `${selectedCombatant.name} - ${ability.toUpperCase()} Save`;

                    return (
                      <div key={ability} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        {/* Ability Score - Clickable */}
                        <button
                          className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 text-center transition-colors cursor-pointer"
                          onClick={() => handleRoll({ notation: abilityNotation, label: abilityLabel, rollMode: 'normal', character: selectedCombatant.name })}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDiceContextMenu({
                              show: true,
                              x: e.clientX,
                              y: e.clientY,
                              notation: abilityNotation,
                              type: 'd20',
                              label: abilityLabel
                            });
                          }}
                          title="Left: Roll | Right: Adv/Dis"
                        >
                          <div className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">{ability}</div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{score}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-500">
                            ({mod >= 0 ? '+' : ''}{mod})
                          </div>
                        </button>
                        {/* Saving Throw - Clickable */}
                        <button
                          className="w-full bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 p-1.5 text-center transition-colors cursor-pointer border-t border-slate-200 dark:border-slate-700"
                          onClick={() => handleRoll({ notation: saveNotation, label: saveLabel, rollMode: 'normal', character: selectedCombatant.name })}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDiceContextMenu({
                              show: true,
                              x: e.clientX,
                              y: e.clientY,
                              notation: saveNotation,
                              type: 'd20',
                              label: saveLabel
                            });
                          }}
                          title="Left: Roll Save | Right: Adv/Dis"
                        >
                          <div className="text-xs font-semibold text-green-700 dark:text-green-300">
                            Save {saveBonus >= 0 ? '+' : ''}{saveBonus}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Death Saves (if HP is 0) */}
              {selectedCombatant.hp === 0 && (
                <div className="card space-y-2">
                  <div className="lbl">Death Saves</div>
                  <div className="flex justify-between">
                    <div>
                      <div className="text-xs text-green-600 dark:text-green-400">Successes</div>
                      <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                          <button
                            key={i}
                            className={`w-6 h-6 rounded border ${
                              (selectedCombatant.deathSaves?.successes || 0) >= i
                                ? 'bg-green-500 border-green-600'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                            onClick={() => {
                              const current = selectedCombatant.deathSaves?.successes || 0;
                              updateCombatant(selectedCombatant.id, {
                                deathSaves: {
                                  ...selectedCombatant.deathSaves,
                                  successes: current >= i ? i - 1 : i
                                }
                              });
                            }}
                            title="Click to toggle success"
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-red-600 dark:text-red-400">Failures</div>
                      <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                          <button
                            key={i}
                            className={`w-6 h-6 rounded border ${
                              (selectedCombatant.deathSaves?.failures || 0) >= i
                                ? 'bg-red-500 border-red-600'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                            onClick={() => {
                              const current = selectedCombatant.deathSaves?.failures || 0;
                              updateCombatant(selectedCombatant.id, {
                                deathSaves: {
                                  ...selectedCombatant.deathSaves,
                                  failures: current >= i ? i - 1 : i
                                }
                              });
                            }}
                            title="Click to toggle failure"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Concentration */}
              {selectedCombatant.concentratingOn && (
                <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">Concentrating</div>
                      <div className="text-sm dark:text-slate-200">{selectedCombatant.concentratingOn}</div>
                    </div>
                    <button
                      className="btn text-xs"
                      onClick={() => updateCombatant(selectedCombatant.id, { concentratingOn: null })}
                    >
                      End
                    </button>
                  </div>
                </div>
              )}

              {/* Active Conditions */}
              {selectedCombatant.conditions && selectedCombatant.conditions.length > 0 && (
                <div className="card bg-orange-50/50 dark:bg-orange-950/20 space-y-2">
                  <div className="lbl">Active Conditions</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCombatant.conditions.map((cond, idx) => (
                      <button
                        key={idx}
                        className="px-3 py-1 text-sm bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-300 rounded-full font-medium border border-orange-300 dark:border-orange-800 cursor-pointer transition-colors"
                        onClick={() => {
                          const conditionData = conditionsData[cond.toLowerCase()];
                          if (conditionData) {
                            setSelectedCondition(conditionData);
                            setConditionName(cond);
                            setShowConditionModal(true);
                          }
                        }}
                        {...getConditionTooltipHandlers(cond)}
                      >
                        {cond}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div className="card bg-slate-50/50 dark:bg-slate-900/20 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="lbl">CR</span>
                  <div className="relative group">
                    <span className="dark:text-slate-200 cursor-help">{selectedCombatant.cr || '—'}</span>
                    {ecrData && (
                      <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 w-64 p-3 bg-slate-800 dark:bg-slate-900 border border-slate-600 rounded-lg shadow-xl text-xs">
                        <div className="font-bold text-amber-400 mb-2">ML Predicted eCR</div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Predicted eCR:</span>
                            <span className="text-white font-semibold">{ecrData.ecr}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Official CR:</span>
                            <span className="text-slate-300">{ecrData.officialCR}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Rule-based:</span>
                            <span className="text-slate-300">{ecrData.ruleBasedECR}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Confidence:</span>
                            <span className={`font-medium ${
                              ecrData.confidence === 'high' ? 'text-green-400' :
                              ecrData.confidence === 'medium' ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {ecrData.confidence.toUpperCase()}
                            </span>
                          </div>
                          <div className="border-t border-slate-700 pt-1.5 mt-1.5 text-slate-400 italic text-[10px]">
                            Trained on {'>'}3000 5e monsters
                          </div>
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full right-4 -mt-1 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-slate-800 dark:border-t-slate-900"></div>
                      </div>
                    )}
                  </div>
                </div>
                {selectedCombatant.alignment && (
                  <div className="flex justify-between">
                    <span className="lbl">Alignment</span>
                    <span className="dark:text-slate-200">{selectedCombatant.alignment}</span>
                  </div>
                )}
              </div>

              {/* Speed */}
              {(selectedCombatant.speed || selectedCombatant.fly || selectedCombatant.swim || selectedCombatant.climb || selectedCombatant.burrow) && (
                <div className="card bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="lbl mb-2">Speed</div>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Walk speed */}
                    {selectedCombatant.speed && typeof selectedCombatant.speed !== 'object' && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-center border border-slate-200 dark:border-slate-700">
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {typeof selectedCombatant.speed === 'string' ? selectedCombatant.speed.replace(' ft.', '') : selectedCombatant.speed}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Walk
                        </div>
                      </div>
                    )}
                    {/* Fly speed */}
                    {selectedCombatant.fly && (
                      <div className="bg-sky-50 dark:bg-sky-900/20 rounded-lg p-2 text-center border border-sky-200 dark:border-sky-800">
                        <div className="text-2xl font-bold text-sky-700 dark:text-sky-300">
                          {typeof selectedCombatant.fly === 'string' ? selectedCombatant.fly.replace(' ft.', '') : selectedCombatant.fly}
                        </div>
                        <div className="text-xs text-sky-600 dark:text-sky-400 uppercase tracking-wide">
                          Fly
                        </div>
                      </div>
                    )}
                    {/* Swim speed */}
                    {selectedCombatant.swim && (
                      <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-2 text-center border border-cyan-200 dark:border-cyan-800">
                        <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">
                          {typeof selectedCombatant.swim === 'string' ? selectedCombatant.swim.replace(' ft.', '') : selectedCombatant.swim}
                        </div>
                        <div className="text-xs text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                          Swim
                        </div>
                      </div>
                    )}
                    {/* Climb speed */}
                    {selectedCombatant.climb && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center border border-emerald-200 dark:border-emerald-800">
                        <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                          {typeof selectedCombatant.climb === 'string' ? selectedCombatant.climb.replace(' ft.', '') : selectedCombatant.climb}
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          Climb
                        </div>
                      </div>
                    )}
                    {/* Burrow speed */}
                    {selectedCombatant.burrow && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center border border-amber-200 dark:border-amber-800">
                        <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                          {typeof selectedCombatant.burrow === 'string' ? selectedCombatant.burrow.replace(' ft.', '') : selectedCombatant.burrow}
                        </div>
                        <div className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          Burrow
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Senses */}
              <div className="card bg-purple-50/50 dark:bg-purple-950/20">
                <div className="lbl mb-2">Senses</div>
                {(() => {
                  // Get ability scores (stored directly on combatant, not under abilities)
                  const wisdomMod = Math.floor(((selectedCombatant.wis || selectedCombatant.abilities?.wis || 10) - 10) / 2);
                  const intelligenceMod = Math.floor(((selectedCombatant.int || selectedCombatant.abilities?.int || 10) - 10) / 2);

                  // Parse special senses from senses string
                  const sensesData = {};
                  if (selectedCombatant.senses) {
                    const senseParts = selectedCombatant.senses.split(',');
                    senseParts.forEach(part => {
                      const trimmed = part.trim();
                      const match = trimmed.match(/^([^:]+):\s*(\d+)/);
                      if (match) {
                        const [, name, value] = match;
                        sensesData[name.toLowerCase().trim()] = parseInt(value);
                      } else if (trimmed.toLowerCase().includes('passive')) {
                        const passiveMatch = trimmed.match(/passive\s*(\w+)\s*(\d+)/i);
                        if (passiveMatch) {
                          sensesData[`passive${passiveMatch[1].toLowerCase()}`] = parseInt(passiveMatch[2]);
                        }
                      }
                    });
                  }

                  // Calculate passive skills
                  const perceptionBonus = selectedCombatant.skill?.perception ?? selectedCombatant.skills?.perception ?? wisdomMod;
                  const passivePerception = sensesData.passiveperception || selectedCombatant.passive || (10 + perceptionBonus);

                  const insightBonus = selectedCombatant.skill?.insight ?? selectedCombatant.skills?.insight ?? wisdomMod;
                  const passiveInsight = sensesData.passiveinsight || (10 + insightBonus);

                  const investigationBonus = selectedCombatant.skill?.investigation ?? selectedCombatant.skills?.investigation ?? intelligenceMod;
                  const passiveInvestigation = sensesData.passiveinvestigation || (10 + investigationBonus);

                  return (
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        {/* Special Senses */}
                        {sensesData.darkvision && (
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300 font-medium">Darkvision</td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">{sensesData.darkvision} ft.</td>
                          </tr>
                        )}
                        {sensesData.blindsight && (
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300 font-medium">Blindsight</td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">{sensesData.blindsight} ft.</td>
                          </tr>
                        )}
                        {sensesData.truesight && (
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300 font-medium">Truesight</td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">{sensesData.truesight} ft.</td>
                          </tr>
                        )}
                        {sensesData.tremorsense && (
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300 font-medium">Tremorsense</td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">{sensesData.tremorsense} ft.</td>
                          </tr>
                        )}

                        {/* Passive Skills - Always shown */}
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300 font-medium">Passive Perception</td>
                          <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">{passivePerception}</td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300 font-medium">Passive Insight</td>
                          <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">{passiveInsight}</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300 font-medium">Passive Investigation</td>
                          <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">{passiveInvestigation}</td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              {/* Legendary Resistances */}
              {selectedCombatant.legendaryResistances !== undefined && (
                <div className="card bg-orange-50/50 dark:bg-orange-950/20">
                  <div className="flex justify-between items-center mb-2">
                    <div className="lbl">Legendary Resistances</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {selectedCombatant.legendaryResistances || 0}/3 per day
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                      <button
                        key={i}
                        className={`flex-1 h-10 rounded-lg border-2 transition-all cursor-pointer hover:scale-105 ${
                          (selectedCombatant.legendaryResistances || 0) >= i
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-amber-600 shadow-lg'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-amber-400'
                        }`}
                        onClick={() => {
                          const current = selectedCombatant.legendaryResistances || 0;
                          updateCombatant(selectedCombatant.id, {
                            legendaryResistances: current >= i ? i - 1 : i
                          });
                        }}
                        title={`Click to ${(selectedCombatant.legendaryResistances || 0) >= i ? 'use' : 'restore'}`}
                      >
                        {(selectedCombatant.legendaryResistances || 0) >= i && (
                          <span className="text-white font-bold text-lg">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}


              {/* Skills */}
              {(() => {
                const skillsObj = selectedCombatant.skill || selectedCombatant.skills || {};
                return Object.keys(skillsObj).length > 0 && (
                  <div className="card bg-amber-50/50 dark:bg-amber-950/20 text-sm">
                    <div className="lbl mb-1">Skills</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(skillsObj).map(([skill, bonus]) => {
                      const notation = bonus >= 0 ? `1d20+${bonus}` : `1d20${bonus}`;
                      const label = `${selectedCombatant.name} - ${skill.charAt(0).toUpperCase() + skill.slice(1)}`;

                      return (
                        <button
                          key={skill}
                          className="flex justify-between items-center px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors cursor-pointer text-left"
                          onClick={() => handleRoll({ notation, label, rollMode: 'normal', character: selectedCombatant.name })}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDiceContextMenu({
                              show: true,
                              x: e.clientX,
                              y: e.clientY,
                              notation,
                              type: 'd20',
                              label
                            });
                          }}
                          title="Left: Roll | Right: Adv/Dis"
                        >
                          <span className="text-slate-600 dark:text-slate-400 capitalize">{skill}</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{bonus >= 0 ? '+' : ''}{bonus}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {/* Defenses - Combined Card */}
              {(selectedCombatant.damageVulnerabilities?.length > 0 ||
                selectedCombatant.damageResistances?.length > 0 ||
                selectedCombatant.damageImmunities?.length > 0 ||
                selectedCombatant.conditionImmunities?.length > 0) && (
                <div className="card bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
                  {/* Damage Vulnerabilities */}
                  {selectedCombatant.damageVulnerabilities?.length > 0 && (
                    <div>
                      <div className="lbl mb-2">Vulnerabilities</div>
                      <div className="flex flex-wrap gap-2">
                        {[...selectedCombatant.damageVulnerabilities]
                          .sort((a, b) => a.localeCompare(b))
                          .map((vuln, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium border border-red-300 dark:border-red-800"
                            >
                              {vuln.charAt(0).toUpperCase() + vuln.slice(1).toLowerCase()}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Damage Resistances */}
                  {selectedCombatant.damageResistances?.length > 0 && (
                    <div>
                      <div className="lbl mb-2">Resistances</div>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const resistances = [...selectedCombatant.damageResistances];
                          const hasBludgeoning = resistances.some(r => r.toLowerCase().includes('bludgeoning'));
                          const hasPiercing = resistances.some(r => r.toLowerCase().includes('piercing'));
                          const hasSlashing = resistances.some(r => r.toLowerCase().includes('slashing'));

                          // If all three BPS are present, combine them
                          if (hasBludgeoning && hasPiercing && hasSlashing) {
                            const filtered = resistances.filter(r =>
                              !r.toLowerCase().includes('bludgeoning') &&
                              !r.toLowerCase().includes('piercing') &&
                              !r.toLowerCase().includes('slashing')
                            );

                            // Check if there's additional context (like "from nonmagical attacks")
                            const bpsEntry = resistances.find(r => r.toLowerCase().includes('bludgeoning'));
                            const context = bpsEntry?.match(/from .+$/i)?.[0] || 'from non-magical weapons';

                            return [
                              <span
                                key="bps"
                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-300 dark:border-blue-800"
                              >
                                {`Bludgeoning, Piercing, Slashing ${context}`}
                              </span>,
                              ...filtered.sort((a, b) => a.localeCompare(b)).map((res, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-300 dark:border-blue-800"
                                >
                                  {res.charAt(0).toUpperCase() + res.slice(1).toLowerCase()}
                                </span>
                              ))
                            ];
                          }

                          // Otherwise show all individually
                          return resistances.sort((a, b) => a.localeCompare(b)).map((res, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-300 dark:border-blue-800"
                            >
                              {res.charAt(0).toUpperCase() + res.slice(1).toLowerCase()}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Damage Immunities */}
                  {selectedCombatant.damageImmunities?.length > 0 && (
                    <div>
                      <div className="lbl mb-2">Damage Immunities</div>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const immunities = [...selectedCombatant.damageImmunities];
                          const hasBludgeoning = immunities.some(r => r.toLowerCase().includes('bludgeoning'));
                          const hasPiercing = immunities.some(r => r.toLowerCase().includes('piercing'));
                          const hasSlashing = immunities.some(r => r.toLowerCase().includes('slashing'));

                          // If all three BPS are present, combine them
                          if (hasBludgeoning && hasPiercing && hasSlashing) {
                            const filtered = immunities.filter(r =>
                              !r.toLowerCase().includes('bludgeoning') &&
                              !r.toLowerCase().includes('piercing') &&
                              !r.toLowerCase().includes('slashing')
                            );

                            const bpsEntry = immunities.find(r => r.toLowerCase().includes('bludgeoning'));
                            const context = bpsEntry?.match(/from .+$/i)?.[0] || 'from non-magical weapons';

                            return [
                              <span
                                key="bps"
                                className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium border border-green-300 dark:border-green-800"
                              >
                                {`Bludgeoning, Piercing, Slashing ${context}`}
                              </span>,
                              ...filtered.sort((a, b) => a.localeCompare(b)).map((imm, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium border border-green-300 dark:border-green-800"
                                >
                                  {imm.charAt(0).toUpperCase() + imm.slice(1).toLowerCase()}
                                </span>
                              ))
                            ];
                          }

                          return immunities.sort((a, b) => a.localeCompare(b)).map((imm, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium border border-green-300 dark:border-green-800"
                            >
                              {imm.charAt(0).toUpperCase() + imm.slice(1).toLowerCase()}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Condition Immunities */}
                  {selectedCombatant.conditionImmunities?.length > 0 && (
                    <div>
                      <div className="lbl mb-2">Condition Immunities</div>
                      <div className="flex flex-wrap gap-2">
                        {[...selectedCombatant.conditionImmunities]
                          .sort((a, b) => a.localeCompare(b))
                          .map((cond, idx) => (
                            <button
                              key={idx}
                              className="px-3 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-300 dark:border-amber-800 cursor-pointer transition-colors"
                              onClick={() => {
                                const conditionData = conditionsData[cond.toLowerCase()];
                                if (conditionData) {
                                  setSelectedCondition(conditionData);
                                  setConditionName(cond);
                                  setShowConditionModal(true);
                                }
                              }}
                              {...getConditionTooltipHandlers(cond)}
                            >
                              {cond.charAt(0).toUpperCase() + cond.slice(1).toLowerCase()}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Spell Slots */}
              {selectedCombatant.spellSlots && Object.keys(selectedCombatant.spellSlots).length > 0 && (
                <div className="card bg-indigo-50/50 dark:bg-indigo-950/20">
                  <div className="lbl mb-2">Spell Slots</div>
                  <div className="space-y-3">
                    {Object.entries(selectedCombatant.spellSlots).sort(([a], [b]) => Number(a) - Number(b)).map(([level, slots]) => (
                      <div key={level} className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                          Level {level}
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <div className={`marker-coins spell ${(slots.current || 0) > 0 ? 'active' : 'inactive'}`}>
                            {[...Array(slots.max || 0)].map((_, idx) => (
                              <div
                                key={idx}
                                className="coin"
                                onClick={() => {
                                  const newCurrent = idx < slots.current ? idx : idx + 1;
                                  updateCombatant(selectedCombatant.id, {
                                    spellSlots: {
                                      ...selectedCombatant.spellSlots,
                                      [level]: { ...slots, current: newCurrent }
                                    }
                                  });
                                }}
                                title={idx < slots.current ? 'Click to use slot' : 'Click to restore slot'}
                                style={{
                                  opacity: idx < (slots.current || 0) ? 1 : 0.3,
                                  width: '24px',
                                  height: '24px'
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 ml-1.5 min-w-[2rem]">
                            {slots.current || 0}/{slots.max || 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spellcasting */}
              {selectedCombatant.spellcasting && selectedCombatant.spellcasting.length > 0 && (
                <div className="space-y-3">
                  <div className="h2">Spellcasting</div>
                  {selectedCombatant.spellcasting.map((sc, idx) => (
                    <div key={idx} className="card bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
                      {/* Header */}
                      {sc.name && <div className="lbl">{sc.name}</div>}
                      {sc.notes && (
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          <RollableText text={sc.notes} onRoll={handleRoll} />
                        </div>
                      )}
                      {sc.headerEntries && sc.headerEntries.map((entry, i) => (
                        <div key={i} className="text-sm text-slate-700 dark:text-slate-300">
                          <RollableText text={typeof entry === 'string' ? entry : entry.entry || ''} onRoll={handleRoll} />
                        </div>
                      ))}

                      {/* At Will Spells */}
                      {sc.will && sc.will.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">At Will</div>
                          <div className="flex flex-wrap gap-2">
                            {sc.will.map((spell, i) => {
                              const spellName = spell.replace(/[{}]/g, '');
                              const capitalizedSpell = spellName.split(' ').map(word =>
                                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                              ).join(' ');

                              return (
                                <button
                                  key={i}
                                  className="px-3 py-1 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded-md text-sm font-medium transition-colors"
                                  onClick={() => {
                                    const spellData = combatantSpellCache[selectedCombatantId]?.[spellName.toLowerCase()];
                                    if (spellData) {
                                      setSelectedSpell(spellData); setShowSpellModal(true);
                                    }
                                  }}
                                  {...getSpellTooltipHandlers(spellName)}
                                >
                                  {capitalizedSpell}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Daily Spells */}
                      {sc.daily && (
                        <div className="space-y-2">
                          {Object.entries(sc.daily).map(([freq, spells]) => {
                            const maxUses = parseInt(freq.charAt(0)) || 1;
                            return (
                              <div key={freq}>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                    {freq === '1e' ? '1/day each' : freq === '2e' ? '2/day each' : freq === '3e' ? '3/day each' : freq}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {spells.map((spell, i) => {
                                    const spellName = spell.replace(/[{}]/g, '');
                                    const capitalizedSpell = spellName.split(' ').map(word =>
                                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                    ).join(' ');

                                    const dailyKey = `daily_${freq}_${spellName.toLowerCase().replace(/\s+/g, '_')}`;
                                    const usesRemaining = selectedCombatant.dailySpellUses?.[dailyKey] ?? maxUses;

                                    return (
                                      <div key={i} className="flex items-center gap-1">
                                        <button
                                          className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-md text-sm font-medium transition-colors"
                                          onClick={() => {
                                            const spellData = combatantSpellCache[selectedCombatantId]?.[spellName.toLowerCase()];
                                            if (spellData) {
                                              setSelectedSpell(spellData); setShowSpellModal(true);
                                            }
                                          }}
                                          {...getSpellTooltipHandlers(spellName)}
                                        >
                                          {capitalizedSpell}
                                        </button>
                                        {/* Spell use markers */}
                                        <div className={`marker-coins spell ${usesRemaining > 0 ? 'active' : 'inactive'}`}>
                                          {[...Array(maxUses)].map((_, idx) => (
                                            <div
                                              key={idx}
                                              className="coin"
                                              onClick={() => {
                                                const newUses = { ...selectedCombatant.dailySpellUses || {} };
                                                if (idx < usesRemaining) {
                                                  // Clicking a filled slot - empty it and all after
                                                  newUses[dailyKey] = idx;
                                                } else {
                                                  // Clicking an empty slot - fill up to and including this one
                                                  newUses[dailyKey] = idx + 1;
                                                }
                                                updateCombatant(selectedCombatant.id, { dailySpellUses: newUses });
                                              }}
                                              onContextMenu={(e) => {
                                                e.preventDefault();
                                                // Right click resets to max
                                                const newUses = { ...selectedCombatant.dailySpellUses || {} };
                                                newUses[dailyKey] = maxUses;
                                                updateCombatant(selectedCombatant.id, { dailySpellUses: newUses });
                                              }}
                                              title={idx < usesRemaining ? "Left: Use | Right: Restore all" : "Click to restore"}
                                              style={{
                                                opacity: idx < usesRemaining ? 1 : 0.3
                                              }}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Leveled Spells with Slots */}
                      {sc.spellsByLevel && sc.spellsByLevel.map((levelData, i) => {
                        if (levelData.level === 0) {
                          // Cantrips
                          return (
                            <div key={i}>
                              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cantrips</div>
                              <div className="flex flex-wrap gap-2">
                                {levelData.spells.map((spell, j) => {
                                  const spellName = spell.replace(/[{}]/g, '');
                                  const capitalizedSpell = spellName.split(' ').map(word =>
                                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                  ).join(' ');

                                  return (
                                    <button
                                      key={j}
                                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-md text-sm font-medium transition-colors"
                                      onClick={() => {
                                        const spellData = combatantSpellCache[selectedCombatantId]?.[spellName.toLowerCase()];
                                        if (spellData) {
                                          setSelectedSpell(spellData); setShowSpellModal(true);
                                        }
                                      }}
                                      {...getSpellTooltipHandlers(spellName)}
                                    >
                                      {capitalizedSpell}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        } else {
                          // Leveled spells with slots
                          const slotKey = `${levelData.level}`;
                          const slots = selectedCombatant.spellSlots?.[slotKey] || { current: levelData.slots || 0, max: levelData.slots || 0 };

                          return (
                            <div key={i}>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  Level {levelData.level}
                                </div>
                                {/* Spell Slots */}
                                <div className={`marker-coins spell ${(slots.current || 0) > 0 ? 'active' : 'inactive'}`}>
                                  {[...Array(slots.max || 0)].map((_, idx) => (
                                    <div
                                      key={idx}
                                      className="coin"
                                      onClick={() => {
                                        const newSlots = { ...selectedCombatant.spellSlots };
                                        if (!newSlots[slotKey]) {
                                          newSlots[slotKey] = { current: slots.max, max: slots.max };
                                        }
                                        if (idx < newSlots[slotKey].current) {
                                          // Clicked on a filled slot - empty it and all after
                                          newSlots[slotKey].current = idx;
                                        } else {
                                          // Clicked on an empty slot - fill up to and including this one
                                          newSlots[slotKey].current = idx + 1;
                                        }
                                        updateCombatant(selectedCombatant.id, { spellSlots: newSlots });
                                      }}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        // Right click resets all slots of this level
                                        const newSlots = { ...selectedCombatant.spellSlots };
                                        newSlots[slotKey] = { ...newSlots[slotKey], current: slots.max };
                                        updateCombatant(selectedCombatant.id, { spellSlots: newSlots });
                                      }}
                                      title={idx < (slots.current || 0) ? "Left: Use slot | Right: Restore all" : "Click to restore"}
                                      style={{
                                        opacity: idx < (slots.current || 0) ? 1 : 0.3,
                                        width: '20px',
                                        height: '20px'
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {levelData.spells.map((spell, j) => {
                                  const spellName = spell.replace(/[{}]/g, '');
                                  const capitalizedSpell = spellName.split(' ').map(word =>
                                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                  ).join(' ');

                                  return (
                                    <button
                                      key={j}
                                      className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 rounded-md text-sm font-medium transition-colors"
                                      onClick={() => {
                                        const spellData = combatantSpellCache[selectedCombatantId]?.[spellName.toLowerCase()];
                                        if (spellData) {
                                          setSelectedSpell(spellData); setShowSpellModal(true);
                                        }
                                      }}
                                      {...getSpellTooltipHandlers(spellName)}
                                    >
                                      {capitalizedSpell}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                      })}

                      {/* Old format support */}
                      {sc.spells && Object.entries(sc.spells).map(([level, spellData]) => (
                        <div key={level}>
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{level}</div>
                          <div className="flex flex-wrap gap-2">
                            {(spellData.spells || []).map((spell, i) => {
                              const spellName = spell.replace(/[{}]/g, '');
                              const capitalizedSpell = spellName.split(' ').map(word =>
                                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                              ).join(' ');

                              return (
                                <button
                                  key={i}
                                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-md text-sm font-medium transition-colors"
                                  onClick={() => {
                                    const spellData = combatantSpellCache[selectedCombatantId]?.[spellName.toLowerCase()];
                                    if (spellData) {
                                      setSelectedSpell(spellData); setShowSpellModal(true);
                                    }
                                  }}
                                  {...getSpellTooltipHandlers(spellName)}
                                >
                                  {capitalizedSpell}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Traits */}
              {selectedCombatant.traits && selectedCombatant.traits.length > 0 && (
                <div className="space-y-2">
                  <div className="h2">Traits</div>
                  {selectedCombatant.traits.map((trait, idx) => {
                    // Check if this is a Legendary Resistance trait
                    const isLegendaryResistance = trait.name && trait.name.match(/Legendary Resistance\s*\((\d+)\/Day\)/i);

                    return (
                      <div key={idx} className="card bg-slate-50/50 dark:bg-slate-900/20 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold dark:text-slate-200">{trait.name}</div>
                          {/* Legendary Resistance Counter */}
                          {isLegendaryResistance && selectedCombatant.legendaryResistanceMax > 0 && (
                            <div className={`marker-coins legendary ${(selectedCombatant.legendaryResistanceRemaining ?? 0) > 0 ? 'active' : 'inactive'}`}>
                              {[...Array(selectedCombatant.legendaryResistanceMax)].map((_, i) => (
                                <div
                                  key={i}
                                  className="coin"
                                  onClick={() => {
                                    const current = selectedCombatant.legendaryResistanceRemaining ?? 0;
                                    updateCombatant(selectedCombatant.id, {
                                      legendaryResistanceRemaining: current >= (i + 1) ? i : i + 1
                                    });
                                  }}
                                  title={`Legendary Resistance ${i + 1}`}
                                  style={{
                                    opacity: (selectedCombatant.legendaryResistanceRemaining ?? 0) >= (i + 1) ? 1 : 0.3,
                                    width: '24px',
                                    height: '24px'
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                          <RollableText text={trait.desc} onRoll={handleRoll} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              {selectedCombatant.actions && selectedCombatant.actions.length > 0 && (
                <div className="space-y-2">
                  <div className="h2 text-slate-800 dark:text-slate-200">Actions</div>
                  {selectedCombatant.actions.map((action, idx) => {
                    const formatted = formatActionName(action.name);
                    const rechargeKey = `recharge_action_${idx}`;
                    const isAvailable = selectedCombatant.rechargeAbilities?.[rechargeKey] ?? true;
                    const parsed = parseActionDescription(action.desc);

                    return (
                      <div key={idx} className="card bg-slate-50 dark:bg-slate-800/50 border-l-4 border-slate-400 dark:border-slate-500 text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{formatted.name}</div>
                            {formatted.recharge && (
                              <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                                Recharge {formatted.recharge}
                              </span>
                            )}
                          </div>
                          {formatted.recharge && (
                            <div className={`marker-coins recharge ${isAvailable ? 'active' : 'inactive'}`}>
                              <div
                                className="coin"
                                onClick={() => {
                                  const newRecharge = { ...selectedCombatant.rechargeAbilities || {} };
                                  newRecharge[rechargeKey] = !isAvailable;
                                  updateCombatant(selectedCombatant.id, { rechargeAbilities: newRecharge });
                                }}
                                title={isAvailable ? "Click to mark as used" : "Click to mark as available"}
                              />
                            </div>
                          )}
                        </div>

                        {parsed && parsed.type === 'attack' ? (
                          <>
                            {/* Structured Attack Table */}
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-2 text-xs bg-slate-100 dark:bg-slate-900/30 p-2 rounded">
                              <div className="font-semibold text-slate-600 dark:text-slate-400">Type:</div>
                              <div className="text-slate-700 dark:text-slate-300">
                                {parsed.attackType.toUpperCase() === 'MW' && 'Melee Weapon'}
                                {parsed.attackType.toUpperCase() === 'RW' && 'Ranged Weapon'}
                                {parsed.attackType.toUpperCase() === 'MS' && 'Melee Spell'}
                                {parsed.attackType.toUpperCase() === 'RS' && 'Ranged Spell'}
                                {(parsed.attackType.toUpperCase() === 'MW,RW' || parsed.attackType.toUpperCase() === 'RW,MW') && 'Melee or Ranged Weapon'}
                              </div>

                              <div className="font-semibold text-slate-600 dark:text-slate-400">To Hit:</div>
                              <div>
                                <button
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/60 text-green-800 dark:text-green-300 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border border-green-300 dark:border-green-700"
                                  onClick={() => {
                                    const bonus = parsed.toHit.startsWith('+') || parsed.toHit.startsWith('-') ? parsed.toHit : `+${parsed.toHit}`;
                                    const notation = `1d20${bonus}`;
                                    rollDice({
                                      notation: notation,
                                      rollMode: "normal",
                                      label: `${selectedCombatant.name} - ${action.name} - Attack`,
                                      character: selectedCombatant.name
                                    });
                                    handleRoll();
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    const bonus = parsed.toHit.startsWith('+') || parsed.toHit.startsWith('-') ? parsed.toHit : `+${parsed.toHit}`;
                                    const notation = `1d20${bonus}`;
                                    setDiceContextMenu({
                                      show: true,
                                      x: e.clientX,
                                      y: e.clientY,
                                      notation: notation,
                                      type: "d20",
                                      label: `${selectedCombatant.name} - ${action.name} - Attack`,
                                      character: selectedCombatant.name
                                    });
                                  }}
                                  title="Left: Roll | Right: Adv/Dis"
                                >
                                  ⚔️ {parsed.toHit.startsWith('+') || parsed.toHit.startsWith('-') ? parsed.toHit : `+${parsed.toHit}`}
                                </button>
                              </div>

                              {parsed.reach && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">
                                    {parsed.attackType.toLowerCase().includes('r') ? 'Range:' : 'Reach:'}
                                  </div>
                                  <div className="text-slate-700 dark:text-slate-300">{parsed.reach}</div>
                                </>
                              )}

                              <div className="font-semibold text-slate-600 dark:text-slate-400">Target:</div>
                              <div className="text-slate-700 dark:text-slate-300 capitalize">{parsed.target}</div>

                              {parsed.damages && parsed.damages.length > 0 && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Damage:</div>
                                  <div className="flex flex-col gap-1">
                                    {parsed.damages.map((dmg, dmgIdx) => (
                                      <div key={dmgIdx} className="flex items-center gap-2">
                                        <button
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60 text-blue-800 dark:text-blue-300 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border border-blue-300 dark:border-blue-700"
                                          onClick={() => {
                                            rollDice({
                                              notation: dmg.dice.replace(/\s+/g, ''),
                                              rollMode: "normal",
                                              label: `${selectedCombatant.name} - ${action.name} - ${dmg.type} Damage`,
                                              character: selectedCombatant.name
                                            });
                                            handleRoll();
                                          }}
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            setDiceContextMenu({
                                              show: true,
                                              x: e.clientX,
                                              y: e.clientY,
                                              notation: dmg.dice.replace(/\s+/g, ''),
                                              type: "damage",
                                              label: `${selectedCombatant.name} - ${action.name} - ${dmg.type} Damage`,
                                              character: selectedCombatant.name
                                            });
                                          }}
                                          title="Left: Roll | Right: Crit"
                                        >
                                          🎲 {dmg.dice}
                                        </button>
                                        <span className="text-slate-600 dark:text-slate-400">
                                          {dmg.type} <span className="text-xs">(avg: {dmg.average})</span>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Remaining description */}
                            {parsed.remainingDesc && parsed.remainingDesc.trim() !== '.' && parsed.remainingDesc.trim() !== '' && (
                              <div className="text-slate-700 dark:text-slate-300 text-xs">
                                <RollableText text={parsed.remainingDesc} onRoll={handleRoll} character={selectedCombatant.name} actionName={action.name} removeAttackText={true} />
                              </div>
                            )}
                          </>
                        ) : parsed && parsed.type === 'save' ? (
                          <>
                            {/* Saving Throw Action */}
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-2 text-xs bg-slate-100 dark:bg-slate-900/30 p-2 rounded">
                              {parsed.targetInfo && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Target:</div>
                                  <div className="text-slate-700 dark:text-slate-300 capitalize">{parsed.targetInfo}</div>
                                </>
                              )}

                              {parsed.range && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Range:</div>
                                  <div className="text-slate-700 dark:text-slate-300">{parsed.range}</div>
                                </>
                              )}

                              {parsed.condition && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Condition:</div>
                                  <div className="text-slate-700 dark:text-slate-300">{parsed.condition}</div>
                                </>
                              )}

                              {parsed.area && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Area:</div>
                                  <div className="text-slate-700 dark:text-slate-300 capitalize">{parsed.area}</div>
                                </>
                              )}

                              <div className="font-semibold text-slate-600 dark:text-slate-400">Save:</div>
                              <div className="text-slate-700 dark:text-slate-300">
                                DC {parsed.dc} {parsed.ability.charAt(0).toUpperCase() + parsed.ability.slice(1)}
                              </div>

                              {parsed.damage && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Damage Type:</div>
                                  <div className="text-slate-700 dark:text-slate-300 capitalize">{parsed.damage.type}</div>

                                  <div className="font-semibold text-slate-600 dark:text-slate-400">On Failure:</div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 text-red-800 dark:text-red-300 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border border-red-300 dark:border-red-700"
                                      onClick={() => {
                                        rollDice({
                                          notation: parsed.damage.dice.replace(/\s+/g, ''),
                                          rollMode: "normal",
                                          label: `${selectedCombatant.name} - ${action.name} - Damage`,
                                          character: selectedCombatant.name
                                        });
                                        handleRoll();
                                      }}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        setDiceContextMenu({
                                          show: true,
                                          x: e.clientX,
                                          y: e.clientY,
                                          notation: parsed.damage.dice.replace(/\s+/g, ''),
                                          type: "damage",
                                          label: `${selectedCombatant.name} - ${action.name} - Damage`,
                                          character: selectedCombatant.name
                                        });
                                      }}
                                      title="Left: Roll | Right: Crit"
                                    >
                                      🎲 {parsed.damage.dice}
                                    </button>
                                    <span className="text-slate-600 dark:text-slate-400">
                                      (avg: {parsed.damage.average})
                                    </span>
                                  </div>

                                  {parsed.successEffect && (
                                    <>
                                      <div className="font-semibold text-slate-600 dark:text-slate-400">On Success:</div>
                                      <div className="text-slate-700 dark:text-slate-300 capitalize">{parsed.successEffect}</div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Full Description Text */}
                            <div className="text-slate-700 dark:text-slate-300 text-xs mt-2">
                              <RollableText text={action.desc} onRoll={handleRoll} character={selectedCombatant.name} actionName={action.name} />
                            </div>
                          </>
                        ) : (
                          <div className="text-slate-700 dark:text-slate-300">
                            <RollableText text={action.desc} onRoll={handleRoll} character={selectedCombatant.name} actionName={action.name} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bonus Actions */}
              {selectedCombatant.bonusActions && selectedCombatant.bonusActions.length > 0 && (
                <div className="space-y-2">
                  <div className="h2 text-blue-700 dark:text-blue-400">Bonus Actions</div>
                  {selectedCombatant.bonusActions.map((action, idx) => {
                    const formatted = formatActionName(action.name);
                    const rechargeKey = `recharge_bonus_${idx}`;
                    const isAvailable = selectedCombatant.rechargeAbilities?.[rechargeKey] ?? true;
                    const parsed = parseActionDescription(action.desc);

                    return (
                      <div key={idx} className="card bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-blue-800 dark:text-blue-200">{formatted.name}</div>
                            {formatted.recharge && (
                              <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                                Recharge {formatted.recharge}
                              </span>
                            )}
                          </div>
                          {formatted.recharge && (
                            <div className={`marker-coins recharge ${isAvailable ? 'active' : 'inactive'}`}>
                              <div
                                className="coin"
                                onClick={() => {
                                  const newRecharge = { ...selectedCombatant.rechargeAbilities || {} };
                                  newRecharge[rechargeKey] = !isAvailable;
                                  updateCombatant(selectedCombatant.id, { rechargeAbilities: newRecharge });
                                }}
                                title={isAvailable ? "Click to mark as used" : "Click to mark as available"}
                              />
                            </div>
                          )}
                        </div>

                        {parsed && parsed.type === 'attack' ? (
                          <>
                            {/* Structured Attack Table */}
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-2 text-xs bg-blue-100 dark:bg-blue-900/30 p-2 rounded">
                              <div className="font-semibold text-slate-600 dark:text-slate-400">Type:</div>
                              <div className="text-slate-700 dark:text-slate-300">
                                {parsed.attackType.toUpperCase() === 'MW' && 'Melee Weapon'}
                                {parsed.attackType.toUpperCase() === 'RW' && 'Ranged Weapon'}
                                {parsed.attackType.toUpperCase() === 'MS' && 'Melee Spell'}
                                {parsed.attackType.toUpperCase() === 'RS' && 'Ranged Spell'}
                                {(parsed.attackType.toUpperCase() === 'MW,RW' || parsed.attackType.toUpperCase() === 'RW,MW') && 'Melee or Ranged Weapon'}
                              </div>

                              <div className="font-semibold text-slate-600 dark:text-slate-400">To Hit:</div>
                              <div className="text-slate-700 dark:text-slate-300">
                                <button
                                  onClick={() => handleRoll(`1d20${parsed.toHit}`, selectedCombatant.name, `${action.name} Attack`)}
                                  className="px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-mono rounded shadow-sm"
                                >
                                  {parsed.toHit}
                                </button>
                              </div>

                              <div className="font-semibold text-slate-600 dark:text-slate-400">Reach/Range:</div>
                              <div className="text-slate-700 dark:text-slate-300">{parsed.reach}</div>

                              {parsed.target && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Target:</div>
                                  <div className="text-slate-700 dark:text-slate-300">{parsed.target}</div>
                                </>
                              )}
                            </div>

                            {/* Damage Buttons */}
                            {parsed.damages && parsed.damages.length > 0 && (
                              <div className="mb-2">
                                <div className="font-semibold text-xs text-slate-600 dark:text-slate-400 mb-1">Hit:</div>
                                <div className="flex flex-wrap gap-2">
                                  {parsed.damages.map((dmg, dmgIdx) => (
                                    <button
                                      key={dmgIdx}
                                      onClick={() => handleRoll(dmg.dice, selectedCombatant.name, `${action.name} Damage`)}
                                      className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-mono rounded shadow-sm"
                                    >
                                      {dmg.average} ({dmg.dice}) {dmg.type}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Remaining Description */}
                            {parsed.remainingDesc && (
                              <div className="text-slate-700 dark:text-slate-300">
                                <RollableText text={parsed.remainingDesc} onRoll={handleRoll} character={selectedCombatant.name} actionName={action.name} />
                              </div>
                            )}
                          </>
                        ) : parsed && parsed.type === 'save' ? (
                          <>
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mb-2">
                              <div className="font-semibold text-slate-600 dark:text-slate-400">Type:</div>
                              <div className="text-slate-700 dark:text-slate-300">{parsed.ability.toUpperCase()} Saving Throw</div>

                              <div className="font-semibold text-slate-600 dark:text-slate-400">DC:</div>
                              <div className="text-slate-700 dark:text-slate-300">{parsed.dc}</div>

                              {parsed.targetInfo && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Target:</div>
                                  <div className="text-slate-700 dark:text-slate-300">{parsed.targetInfo}</div>
                                </>
                              )}

                              {parsed.area && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Area:</div>
                                  <div className="text-slate-700 dark:text-slate-300 capitalize">{parsed.area}</div>
                                </>
                              )}

                              {parsed.damage && (
                                <>
                                  <div className="font-semibold text-slate-600 dark:text-slate-400">Damage Type:</div>
                                  <div className="text-slate-700 dark:text-slate-300 capitalize">{parsed.damage.type}</div>

                                  <div className="font-semibold text-slate-600 dark:text-slate-400">On Failure:</div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 text-red-800 dark:text-red-300 rounded font-mono text-xs font-semibold transition-colors cursor-pointer border border-red-300 dark:border-red-700"
                                      onClick={() => {
                                        rollDice({
                                          notation: parsed.damage.dice.replace(/\s+/g, ''),
                                          rollMode: "normal",
                                          label: `${selectedCombatant.name} - ${action.name} - Damage`,
                                          character: selectedCombatant.name
                                        });
                                        handleRoll();
                                      }}
                                    >
                                      <span className="text-[10px]">🎲</span>
                                      {parsed.damage.average} ({parsed.damage.dice})
                                    </button>
                                  </div>

                                  {parsed.damage.halfOnSuccess && (
                                    <>
                                      <div className="font-semibold text-slate-600 dark:text-slate-400">On Success:</div>
                                      <div className="text-slate-700 dark:text-slate-300">Half damage</div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Failure Effect */}
                            {parsed.failureEffect && (
                              <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/10 rounded border-l-2 border-red-400">
                                <div className="font-semibold text-red-800 dark:text-red-300 text-xs mb-1">On a Failed Save:</div>
                                <div className="text-slate-700 dark:text-slate-300 text-xs">
                                  <RollableText text={parsed.failureEffect} onRoll={handleRoll} character={selectedCombatant.name} actionName={action.name} />
                                </div>
                              </div>
                            )}

                            {/* Success Effect */}
                            {parsed.successEffect && (
                              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/10 rounded border-l-2 border-green-400">
                                <div className="font-semibold text-green-800 dark:text-green-300 text-xs mb-1">On a Successful Save:</div>
                                <div className="text-slate-700 dark:text-slate-300 text-xs">
                                  <RollableText text={parsed.successEffect} onRoll={handleRoll} character={selectedCombatant.name} actionName={action.name} />
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-slate-700 dark:text-slate-300">
                            <RollableText text={action.desc} onRoll={handleRoll} character={selectedCombatant.name} actionName={action.name} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reactions */}
              {selectedCombatant.reactions && selectedCombatant.reactions.length > 0 && (
                <div className="space-y-2">
                  <div className="h2 text-purple-700 dark:text-purple-400">Reactions</div>
                  {selectedCombatant.reactions.map((reaction, idx) => (
                    <div key={idx} className="card bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-400 dark:border-purple-500 text-sm">
                      <div className="font-semibold mb-1 text-purple-800 dark:text-purple-200">{reaction.name}</div>
                      <div className="text-slate-700 dark:text-slate-300">
                        <RollableText text={reaction.desc} onRoll={handleRoll} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Legendary Actions */}
              {selectedCombatant.legendary && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="h2 text-amber-700 dark:text-amber-400">Legendary Actions</div>
                    {/* Legendary Actions Counter */}
                    <div className={`marker-coins legendary ${(selectedCombatant.legendaryActionsRemaining ?? 3) > 0 ? 'active' : 'inactive'}`}>
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="coin"
                          onClick={() => {
                            const current = selectedCombatant.legendaryActionsRemaining ?? 3;
                            updateCombatant(selectedCombatant.id, {
                              legendaryActionsRemaining: current >= i ? i - 1 : i
                            });
                          }}
                          title={`Legendary Action ${i}`}
                          style={{
                            opacity: (selectedCombatant.legendaryActionsRemaining ?? 3) >= i ? 1 : 0.3,
                            width: '24px',
                            height: '24px'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {selectedCombatant.legendary.desc && (
                    <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-200 dark:border-amber-800">
                      <RollableText text={selectedCombatant.legendary.desc} onRoll={handleRoll} />
                    </div>
                  )}
                  {selectedCombatant.legendary.actions?.map((action, idx) => {
                    // Parse cost from name like "Attack (Costs 2 Actions)" or just default to 1
                    const costMatch = action.name.match(/\(Costs? (\d+) Actions?\)/i);
                    const cost = costMatch ? parseInt(costMatch[1]) : 1;

                    return (
                      <div key={idx} className="card bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 dark:border-amber-600 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-amber-800 dark:text-amber-200">{action.name}</div>
                          <button
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              const current = selectedCombatant.legendaryActionsRemaining ?? 3;
                              if (current >= cost) {
                                updateCombatant(selectedCombatant.id, {
                                  legendaryActionsRemaining: current - cost
                                });
                              }
                            }}
                            disabled={(selectedCombatant.legendaryActionsRemaining ?? 3) < cost}
                            title={`Use (costs ${cost} action${cost > 1 ? 's' : ''})`}
                          >
                            Use
                          </button>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                          <RollableText text={action.desc} onRoll={handleRoll} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FullscreenCreatureManager({
  creature,
  initialTab,
  initialSearch,
  onClose,
  onSave,
  onAddMonster,
  campaigns = [],
}) {
  const [tab, setTab] = useState(creature ? "form" : initialTab || "browse");
  const [list, setList] = useState([]);
  const [q, setQ] = useState(initialSearch || "");
  const [selectedTags, setSelectedTags] = useState([]);
  const [form, setForm] = useState(
    creature
      ? normalizeCreatureForForm(creature)
      : {
          name: "",
          ac: "",
          hp: "",
          cr: "",
          type: "",
          speed: "",
          initiativeMod: "",
          source: "homebrew",
          tags: [],
          imageUrl: "",
        }
  );
  const [jsonText, setJsonText] = useState(
    '[\n  { "name": "Bandit Captain", "ac": 15, "hp": 65, "cr": 2, "type": "humanoid (any)", "speed": "30 ft.", "initiativeMod": 2 }\n]'
  );
  const [ddbText, setDdbText] = useState(
    "Goblin\nSmall humanoid (goblinoid), neutral evil\nArmor Class 15 (leather armor, shield)\nHit Points 7 (2d6)\nSpeed 30 ft.\nChallenge 1/4 (50 XP)"
  );
  const [sourceTooltip, setSourceTooltip] = useState({
    source: null,
    fullName: null,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    apiGet(`/api/monsters?search=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then(setList);
  }, [q]);

  async function saveCreature() {
    const payload = {
      ...form,
      name: form.name.trim(),
      ac: numberOr(form.ac, undefined),
      hp: numberOr(form.hp, undefined),
      cr: form.cr === "" ? undefined : Number(form.cr),
      type: form.type || undefined,
      speed: form.speed || undefined,
      initiativeMod: numberOr(form.initiativeMod, undefined),
      tags: form.tags || [],
      campaignIds: form.campaignIds || [],
      imageUrl: form.imageUrl || undefined,
    };
    if (!payload.name) {
      await alert("Name fehlt");
      return;
    }
    const r = await apiPost("/api/monsters", payload);
    if (!r.ok) {
      await alert("Fehler beim Speichern");
      return;
    }
    onSave(await r.json());
  }

  async function saveAsNew() {
    const name = await prompt(
      "Neuer Name für die Kreatur:",
      form.name + " (Copy)"
    );
    if (!name) return;
    const payload = {
      ...form,
      id: undefined, // Force new ID
      name: name.trim(),
      ac: numberOr(form.ac, undefined),
      hp: numberOr(form.hp, undefined),
      cr: form.cr === "" ? undefined : Number(form.cr),
      type: form.type || undefined,
      speed: form.speed || undefined,
      initiativeMod: numberOr(form.initiativeMod, undefined),
      tags: form.tags || [],
    };
    const r = await apiPost("/api/monsters", payload);
    if (!r.ok) {
      await alert("Fehler beim Speichern");
      return;
    }
    onSave(await r.json());
  }

  async function importJSON() {
    let arr;
    try {
      arr = JSON.parse(jsonText);
    } catch {
      await alert("Ungültiges JSON");
      return;
    }
    const payload = Array.isArray(arr) ? arr : arr?.monsters;
    if (!Array.isArray(payload)) {
      await alert("Erwarte Array oder { monsters: [...] }");
      return;
    }
    const r = await apiPost("/api/monsters/bulk", payload);
    const out = await r.json();
    await alert(`Import OK – erstellt: ${out.created}`);
    setQ("");
  }

  async function importDDB() {
    const r = await apiPost("/api/monsters/import/ddb", { text: ddbText });
    const out = await r.json();
    if (out.error) {
      await alert(out.error);
      return;
    }
    await alert(`DDB-Import OK – erstellt: ${out.created}`);
    setQ("");
  }

  async function deleteCreature(id) {
    if (!(await confirm("Kreatur wirklich löschen?"))) return;
    await apiDelete(`/api/monsters/${encodeURIComponent(id)}`);
    setQ(q + " "); // Refresh list
  }

  function loadCreature(monster) {
    const normalized = normalizeCreatureForForm(monster);
    setForm(normalized);
    setTab("form");
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="creature-manager-container bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">🐉 Creature Manager</h2>
            <p className="text-green-100 text-sm mt-1">
              Create, edit, and manage all creatures
            </p>
          </div>
          <button
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 dark:bg-slate-700/50 dark:hover:bg-slate-600/50 flex items-center justify-center text-2xl transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700 flex gap-1 px-6 bg-slate-50 dark:bg-slate-900">
          {["form", "json", "ddb", "browse", "players"].map((t) => (
            <button
              key={t}
              className={`px-4 py-3 font-medium transition-colors ${
                tab === t
                  ? "text-green-700 dark:text-green-400 border-b-2 border-green-600 bg-white dark:bg-slate-800"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
              onClick={() => setTab(t)}
            >
              {t === "form" && "📝 Edit Creature"}
              {t === "json" && "📄 JSON Import"}
              {t === "ddb" && "🎲 D&D Beyond"}
              {t === "browse" && "📚 Browse All"}
              {t === "players" && "👥 Player Characters"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "form" && (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Basic Info */}
              <div className="card">
                <h3 className="h2">Basic Information</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="lbl mb-1 block">Name *</label>
                    <input
                      className="input"
                      placeholder="Creature name"
                      value={form.name || ""}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Type</label>
                    <input
                      className="input"
                      placeholder="e.g. humanoid, beast"
                      value={form.type || ""}
                      onChange={(e) =>
                        setForm({ ...form, type: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Size</label>
                    <select
                      className="input"
                      value={form.size || "Medium"}
                      onChange={(e) =>
                        setForm({ ...form, size: e.target.value })
                      }
                    >
                      <option value="Tiny">Tiny</option>
                      <option value="Small">Small</option>
                      <option value="Medium">Medium</option>
                      <option value="Large">Large</option>
                      <option value="Huge">Huge</option>
                      <option value="Gargantuan">Gargantuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Alignment</label>
                    <input
                      className="input"
                      placeholder="e.g. neutral evil"
                      value={form.alignment || ""}
                      onChange={(e) =>
                        setForm({ ...form, alignment: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Armor Class</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="AC"
                      value={form.ac || ""}
                      onChange={(e) => setForm({ ...form, ac: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Hit Points</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="HP"
                      value={form.hp || ""}
                      onChange={(e) => setForm({ ...form, hp: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Hit Dice</label>
                    <input
                      className="input"
                      placeholder="e.g. 8d10+16"
                      value={form.hitDice || ""}
                      onChange={(e) =>
                        setForm({ ...form, hitDice: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Challenge Rating</label>
                    <input
                      type="number"
                      step="0.125"
                      className="input"
                      placeholder="CR"
                      value={form.cr || ""}
                      onChange={(e) => setForm({ ...form, cr: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">
                      Initiative Modifier
                    </label>
                    <input
                      type="number"
                      className="input"
                      placeholder="+0"
                      value={form.initiativeMod || ""}
                      onChange={(e) =>
                        setForm({ ...form, initiativeMod: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="lbl mb-1 block">
                      Bild URL (Token/Avatar)
                    </label>
                    <input
                      type="url"
                      className="input"
                      placeholder="https://example.com/image.png"
                      value={form.imageUrl || ""}
                      onChange={(e) =>
                        setForm({ ...form, imageUrl: e.target.value })
                      }
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Optionale URL zu einem Bild (wird im Player Screen angezeigt)
                    </p>
                  </div>
                </div>
              </div>

              {/* Ability Scores */}
              <div className="card">
                <h3 className="h2">Ability Scores</h3>
                <div className="grid grid-cols-6 gap-3">
                  {["str", "dex", "con", "int", "wis", "cha"].map((ability) => (
                    <div key={ability}>
                      <label className="lbl mb-1 block text-center uppercase">
                        {ability}
                      </label>
                      <input
                        type="number"
                        className="input text-center"
                        placeholder="10"
                        value={form[ability] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [ability]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Speed */}
              <div className="card">
                <h3 className="h2">Speed</h3>
                <div className="grid md:grid-cols-5 gap-4">
                  <div>
                    <label className="lbl mb-1 block">Walk</label>
                    <input
                      className="input"
                      placeholder="30 ft."
                      value={form.speed || ""}
                      onChange={(e) =>
                        setForm({ ...form, speed: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Fly</label>
                    <input
                      className="input"
                      placeholder="60 ft."
                      value={form.fly || ""}
                      onChange={(e) =>
                        setForm({ ...form, fly: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Swim</label>
                    <input
                      className="input"
                      placeholder="30 ft."
                      value={form.swim || ""}
                      onChange={(e) =>
                        setForm({ ...form, swim: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Climb</label>
                    <input
                      className="input"
                      placeholder="30 ft."
                      value={form.climb || ""}
                      onChange={(e) =>
                        setForm({ ...form, climb: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Burrow</label>
                    <input
                      className="input"
                      placeholder="20 ft."
                      value={form.burrow || ""}
                      onChange={(e) =>
                        setForm({ ...form, burrow: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Senses & Languages */}
              <div className="card">
                <h3 className="h2">Senses & Languages</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="lbl mb-1 block">Senses</label>
                    <input
                      className="input"
                      placeholder="e.g. darkvision 60 ft., passive Perception 12"
                      value={form.senses || ""}
                      onChange={(e) =>
                        setForm({ ...form, senses: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Languages</label>
                    <input
                      className="input"
                      placeholder="e.g. Common, Draconic"
                      value={form.languages || ""}
                      onChange={(e) =>
                        setForm({ ...form, languages: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Defenses */}
              <div className="card">
                <h3 className="h2">Defenses</h3>
                <div className="space-y-3">
                  <div>
                    <label className="lbl mb-1 block">
                      Damage Vulnerabilities
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. fire, cold"
                      value={form.vulnerabilities || ""}
                      onChange={(e) =>
                        setForm({ ...form, vulnerabilities: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Damage Resistances</label>
                    <input
                      className="input"
                      placeholder="e.g. bludgeoning from nonmagical attacks"
                      value={form.resistances || ""}
                      onChange={(e) =>
                        setForm({ ...form, resistances: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Damage Immunities</label>
                    <input
                      className="input"
                      placeholder="e.g. poison, psychic"
                      value={form.immunities || ""}
                      onChange={(e) =>
                        setForm({ ...form, immunities: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">
                      Condition Immunities
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. charmed, frightened, paralyzed"
                      value={form.conditionImmunities || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          conditionImmunities: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Actions & Abilities */}
              <div className="card">
                <h3 className="h2">Traits, Actions & Abilities</h3>
                <div className="space-y-4">
                  <div>
                    <label className="lbl mb-1 block">Traits</label>
                    <textarea
                      className="input h-32 font-mono text-sm resize-y"
                      placeholder="Special traits and passive abilities (one per line or JSON format)"
                      value={form.traits || ""}
                      onChange={(e) =>
                        setForm({ ...form, traits: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Actions</label>
                    <textarea
                      className="input h-32 font-mono text-sm resize-y"
                      placeholder="Actions the creature can take (one per line or JSON format)"
                      value={form.actions || ""}
                      onChange={(e) =>
                        setForm({ ...form, actions: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Bonus Actions</label>
                    <textarea
                      className="input h-24 font-mono text-sm resize-y"
                      placeholder="Bonus actions (one per line or JSON format)"
                      value={form.bonusActions || ""}
                      onChange={(e) =>
                        setForm({ ...form, bonusActions: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Reactions</label>
                    <textarea
                      className="input h-24 font-mono text-sm resize-y"
                      placeholder="Reactions (one per line or JSON format)"
                      value={form.reactions || ""}
                      onChange={(e) =>
                        setForm({ ...form, reactions: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="lbl mb-1 block">Legendary Actions</label>
                    <textarea
                      className="input h-24 font-mono text-sm resize-y"
                      placeholder="Legendary actions (one per line or JSON format)"
                      value={form.legendaryActions || ""}
                      onChange={(e) =>
                        setForm({ ...form, legendaryActions: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="card">
                <h3 className="h2">Tags</h3>
                <TagInput
                  value={form.tags || []}
                  onChange={(tags) => setForm({ ...form, tags })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Add tags to organize and filter creatures (terrain,
                  difficulty, adventure, etc.)
                </p>
              </div>

              {/* Campaigns */}
              <div className="card">
                <h3 className="h2">Kampagnen</h3>
                {campaigns.length === 0 ? (
                  <p className="text-sm text-gray-500">Keine Kampagnen verfügbar</p>
                ) : (
                  <div className="space-y-2">
                    {campaigns.map(campaign => (
                      <label key={campaign.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(form.campaignIds || []).includes(campaign.id)}
                          onChange={e => {
                            const campaignIds = form.campaignIds || [];
                            if (e.target.checked) {
                              setForm({ ...form, campaignIds: [...campaignIds, campaign.id] });
                            } else {
                              setForm({ ...form, campaignIds: campaignIds.filter(id => id !== campaign.id) });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{campaign.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Weise dieses Monster einer oder mehreren Kampagnen zu
                </p>
              </div>
            </div>
          )}

          {tab === "json" && (
            <div className="max-w-4xl mx-auto space-y-4">
              <label className="lbl">
                Array of monsters or {"{ monsters:[...] }"}
              </label>
              <textarea
                className="input h-96 font-mono text-sm"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
              />
              <button
                className="btn bg-green-600 text-white hover:bg-green-700 border-green-600"
                onClick={importJSON}
              >
                Import JSON
              </button>
            </div>
          )}

          {tab === "ddb" && (
            <div className="max-w-4xl mx-auto space-y-4">
              <label className="lbl">Paste D&D Beyond statblock (text)</label>
              <textarea
                className="input h-96 font-mono text-sm"
                value={ddbText}
                onChange={(e) => setDdbText(e.target.value)}
              />
              <div className="text-sm text-slate-600">
                Note: Parser extracts Name/Type/AC/HP/Speed/CR only.
              </div>
              <button
                className="btn bg-green-600 text-white hover:bg-green-700 border-green-600"
                onClick={importDDB}
              >
                Import D&D Beyond
              </button>
            </div>
          )}

          {tab === "browse" && (
            <div className="max-w-4xl mx-auto space-y-4">
              <input
                className="input w-full"
                placeholder="Search creatures..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              {/* Tag Filter */}
              <div className="card bg-slate-50 dark:bg-slate-900/50">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                  Filter by Tags
                </label>
                <TagInput value={selectedTags} onChange={setSelectedTags} />
              </div>

              <div className="grid gap-2">
                {list
                  .filter((m) => {
                    // Filter by selected tags
                    if (selectedTags.length === 0) return true;
                    const monsterTags = m.tags || [];
                    return selectedTags.every((tag) =>
                      monsterTags.includes(tag)
                    );
                  })
                  .map((m, mIndex) => {
                    const displayHP =
                      typeof m.hp === "object" && m.hp !== null
                        ? m.hp.average
                        : m.hp;
                    const displayAC =
                      typeof m.ac === "object" && m.ac !== null
                        ? m.ac.value
                        : m.ac;
                    return (
                      <div
                        key={`${m.id}-${mIndex}`}
                        className="card flex items-start justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-lg">{m.name}</div>
                          <div className="text-sm text-slate-600 mb-2">
                            CR {m.cr ?? "—"} · AC {displayAC ?? "—"} · HP{" "}
                            {displayHP ?? "—"} ·{" "}
                            {typeof m.type === "string"
                              ? m.type
                              : typeof m.type?.type === "string"
                              ? m.type.type
                              : m.type?.type?.choose
                              ? `${m.type.type.choose.join(" or ")}`
                              : ""}
                          </div>
                          {/* Display tags */}
                          {m.tags && m.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {m.tags.map((tag, tagIndex) => {
                                // Handle case where tag might be an object or string
                                const tagValue =
                                  typeof tag === "string"
                                    ? tag
                                    : tag?.type || JSON.stringify(tag);
                                const tagColors = {
                                  Underdark:
                                    "bg-purple-100 text-purple-800 border-purple-200",
                                  Forest:
                                    "bg-green-100 text-green-800 border-green-200",
                                  Mountain:
                                    "bg-slate-100 text-slate-800 border-slate-200",
                                  Desert:
                                    "bg-yellow-100 text-yellow-800 border-yellow-200",
                                  Swamp:
                                    "bg-emerald-100 text-emerald-800 border-emerald-200",
                                  Coastal:
                                    "bg-blue-100 text-blue-800 border-blue-200",
                                  Urban:
                                    "bg-gray-100 text-gray-800 border-gray-200",
                                  Dungeon:
                                    "bg-stone-100 text-stone-800 border-stone-200",
                                  Planar:
                                    "bg-indigo-100 text-indigo-800 border-indigo-200",
                                  Boss: "bg-red-100 text-red-800 border-red-200",
                                  Minion:
                                    "bg-slate-100 text-slate-600 border-slate-200",
                                  Elite:
                                    "bg-orange-100 text-orange-800 border-orange-200",
                                };
                                return (
                                  <span
                                    key={`${m.id}-tag-${tagIndex}`}
                                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                                      tagColors[tagValue] ||
                                      "bg-slate-100 text-slate-800 border-slate-200"
                                    }`}
                                  >
                                    {tagValue}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            className="btn"
                            onClick={() => loadCreature(m)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn hover:bg-red-100 hover:text-red-700"
                            onClick={() => deleteCreature(m.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {tab === "players" && (
            <PlayerCharacterTab
              apiGet={apiGet}
              apiPost={apiPost}
              apiDelete={apiDelete}
              alert={alert}
              confirm={confirm}
              campaigns={campaigns}
              onAddToEncounter={(pc) => {
                // Konvertiere PC zu Monster-Format und füge zum Encounter hinzu
                const monsterFormat = {
                  name: pc.name,
                  ac: pc.ac,
                  hp: pc.hp,
                  initiativeMod: pc.initiativeMod || 0,
                  speed: pc.speed || "30 ft.",
                  isPC: true,
                  source: pc.source || 'player-character',
                };
                // Verwende die addMonster Funktion aus dem App-Scope
                if (onAddMonster) {
                  onAddMonster(monsterFormat);
                  onClose();
                }
              }}
            />
          )}
        </div>

        {/* Footer with action buttons */}
        {tab === "form" && (
          <div className="border-t border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-4">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <div className="flex gap-2">
              {form.id && (
                <button
                  className="btn bg-blue-500 text-white hover:bg-blue-600 border-blue-500"
                  onClick={saveAsNew}
                >
                  💾 Save as New
                </button>
              )}
              <button
                className="btn bg-green-600 text-white hover:bg-green-700 border-green-600"
                onClick={saveCreature}
              >
                ✅ {form.id ? "Update" : "Create"} Creature
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Source Tooltip (Hover) */}
      {sourceTooltip.source && (
        <div
          className="fixed z-50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-2xl border-2 border-blue-400 dark:border-blue-600 p-5 pointer-events-none"
          style={{
            left: `${sourceTooltip.x}px`,
            top: `${sourceTooltip.y}px`,
            width: "320px",
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                  Source Book
                </div>
                <div className="text-lg font-bold text-blue-900 dark:text-blue-100 leading-tight">
                  {sourceTooltip.fullName || sourceTooltip.source}
                </div>
              </div>
            </div>

            <div className="border-t-2 border-blue-200 dark:border-blue-800 pt-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2.5 py-1 bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 rounded-md font-mono font-semibold">
                  {sourceTooltip.source}
                </span>
                <span className="text-blue-600 dark:text-blue-400 text-xs">
                  abbreviation
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TagInput({ value, onChange }) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const commonTags = [
    "Underdark",
    "Forest",
    "Mountain",
    "Desert",
    "Swamp",
    "Coastal",
    "Urban",
    "Dungeon",
    "Planar",
    "Boss",
    "Minion",
    "Elite",
    "Aberration",
    "Beast",
    "Celestial",
    "Construct",
    "Dragon",
    "Elemental",
    "Fey",
    "Fiend",
    "Giant",
    "Humanoid",
    "Monstrosity",
    "Ooze",
    "Plant",
    "Undead",
  ];
  const tags = value || [];
  const filtered = commonTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  );

  const addTag = (tag) => {
    onChange([...tags, tag]);
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const tagColors = {
    // Terrain
    Underdark: "bg-purple-100 text-purple-800 border-purple-200",
    Forest: "bg-green-100 text-green-800 border-green-200",
    Mountain: "bg-slate-100 text-slate-800 border-slate-200",
    Desert: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Swamp: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Coastal: "bg-blue-100 text-blue-800 border-blue-200",
    Urban: "bg-gray-100 text-gray-800 border-gray-200",
    Dungeon: "bg-stone-100 text-stone-800 border-stone-200",
    Planar: "bg-indigo-100 text-indigo-800 border-indigo-200",
    // Difficulty
    Boss: "bg-red-100 text-red-800 border-red-200",
    Minion: "bg-slate-100 text-slate-600 border-slate-200",
    Elite: "bg-orange-100 text-orange-800 border-orange-200",
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => {
          // Handle case where tag might be an object or string
          const tagValue =
            typeof tag === "string" ? tag : tag?.type || JSON.stringify(tag);
          return (
            <span
              key={`tag-${index}-${tagValue}`}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${
                tagColors[tagValue] ||
                "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600"
              }`}
            >
              {tagValue}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                title="Remove tag"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <div className="relative">
        <input
          className="input w-full"
          placeholder="Add tag (press Enter or comma to add)..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && input.trim()) {
              addTag(input.trim());
              e.preventDefault();
            }
          }}
        />
        {showSuggestions && (filtered.length > 0 || input.trim()) && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-auto">
            {filtered.map((tag) => (
              <button
                key={tag}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm flex items-center gap-2"
                onClick={() => addTag(tag)}
              >
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                    tagColors[tag] ||
                    "bg-slate-100 text-slate-800 border-slate-200"
                  }`}
                >
                  {tag}
                </span>
              </button>
            ))}
            {input.trim() &&
              !commonTags.some(
                (t) => t.toLowerCase() === input.toLowerCase()
              ) && (
                <button
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm border-t border-slate-200 dark:border-slate-700"
                  onClick={() => addTag(input.trim())}
                >
                  <span className="text-blue-600 dark:text-blue-400">
                    + Create "{input.trim()}"
                  </span>
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConditionAutocomplete({ value, onChange, conditionImmunities = [], settings }) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingImmune, setPendingImmune] = useState({}); // Tracks immune conditions awaiting confirmation

  const commonConditions = [
    "Blinded",
    "Charmed",
    "Deafened",
    "Frightened",
    "Grappled",
    "Incapacitated",
    "Invisible",
    "Paralyzed",
    "Petrified",
    "Poisoned",
    "Prone",
    "Restrained",
    "Stunned",
    "Unconscious",
  ];
  const conditions = value || [];
  const filtered = commonConditions.filter(
    (c) =>
      !conditions.includes(c) &&
      !pendingImmune[c] &&
      c.toLowerCase().includes(input.toLowerCase())
  );

  // Check if a condition is immune (case-insensitive)
  const isImmune = (cond) => {
    if (!conditionImmunities || !Array.isArray(conditionImmunities)) {
      return false;
    }
    return conditionImmunities.some(immune =>
      immune.toLowerCase() === cond.toLowerCase()
    );
  };

  const addCondition = (cond) => {
    console.log('[ConditionAutocomplete] addCondition called with:', cond);
    console.log('[ConditionAutocomplete] conditionImmunities:', conditionImmunities);
    console.log('[ConditionAutocomplete] isImmune check:', isImmune(cond));
    console.log('[ConditionAutocomplete] current conditions:', conditions);

    // Check if should show immunity reminder
    if (isImmune(cond) && settings?.conditionImmunityReminder) {
      console.log('[ConditionAutocomplete] Adding to pending immune:', cond);
      // Add to pending immune conditions instead of active conditions
      setPendingImmune({ ...pendingImmune, [cond]: true });
    } else {
      console.log('[ConditionAutocomplete] Adding to active conditions:', cond);
      onChange([...conditions, cond]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeCondition = (cond) => {
    onChange(conditions.filter((c) => c !== cond));
  };

  const confirmImmuneCondition = (cond) => {
    // Move from pending to active conditions
    const newPending = { ...pendingImmune };
    delete newPending[cond];
    setPendingImmune(newPending);
    onChange([...conditions, cond]);
  };

  const rejectImmuneCondition = (cond) => {
    // Remove from pending
    const newPending = { ...pendingImmune };
    delete newPending[cond];
    setPendingImmune(newPending);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Pending immune conditions with confirm/reject buttons */}
        {Object.keys(pendingImmune).map((cond) => (
          <span
            key={cond}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium border border-red-300 dark:border-red-800"
            title={`${cond} is immune against being ${cond}`}
          >
            {cond}
            <button
              onClick={() => confirmImmuneCondition(cond)}
              className="hover:text-red-900 dark:hover:text-red-100 font-bold text-base leading-none"
              title={`${cond} is immune against being ${cond}`}
            >
              &#10003;
            </button>
            <button
              onClick={() => rejectImmuneCondition(cond)}
              className="hover:text-red-900 dark:hover:text-red-100 font-bold text-base leading-none"
              title={`${cond} is immune against being ${cond}`}
            >
              &#10005;
            </button>
          </span>
        ))}

        {/* Active conditions with remove button */}
        {conditions.map((cond) => (
          <span
            key={cond}
            className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium"
          >
            {cond}
            <button
              onClick={() => removeCondition(cond)}
              className="hover:text-amber-900 dark:hover:text-amber-100"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          className="input w-full"
          placeholder="Add condition..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            console.log('[ConditionAutocomplete] Input focused');
            setShowSuggestions(true);
          }}
          onBlur={() => {
            console.log('[ConditionAutocomplete] Input blurred, will hide suggestions in 300ms');
            setTimeout(() => setShowSuggestions(false), 300);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              console.log('[ConditionAutocomplete] Enter pressed with:', input.trim());
              addCondition(input.trim());
              e.preventDefault();
            }
          }}
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-auto">
            {filtered.map((cond) => (
              <button
                key={cond}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm dark:text-slate-200"
                onMouseDown={(e) => {
                  console.log('[ConditionAutocomplete] Suggestion clicked:', cond);
                  e.preventDefault(); // Prevent blur
                  addCondition(cond);
                }}
              >
                {cond}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InlineEdit({
  value,
  onChange,
  className = "",
  type = "text",
  onBlur,
  editValue, // Optional: different value to show when editing starts
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(tempValue);
    setIsEditing(false);
    if (onBlur) onBlur();
  };

  if (!isEditing) {
    return (
      <div
        className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-2 py-1 transition-colors ${className}`}
        onClick={() => {
          // Use editValue if provided, otherwise use value
          setTempValue(editValue !== undefined ? editValue : value);
          setIsEditing(true);
        }}
      >
        {value || "—"}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      className={`border-2 border-blue-400 dark:border-blue-500 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100 ${className}`}
      value={tempValue}
      onChange={(e) => {
        // For text inputs, keep the value as string to preserve +/- prefixes
        const newValue = type === "number" ? Number(e.target.value) : e.target.value;
        setTempValue(newValue);
      }}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") {
          setTempValue(editValue !== undefined ? editValue : value);
          setIsEditing(false);
        }
      }}
    />
  );
}

function QuickHPInput({
  currentHP,
  maxHP,
  tempHP,
  onHeal,
  onDamage,
  onSetHP,
  onClose,
}) {
  const [input, setInput] = useState("");
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSubmit = () => {
    const val = input.trim();
    if (!val) return;

    if (val.startsWith("+")) {
      // Healing
      const amount = parseInt(val.substring(1)) || 0;
      onHeal(amount);
    } else if (val.startsWith("-")) {
      // Damage
      const amount = parseInt(val.substring(1)) || 0;
      onDamage(amount);
    } else {
      // Absolute value
      const amount = parseInt(val) || 0;
      onSetHP(amount);
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-white dark:bg-slate-800 z-10 flex items-center justify-center rounded-xl shadow-lg border-2 border-blue-500 dark:border-blue-400">
      <div className="text-center space-y-3 p-4">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          HP: <span className="font-bold">{currentHP}</span> / {maxHP}
          {tempHP > 0 && (
            <span className="text-cyan-600 dark:text-cyan-400 ml-2">
              +{tempHP} temp
            </span>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="input w-32 text-center text-lg font-bold"
          placeholder="+10 oder -5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
          onBlur={onClose}
        />
        <div className="text-xs text-slate-500 dark:text-slate-400">
          +10 (heal) | -5 (dmg) | 20 (set)
        </div>
      </div>
    </div>
  );
}

function AdjectiveSelector({ currentName, onChange }) {
  const settings = useSettings();
  const namingMode = settings.creatureNamingMode || 'adjective';

  // Extract base name and identifier based on naming mode
  const extractNameParts = (name) => {
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return { identifier: null, baseName: name };
    }

    if (namingMode === 'adjective') {
      // Check if first word is an adjective from our list
      const firstWord = words[0];
      if (CREATURE_ADJECTIVES.includes(firstWord)) {
        return {
          identifier: firstWord,
          baseName: words.slice(1).join(' ')
        };
      }
    } else {
      // For letter/number/roman modes, identifier is at the end
      const lastWord = words[words.length - 1];
      // Check if last word looks like an identifier
      if (/^[A-Z]+$|^\d+$|^[IVXLCDM]+$/.test(lastWord)) {
        return {
          identifier: lastWord,
          baseName: words.slice(0, -1).join(' ')
        };
      }
    }

    // No identifier found
    return { identifier: null, baseName: name };
  };

  const { identifier, baseName } = extractNameParts(currentName);

  // Generate 9 random adjectives (excluding current one if it exists)
  const getRandomAdjectives = (excludeAdj) => {
    const available = CREATURE_ADJECTIVES.filter(adj => adj !== excludeAdj);
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 9);
  };

  const [randomAdjectives, setRandomAdjectives] = useState(() => getRandomAdjectives(identifier));
  const [isFading, setIsFading] = useState(false);

  const handleAdjectiveClick = (newAdjective) => {
    const newName = formatCreatureName(newAdjective, baseName, namingMode);

    // Start fade out
    setIsFading(true);

    // After fade out completes, change name and generate new adjectives
    setTimeout(() => {
      onChange(newName);
      setRandomAdjectives(getRandomAdjectives(newAdjective));
      setIsFading(false);
    }, 300); // Match the CSS transition duration
  };

  // Only show selector for adjective mode
  if (namingMode !== 'adjective') {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Diese Kreatur verwendet den Benennungsmodus "{namingMode}". Adjektiv-Auswahl ist nur im Adjektiv-Modus verfügbar.
      </p>
    );
  }

  // If no adjective in current name, don't show selector
  if (!identifier) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Diese Kreatur hat kein Adjektiv. Adjektive werden automatisch vergeben, wenn mehrere gleiche Kreaturen hinzugefügt werden.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">
        Aktuell: <span className="font-semibold">{identifier}</span>
      </div>
      <div
        className={`grid grid-cols-3 gap-2 transition-opacity duration-300 ${isFading ? 'opacity-0' : 'opacity-100'}`}
      >
        {randomAdjectives.map((adj) => (
          <button
            key={adj}
            className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 rounded-lg transition-colors text-slate-700 dark:text-slate-200"
            onClick={(e) => {
              e.stopPropagation();
              handleAdjectiveClick(adj);
            }}
            disabled={isFading}
          >
            {adj}
          </button>
        ))}
      </div>
    </div>
  );
}

function CombatantRow({
  c,
  idx,
  active,
  onChange,
  onSelect,
  isSelected,
  onDamage,
  allPlayers = [],
  hpManagement,
  conditionsData = {},
  getConditionTooltipHandlers,
  setSelectedCondition,
  setConditionName,
  setShowConditionModal,
  settings,
  isCompleted = false,
}) {
  const [open, setOpen] = useState(false);
  const [showHPInput, setShowHPInput] = useState(false);

  // Special rendering for Lair Action markers
  if (c.isLairAction) {
    return (
      <div
        className={`card relative overflow-hidden cursor-pointer transition-all ${
          active ? "ring-2 ring-red-500 shadow-lg bg-red-50 dark:bg-red-900/30" : "bg-red-50/50 dark:bg-red-900/10"
        } ${isSelected ? "ring-2 ring-purple-400" : ""}`}
        onClick={(e) => {
          if (!e.defaultPrevented) onSelect();
        }}
      >
        <div className="flex items-center gap-3 py-3">
          <div className="w-8 h-8 flex items-center justify-center bg-red-200 dark:bg-red-800 rounded-full font-bold text-sm text-red-900 dark:text-red-200">
            {idx + 1}
          </div>
          <div className="flex-1 font-semibold text-lg text-red-900 dark:text-red-300">
            {c.name}
          </div>
          <div className="flex items-center gap-1 text-red-700 dark:text-red-400">
            <span className="text-xs">Init</span>
            <span className="w-16 text-center font-bold">{c.initiative}</span>
          </div>
          <div className="px-3 py-1 bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-200 rounded-full text-xs font-semibold">
            DM Only
          </div>
        </div>
      </div>
    );
  }

  const effectiveMaxHP = (c.baseHP ?? 0) + (c.maxHPModifier ?? 0);
  const hpPercent =
    effectiveMaxHP > 0 ? Math.max(0, Math.min(100, (c.hp / effectiveMaxHP) * 100)) : 100;
  const hpColor =
    hpPercent > 60
      ? "bg-green-500"
      : hpPercent > 30
      ? "bg-yellow-500"
      : "bg-red-500";
  const isBloodied = hpPercent > 0 && hpPercent < 50;

  return (
    <div
      className={`card relative ${open ? 'overflow-visible' : 'overflow-hidden'} cursor-pointer transition-all ${
        active ? "ring-2 ring-blue-500 shadow-lg" : ""
      } ${isSelected ? "ring-2 ring-purple-400" : ""} ${
        c.concentration ? "border-l-4 border-l-purple-500" : ""
      } ${isBloodied ? "bloodied-border" : ""
      }`}
      style={c.concentration ? { animation: 'concentration-pulse 2s ease-in-out infinite' } : {}}
      onClick={(e) => {
        if (!e.defaultPrevented) onSelect();
      }}
    >
      {showHPInput && (
        <QuickHPInput
          currentHP={c.hp ?? 0}
          maxHP={c.baseHP}
          tempHP={c.tempHP ?? 0}
          onHeal={(amount) => {
            onChange({ hp: Math.min(c.baseHP, c.hp + amount) });
            setShowHPInput(false);
          }}
          onDamage={(amount) => {
            onDamage(amount);
            setShowHPInput(false);
          }}
          onSetHP={(hp) => {
            onChange({ hp: Math.max(0, Math.min(c.baseHP, hp)) });
            setShowHPInput(false);
          }}
          onClose={() => setShowHPInput(false)}
        />
      )}

      {c.concentration && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-full flex items-center gap-1 pointer-events-none z-5">
          <span className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-pulse"></span>
          Concentrating
        </div>
      )}

      <div className="space-y-2">
        {/* First Row: Index, Name, Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded-full font-bold text-sm dark:text-slate-200">
            {idx + 1}
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-2">
            <InlineEdit
              value={c.name}
              onChange={(name) => onChange({ name })}
              className="font-semibold text-lg dark:text-slate-100"
              disabled={isCompleted}
            />
            {c.sidekickOf && (
              <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded text-xs font-semibold">
                🤝 Sidekick
              </span>
            )}
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
              Init
            </span>
            <InlineEdit
              value={c.initiative ?? 0}
              onChange={(initiative) => onChange({ initiative })}
              type="number"
              className="w-16 text-center font-bold text-2xl text-blue-600 dark:text-blue-400"
              disabled={isCompleted}
            />
            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex gap-2">
              <span>Mod: {c.initiativeMod >= 0 ? '+' : ''}{c.initiativeMod || 0}</span>
              <span>Tie: {c.initiativeTieBreaker || 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">AC</span>
            <InlineEdit
              value={c.ac ?? 0}
              onChange={(ac) => onChange({ ac })}
              type="number"
              className="w-16 text-center dark:text-slate-100"
              disabled={isCompleted}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">HP</span>
            <div
              className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${isCompleted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isCompleted && hpManagement) {
                  hpManagement(c, onChange);
                }
              }}
              title={isCompleted ? 'Combat completed' : 'Klick für HP Management'}
            >
              <span className="text-center font-bold dark:text-slate-100 min-w-[3rem]">
                {c.hp ?? 0}{c.tempHP > 0 ? `+${c.tempHP}` : ''}
              </span>
              <span className="text-slate-400 dark:text-slate-500">/</span>
              <span className="text-center text-slate-600 dark:text-slate-300 font-medium min-w-[2rem]">
                {(c.baseHP ?? 0) + (c.maxHPModifier ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Second Row: Action Buttons */}
        <div className="flex items-center gap-2 pl-11">
          <button
            disabled={isCompleted}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              c.concentration
                ? "bg-purple-500 dark:bg-purple-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-purple-900/30"
            } ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ concentration: !c.concentration });
            }}
          >
            {c.concentration ? "⚡ Concentrating" : "Concentration"}
          </button>

          <button
            disabled={isCompleted}
            className={`p-2 rounded-lg text-lg transition-all ${
              c.visibleToPlayers !== false
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
            } ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ visibleToPlayers: c.visibleToPlayers === false });
            }}
            title={c.visibleToPlayers !== false ? "Visible to players" : "Hidden from players"}
          >
            {c.visibleToPlayers !== false ? "👁️" : "👁️‍🗨️"}
          </button>

          <button
            className="btn ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {open ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* HP Bar */}
      <div className="mt-3 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${hpColor} transition-all duration-300`}
          style={{ width: `${hpPercent}%` }}
        ></div>
      </div>

      {/* Conditions Display */}
      {c.conditions && c.conditions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.conditions.map((cond) => (
            <button
              key={cond}
              className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-full text-xs font-medium cursor-pointer transition-colors border border-amber-300 dark:border-amber-800"
              onClick={() => {
                const conditionData = conditionsData[cond.toLowerCase()];
                if (conditionData) {
                  setSelectedCondition(conditionData);
                  setConditionName(cond);
                  setShowConditionModal(true);
                }
              }}
              {...getConditionTooltipHandlers(cond)}
            >
              {cond}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 pt-4 border-t grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="lbl mb-1 block">Notizen</label>
              <textarea
                className="input h-24 resize-none"
                value={c.notes || ""}
                onChange={(e) => onChange({ notes: e.target.value })}
                placeholder="Notizen hinzufügen..."
                disabled={isCompleted}
              />
            </div>

            <div>
              <label className="lbl mb-1 block">Diesen Eintrag als Sidekick zuweisen</label>
              <select
                className="input w-full"
                value={c.sidekickOf || ''}
                onChange={(e) => onChange({ sidekickOf: e.target.value || null })}
                disabled={isCompleted}
              >
                <option value="">Kein Sidekick</option>
                {allPlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dieser Eintrag wird als Sidekick dem ausgewählten Spieler zugeordnet und teilt dessen Initiative
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={c.player || false}
                  onChange={(e) => onChange({ player: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="lbl">Is Player Character</span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Spielercharaktere müssen ihre Initiative manuell eingeben
              </p>
            </div>

            <div>
              <label className="lbl mb-1 block">Conditions</label>
              <ConditionAutocomplete
                value={c.conditions || []}
                onChange={(conditions) => onChange({ conditions })}
                conditionImmunities={c.conditionImmunities || []}
                settings={settings}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Spell Slots</h4>
              <SlotEditor
                slots={c.spellSlots || {}}
                onChange={(slots) => onChange({ spellSlots: slots })}
              />
            </div>

            <div>
              <h4 className="font-semibold mb-2">Adjektiv ändern</h4>
              <AdjectiveSelector
                currentName={c.name}
                onChange={(newName) => onChange({ name: newName })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MonsterBrowser({ onPick, onEdit, disabled, RollableText, combatMode, selectedCombatant }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [allMonsters, setAllMonsters] = useState([]);
  const [sourceTooltip, setSourceTooltip] = useState({
    source: null,
    fullName: null,
    x: 0,
    y: 0,
  });

  // Filter states - Multi-select arrays for Type, Size, Source
  const [crMin, setCrMin] = useState("");
  const [crMax, setCrMax] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);

  // Refs for Select2
  const typeSelectRef = useRef(null);
  const sizeSelectRef = useRef(null);
  const sourceSelectRef = useRef(null);

  // Load all monsters once for filtering
  useEffect(() => {
    apiGet("/api/monsters?search=")
      .then((r) => r.json())
      .then(setAllMonsters);
  }, []);

  // Get unique values for dropdowns - MUST be defined before useEffect that uses them
  const availableTypes = useMemo(() => {
    const types = new Set();
    allMonsters.forEach((m) => {
      if (m.type) {
        const typeStr = typeof m.type === "string" ? m.type : m.type?.type;
        if (typeStr && typeof typeStr === "string") {
          // Capitalize first letter
          const capitalized =
            typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
          types.add(capitalized);
        }
      }
    });
    return Array.from(types).sort();
  }, [allMonsters]);

  const availableSources = useMemo(() => {
    const sources = new Set();
    allMonsters.forEach((m) => {
      // Check source, src, and meta.source fields
      const src = m.source || m.src || m.meta?.source;
      if (src) sources.add(src);
    });
    return Array.from(sources).sort();
  }, [allMonsters]);

  const availableSizes = useMemo(() => {
    const sizes = new Set();
    allMonsters.forEach((m) => {
      if (m.size) sizes.add(m.size);
    });
    return Array.from(sizes).sort();
  }, [allMonsters]);

  // Initialize Select2 for multi-select dropdowns
  useEffect(() => {
    const $ = window.$;

    // Initialize Type select
    if (typeSelectRef.current && availableTypes.length > 0) {
      const $select = $(typeSelectRef.current);
      $select.select2({
        placeholder: "Alle Typen auswählen...",
        allowClear: true,
        width: "100%",
        multiple: true,
      });

      $select.on("change", function () {
        const values = $(this).val() || [];
        setSelectedTypes(values);
      });
    }

    // Initialize Size select
    if (sizeSelectRef.current && availableSizes.length > 0) {
      const $select = $(sizeSelectRef.current);
      $select.select2({
        placeholder: "Alle Größen auswählen...",
        allowClear: true,
        width: "100%",
        multiple: true,
      });

      $select.on("change", function () {
        const values = $(this).val() || [];
        setSelectedSizes(values);
      });
    }

    // Initialize Source select with custom matcher for full name search
    if (sourceSelectRef.current && availableSources.length > 0) {
      const $select = $(sourceSelectRef.current);
      $select.select2({
        placeholder: "Alle Quellen auswählen...",
        allowClear: true,
        width: "100%",
        multiple: true,
        matcher: function (params, data) {
          // If there are no search terms, return all data
          if ($.trim(params.term) === "") {
            return data;
          }

          // Search in both the source abbreviation and full name
          const searchTerm = params.term.toLowerCase();
          const sourceAbbrev = data.id.toLowerCase();
          const sourceFullName = (
            SOURCE_VOCAB[data.id]?.name || ""
          ).toLowerCase();
          const displayText = data.text?.toLowerCase() || "";

          // Match against abbreviation, full name, or display text
          if (
            sourceAbbrev.includes(searchTerm) ||
            sourceFullName.includes(searchTerm) ||
            displayText.includes(searchTerm)
          ) {
            return data;
          }

          // Return null if the term should not be displayed
          return null;
        },
      });

      $select.on("change", function () {
        const values = $(this).val() || [];
        setSelectedSources(values);
      });
    }

    // Cleanup
    return () => {
      try {
        if (typeSelectRef.current && $(typeSelectRef.current).data("select2")) {
          $(typeSelectRef.current).select2("destroy");
        }
        if (sizeSelectRef.current && $(sizeSelectRef.current).data("select2")) {
          $(sizeSelectRef.current).select2("destroy");
        }
        if (
          sourceSelectRef.current &&
          $(sourceSelectRef.current).data("select2")
        ) {
          $(sourceSelectRef.current).select2("destroy");
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [availableTypes, availableSizes, availableSources]);

  // Apply all filters
  useEffect(() => {
    const t = setTimeout(() => {
      let filtered = [...allMonsters];

      // Name/Type/Source search - also searches full source names
      if (q) {
        const lowerQ = q.toLowerCase();
        filtered = filtered.filter((m) => {
          const name = m.name?.toLowerCase() || "";
          const typeStr =
            typeof m.type === "string" ? m.type : m.type?.type || "";
          const typeStrLower = String(typeStr).toLowerCase();

          // Get source and its full name
          const sourceAbbrev = m.source || m.src || m.meta?.source;
          const sourceAbbrevLower = sourceAbbrev?.toLowerCase() || "";
          const sourceFullName = sourceAbbrev
            ? (SOURCE_VOCAB[sourceAbbrev]?.name || "").toLowerCase()
            : "";

          return (
            name.includes(lowerQ) ||
            typeStrLower.includes(lowerQ) ||
            sourceAbbrevLower.includes(lowerQ) ||
            sourceFullName.includes(lowerQ)
          );
        });
      }

      // CR filter
      if (crMin !== "") {
        const min = parseFloat(crMin);
        filtered = filtered.filter((m) => {
          const cr = m.cr !== undefined ? parseFloat(m.cr) : -1;
          return cr >= min;
        });
      }
      if (crMax !== "") {
        const max = parseFloat(crMax);
        filtered = filtered.filter((m) => {
          const cr = m.cr !== undefined ? parseFloat(m.cr) : -1;
          return cr <= max;
        });
      }

      // Type filter - Multi-select
      if (selectedTypes.length > 0) {
        filtered = filtered.filter((m) => {
          const typeStr = typeof m.type === "string" ? m.type : m.type?.type;
          if (!typeStr) return false;
          const capitalized =
            typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
          return selectedTypes.includes(capitalized);
        });
      }

      // Source filter - Multi-select
      if (selectedSources.length > 0) {
        filtered = filtered.filter((m) => {
          const src = m.source || m.src || m.meta?.source;
          return selectedSources.includes(src);
        });
      }

      // Size filter - Multi-select
      if (selectedSizes.length > 0) {
        filtered = filtered.filter((m) => selectedSizes.includes(m.size));
      }

      setList(filtered.slice(0, 100)); // Limit to 100 results
    }, 200);
    return () => clearTimeout(t);
  }, [
    q,
    crMin,
    crMax,
    selectedTypes,
    selectedSources,
    selectedSizes,
    allMonsters,
  ]);

  const clearFilters = () => {
    setQ("");
    setCrMin("");
    setCrMax("");
    setSelectedTypes([]);
    setSelectedSources([]);
    setSelectedSizes([]);

    // Clear Select2 selections
    const $ = window.$;
    if (typeSelectRef.current)
      $(typeSelectRef.current).val(null).trigger("change");
    if (sizeSelectRef.current)
      $(sizeSelectRef.current).val(null).trigger("change");
    if (sourceSelectRef.current)
      $(sourceSelectRef.current).val(null).trigger("change");
  };

  const hasActiveFilters =
    q ||
    crMin ||
    crMax ||
    selectedTypes.length > 0 ||
    selectedSources.length > 0 ||
    selectedSizes.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-green-900 dark:text-green-300 mb-1">
          Browse Monsters
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Suche und filtere aus über 2000 Monstern
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            className="input w-full pl-10 pr-4 py-3 text-base"
            placeholder="Nach Name oder Typ suchen..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Panel - Always Visible */}
      <div className="mb-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl shadow-sm border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-green-800 dark:text-green-300 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filter
          </h4>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-all font-semibold shadow-sm"
            >
              ✕ Zurücksetzen
            </button>
          )}
        </div>

        <div className="space-y-3">
          {/* CR Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-green-800 dark:text-green-300 font-semibold block mb-1.5">
                CR Min
              </label>
              <input
                type="number"
                className="input w-full text-sm"
                placeholder="0"
                value={crMin}
                onChange={(e) => setCrMin(e.target.value)}
                min="0"
                step="0.125"
              />
            </div>
            <div>
              <label className="text-xs text-green-800 dark:text-green-300 font-semibold block mb-1.5">
                CR Max
              </label>
              <input
                type="number"
                className="input w-full text-sm"
                placeholder="30"
                value={crMax}
                onChange={(e) => setCrMax(e.target.value)}
                min="0"
                step="0.125"
              />
            </div>
          </div>

          {/* Type, Size, Source in one row - Multi-select with Select2 */}
          <div className="grid grid-cols-3 gap-3">
            {/* Type */}
            <div>
              <label className="text-xs text-green-800 dark:text-green-300 font-semibold block mb-1.5">
                Typ (Multi)
              </label>
              <select
                ref={typeSelectRef}
                className="input w-full text-sm"
                multiple
                value={selectedTypes}
                onChange={() => {}} // Handled by Select2
              >
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Size */}
            <div>
              <label className="text-xs text-green-800 dark:text-green-300 font-semibold block mb-1.5">
                Größe (Multi)
              </label>
              <select
                ref={sizeSelectRef}
                className="input w-full text-sm"
                multiple
                value={selectedSizes}
                onChange={() => {}} // Handled by Select2
              >
                {availableSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="text-xs text-green-800 dark:text-green-300 font-semibold block mb-1.5">
                Quelle (Multi)
              </label>
              <select
                ref={sourceSelectRef}
                className="input w-full text-sm"
                multiple
                value={selectedSources}
                onChange={() => {}} // Handled by Select2
              >
                {availableSources.map((source) => (
                  <option key={source} value={source}>
                    {source} - {SOURCE_VOCAB[source]?.name || source}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results count */}
      {list.length > 0 && (
        <div className="text-xs text-green-700 dark:text-green-300 mb-1 px-1">
          {list.length} {list.length === 100 ? "+ " : ""}Ergebnis
          {list.length !== 1 ? "se" : ""}
        </div>
      )}

      <ul className="divide-y divide-green-100 dark:divide-green-800 bg-white dark:bg-slate-800 rounded-xl border border-green-200 dark:border-green-800 max-h-[calc(100vh-600px)] overflow-auto">
        {list.length === 0 ? (
          <li className="py-3 px-3 text-sm text-slate-500 dark:text-slate-400 text-center">
            {hasActiveFilters
              ? "Keine Monster gefunden"
              : "Tippe um zu suchen oder öffne Filter..."}
          </li>
        ) : (
          list.map((m, index) => {
            const displayHP =
              typeof m.hp === "object" && m.hp !== null ? m.hp.average : m.hp;
            const displayAC =
              Array.isArray(m.ac) && m.ac.length > 0
                ? m.ac[0].value
                : typeof m.ac === "object" && m.ac !== null
                ? m.ac.value
                : m.ac;
            return (
              <li
                key={`${m.id}-${index}`}
                className="py-2 px-3 flex items-center justify-between gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer"
                onClick={() => onEdit && onEdit(m)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate dark:text-slate-200">
                    {m.name}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      CR {m.cr ?? "—"} · AC {displayAC ?? "—"} · HP{" "}
                      {displayHP ?? "—"}
                    </div>
                    {(m.source || m.src || m.meta?.source) && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 border ${getSourceColorClasses(
                          m.source || m.src || m.meta?.source
                        )}`}
                        onMouseEnter={(e) => {
                          const sourceValue =
                            m.source || m.src || m.meta?.source;
                          const sourceData = SOURCE_VOCAB[sourceValue];
                          const fullName = sourceData?.name || sourceValue;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const tooltipWidth = 320;
                          const x = rect.left - tooltipWidth - 15;
                          const y = rect.top;
                          setSourceTooltip({
                            source: sourceValue,
                            fullName,
                            x,
                            y,
                          });
                        }}
                        onMouseMove={(e) => {
                          if (sourceTooltip.source) {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const tooltipWidth = 320;
                            const x = rect.left - tooltipWidth - 15;
                            const y = rect.top;
                            setSourceTooltip((prev) => ({ ...prev, x, y }));
                          }
                        }}
                        onMouseLeave={() => {
                          setSourceTooltip({
                            source: null,
                            fullName: null,
                            x: 0,
                            y: 0,
                          });
                        }}
                      >
                        {m.source || m.src || m.meta?.source}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn text-xs px-2 py-1 flex-shrink-0 font-bold relative"
                  style={{ top: "-2px" }}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(m);
                  }}
                >
                  +
                </button>
              </li>
            );
          })
        )}
      </ul>

      {/* Source Tooltip (Hover) */}
      {sourceTooltip.source && (
        <div
          className="fixed z-50 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-xl shadow-2xl border-2 border-blue-400 dark:border-blue-600 p-5 pointer-events-none"
          style={{
            left: `${sourceTooltip.x}px`,
            top: `${sourceTooltip.y}px`,
            width: "320px",
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 dark:bg-blue-600 text-white rounded-lg p-2">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Source
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {sourceTooltip.source}
                </div>
              </div>
            </div>
            <div className="border-t border-blue-200 dark:border-blue-700 pt-2">
              <div className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {sourceTooltip.fullName}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

