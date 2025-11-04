/**
 * eCR Calculator with ML Model (ONNX)
 * This is a direct port of the Python feature extraction logic from ecr_trainer_v3.py
 */

import ort from 'onnxruntime-node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CR steps and mappings
const CR_STEPS = [
  0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30
];

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

// DMG baseline stats per CR
const DMG_BASELINES = {
  0: { hp: 1, ac: 13, atk: 3, dpr: 0, dc: 13 },
  0.125: { hp: 7, ac: 13, atk: 3, dpr: 2, dc: 13 },
  0.25: { hp: 36, ac: 13, atk: 3, dpr: 4, dc: 13 },
  0.5: { hp: 50, ac: 13, atk: 3, dpr: 5, dc: 13 },
  1: { hp: 71, ac: 13, atk: 3, dpr: 6, dc: 13 },
  2: { hp: 86, ac: 13, atk: 3, dpr: 14, dc: 13 },
  3: { hp: 101, ac: 13, atk: 4, dpr: 20, dc: 13 },
  4: { hp: 116, ac: 14, atk: 5, dpr: 26, dc: 14 },
  5: { hp: 131, ac: 15, atk: 6, dpr: 32, dc: 15 },
  6: { hp: 146, ac: 15, atk: 6, dpr: 38, dc: 15 },
  7: { hp: 161, ac: 15, atk: 6, dpr: 44, dc: 15 },
  8: { hp: 176, ac: 16, atk: 7, dpr: 50, dc: 16 },
  9: { hp: 191, ac: 16, atk: 7, dpr: 56, dc: 16 },
  10: { hp: 206, ac: 17, atk: 7, dpr: 62, dc: 16 },
  11: { hp: 221, ac: 17, atk: 8, dpr: 68, dc: 17 },
  12: { hp: 251, ac: 17, atk: 8, dpr: 74, dc: 17 },
  13: { hp: 281, ac: 18, atk: 8, dpr: 80, dc: 18 },
  14: { hp: 311, ac: 18, atk: 8, dpr: 86, dc: 18 },
  15: { hp: 341, ac: 18, atk: 8, dpr: 92, dc: 18 },
  16: { hp: 371, ac: 18, atk: 9, dpr: 98, dc: 18 },
  17: { hp: 401, ac: 19, atk: 10, dpr: 104, dc: 19 },
  18: { hp: 431, ac: 19, atk: 10, dpr: 110, dc: 19 },
  19: { hp: 461, ac: 19, atk: 10, dpr: 116, dc: 19 },
  20: { hp: 491, ac: 19, atk: 10, dpr: 122, dc: 19 },
  21: { hp: 521, ac: 19, atk: 11, dpr: 128, dc: 20 },
  22: { hp: 551, ac: 19, atk: 11, dpr: 134, dc: 20 },
  23: { hp: 581, ac: 19, atk: 11, dpr: 140, dc: 20 },
  24: { hp: 611, ac: 19, atk: 12, dpr: 146, dc: 21 },
  25: { hp: 641, ac: 19, atk: 12, dpr: 152, dc: 21 },
  26: { hp: 671, ac: 19, atk: 12, dpr: 158, dc: 21 },
  27: { hp: 701, ac: 19, atk: 13, dpr: 164, dc: 22 },
  28: { hp: 731, ac: 19, atk: 13, dpr: 170, dc: 22 },
  29: { hp: 761, ac: 19, atk: 13, dpr: 176, dc: 22 },
  30: { hp: 791, ac: 19, atk: 14, dpr: 182, dc: 23 }
};

const TRAIT_FLAGS = [
  'Incorporeal', 'Sunlight', 'Magic Resistance', 'Pack Tactics', 'Multiattack',
  'Regeneration', 'Legendary', 'Lair', 'Invisibility', 'Frighten', 'Paralyze',
  'Restrain', 'Grapple', 'Possession', 'Web', 'Teleport', 'Poison'
];

// Load ONNX model and metadata
let onnxSession = null;
let metadata = null;

async function loadModel() {
  if (onnxSession) return { session: onnxSession, metadata };

  const modelPath = path.join(__dirname, '..', '..', 'models', 'ecr_production', 'ecr_model_v1.onnx');
  const metadataPath = path.join(__dirname, '..', '..', 'models', 'ecr_production', 'ecr_model_metadata.json');

  onnxSession = await ort.InferenceSession.create(modelPath);
  metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

  return { session: onnxSession, metadata };
}

/**
 * Utility functions
 */

function stripTokens(text) {
  if (!text) return '';
  return String(text).replace(/\{@[^}]+\}/g, '');
}

function avgFromDiceExpr(expr) {
  if (!expr || typeof expr !== 'string') return 0;

  expr = expr.trim().toLowerCase();
  const match = expr.match(/(\d+)d(\d+)\s*([+\-]\s*\d+)?/);
  if (!match) return 0;

  const numDice = parseInt(match[1]);
  const diceSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3].replace(/\s/g, '')) : 0;

  return numDice * (diceSize + 1) / 2 + modifier;
}

function baselineForCR(cr) {
  const crNum = typeof cr === 'string' ? (CR_TO_NUMERIC[cr] || parseFloat(cr)) : cr;

  // Find closest CR step
  let closest = CR_STEPS[0];
  let minDiff = Math.abs(crNum - closest);

  for (const step of CR_STEPS) {
    const diff = Math.abs(crNum - step);
    if (diff < minDiff) {
      minDiff = diff;
      closest = step;
    }
  }

  return DMG_BASELINES[closest] || DMG_BASELINES[0];
}

function resistanceMultiplier(stat) {
  const resist = (stat.damageResistances || stat.resist || []).length;
  const immune = (stat.damageImmunities || stat.immune || []).length;
  const vuln = (stat.damageVulnerabilities || stat.vulnerable || []).length;

  let mult = 1.0;
  if (resist > 0) mult += resist * 0.25;
  if (immune > 0) mult += immune * 0.5;
  if (vuln > 0) mult -= vuln * 0.25;

  return Math.max(1.0, mult);
}

function hitChance(attackBonus, targetAC) {
  const needed = targetAC - attackBonus;
  if (needed <= 1) return 0.975; // 95% hit (nat 1 misses)
  if (needed >= 20) return 0.05; // 5% hit (nat 20 hits)
  return (21 - needed) / 20.0;
}

function parseActionsForOffense(actions) {
  if (!actions || !Array.isArray(actions)) {
    console.log('[DPR Debug] No actions provided');
    return { bestAtk: null, bestDC: null, dmgEntries: [], ongoing: 0 };
  }

  let bestAtk = null;
  let bestDC = null;
  const dmgEntries = [];
  let ongoing = 0;

  const TO_HIT_RE = /(?:^|\b)([+\-]?\d{1,2})\s*to\s*hit/i;
  const SAVE_DC_RE = /DC\s*(\d{1,2})/i;
  const DAMAGE_BLOCK_RE = /(\d+)\s*\(\s*([0-9d+\-\s]+)\s*\)\s*([a-z]+)/ig;

  console.log('[DPR Debug] Parsing', actions.length, 'actions');

  for (const action of actions) {
    const desc = action.desc || action.d || '';
    const entries = action.entries || [];
    const text = stripTokens(desc || (Array.isArray(entries) ? entries.join(' ') : String(entries)));

    console.log('[DPR Debug] Action:', action.name || action.n || 'Unnamed', 'Text:', text.substring(0, 150));

    // Extract to-hit bonus
    const hitMatch = text.match(TO_HIT_RE);
    if (hitMatch) {
      const atk = parseInt(hitMatch[1]);
      if (bestAtk === null || atk > bestAtk) bestAtk = atk;
    }

    // Extract DC
    const dcMatch = text.match(SAVE_DC_RE);
    if (dcMatch) {
      const dc = parseInt(dcMatch[1]);
      if (bestDC === null || dc > bestDC) bestDC = dc;
    }

    // Extract damage
    let match;
    while ((match = DAMAGE_BLOCK_RE.exec(text)) !== null) {
      const avgDmg = parseInt(match[1]);
      const damageType = match[3].toLowerCase();

      console.log('[DPR Debug]   Found damage:', avgDmg, damageType, 'from pattern:', match[0]);
      dmgEntries.push({ avg: avgDmg, type: damageType });

      // Check for ongoing damage
      if (/(start|end).*(turn|round)/i.test(text)) {
        ongoing += avgDmg * 0.3; // Rough estimate: 30% of damage as ongoing
      }
    }
  }

  console.log('[DPR Debug] Total damage entries:', dmgEntries.length, 'Total DPR:', dmgEntries.reduce((sum, e) => sum + e.avg, 0));

  return { bestAtk, bestDC, dmgEntries, ongoing };
}

function quantizeCR(crValue) {
  if (crValue <= 0) return 0;
  if (crValue >= 30) return 30;

  let closest = CR_STEPS[0];
  let minDiff = Math.abs(crValue - closest);

  for (const validCR of CR_STEPS) {
    const diff = Math.abs(crValue - validCR);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validCR;
    }
  }

  return closest;
}

/**
 * Calculate rule-based eCR (simplified DMG method)
 */
function rulesECR(stat) {
  // Parse HP - same logic as extractFeatures
  let hp;
  if (typeof stat.hpAvg === 'number') {
    hp = stat.hpAvg;
  } else if (typeof stat.baseHP === 'number') {
    hp = stat.baseHP;
  } else if (typeof stat.hp === 'number') {
    hp = stat.hp;
  } else {
    const hpField = stat.hp;
    if (hpField && typeof hpField === 'object') {
      hp = hpField.average || hpField.avg || avgFromDiceExpr(hpField.formula);
    } else if (typeof hpField === 'string') {
      hp = avgFromDiceExpr(hpField);
    }
  }
  hp = hp || 1;

  // Effective HP with resistances
  const ehp = hp * resistanceMultiplier(stat);

  // Find defensive CR based on eHP
  let dcr = CR_STEPS[0];
  let minDiff = Math.abs(DMG_BASELINES[dcr].hp - ehp);
  for (const cr of CR_STEPS) {
    const diff = Math.abs(DMG_BASELINES[cr].hp - ehp);
    if (diff < minDiff) {
      minDiff = diff;
      dcr = cr;
    }
  }

  // Adjust for AC
  let ac = 10;
  const acRaw = stat.ac;
  if (Array.isArray(acRaw) && acRaw.length > 0) {
    ac = acRaw[0]?.value || acRaw[0]?.ac || (typeof acRaw[0] === 'number' ? acRaw[0] : 10);
  } else if (typeof acRaw === 'object') {
    ac = acRaw.value || 10;
  } else if (typeof acRaw === 'number') {
    ac = acRaw;
  }

  const acBase = DMG_BASELINES[dcr].ac;
  const dcrShift = Math.round((ac - acBase) / 2.0);
  let dcrIdx = CR_STEPS.indexOf(dcr);
  dcrIdx = Math.max(0, Math.min(CR_STEPS.length - 1, dcrIdx + dcrShift));
  dcr = CR_STEPS[dcrIdx];

  // Offensive CR
  const { bestAtk, bestDC, dmgEntries, ongoing } = parseActionsForOffense(stat.actions || stat.action || []);

  // Top 2 damage entries
  const top = dmgEntries.sort((a, b) => b.avg - a.avg).slice(0, 2);
  let baseAvg = top.reduce((sum, x) => sum + x.avg, 0);

  // AOE factor
  let aoeFactor = 1.0;
  for (const action of (stat.actions || stat.action || [])) {
    const text = stripTokens(action.d || action.desc || '');
    if (/each creature|\b\d{1,2}-foot[- ]radius\b/i.test(text)) {
      aoeFactor = Math.max(aoeFactor, 1.5);
    }
  }

  const crRaw = stat.cr;
  const baseFor = baselineForCR(crRaw !== undefined ? crRaw : dcr);
  const atkEquiv = bestAtk !== null ? bestAtk : (bestDC !== null ? bestDC - 8 : baseFor.atk);
  const hc = hitChance(atkEquiv, baseFor.ac);
  const dprRaw = baseAvg * aoeFactor + ongoing;
  const dpr = baseAvg * hc * aoeFactor + ongoing;

  console.log('[DPR Debug rulesECR] baseAvg:', baseAvg, 'hitChance:', hc.toFixed(2), 'aoeFactor:', aoeFactor, 'dprRaw:', dprRaw.toFixed(1), 'final DPR:', dpr.toFixed(1));

  // Find offensive CR based on DPR
  let ocr = CR_STEPS[0];
  minDiff = Math.abs(DMG_BASELINES[ocr].dpr - dpr);
  for (const cr of CR_STEPS) {
    const diff = Math.abs(DMG_BASELINES[cr].dpr - dpr);
    if (diff < minDiff) {
      minDiff = diff;
      ocr = cr;
    }
  }

  // Adjust OCR based on attack bonus or DC
  if (bestAtk !== null) {
    const atkDelta = bestAtk - DMG_BASELINES[ocr].atk;
    let ocrIdx = CR_STEPS.indexOf(ocr);
    ocrIdx = Math.max(0, Math.min(CR_STEPS.length - 1, ocrIdx + Math.round(atkDelta / 2.0)));
    ocr = CR_STEPS[ocrIdx];
  } else if (bestDC !== null) {
    const dcDelta = bestDC - DMG_BASELINES[ocr].dc;
    let ocrIdx = CR_STEPS.indexOf(ocr);
    ocrIdx = Math.max(0, Math.min(CR_STEPS.length - 1, ocrIdx + Math.round(dcDelta / 2.0)));
    ocr = CR_STEPS[ocrIdx];
  }

  const ecrCont = 0.5 * (dcr + ocr);
  const ecrQ = quantizeCR(ecrCont);

  return { ecr: ecrQ, ehp, dpr, dpr_raw: dprRaw, dcr, ocr };
}

/**
 * Extract all features for ML model
 */
function extractFeatures(stat) {
  // Parse AC
  let ac = 10;
  const acRaw = stat.ac;
  if (Array.isArray(acRaw) && acRaw.length > 0) {
    ac = acRaw[0]?.value || acRaw[0]?.ac || (typeof acRaw[0] === 'number' ? acRaw[0] : 10);
  } else if (typeof acRaw === 'object') {
    ac = acRaw.value || 10;
  } else if (typeof acRaw === 'number') {
    ac = acRaw;
  }

  // Parse HP - try multiple sources
  let hp;

  // Try different HP sources in order of preference
  if (typeof stat.hpAvg === 'number') {
    hp = stat.hpAvg;
  } else if (typeof stat.baseHP === 'number') {
    hp = stat.baseHP;
  } else if (typeof stat.hp === 'number') {
    hp = stat.hp;
  } else {
    const hpField = stat.hp;
    if (hpField && typeof hpField === 'object') {
      hp = hpField.average || hpField.avg || avgFromDiceExpr(hpField.formula);
    } else if (typeof hpField === 'string') {
      hp = avgFromDiceExpr(hpField);
    }
  }

  console.log('[eCR Debug extractFeatures] Monster:', stat.name, 'HP sources:', {
    hpAvg: stat.hpAvg,
    baseHP: stat.baseHP,
    'hp (field)': stat.hp,
    'hp (parsed)': hp
  });

  hp = hp || 1;

  // Rule-based eCR
  const ruleResult = rulesECR(stat);
  const ecrRule = ruleResult.ecr;
  const ehpRule = ruleResult.ehp;
  const dprRule = ruleResult.dpr;
  const dprRaw = ruleResult.dpr_raw;

  // Parse offense
  const { bestAtk, bestDC, dmgEntries, ongoing } = parseActionsForOffense(stat.actions || stat.action || []);
  const top = dmgEntries.sort((a, b) => b.avg - a.avg).slice(0, 2);
  const dprNaive = top.reduce((sum, x) => sum + x.avg, 0);

  // Parse CR
  let crValue = NaN;
  const crRaw = stat.cr;
  if (crRaw !== null && crRaw !== undefined) {
    if (typeof crRaw === 'string') {
      if (crRaw.includes('/')) {
        const [num, den] = crRaw.split('/');
        crValue = parseFloat(num) / parseFloat(den);
      } else {
        crValue = parseFloat(crRaw);
      }
    } else {
      crValue = parseFloat(crRaw);
    }
  }

  // Abilities
  const abilities = stat.abilities || {};
  const strScore = abilities.str || stat.str || 10;
  const dexScore = abilities.dex || stat.dex || 10;
  const conScore = abilities.con || stat.con || 10;
  const intScore = abilities.int || stat.int || 10;
  const wisScore = abilities.wis || stat.wis || 10;
  const chaScore = abilities.cha || stat.cha || 10;

  const strMod = Math.floor((strScore - 10) / 2);
  const dexMod = Math.floor((dexScore - 10) / 2);
  const conMod = Math.floor((conScore - 10) / 2);
  const intMod = Math.floor((intScore - 10) / 2);
  const wisMod = Math.floor((wisScore - 10) / 2);
  const chaMod = Math.floor((chaScore - 10) / 2);

  // Saving throws
  const saves = stat.savingThrows || stat.save || {};
  const numSavingThrows = Object.keys(saves).length;
  const maxSaveBonus = numSavingThrows > 0 ? Math.max(...Object.values(saves)) : 0;

  // Skills
  const skills = stat.skills || stat.skill || {};
  const numSkills = Object.keys(skills).length;

  // Resistances
  const numResistances = (stat.damageResistances || stat.resist || []).length;
  const numImmunities = (stat.damageImmunities || stat.immune || []).length;
  const numVulnerabilities = (stat.damageVulnerabilities || stat.vulnerable || []).length;
  const numCondImmunities = (stat.conditionImmunities || stat.conditionImmune || []).length;
  const resMult = resistanceMultiplier(stat);

  // Actions
  const numActions = (stat.actions || stat.action || []).length;
  const numBonusActions = (stat.bonusActions || stat.bonus || []).length;
  const numReactions = (stat.reactions || stat.reaction || []).length;
  const numLegendaryActions = (stat.legendaryActions || stat.legendary || []).length;
  const numLairActions = (stat.lairActions || stat.lair || []).length;

  // Movement
  const speed = stat.speed || {};
  const hasFly = !!(speed.fly || speed.canFly);
  const spd = speed.walk || speed.ground || 30;

  // Spellcasting
  let hasSpellcasting = false;
  let totalSpellLevels = 0;

  const traits = stat.traits || stat.trait || [];
  for (const trait of traits) {
    const name = trait.name || '';
    if (/spellcasting/i.test(name)) {
      hasSpellcasting = true;
      // Simple heuristic: count spell levels mentioned
      const text = stripTokens(trait.entries ? JSON.stringify(trait.entries) : '');
      const levels = text.match(/\d+(?:st|nd|rd|th)[- ]level/gi);
      if (levels) {
        totalSpellLevels = levels.length;
      }
    }
  }

  // Trait flags
  const traitFeatures = {};
  for (const traitName of TRAIT_FLAGS) {
    traitFeatures[`trait_${traitName.toLowerCase().replace(/\s+/g, '_')}`] = 0;
  }

  const allText = JSON.stringify([
    ...(stat.traits || stat.trait || []),
    ...(stat.actions || stat.action || []),
    ...(stat.reactions || stat.reaction || [])
  ]).toLowerCase();

  for (const traitName of TRAIT_FLAGS) {
    const key = `trait_${traitName.toLowerCase().replace(/\s+/g, '_')}`;
    if (allText.includes(traitName.toLowerCase())) {
      traitFeatures[key] = 1;
    }
  }

  return {
    ac,
    hp_avg: hp,
    ehp_rule: ehpRule,
    dpr_rule: dprRule,
    dpr_raw: dprRaw,
    atk_best: bestAtk || 0,
    dc_best: bestDC || 0,
    dpr_naive: dprNaive,
    dpr_ongoing: ongoing,
    res_mult: resMult,
    has_fly: hasFly ? 1 : 0,
    spd,
    str_score: strScore,
    dex_score: dexScore,
    con_score: conScore,
    int_score: intScore,
    wis_score: wisScore,
    cha_score: chaScore,
    str_mod: strMod,
    dex_mod: dexMod,
    con_mod: conMod,
    int_mod: intMod,
    wis_mod: wisMod,
    cha_mod: chaMod,
    num_resistances: numResistances,
    num_immunities: numImmunities,
    num_vulnerabilities: numVulnerabilities,
    num_cond_immunities: numCondImmunities,
    num_actions: numActions,
    num_bonus_actions: numBonusActions,
    num_reactions: numReactions,
    num_legendary_actions: numLegendaryActions,
    num_lair_actions: numLairActions,
    num_saving_throws: numSavingThrows,
    max_save_bonus: maxSaveBonus,
    num_skills: numSkills,
    has_spellcasting: hasSpellcasting ? 1 : 0,
    total_spell_levels: totalSpellLevels,
    ...traitFeatures,
    ecr_rule: ecrRule,
    cr_official: crValue
  };
}

/**
 * Predict eCR using ONNX model
 */
export async function predictECR(monsterData) {
  const { session, metadata } = await loadModel();

  // Extract features
  const features = extractFeatures(monsterData);

  // Prepare input tensor (only the features, not ecr_rule for residual model)
  const inputFeatures = metadata.feature_cols.map(col => features[col] || 0);
  const inputTensor = new ort.Tensor('float32', Float32Array.from(inputFeatures), [1, inputFeatures.length]);

  // Run inference
  const feeds = { [metadata.input_name]: inputTensor };
  const results = await session.run(feeds);
  const output = results[metadata.output_name];

  let predRaw = output.data[0];

  // Add back ecr_rule for residual learning
  if (metadata.residual) {
    predRaw += features.ecr_rule;
  }

  // Clip and quantize
  predRaw = Math.max(0, Math.min(30, predRaw));
  const predQuantized = quantizeCR(predRaw);

  // Calculate confidence
  const diff = Math.abs(predQuantized - features.ecr_rule);
  let confidence = 'high';
  if (diff > 2) confidence = 'low';
  else if (diff > 1) confidence = 'medium';

  return {
    ecr: NUMERIC_TO_CR[predQuantized] || String(Math.round(predQuantized)),
    ecrNumeric: predQuantized,
    ecrRaw: predRaw,
    confidence,
    officialCR: NUMERIC_TO_CR[features.cr_official] || (isNaN(features.cr_official) ? null : String(features.cr_official)),
    ruleBasedECR: NUMERIC_TO_CR[features.ecr_rule] || String(features.ecr_rule),
    features: {
      hp: features.hp_avg,
      ac: features.ac,
      ehp: features.ehp_rule,
      dpr: features.dpr_rule,
      dpr_raw: features.dpr_raw,
      attackBonus: features.atk_best,
      numLegendaryActions: features.num_legendary_actions
    }
  };
}

export { extractFeatures, quantizeCR };
