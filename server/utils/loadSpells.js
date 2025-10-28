import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Cache für 5e.tools Spell-Daten
 * Lädt alle Spell-JSONs aus dem spells-Ordner und cached sie im Speicher
 */
export class SpellCache {
  constructor() {
    this.cache = null;
    this.lastLoad = 0;
    this.cacheDuration = 5 * 60 * 1000; // 5 Minuten Cache
  }

  /**
   * Lädt alle Spells aus der konvertierten spells_5etools.json
   */
  async load(dataBasePath) {
    const now = Date.now();

    // Return cached data if still valid
    if (this.cache && (now - this.lastLoad) < this.cacheDuration) {
      console.log('📖 Using cached spells');
      return this.cache;
    }

    console.log('📚 Loading spells from converted file...');

    try {
      const spellsFilePath = join(dataBasePath, 'sources', 'spells_5etools.json');

      const content = readFileSync(spellsFilePath, 'utf-8');
      const allSpells = JSON.parse(content);

      if (!Array.isArray(allSpells)) {
        throw new Error('Invalid spells file format - expected array');
      }

      console.log(`✅ Loaded ${allSpells.length} spells`);

      // Cache the results
      this.cache = allSpells;
      this.lastLoad = now;

      return allSpells;
    } catch (error) {
      console.error('❌ Error loading spells:', error);
      return this.cache || []; // Return cached data or empty array on error
    }
  }

  /**
   * Invalidate cache (force reload on next request)
   */
  invalidate() {
    this.cache = null;
    this.lastLoad = 0;
  }
}
