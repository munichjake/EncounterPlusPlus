/**
 * Compact Converter für Node.js (ES6 Modules)
 * Konvertiert kompaktes Format zu vollständigem Format
 */

const SIZE_CODE_TO_FULL = {
  'T': 'Tiny',
  'S': 'Small',
  'M': 'Medium',
  'L': 'Large',
  'H': 'Huge',
  'G': 'Gargantuan'
};

const ATTACK_CODE_TO_TYPE = {
  'mw': 'meleeWeaponAttack',
  'rw': 'rangedWeaponAttack',
  'ms': 'meleeSpellAttack',
  'rs': 'rangedSpellAttack'
};

/**
 * Expandiert eine kompakte Kreatur ins vollständige Format
 * @param {Object} compact - Kompakte Kreatur
 * @returns {Object} - Vollständige Kreatur
 */
export function expandCompactCreature(compact) {
  const creature = {
    schema: 'encounterpp-creature',
    schemaVersion: 1
  };

  // Basis
  creature.name = compact.n;
  creature.id = compact.id || slugify(compact.n);

  // Size
  if (compact.sz) {
    creature.size = SIZE_CODE_TO_FULL[compact.sz] || 'Medium';
  }

  // Type
  const typeData = {};
  if (compact.t) typeData.type = compact.t;
  if (compact.tags) typeData.tags = compact.tags;
  if (Object.keys(typeData).length > 0) {
    creature.type = typeData;
  }

  // Alignment
  if (compact.al) creature.alignment = compact.al;

  // AC
  const acEntry = { value: compact.ac || 10 };
  if (compact.acNote) acEntry.notes = compact.acNote;
  creature.ac = [acEntry];

  // HP
  const hp = {};
  if (compact.hp) hp.formula = compact.hp;
  if (compact.hpAvg) hp.average = compact.hpAvg;
  creature.hp = hp;

  // Speed
  const speed = {};
  if (compact.spd) speed.walk = compact.spd;
  if (compact.fly) speed.fly = compact.fly;
  if (compact.swim) speed.swim = compact.swim;
  if (compact.climb) speed.climb = compact.climb;
  if (compact.burrow) speed.burrow = compact.burrow;
  if (compact.hover) speed.hover = compact.hover;
  creature.speed = speed;

  // Abilities
  creature.abilities = {
    str: compact.str || 10,
    dex: compact.dex || 10,
    con: compact.con || 10,
    int: compact.int || 10,
    wis: compact.wis || 10,
    cha: compact.cha || 10
  };

  // Saves & Skills
  creature.savingThrows = compact.save || {};
  creature.skills = compact.skill || {};

  // Senses
  const senses = {};
  if (compact.darkvision) senses.darkvision = compact.darkvision;
  if (compact.blindsight) senses.blindsight = compact.blindsight;
  if (compact.tremorsense) senses.tremorsense = compact.tremorsense;
  if (compact.truesight) senses.truesight = compact.truesight;
  if (compact.pp) senses.passivePerception = compact.pp;
  creature.senses = senses;

  // Languages
  creature.languages = compact.lang || [];

  // CR & XP
  if (compact.cr !== undefined) creature.cr = compact.cr;
  if (compact.xp) creature.xp = compact.xp;

  // Proficiencies
  creature.proficiencies = { armor: [], weapons: [], tools: [] };

  // Damage stuff
  creature.damageVulnerabilities = compact.vuln || [];
  creature.damageResistances = compact.res || [];
  creature.damageImmunities = compact.immune || [];
  creature.conditionImmunities = compact.condImm || [];

  // Features
  creature.traits = expandFeatures(compact.traits || []);
  creature.actions = expandActions(compact.actions || []);
  creature.bonusActions = expandActions(compact.bonus || []);
  creature.reactions = expandFeatures(compact.reactions || []);

  // Legendary
  if (compact.legendary) {
    creature.legendary = {
      points: compact.legendary.pts || 3,
      actions: expandFeatures(compact.legendary.actions || [])
    };
  } else {
    creature.legendary = null;
  }

  // Legendary Group (for lair actions reference)
  if (compact.legendaryGroup) {
    creature.legendaryGroup = compact.legendaryGroup;
  }

  // Lair Actions & Spellcasting
  creature.lairActions = expandFeatures(compact.lair || []);
  creature.spellcasting = compact.spells || [];

  // Meta
  const meta = {};
  if (compact.src) meta.source = compact.src;
  if (compact.img) meta.imageUrl = compact.img;
  else meta.imageUrl = null;
  if (compact.token) meta.tokenUrl = compact.token;
  if (compact.tag) meta.tags = compact.tag;
  creature.meta = meta;

  return creature;
}

/**
 * Expandiert Features (Traits, Reactions, etc.)
 */
function expandFeatures(compactFeatures) {
  return compactFeatures.map(cf => {
    const feature = { name: cf.n };
    if (cf.d) feature.desc = cf.d;
    if (cf.rules) feature.rules = cf.rules;
    return feature;
  });
}

/**
 * Expandiert Actions
 */
function expandActions(compactActions) {
  return compactActions.map(ca => {
    if (ca.atk) {
      // Attack Action
      const actionType = ATTACK_CODE_TO_TYPE[ca.atk] || 'meleeWeaponAttack';
      const action = {
        name: ca.n,
        type: actionType
      };

      if (ca.hit) action.attackBonus = ca.hit;
      if (ca.rch) action.reach = ca.rch;

      if (ca.range) {
        const rangeStr = ca.range;
        if (rangeStr.includes('/')) {
          const [normal, long] = rangeStr.split('/').map(Number);
          action.range = { normal, long };
        } else {
          action.range = { normal: Number(rangeStr) };
        }
      }

      // On Hit
      const onHit = [];
      if (ca.dmg) {
        const hitEntry = { damage: ca.dmg };
        if (ca.type) hitEntry.type = ca.type;
        onHit.push(hitEntry);
      }

      if (ca.extra) {
        ca.extra.forEach(ex => {
          const extraHit = {};
          if (ex.dmg) extraHit.damage = ex.dmg;
          if (ex.type) extraHit.type = ex.type;
          onHit.push(extraHit);
        });
      }

      if (onHit.length > 0) action.onHit = onHit;
      action.target = ca.target || 'one target';

      return action;

    } else if (ca.save) {
      // Save Action
      const action = {
        name: ca.n,
        type: 'save',
        save: {
          ability: ca.save,
          dc: ca.dc
        }
      };

      if (ca.half) action.save.onSuccess = 'half damage';

      if (ca.area) {
        const [shape, size] = ca.area.split(' ');
        action.area = {
          shape,
          size: Number(size),
          unit: 'ft'
        };
      }

      const effects = [];
      if (ca.dmg) {
        const effect = { damage: ca.dmg };
        if (ca.type) effect.type = ca.type;
        effects.push(effect);
      }
      if (effects.length > 0) action.effects = effects;

      if (ca.rchg) action.recharge = ca.rchg;

      return action;

    } else {
      // Beschreibende Action
      const action = { name: ca.n };
      if (ca.d) action.desc = ca.d;
      return action;
    }
  });
}

/**
 * Expandiert ein Array von kompakten Kreaturen
 * @param {Array} compactCreatures - Array von kompakten Kreaturen
 * @returns {Array} - Array von vollständigen Kreaturen
 */
export function expandCompactCreatures(compactCreatures) {
  return compactCreatures.map(expandCompactCreature);
}

/**
 * Slugify-Funktion
 */
function slugify(text) {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
