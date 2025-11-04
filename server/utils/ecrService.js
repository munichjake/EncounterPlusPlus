import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Persistent Python eCR prediction service
 * Spawns Python process once and keeps it alive for fast predictions
 */
class ECRService {
  constructor() {
    this.process = null;
    this.ready = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.cache = new Map(); // Cache predictions by monster name+cr
  }

  /**
   * Start the Python service process
   */
  async start() {
    if (this.process) return;

    const pythonScript = join(__dirname, '..', 'ecr_service.py');

    this.process = spawn('python', [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle stdout (responses)
    this.process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const response = JSON.parse(line);

          if (response.status === 'ready') {
            this.ready = true;
            console.log('✓ eCR service ready');
          } else if (response.requestId !== undefined) {
            const callback = this.pendingRequests.get(response.requestId);
            if (callback) {
              this.pendingRequests.delete(response.requestId);
              callback(null, response);
            }
          }
        } catch (e) {
          console.error('eCR service parse error:', e);
        }
      }
    });

    // Handle stderr
    this.process.stderr.on('data', (data) => {
      console.error('eCR service error:', data.toString());
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      console.warn(`eCR service exited with code ${code}`);
      this.ready = false;
      this.process = null;

      // Reject all pending requests
      for (const callback of this.pendingRequests.values()) {
        callback(new Error('Service crashed'));
      }
      this.pendingRequests.clear();

      // Auto-restart after 1 second
      setTimeout(() => this.start(), 1000);
    });

    // Wait for ready signal
    await new Promise((resolve) => {
      const checkReady = setInterval(() => {
        if (this.ready) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        if (!this.ready) {
          console.error('eCR service failed to start');
          resolve();
        }
      }, 10000);
    });
  }

  /**
   * Send a command to the Python service
   */
  _sendCommand(command, data) {
    return new Promise((resolve, reject) => {
      if (!this.ready) {
        return reject(new Error('eCR service not ready'));
      }

      const requestId = this.requestId++;
      const request = { command, data, requestId };

      this.pendingRequests.set(requestId, (error, response) => {
        if (error) return reject(error);
        if (response.status === 'error') return reject(new Error(response.error));
        resolve(response.result);
      });

      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Predict eCR for a monster
   */
  async predictECR(monsterData) {
    // Check cache
    const cacheKey = `${monsterData.name}:${monsterData.cr}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const result = await this._sendCommand('predict', monsterData);

      // Cache the result
      this.cache.set(cacheKey, result);

      // Limit cache size to 1000 entries
      if (this.cache.size > 1000) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return result;
    } catch (error) {
      console.error('eCR prediction failed:', error);
      throw error;
    }
  }

  /**
   * Get extracted features for a monster
   */
  async getFeatures(monsterData) {
    try {
      return await this._sendCommand('features', monsterData);
    } catch (error) {
      console.error('Feature extraction failed:', error);
      throw error;
    }
  }

  /**
   * Ping the service to check if alive
   */
  async ping() {
    try {
      await this._sendCommand('ping', {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop the service
   */
  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }
}

// Singleton instance
const ecrService = new ECRService();

export { ecrService };
