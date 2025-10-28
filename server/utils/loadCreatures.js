/**
 * Creature Loader für Node.js (ES6 Modules)
 * Lädt Creatures aus verschiedenen Formaten (normal, minified, gzip)
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import { expandCompactCreatures } from './compactConverter.js';

const gunzipAsync = promisify(gunzip);

/**
 * Lädt eine JSON-Datei (gzip oder normal)
 * @param {string} filePath - Pfad zur Datei
 * @returns {Promise<Object>} - Geparste JSON-Daten
 */
export async function loadJSON(filePath) {
  if (filePath.endsWith('.gz')) {
    return loadGzipJSON(filePath);
  } else {
    return loadPlainJSON(filePath);
  }
}

/**
 * Lädt eine normale JSON-Datei
 */
async function loadPlainJSON(filePath) {
  const data = await readFile(filePath, 'utf8');
  return JSON.parse(data);
}

/**
 * Lädt eine gzip-komprimierte JSON-Datei
 */
async function loadGzipJSON(filePath) {
  const compressed = await readFile(filePath);
  const decompressed = await gunzipAsync(compressed);
  return JSON.parse(decompressed.toString('utf8'));
}

/**
 * Lädt eine JSON-Datei mit automatischer Fallback-Logik
 * Versucht: .json.gz → .min.json → .json
 * @param {string} baseFilePath - Basis-Pfad (ohne Extension)
 * @returns {Promise<Object>} - Geparste JSON-Daten
 */
export async function loadJSONWithFallback(baseFilePath) {
  // Entferne mögliche Extensions
  let basePath = baseFilePath
    .replace(/\.json\.gz$/, '')
    .replace(/\.min\.json$/, '')
    .replace(/\.json$/, '');

  // Versuche zuerst .json.gz (kleinste Datei)
  const gzPath = basePath + '.json.gz';
  if (existsSync(gzPath)) {
    console.log(`Loading compressed file: ${gzPath}`);
    return loadGzipJSON(gzPath);
  }

  // Fallback zu .min.json
  const minPath = basePath + '.min.json';
  if (existsSync(minPath)) {
    console.log(`Loading minified file: ${minPath}`);
    return loadPlainJSON(minPath);
  }

  // Fallback zu .json
  const jsonPath = basePath + '.json';
  if (existsSync(jsonPath)) {
    console.log(`Loading normal file: ${jsonPath}`);
    return loadPlainJSON(jsonPath);
  }

  throw new Error(`File not found: ${basePath}[.json.gz|.min.json|.json]`);
}

/**
 * Lädt Creature-Daten aus verschiedenen Formaten
 * @param {string} filePath - Pfad zur Datei
 * @returns {Promise<Array>} - Array von Kreaturen (immer im Vollformat)
 */
export async function loadCreatures(filePath) {
  const data = await loadJSONWithFallback(filePath);

  // Format erkennen
  if (data.schema === 'encounterpp-compact-creatures') {
    // Kompaktes Format mit Wrapper
    console.log(`Expanding ${data.creatures.length} compact creatures...`);
    return expandCompactCreatures(data.creatures);
  } else if (Array.isArray(data)) {
    // Array von Kreaturen
    if (data.length > 0 && data[0].n) {
      // Kompaktes Format ohne Wrapper
      console.log(`Expanding ${data.length} compact creatures...`);
      return expandCompactCreatures(data);
    }
    // Vollständiges Format
    return data;
  } else if (data.creatures && Array.isArray(data.creatures)) {
    // Wrapper-Objekt (vollständiges Format)
    return data.creatures;
  } else if (data.monsters && Array.isArray(data.monsters)) {
    // Legacy SRD-Format
    return data.monsters;
  }

  throw new Error('Unknown creatures file format');
}

/**
 * Lädt Creatures und cached sie
 */
export class CreatureCache {
  constructor() {
    this.cache = null;
    this.loading = null;
  }

  /**
   * Lädt Creatures (nur einmal, dann gecacht)
   */
  async load(filePath) {
    if (this.cache) {
      return this.cache;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = loadCreatures(filePath);
    this.cache = await this.loading;
    this.loading = null;

    return this.cache;
  }

  /**
   * Löscht den Cache
   */
  clear() {
    this.cache = null;
    this.loading = null;
  }

  /**
   * Gibt die Anzahl gecachter Creatures zurück
   */
  count() {
    return this.cache ? this.cache.length : 0;
  }
}
