// Creature adjectives will be loaded from JSON file
let CREATURE_ADJECTIVES = [];

// Load adjectives from JSON file
export async function loadCreatureAdjectives(apiFunction) {
  try {
    // Use API function if provided, otherwise use direct fetch with API prefix
    const url = apiFunction ? apiFunction('/data/creature-adjectives.json') : '/api/data/creature-adjectives.json';
    const response = await fetch(url);
    const data = await response.json();
    CREATURE_ADJECTIVES = data.adjectives || [];
  } catch (error) {
    console.error('Failed to load creature adjectives:', error);
    // Fallback to a few basic adjectives if loading fails
    CREATURE_ADJECTIVES = ["Brave", "Cunning", "Fierce", "Swift", "Mighty"];
  }
}

// Convert number to Roman numerals
export function toRomanNumeral(num) {
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
export function getUniqueIdentifier(baseName, existingNames, namingMode = 'adjective') {
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

// Format creature name with identifier
export function formatCreatureName(identifier, baseName, namingMode = 'adjective') {
  if (namingMode === 'adjective') {
    return `${identifier} ${baseName}`;
  }
  return `${baseName} ${identifier}`;
}

// Get CREATURE_ADJECTIVES for external use
export function getCreatureAdjectives() {
  return CREATURE_ADJECTIVES;
}
