/**
 * Compression Middleware für Express
 * Komprimiert API-Responses automatisch mit gzip
 */

const compression = require('compression');

/**
 * Konfiguriert Compression Middleware
 * @returns {Function} Express Middleware
 */
function compressionMiddleware() {
    return compression({
        // Nur Responses >= 1KB komprimieren
        threshold: 1024,

        // Compression Level (0-9, Standard: 6)
        // 6 = guter Kompromiss zwischen Speed und Größe
        level: 6,

        // Filter: Was soll komprimiert werden?
        filter: (req, res) => {
            // Immer JSON komprimieren
            if (res.getHeader('Content-Type')?.includes('application/json')) {
                return true;
            }

            // Standardfilter verwenden
            return compression.filter(req, res);
        }
    });
}

module.exports = compressionMiddleware;
