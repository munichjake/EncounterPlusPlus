/**
 * Normalisiert ein Monster-Objekt für das Edit-Formular
 * Konvertiert komplexe 5e.tools Strukturen zu einfachen Formular-Werten
 */
export function normalizeCreatureForForm(creature) {
  if (!creature) return null;

  const normalized = { ...creature };

  // AC: [{ value: 16, notes: "..." }] => 16
  if (Array.isArray(normalized.ac) && normalized.ac.length > 0) {
    normalized.ac = normalized.ac[0].value || normalized.ac[0];
  } else if (typeof normalized.ac === 'object' && normalized.ac.value) {
    normalized.ac = normalized.ac.value;
  }

  // HP: { average: 60, formula: "..." } => 60
  if (typeof normalized.hp === 'object' && normalized.hp !== null) {
    normalized.hp = normalized.hp.average || normalized.hp.formula || '';
  }

  // Speed: Handle both object and string formats
  if (typeof normalized.speed === 'object' && normalized.speed !== null) {
    // Object format: { walk: 30, fly: 60 } => split into individual fields
    if (normalized.speed.walk) normalized.speed = `${normalized.speed.walk} ft.`;
    if (normalized.speed.fly) normalized.fly = `${normalized.speed.fly} ft.${normalized.speed.hover ? ' (hover)' : ''}`;
    if (normalized.speed.swim) normalized.swim = `${normalized.speed.swim} ft.`;
    if (normalized.speed.climb) normalized.climb = `${normalized.speed.climb} ft.`;
    if (normalized.speed.burrow) normalized.burrow = `${normalized.speed.burrow} ft.`;
  } else if (typeof normalized.speed === 'string' && normalized.speed) {
    // String format: "30 ft., fly 60 ft., swim 30 ft." => split into individual fields
    const speedParts = normalized.speed.toLowerCase().split(',').map(s => s.trim());
    let walkSpeed = null;

    speedParts.forEach(part => {
      if (part.includes('fly')) {
        normalized.fly = part.replace('fly', '').trim();
      } else if (part.includes('swim')) {
        normalized.swim = part.replace('swim', '').trim();
      } else if (part.includes('climb')) {
        normalized.climb = part.replace('climb', '').trim();
      } else if (part.includes('burrow')) {
        normalized.burrow = part.replace('burrow', '').trim();
      } else if (part.match(/^\d/) && !walkSpeed) {
        // First numeric value is walking speed
        walkSpeed = part.trim();
      }
    });

    // Set walk speed if found
    if (walkSpeed) {
      normalized.speed = walkSpeed;
    }
  }

  // Type: { type: "construct", tags: [...] } => "construct"
  if (typeof normalized.type === 'object' && normalized.type !== null) {
    let typeStr = '';

    // Handle {choose} objects in type.type field
    if (typeof normalized.type.type === 'string') {
      typeStr = normalized.type.type;
    } else if (typeof normalized.type.type === 'object' && normalized.type.type?.choose) {
      // If type contains {choose: ["celestial", "fiend"]}, format as "celestial or fiend"
      typeStr = Array.isArray(normalized.type.type.choose)
        ? normalized.type.type.choose.join(' or ')
        : JSON.stringify(normalized.type.type.choose);
    } else {
      typeStr = normalized.type.type || '';
    }

    if (normalized.type.tags && normalized.type.tags.length > 0) {
      typeStr += ` (${normalized.type.tags.join(', ')})`;
    }
    normalized.type = typeStr;
  }

  // Actions & Traits: Konvertiere Arrays zu lesbarem Text für Anzeige und Editierung
  if (Array.isArray(normalized.actions)) {
    normalized.actions = normalized.actions.map(a => {
      let text = `**${a.name || a.n}**`;
      const desc = a.desc || a.d || a.description;
      if (desc) text += `: ${desc}`;
      return text;
    }).join('\n\n');
  }

  if (Array.isArray(normalized.traits)) {
    normalized.traits = normalized.traits.map(t => {
      let text = `**${t.name || t.n}**`;
      const desc = t.desc || t.d || t.description;
      if (desc) text += `: ${desc}`;
      return text;
    }).join('\n\n');
  }

  if (Array.isArray(normalized.bonusActions)) {
    normalized.bonusActions = normalized.bonusActions.map(a => {
      let text = `**${a.name || a.n}**`;
      const desc = a.desc || a.d || a.description;
      if (desc) text += `: ${desc}`;
      return text;
    }).join('\n\n');
  }

  if (Array.isArray(normalized.reactions)) {
    normalized.reactions = normalized.reactions.map(r => {
      let text = `**${r.name || r.n}**`;
      const desc = r.desc || r.d || r.description;
      if (desc) text += `: ${desc}`;
      return text;
    }).join('\n\n');
  }

  if (Array.isArray(normalized.legendaryActions)) {
    normalized.legendaryActions = normalized.legendaryActions.map(l => {
      let text = `**${l.name || l.n}**`;
      const desc = l.desc || l.d || l.description;
      if (desc) text += `: ${desc}`;
      return text;
    }).join('\n\n');
  }

  // Damage immunities, resistances, vulnerabilities
  if (Array.isArray(normalized.immune)) {
    normalized.immunities = normalized.immune.join(', ');
  }
  if (Array.isArray(normalized.resist)) {
    normalized.resistances = normalized.resist.join(', ');
  }
  if (Array.isArray(normalized.vulnerable)) {
    normalized.vulnerabilities = normalized.vulnerable.join(', ');
  }
  if (Array.isArray(normalized.conditionImmune) || Array.isArray(normalized.condImm)) {
    const condImm = normalized.conditionImmune || normalized.condImm;
    normalized.conditionImmunities = condImm.join(', ');
  }

  // Languages
  if (Array.isArray(normalized.languages) || Array.isArray(normalized.lang)) {
    const langs = normalized.languages || normalized.lang;
    normalized.languages = langs.join(', ');
  }

  // Senses: Combine individual sense fields into a single string
  if (!normalized.senses || typeof normalized.senses !== 'string') {
    const senseParts = [];

    if (normalized.blindsight) senseParts.push(`blindsight ${normalized.blindsight} ft.`);
    if (normalized.darkvision) senseParts.push(`darkvision ${normalized.darkvision} ft.`);
    if (normalized.tremorsense) senseParts.push(`tremorsense ${normalized.tremorsense} ft.`);
    if (normalized.truesight) senseParts.push(`truesight ${normalized.truesight} ft.`);
    if (normalized.pp || normalized.passivePerception) {
      const pp = normalized.pp || normalized.passivePerception;
      senseParts.push(`passive Perception ${pp}`);
    }

    if (senseParts.length > 0) {
      normalized.senses = senseParts.join(', ');
    }
  }

  // Ability scores - handle both full names and abbreviations
  const abilityMap = {
    str: 'str',
    dex: 'dex',
    con: 'con',
    int: 'int',
    wis: 'wis',
    cha: 'cha'
  };

  // Copy ability scores to standardized fields
  Object.keys(abilityMap).forEach(key => {
    if (normalized[key] !== undefined) {
      // Already has the field
    } else if (normalized.abilities?.[key] !== undefined) {
      normalized[key] = normalized.abilities[key];
    }
  });

  // Size mapping from abbreviated to full
  const sizeMap = {
    'T': 'Tiny',
    'S': 'Small',
    'M': 'Medium',
    'L': 'Large',
    'H': 'Huge',
    'G': 'Gargantuan'
  };

  if (normalized.sz && !normalized.size) {
    normalized.size = sizeMap[normalized.sz] || normalized.sz;
  }

  // Alignment
  if (normalized.al && !normalized.alignment) {
    normalized.alignment = normalized.al;
  }

  // Initiative Modifier berechnen falls nicht vorhanden
  if (normalized.initiativeMod === undefined) {
    const dex = normalized.dex || normalized.abilities?.dex;
    if (dex) {
      normalized.initiativeMod = Math.floor((dex - 10) / 2);
    }
  }

  return normalized;
}

/**
 * Bereitet Monster-Daten für das Speichern vor
 * (Für zukünftige Erweiterungen - aktuell passthrough)
 */
export function prepareCreatureForSave(formData) {
  // Momentan speichern wir einfache Werte direkt
  // In Zukunft könnten wir hier komplexere Strukturen aufbauen
  return formData;
}
