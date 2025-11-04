/**
 * eCR Calculator - Pure JavaScript implementation
 * Based on simplified rule-based heuristics from the ML model
 */

// CR to numeric mapping
const CR_TO_NUMERIC = {
  '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18,
  '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '25': 25, '26': 26,
  '27': 27, '28': 28, '29': 29, '30': 30
};

const NUMERIC_TO_CR = {
  0: '0', 0.125: '1/8', 0.25: '1/4', 0.5: '1/2',
  1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: '11', 12: '12', 13: '13', 14: '14', 15: '15', 16: '16', 17: '17', 18: '18',
  19: '19', 20: '20', 21: '21', 22: '22', 23: '23', 24: '24', 25: '25', 26: '26',
  27: '27', 28: '28', 29: '29', 30: '30'
};

// Valid CR values sorted for quantization
const VALID_CRS = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

/**
 * Calculate ability modifier from ability score
 */
function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Parse dice expression like "2d6+3" to average damage
 */
function avgFromDiceExpr(expr) {
  if (!expr || typeof expr !== 'string') return 0;

  expr = expr.trim().toLowerCase();

  // Match format: XdY+Z or XdY-Z or XdY
  const match = expr.match(/(\d+)d(\d+)\s*([+\-]\s*\d+)?/);
  if (!match) return 0;

  const numDice = parseInt(match[1]);
  const diceSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3].replace(/\s/g, '')) : 0;

  return numDice * (diceSize + 1) / 2 + modifier;
}

/**
 * Extract damage from action description
 */
function extractDamage(text) {
  if (!text) return 0;

  // Match format: "damage_number (dice_expression) damage_type"
  // Example: "6 (1d8 + 2) piercing damage"
  const damagePattern = /(\d+)\s*\(\s*([0-9d+\-\s]+)\s*\)\s*([a-z]+)/gi;
  let totalDamage = 0;
  let match;

  while ((match = damagePattern.exec(text)) !== null) {
    totalDamage += parseInt(match[1]);
  }

  return totalDamage;
}

/**
 * Calculate DPR (Damage Per Round) from actions
 */
function calculateDPR(monster) {
  let maxDPR = 0;

  const actions = monster.actions || monster.action || [];

  for (const action of actions) {
    const desc = action.desc || action.d || '';
    const entries = action.entries || [];
    const text = desc || (Array.isArray(entries) ? entries.join(' ') : String(entries));

    // Check for multiattack
    const multiattackMatch = text.match(/makes?\s+(\w+)\s+attacks?/i);
    let numAttacks = 1;

    if (multiattackMatch) {
      const word = multiattackMatch[1].toLowerCase();
      const numberWords = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6 };
      numAttacks = numberWords[word] || parseInt(word) || 1;
    }

    const damage = extractDamage(text);
    const dpr = damage * numAttacks;

    if (dpr > maxDPR) {
      maxDPR = dpr;
    }
  }

  return maxDPR;
}

/**
 * Extract features from monster data
 */
function extractFeatures(monster) {
  // Basic info
  const cr = CR_TO_NUMERIC[String(monster.cr)] || 0;

  // HP
  let hp = monster.hpAvg;
  if (typeof hp !== 'number') {
    const hpField = monster.hp;
    if (hpField && typeof hpField === 'object') {
      hp = hpField.average || avgFromDiceExpr(hpField.formula);
    } else if (typeof hpField === 'string') {
      hp = avgFromDiceExpr(hpField);
    }
  }
  hp = hp || 1;

  // AC
  let ac = 10;
  if (Array.isArray(monster.ac)) {
    ac = monster.ac[0]?.value || monster.ac[0]?.ac || 10;
  } else if (typeof monster.ac === 'number') {
    ac = monster.ac;
  }

  // Abilities
  const abilities = monster.abilities || {};
  const str = abilities.str || monster.str || 10;
  const dex = abilities.dex || monster.dex || 10;
  const con = abilities.con || monster.con || 10;
  const int = abilities.int || monster.int || 10;
  const wis = abilities.wis || monster.wis || 10;
  const cha = abilities.cha || monster.cha || 10;

  // Ability modifiers
  const strMod = abilityMod(str);
  const dexMod = abilityMod(dex);
  const conMod = abilityMod(con);
  const intMod = abilityMod(int);
  const wisMod = abilityMod(wis);
  const chaMod = abilityMod(cha);

  // Proficiency bonus (approximate from CR)
  const profBonus = Math.floor(cr / 4) + 2;

  // Saves (use provided or calculate from ability + proficiency)
  const saves = monster.savingThrows || monster.save || {};
  const strSave = saves.str !== undefined ? saves.str : strMod;
  const dexSave = saves.dex !== undefined ? saves.dex : dexMod;
  const conSave = saves.con !== undefined ? saves.con : conMod;
  const intSave = saves.int !== undefined ? saves.int : intMod;
  const wisSave = saves.wis !== undefined ? saves.wis : wisMod;
  const chaSave = saves.cha !== undefined ? saves.cha : chaMod;

  // Action economy
  const numActions = (monster.actions || monster.action || []).length;
  const numBonusActions = (monster.bonusActions || monster.bonus || []).length;
  const numReactions = (monster.reactions || monster.reaction || []).length;
  const numLegendaryActions = (monster.legendaryActions || monster.legendary || []).length;

  // DPR
  const dpr = calculateDPR(monster);

  // Resistances and immunities
  const numResistances = (monster.damageResistances || monster.resist || []).length;
  const numImmunities = (monster.damageImmunities || monster.immune || []).length;
  const numConditionImmunities = (monster.conditionImmunities || monster.conditionImmune || []).length;

  return {
    cr,
    hp,
    ac,
    str, dex, con, int, wis, cha,
    strMod, dexMod, conMod, intMod, wisMod, chaMod,
    strSave, dexSave, conSave, intSave, wisSave, chaSave,
    profBonus,
    numActions,
    numBonusActions,
    numReactions,
    numLegendaryActions,
    dpr,
    numResistances,
    numImmunities,
    numConditionImmunities
  };
}

/**
 * Quantize a continuous CR value to nearest valid D&D CR
 */
function quantizeCR(crValue) {
  if (crValue <= 0) return 0;
  if (crValue >= 30) return 30;

  // Find nearest valid CR
  let closest = VALID_CRS[0];
  let minDiff = Math.abs(crValue - closest);

  for (const validCR of VALID_CRS) {
    const diff = Math.abs(crValue - validCR);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validCR;
    }
  }

  return closest;
}

/**
 * Calculate rule-based eCR approximation
 * This is a simplified version based on DMG guidelines and ML model insights
 */
function calculateRuleBasedECR(features) {
  const { hp, ac, dpr, numLegendaryActions, numResistances, numImmunities } = features;

  // Defensive CR (from HP and AC)
  let defensiveCR = 0;
  const effectiveHP = hp * (1 + (ac - 13) * 0.05) * (1 + numResistances * 0.25 + numImmunities * 0.5);

  if (effectiveHP < 7) defensiveCR = 0;
  else if (effectiveHP < 36) defensiveCR = 0.125;
  else if (effectiveHP < 50) defensiveCR = 0.25;
  else if (effectiveHP < 71) defensiveCR = 0.5;
  else if (effectiveHP < 86) defensiveCR = 1;
  else if (effectiveHP < 101) defensiveCR = 2;
  else if (effectiveHP < 116) defensiveCR = 3;
  else if (effectiveHP < 131) defensiveCR = 4;
  else if (effectiveHP < 146) defensiveCR = 5;
  else if (effectiveHP < 161) defensiveCR = 6;
  else if (effectiveHP < 176) defensiveCR = 7;
  else if (effectiveHP < 191) defensiveCR = 8;
  else if (effectiveHP < 206) defensiveCR = 9;
  else if (effectiveHP < 221) defensiveCR = 10;
  else if (effectiveHP < 251) defensiveCR = 11;
  else if (effectiveHP < 281) defensiveCR = 12;
  else if (effectiveHP < 311) defensiveCR = 13;
  else if (effectiveHP < 341) defensiveCR = 14;
  else if (effectiveHP < 371) defensiveCR = 15;
  else if (effectiveHP < 401) defensiveCR = 16;
  else if (effectiveHP < 431) defensiveCR = 17;
  else if (effectiveHP < 461) defensiveCR = 18;
  else if (effectiveHP < 491) defensiveCR = 19;
  else if (effectiveHP < 521) defensiveCR = 20;
  else defensiveCR = Math.min(30, 20 + Math.floor((effectiveHP - 521) / 30));

  // Offensive CR (from DPR)
  let offensiveCR = 0;
  const effectiveDPR = dpr * (1 + numLegendaryActions * 0.5);

  if (effectiveDPR < 2) offensiveCR = 0;
  else if (effectiveDPR < 4) offensiveCR = 0.125;
  else if (effectiveDPR < 5) offensiveCR = 0.25;
  else if (effectiveDPR < 6) offensiveCR = 0.5;
  else if (effectiveDPR < 7) offensiveCR = 1;
  else if (effectiveDPR < 15) offensiveCR = 2;
  else if (effectiveDPR < 21) offensiveCR = 3;
  else if (effectiveDPR < 27) offensiveCR = 4;
  else if (effectiveDPR < 33) offensiveCR = 5;
  else if (effectiveDPR < 39) offensiveCR = 6;
  else if (effectiveDPR < 45) offensiveCR = 7;
  else if (effectiveDPR < 51) offensiveCR = 8;
  else if (effectiveDPR < 57) offensiveCR = 9;
  else if (effectiveDPR < 63) offensiveCR = 10;
  else if (effectiveDPR < 69) offensiveCR = 11;
  else if (effectiveDPR < 75) offensiveCR = 12;
  else if (effectiveDPR < 81) offensiveCR = 13;
  else if (effectiveDPR < 87) offensiveCR = 14;
  else if (effectiveDPR < 93) offensiveCR = 15;
  else if (effectiveDPR < 99) offensiveCR = 16;
  else if (effectiveDPR < 105) offensiveCR = 17;
  else if (effectiveDPR < 111) offensiveCR = 18;
  else if (effectiveDPR < 117) offensiveCR = 19;
  else if (effectiveDPR < 123) offensiveCR = 20;
  else offensiveCR = Math.min(30, 20 + Math.floor((effectiveDPR - 123) / 6));

  // Average of defensive and offensive CR
  return (defensiveCR + offensiveCR) / 2;
}

/**
 * Predict eCR for a monster
 * @param {Object} monster - Monster data in 5e.tools format
 * @returns {Object} { ecr: string, ecrNumeric: number, confidence: string, features: Object }
 */
function predictECR(monster) {
  // Extract features
  const features = extractFeatures(monster);

  // Calculate rule-based eCR
  const ruleBasedECR = calculateRuleBasedECR(features);

  // Quantize to nearest valid CR
  const ecrNumeric = quantizeCR(ruleBasedECR);
  const ecr = NUMERIC_TO_CR[ecrNumeric] || String(Math.round(ecrNumeric));

  // Calculate confidence based on difference from official CR
  const officialCR = features.cr;
  const diff = Math.abs(ecrNumeric - officialCR);

  let confidence = 'high';
  if (diff > 2) confidence = 'low';
  else if (diff > 1) confidence = 'medium';

  return {
    ecr,
    ecrNumeric,
    confidence,
    officialCR: NUMERIC_TO_CR[officialCR] || String(officialCR),
    features
  };
}

export {
  predictECR,
  extractFeatures,
  quantizeCR
};
