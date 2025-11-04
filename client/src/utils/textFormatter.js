/**
 * Utility functions for formatting and cleaning text from 5e.tools data
 */

/**
 * Cleans 5e.tools link markup from text
 * Converts patterns like "Hit Points|XPHB|Hit Point" to "Hit Points"
 * or "Disadvantage|XPHB" to "Disadvantage"
 *
 * @param {string} text - Text potentially containing 5e.tools markup
 * @returns {string} Cleaned text without markup
 */
export function clean5eToolsMarkup(text) {
  if (!text || typeof text !== 'string') return text;

  // Pattern matches: "Text|SOURCE|OptionalText" or "Text|SOURCE"
  // Common sources: XPHB, PHB, XDMG, DMG, TCE, TCoE, XGE, SCAG, VGM, MTF, etc.
  // We capture the first part (the actual text) and discard the source reference
  const pattern = /([^|{\n]+)\|([A-Z]{2,6})(?:\|[^|}{\n]*)?/g;

  return text.replace(pattern, '$1');
}

/**
 * Cleans all 5e.tools markup tags including {@tag content}
 *
 * @param {string} text - Text potentially containing 5e.tools markup
 * @returns {string} Cleaned text
 */
export function cleanAll5eToolsMarkup(text) {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;

  // Remove link patterns like "Text|SOURCE|OptionalText"
  cleaned = clean5eToolsMarkup(cleaned);

  // Remove dice roll tags like {@dice 1d20} or {@damage 2d6}
  cleaned = cleaned.replace(/\{@(?:dice|damage|hit|h|d20|scaledice|scaledamage)\s+([^}]+)\}/g, '$1');

  // Remove other common tags like {@creature Name}, {@spell Name}, etc.
  cleaned = cleaned.replace(/\{@(?:creature|spell|item|condition|sense|skill|action)\s+([^}|]+)(?:\|[^}]*)?\}/g, '$1');

  // Remove any remaining tags
  cleaned = cleaned.replace(/\{@\w+\s+([^}]+)\}/g, '$1');

  return cleaned.trim();
}

/**
 * Cleans text for display in UI (removes all markup)
 *
 * @param {string} text - Text to clean
 * @returns {string} Display-ready text
 */
export function formatForDisplay(text) {
  return cleanAll5eToolsMarkup(text);
}
