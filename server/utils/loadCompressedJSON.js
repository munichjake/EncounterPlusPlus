/**
 * Utility zum Laden von komprimierten JSON-Dateien
 * Unterstützt .json, .json.gz, und automatische Format-Erkennung
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

/**
 * Lädt eine JSON-Datei (optional gzip-komprimiert)
 * @param {string} filePath - Pfad zur Datei (.json oder .json.gz)
 * @returns {Promise<Object>} - Geparste JSON-Daten
 */
async function loadJSON(filePath) {
    const ext = path.extname(filePath);

    if (ext === '.gz' || filePath.endsWith('.json.gz')) {
        // Gzip-komprimierte Datei
        return loadGzipJSON(filePath);
    } else {
        // Normale JSON-Datei
        return loadPlainJSON(filePath);
    }
}

/**
 * Lädt eine normale JSON-Datei
 */
async function loadPlainJSON(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return reject(err);
            try {
                const json = JSON.parse(data);
                resolve(json);
            } catch (parseErr) {
                reject(parseErr);
            }
        });
    });
}

/**
 * Lädt eine gzip-komprimierte JSON-Datei
 */
async function loadGzipJSON(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) return reject(err);

            zlib.gunzip(data, (err, decompressed) => {
                if (err) return reject(err);

                try {
                    const json = JSON.parse(decompressed.toString('utf8'));
                    resolve(json);
                } catch (parseErr) {
                    reject(parseErr);
                }
            });
        });
    });
}

/**
 * Lädt eine JSON-Datei mit automatischer Fallback-Logik
 * Versucht zuerst .gz, dann .json
 * @param {string} baseFilePath - Basis-Pfad ohne oder mit Extension
 * @returns {Promise<Object>} - Geparste JSON-Daten
 */
async function loadJSONWithFallback(baseFilePath) {
    // Entferne mögliche Extensions
    let basePath = baseFilePath.replace(/\.(json|gz)$/, '').replace(/\.json$/, '');

    // Versuche zuerst .json.gz (kleinste Datei)
    const gzPath = basePath + '.json.gz';
    if (fs.existsSync(gzPath)) {
        console.log(`Loading compressed file: ${path.basename(gzPath)}`);
        return loadGzipJSON(gzPath);
    }

    // Fallback zu .min.json
    const minPath = basePath + '.min.json';
    if (fs.existsSync(minPath)) {
        console.log(`Loading minified file: ${path.basename(minPath)}`);
        return loadPlainJSON(minPath);
    }

    // Fallback zu .json
    const jsonPath = basePath + '.json';
    if (fs.existsSync(jsonPath)) {
        console.log(`Loading normal file: ${path.basename(jsonPath)}`);
        return loadPlainJSON(jsonPath);
    }

    throw new Error(`File not found: ${basePath}[.json.gz|.min.json|.json]`);
}

/**
 * Lädt Creature-Daten aus verschiedenen Formaten
 * Unterstützt: compact, full, gzipped
 * @param {string} filePath - Pfad zur Datei
 * @returns {Promise<Array>} - Array von Kreaturen (immer im Vollformat)
 */
async function loadCreatures(filePath) {
    const data = await loadJSONWithFallback(filePath);

    // Detect format
    if (data.schema === 'encounterpp-compact-creatures') {
        // Kompaktes Format -> Expandieren
        const { expandCompactCreatures } = require('./compactConverter');
        return expandCompactCreatures(data.creatures);
    } else if (Array.isArray(data)) {
        // Array von Kreaturen (kompakt oder voll)
        if (data.length > 0 && data[0].n) {
            // Kompakt
            const { expandCompactCreatures } = require('./compactConverter');
            return expandCompactCreatures(data);
        }
        return data;
    } else if (data.creatures && Array.isArray(data.creatures)) {
        // Wrapper-Objekt
        return data.creatures;
    }

    throw new Error('Unknown creatures file format');
}

module.exports = {
    loadJSON,
    loadPlainJSON,
    loadGzipJSON,
    loadJSONWithFallback,
    loadCreatures
};
