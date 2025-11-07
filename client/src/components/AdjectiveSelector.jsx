import React, { useState } from "react";
import { useSettings } from "./Settings.jsx";
import { getCreatureAdjectives, formatCreatureName } from "../utils/namingUtils.js";

// Get reference to CREATURE_ADJECTIVES
const CREATURE_ADJECTIVES = getCreatureAdjectives();

export function AdjectiveSelector({ currentName, onChange }) {
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
