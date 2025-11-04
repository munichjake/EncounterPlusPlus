import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { CreatureCache } from './utils/loadCreatures.js';
import { SpellCache } from './utils/loadSpells.js';
import { logger } from './utils/logger.js';
import { predictECR } from './utils/ecrCalculatorML.js';
import QRCode from 'qrcode';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = __filename.substring(0, __filename.lastIndexOf('/'));
const app = express();

// Trust proxy - wichtig für Reverse Proxy (Caddy)
app.set('trust proxy', true);

// Security: Helmet for HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for Three.js/dice
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://character-service.dndbeyond.com", "https://dddice.com", "wss://dddice.com"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173']; // Default for development

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Session-Token', 'Authorization']
}));

// Rate limiting - Different limits for different use cases

// Strict rate limiting for authentication/security endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 login attempts per window
  message: { error: 'Zu viele Login-Versuche. Bitte versuche es später erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Zu viele Login-Versuche. Bitte versuche es später erneut.' });
  }
});

// Relaxed rate limiting for data query endpoints (spells, monsters, etc.)
const dataLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // max 500 requests per IP per minute (very relaxed for data queries)
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn(`Data rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Zu viele Anfragen. Bitte versuche es später erneut.' });
  }
});

// Moderate rate limiting for general API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // max 500 requests per IP per window
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`API rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Zu viele Anfragen. Bitte versuche es später erneut.' });
  }
});

// Very relaxed rate limiting for player screen polling
const playerScreenLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // max 1000 requests per minute (allows polling every 3 seconds = 20/min per player)
  message: { error: 'Zu viele Anfragen vom Player Screen.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn(`Player screen rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Zu viele Anfragen vom Player Screen.' });
  }
});

app.use(express.json({ limit: '3mb' }));
app.use(cookieParser());

// Serve static files from data directory
app.use('/data', express.static(join(__dirname, '..', 'data'), {
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// Special routes with custom rate limiters (defined before general limiter)
// These will be handled separately and skip the general apiLimiter

// Apply general limiter to all OTHER API routes as baseline (after special routes are defined)
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for player screen encounter GET requests
  if (req.method === 'GET' && req.path.match(/^\/encounters\/[^\/]+$/)) {
    return next();
  }
  return apiLimiter(req, res, next);
});

const DATA_DIR = join(__dirname, '..', 'data');
const ENCOUNTERS_PATH = join(DATA_DIR, 'encounters', 'encounters.json');
const SRD_PATH = join(DATA_DIR, 'creatures', 'srd', 'srd-monsters.json');
const SESSIONS_PATH = join(DATA_DIR, 'sessions.json');
const CREATURES_PATH = join(DATA_DIR, 'imports', '5etools_all');
const PLAYER_CHARACTERS_PATH = join(DATA_DIR, 'player-characters.json');
const USER_SETTINGS_PATH = join(DATA_DIR, 'user-settings.json');
const USER_MONSTER_OVERRIDES_PATH = join(DATA_DIR, 'user-monster-overrides.json');
const CAMPAIGNS_PATH = join(DATA_DIR, 'campaigns.json');
const FOLDERS_PATH = join(DATA_DIR, 'folders.json');
const SHARE_CODES_PATH = join(DATA_DIR, 'share-codes.json');

// Creature Cache initialisieren
const creatureCache = new CreatureCache();

// Spell Cache initialisieren
const spellCache = new SpellCache();

function readJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    logger.error('Failed to read or parse JSON file', {
      path,
      error: err.message,
      stack: err.stack
    });
    return fallback;
  }
}
// File write queue to prevent race conditions
const writeQueue = new Map(); // path -> Promise

async function writeJSON(path, data) {
  // Wait for any pending write to this file to complete
  if (writeQueue.has(path)) {
    await writeQueue.get(path);
  }

  // Create promise for this write operation
  const writePromise = (async () => {
    try {
      await new Promise((resolve, reject) => {
        writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
        resolve();
      });
    } catch (err) {
      logger.error('Failed to write JSON file', {
        path,
        error: err.message,
        stack: err.stack
      });
      throw err;
    } finally {
      // Remove from queue when done
      writeQueue.delete(path);
    }
  })();

  // Add to queue
  writeQueue.set(path, writePromise);
  return writePromise;
}

// -------------------- USER-SPECIFIC MONSTER HELPERS --------------------
/**
 * Get all monster overrides for a specific user
 * @param {string} userEmail - The user's email
 * @returns {Object} Map of monster ID to monster data
 */
function getUserMonsterOverrides(userEmail) {
  const allOverrides = readJSON(USER_MONSTER_OVERRIDES_PATH, {});
  return allOverrides[userEmail] || {};
}

/**
 * Save a monster override for a specific user
 * @param {string} userEmail - The user's email
 * @param {Object} monster - The monster data to save
 */
async function saveUserMonsterOverride(userEmail, monster) {
  const allOverrides = readJSON(USER_MONSTER_OVERRIDES_PATH, {});
  if (!allOverrides[userEmail]) {
    allOverrides[userEmail] = {};
  }
  allOverrides[userEmail][monster.id] = monster;
  await writeJSON(USER_MONSTER_OVERRIDES_PATH, allOverrides);
}

/**
 * Delete a monster override for a specific user
 * @param {string} userEmail - The user's email
 * @param {string} monsterId - The monster ID to delete
 * @returns {boolean} True if deleted, false if not found
 */
async function deleteUserMonsterOverride(userEmail, monsterId) {
  const allOverrides = readJSON(USER_MONSTER_OVERRIDES_PATH, {});
  if (!allOverrides[userEmail] || !allOverrides[userEmail][monsterId]) {
    return false;
  }
  delete allOverrides[userEmail][monsterId];
  // Clean up empty user objects
  if (Object.keys(allOverrides[userEmail]).length === 0) {
    delete allOverrides[userEmail];
  }
  await writeJSON(USER_MONSTER_OVERRIDES_PATH, allOverrides);
  return true;
}

/**
 * Merge user overrides with base monsters
 * @param {Array} baseMonsters - Base monster array
 * @param {string} userEmail - The user's email (optional)
 * @returns {Array} Merged monster array with user overrides applied
 */
function applyUserMonsterOverrides(baseMonsters, userEmail) {
  if (!userEmail) return baseMonsters;

  const userOverrides = getUserMonsterOverrides(userEmail);
  if (Object.keys(userOverrides).length === 0) return baseMonsters;

  // Create a map of base monsters by ID for efficient lookup
  const monsterMap = new Map();
  baseMonsters.forEach(m => monsterMap.set(m.id, m));

  // Apply overrides and mark them as custom
  Object.entries(userOverrides).forEach(([id, override]) => {
    // Check if this is an override of an existing base monster
    const originalMonster = monsterMap.get(id);
    const isOverride = !!originalMonster;

    // Add custom label and preserve original information
    const customMonster = {
      ...override,
      isCustom: true,
      hasOriginal: isOverride,
      originalMonsterName: isOverride ? originalMonster.name : null,
      originalMonsterSource: isOverride ? originalMonster.source : null
    };

    monsterMap.set(id, customMonster);
  });

  return Array.from(monsterMap.values());
}

// -------------------- ENCRYPTION FOR SENSITIVE DATA --------------------
// Get encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32); // 256-bit key for AES-256

if (!process.env.ENCRYPTION_KEY) {
  logger.warn('⚠️  WARNING: No ENCRYPTION_KEY in .env file!');
  logger.warn('⚠️  Add this to your .env file:');
  logger.warn(`ENCRYPTION_KEY=${ENCRYPTION_KEY.toString('hex')}`);
}

function encryptToken(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16); // Initialization vector
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedText) {
  if (!encryptedText) return null;

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    logger.error('Decryption failed', { error: err.message });
    return null;
  }
}

// -------------------- AUTH / OTP SETUP --------------------
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const otpStore = new Map(); // email -> { otp, expiresAt, sessionToken? }

// Rate limiting for auth endpoints
const authAttempts = new Map(); // email/ip -> { count, resetAt }
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(identifier) {
  const now = Date.now();
  const attempt = authAttempts.get(identifier);

  if (!attempt || now > attempt.resetAt) {
    authAttempts.set(identifier, { count: 1, resetAt: now + AUTH_WINDOW });
    return true;
  }

  if (attempt.count >= MAX_AUTH_ATTEMPTS) {
    return false;
  }

  attempt.count++;
  return true;
}

// Load sessions from disk
// Note: We store hashed tokens in the file, but keep unhashed tokens in memory for fast lookup
function loadSessions() {
  const data = readJSON(SESSIONS_PATH, { sessions: {} });
  const sessions = new Map();
  const now = Date.now();
  const SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Only load sessions that are not expired
  for (const [hashedToken, session] of Object.entries(data.sessions)) {
    if (now - session.createdAt < SESSION_LIFETIME) {
      // We store by hashed token, but we need to be able to look up by unhashed token
      // So we'll verify tokens on each request by hashing and comparing
      sessions.set(hashedToken, session);
    }
  }
  return sessions;
}

async function saveSessions() {
  const sessionsObj = {};
  for (const [hashedToken, session] of sessions.entries()) {
    sessionsObj[hashedToken] = session;
  }
  await writeJSON(SESSIONS_PATH, { sessions: sessionsObj });
}

const sessions = loadSessions();

// Token to session map for fast lookup (avoids O(n) bcrypt comparison on every request)
// Maps plain token -> session data
const tokenCache = new Map();

// Helper function to hash tokens for storage
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Helper function to verify token
function verifyToken(token) {
  // Check cache first
  if (tokenCache.has(token)) {
    return tokenCache.get(token);
  }

  // Check if hashed token exists in sessions
  const hashedToken = hashToken(token);
  const session = sessions.get(hashedToken);

  if (session) {
    // Cache for future requests
    tokenCache.set(token, session);
    return session;
  }

  return null;
}

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Middleware zum Prüfen der Session
function requireAuth(req, res, next) {
  // Check for token in cookie (preferred) or fallback to header (for backwards compatibility)
  const token = req.cookies.sessionToken ||
                req.headers['x-session-token'] ||
                req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    logger.warn('Unauthorized request - no token', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }

  // Verify token against stored hashes
  const session = verifyToken(token);
  if (!session) {
    logger.warn('Unauthorized request - invalid token', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }

  // Check session age (30 days)
  const SESSION_LIFETIME = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  const sessionAge = Date.now() - session.createdAt;
  if (sessionAge > SESSION_LIFETIME) {
    logger.warn('Session expired', { email: session.email, age: sessionAge });
    // Remove expired session
    const hashedToken = hashToken(token);
    sessions.delete(hashedToken);
    tokenCache.delete(token);
    saveSessions(); // Don't await, fire and forget
    return res.status(401).json({ error: 'Session abgelaufen. Bitte erneut anmelden.' });
  }

  req.userEmail = session.email;
  next();
}

// Bootstrap
if (!existsSync(ENCOUNTERS_PATH)) writeJSON(ENCOUNTERS_PATH, { encounters: [] });
if (!existsSync(SRD_PATH)) writeJSON(SRD_PATH, { monsters: [] });

// -------------------- AUTH ENDPOINTS --------------------
app.post('/api/auth/request-otp', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-Mail-Adresse erforderlich' });

  const normalizedEmail = email.trim().toLowerCase();

  // Rate limiting
  const clientIp = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(`otp-${normalizedEmail}-${clientIp}`)) {
    logger.warn('OTP request rate limit exceeded', { email: normalizedEmail, ip: clientIp });
    return res.status(429).json({ error: 'Zu viele Anfragen. Bitte versuche es später erneut.' });
  }

  // Prüfen ob E-Mail erlaubt ist
  if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
    logger.warn('Unauthorized OTP request', { email: normalizedEmail, ip: clientIp });
    return res.status(403).json({ error: 'Diese E-Mail-Adresse ist nicht autorisiert' });
  }

  // OTP generieren
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 Minuten gültig

  otpStore.set(normalizedEmail, { otp, expiresAt });

  // OTP per E-Mail versenden
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: 'Dein Login-Code für Encounter Tracker',
      text: `Dein Login-Code lautet: ${otp}\n\nDieser Code ist 10 Minuten gültig.`,
      html: `
        <h2>Encounter Tracker Login</h2>
        <p>Dein Login-Code lautet:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; font-family: monospace;">${otp}</h1>
        <p>Dieser Code ist 10 Minuten gültig.</p>
      `,
    });

    logger.info('OTP sent', { email: normalizedEmail });
    res.json({ ok: true, message: 'OTP wurde an deine E-Mail gesendet' });
  } catch (error) {
    logger.error('Failed to send OTP email', { email: normalizedEmail, error: error.message });
    res.status(500).json({ error: 'E-Mail konnte nicht gesendet werden' });
  }
});

app.post('/api/auth/verify-otp', authLimiter, async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'E-Mail und OTP erforderlich' });

  const normalizedEmail = email.trim().toLowerCase();

  // Rate limiting
  const clientIp = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(`verify-${normalizedEmail}-${clientIp}`)) {
    return res.status(429).json({ error: 'Zu viele Anfragen. Bitte versuche es später erneut.' });
  }

  const stored = otpStore.get(normalizedEmail);

  if (!stored) {
    logger.warn('OTP verification failed - no OTP found', { email: normalizedEmail });
    return res.status(400).json({ error: 'Kein OTP angefordert oder bereits abgelaufen' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    logger.warn('OTP verification failed - expired', { email: normalizedEmail });
    return res.status(400).json({ error: 'OTP ist abgelaufen' });
  }

  if (stored.otp !== otp.trim()) {
    logger.warn('OTP verification failed - wrong code', { email: normalizedEmail });
    return res.status(400).json({ error: 'Falscher OTP-Code' });
  }

  // OTP korrekt - Session erstellen
  const sessionToken = nanoid(32);
  const hashedToken = hashToken(sessionToken);
  const sessionData = { email: normalizedEmail, createdAt: Date.now() };
  sessions.set(hashedToken, sessionData);
  tokenCache.set(sessionToken, sessionData); // Add to cache for fast lookup
  await saveSessions(); // Persist session to disk with hashed token
  otpStore.delete(normalizedEmail);

  logger.info('User logged in successfully', { email: normalizedEmail });

  // Set httpOnly cookie (secure in production)
  res.cookie('sessionToken', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  // Also return token in response for backwards compatibility / initial setup
  res.json({ ok: true, sessionToken, email: normalizedEmail });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const token = req.cookies.sessionToken ||
                req.headers['x-session-token'] ||
                req.headers['authorization']?.replace('Bearer ', '');

  if (token) {
    const hashedToken = hashToken(token);
    const session = sessions.get(hashedToken);

    if (session) {
      sessions.delete(hashedToken);
      tokenCache.delete(token); // Remove from cache
      await saveSessions(); // Persist change to disk
      logger.info('User logged out', { email: session.email });
    }
  }

  // Clear the cookie
  res.clearCookie('sessionToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });

  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ email: req.userEmail });
});

// -------------------- USER SETTINGS --------------------

app.get('/api/user/settings', requireAuth, (req, res) => {
  const settings = readJSON(USER_SETTINGS_PATH, {});
  const userSettings = settings[req.userEmail] || {};

  // Decrypt sensitive fields before sending to client
  const decrypted = { ...userSettings };
  if (decrypted.ddbCobaltToken) {
    decrypted.ddbCobaltToken = decryptToken(decrypted.ddbCobaltToken);
  }

  res.json(decrypted);
});

app.put('/api/user/settings', requireAuth, async (req, res) => {
  const settings = readJSON(USER_SETTINGS_PATH, {});
  const updates = { ...req.body };

  // Encrypt sensitive fields before storing
  if (updates.ddbCobaltToken) {
    updates.ddbCobaltToken = encryptToken(updates.ddbCobaltToken);
  }

  settings[req.userEmail] = {
    ...settings[req.userEmail],
    ...updates
  };
  await writeJSON(USER_SETTINGS_PATH, settings);
  res.json({ ok: true });
});

// -------------------- MONSTERS (CRUD + BULK + DDB IMPORT + 5E.TOOLS) --------------------

/**
 * GET /api/monsters
 * Liefert alle Monster aus der Datenbank (mit user-spezifischen Overrides)
 * Query-Params:
 *   - search: Suchbegriff (Name oder Type)
 *   - source: Filter nach Quelle (srd, homebrew, 5etools)
 * Note: Requires authentication to get user-specific overrides
 */
app.get('/api/monsters', dataLimiter, async (req, res) => {
  try {
    const q = (req.query.search || '').toString().toLowerCase();
    const sourceFilter = req.query.source;

    // Get user email from session if authenticated (optional for GET)
    let userEmail = null;
    const token = req.cookies.sessionToken ||
                  req.headers['x-session-token'] ||
                  req.headers['authorization']?.replace('Bearer ', '');
    if (token) {
      const session = verifyToken(token);
      if (session) {
        userEmail = session.email;
      }
    }

    // Lade 5e.tools Creatures (gecached)
    // For now, load from compact format but we'll need to fix the data
    const fiveToolsCreatures = await creatureCache.load(CREATURES_PATH);

    // Lade homebrew/SRD monsters (base data, not user-specific)
    const srdData = readJSON(SRD_PATH, { monsters: [] });
    const homebrewMonsters = srdData.monsters || [];

    // Kombiniere alle Monster
    let allMonsters = [...fiveToolsCreatures, ...homebrewMonsters];

    // Apply user-specific overrides if user is authenticated
    if (userEmail) {
      allMonsters = applyUserMonsterOverrides(allMonsters, userEmail);
    }

    // Source-Filter
    if (sourceFilter) {
      if (sourceFilter === '5etools') {
        allMonsters = allMonsters.filter(m =>
          m.source && m.source !== 'homebrew' && m.source !== 'srd' && m.source !== 'ddb-import'
        );
      } else if (sourceFilter === 'homebrew' || sourceFilter === 'srd') {
        allMonsters = allMonsters.filter(m =>
          (m.source || '').toLowerCase().includes(sourceFilter.toLowerCase())
        );
      }
    }

    // Such-Filter
    const filtered = q
      ? allMonsters.filter(m => {
          const name = (m.name || '').toLowerCase();
          const type = typeof m.type === 'object' ? (m.type.type || '') : (m.type || '');
          const typeStr = String(type).toLowerCase();
          return name.includes(q) || typeStr.includes(q);
        })
      : allMonsters;

    // Limitiere auf 500 Ergebnisse nur wenn gefiltert (bei leerem search gib alle zurück für client-seitiges Filtern)
    // Note: legendaryGroup, tokenUrl, imageUrl are now included in the compact format
    const limit = q ? 500 : filtered.length;
    res.json(filtered.slice(0, limit));
  } catch (error) {
    logger.error('Error loading monsters', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to load monsters' });
  }
});

app.post('/api/monsters', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: 'name is required' });

  const id = (body.id && String(body.id)) || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const mon = { id, source: body.source || 'homebrew', createdBy: req.userEmail, ...body };

  // Save as user-specific override instead of global
  saveUserMonsterOverride(req.userEmail, mon);

  logger.info('User monster override saved', {
    userEmail: req.userEmail,
    monsterId: mon.id,
    monsterName: mon.name
  });

  res.status(201).json(mon);
});

app.post('/api/monsters/bulk', requireAuth, (req, res) => {
  const arr = Array.isArray(req.body) ? req.body : req.body?.monsters;
  if (!Array.isArray(arr)) return res.status(400).json({ error: 'Expected an array of monsters or { monsters: [...] }' });

  let created = 0;
  arr.forEach(raw => {
    if (!raw || !raw.name) return;
    const id = (raw.id && String(raw.id)) || raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const mon = { id, source: raw.source || 'homebrew', createdBy: req.userEmail, ...raw };

    // Save as user-specific override
    saveUserMonsterOverride(req.userEmail, mon);
    created++;
  });

  logger.info('Bulk monster overrides saved', {
    userEmail: req.userEmail,
    count: created
  });

  // Get user's total monster count
  const userOverrides = getUserMonsterOverrides(req.userEmail);
  res.json({ ok: true, created, total: Object.keys(userOverrides).length });
});

app.delete('/api/monsters/:id', requireAuth, (req, res) => {
  // Only delete user's override, not the base monster
  const deleted = deleteUserMonsterOverride(req.userEmail, req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Monster override not found for this user' });
  }

  logger.info('User monster override deleted', {
    userEmail: req.userEmail,
    monsterId: req.params.id
  });

  res.status(204).end();
});

/**
 * GET /api/monsters/:id/original
 * Retrieves the original (base) version of a monster without user overrides
 * Useful when user wants to see the original stats before their modifications
 */
app.get('/api/monsters/:id/original', requireAuth, async (req, res) => {
  try {
    const monsterId = req.params.id;

    // Load base monsters
    const fiveToolsCreatures = await creatureCache.load(CREATURES_PATH);
    const srdData = readJSON(SRD_PATH, { monsters: [] });
    const homebrewMonsters = srdData.monsters || [];

    // Combine and search for the original monster
    const allBaseMonsters = [...fiveToolsCreatures, ...homebrewMonsters];
    const originalMonster = allBaseMonsters.find(m => m.id === monsterId);

    if (!originalMonster) {
      return res.status(404).json({ error: 'Original monster not found' });
    }

    logger.info('Original monster retrieved', {
      userEmail: req.userEmail,
      monsterId: monsterId
    });

    res.json(originalMonster);
  } catch (error) {
    logger.error('Error loading original monster', {
      error: error.message,
      stack: error.stack,
      monsterId: req.params.id
    });
    res.status(500).json({ error: 'Failed to load original monster' });
  }
});

/**
 * POST /api/monsters/:id/reset
 * Resets a monster to its original version by removing the user's override
 * This allows users to revert their custom changes back to the base monster
 */
app.post('/api/monsters/:id/reset', requireAuth, (req, res) => {
  const monsterId = req.params.id;

  // Delete the user's override
  const deleted = deleteUserMonsterOverride(req.userEmail, monsterId);

  if (!deleted) {
    return res.status(404).json({ error: 'No custom override found for this monster' });
  }

  logger.info('User reset monster to original', {
    userEmail: req.userEmail,
    monsterId: monsterId
  });

  res.json({ ok: true, message: 'Monster reset to original version' });
});

// Minimal D&D Beyond statblock text parser
function parseDDBText(text){
  const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const name = lines[0] || 'Creature';
  const typeLine = lines.find(l=>/(beast|humanoid|undead|fiend|dragon|construct|aberration|giant|monstrosity|plant|ooze|fey|celestial)/i) || '';
  const ac = parseInt((text.match(/Armor Class\s*(\d+)/i)||[])[1]||'',10) || undefined;
  const hp = parseInt((text.match(/Hit Points\s*(\d+)/i)||[])[1]||'',10) || undefined;
  const speed = (text.match(/Speed\s*([^\n]+)/i)||[])[1];
  const crMatch = text.match(/Challenge\s*([0-9\/\.]+)\s*\(/i) || text.match(/Challenge\s*([0-9\/\.]+)/i);

  // Safe CR parsing without eval()
  let cr = undefined;
  if (crMatch) {
    const crStr = crMatch[1];
    if (crStr.includes('/')) {
      const parts = crStr.split('/');
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        cr = numerator / denominator;
      }
    } else {
      cr = parseFloat(crStr);
    }
  }

  return [{ id: name.toLowerCase().replace(/[^a-z0-9]+/g,'-'), name, type: typeLine.toLowerCase(), ac, hp, speed, cr, source:'ddb-import' }];
}

app.post('/api/monsters/import/ddb', requireAuth, (req, res) => {
  const { text, monsters } = req.body || {};
  let arr = [];
  if (Array.isArray(monsters)) { arr = monsters; }
  else if (typeof text === 'string' && text.trim()) { arr = parseDDBText(text); }
  else return res.status(400).json({ error: 'Provide { text } or { monsters: [...] }' });

  let created = 0;
  arr.forEach(raw => {
    if (!raw || !raw.name) return;
    const id = (raw.id && String(raw.id)) || raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const mon = { id, source: raw.source || 'ddb-import', createdBy: req.userEmail, ...raw };

    // Save as user-specific override
    saveUserMonsterOverride(req.userEmail, mon);
    created++;
  });

  logger.info('D&D Beyond monsters imported as user overrides', {
    userEmail: req.userEmail,
    count: created
  });

  // Get user's total monster count
  const userOverrides = getUserMonsterOverrides(req.userEmail);
  res.json({ ok: true, created, total: Object.keys(userOverrides).length });
});

// -------------------- eCR PREDICTION --------------------
app.post('/api/ecr/predict', dataLimiter, async (req, res) => {
  try {
    const monsterData = req.body;

    if (!monsterData || !monsterData.name) {
      return res.status(400).json({ error: 'Monster data with name required' });
    }

    const result = await predictECR(monsterData);
    res.json(result);
  } catch (error) {
    logger.error('eCR prediction error:', error);
    res.status(500).json({ error: 'Prediction failed', details: error.message });
  }
});

// Calculate eCR for a monster (flexible endpoint for UI tooltips)
app.post('/api/ecr/calculate', dataLimiter, async (req, res) => {
  try {
    const { monster, monsterId } = req.body;

    let monsterData = monster;

    // If monsterId is provided, fetch the monster from database
    if (monsterId && !monsterData) {
      const userOverrides = getUserMonsterOverrides(req.userEmail);
      monsterData = userOverrides[monsterId];

      if (!monsterData) {
        return res.status(404).json({ error: 'Monster not found' });
      }
    }

    if (!monsterData) {
      return res.status(400).json({ error: 'Monster data or monsterId required' });
    }

    const result = await predictECR(monsterData);
    res.json(result);
  } catch (error) {
    logger.error('eCR calculation error:', error);
    res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
});

// -------------------- SPELLS --------------------
app.get('/api/spells', dataLimiter, async (req, res) => {
  try {
    const q = (req.query.search || '').toString().toLowerCase();
    const levelFilter = req.query.level;
    const schoolFilter = req.query.school;
    const classFilter = req.query.class;

    // Load all spells from 5e.tools (cached)
    const allSpells = await spellCache.load(DATA_DIR);

    let filtered = allSpells;

    // Search filter (name)
    if (q) {
      filtered = filtered.filter(spell => {
        const name = (spell.name || '').toLowerCase();
        return name.includes(q);
      });
    }

    // Level filter
    if (levelFilter !== undefined && levelFilter !== '') {
      const level = parseInt(levelFilter);
      filtered = filtered.filter(spell => spell.level === level);
    }

    // School filter (C=conjuration, A=abjuration, etc.)
    if (schoolFilter) {
      filtered = filtered.filter(spell => spell.school === schoolFilter);
    }

    // Class filter
    if (classFilter) {
      filtered = filtered.filter(spell => {
        if (!spell.classes || !spell.classes.fromClassList) return false;
        return spell.classes.fromClassList.some(c =>
          c.name.toLowerCase() === classFilter.toLowerCase()
        );
      });
    }

    // Limit to 500 results for performance
    res.json(filtered.slice(0, 500));
  } catch (error) {
    logger.error('Error loading spells', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to load spells' });
  }
});

// Get single spell by name
app.get('/api/spells/:name', dataLimiter, async (req, res) => {
  try {
    const spellName = decodeURIComponent(req.params.name);
    const allSpells = await spellCache.load(DATA_DIR);

    const spell = allSpells.find(s =>
      s.name.toLowerCase() === spellName.toLowerCase()
    );

    if (!spell) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    res.json(spell);
  } catch (error) {
    logger.error('Error loading spell', { spell: req.params.name, error: error.message });
    res.status(500).json({ error: 'Failed to load spell' });
  }
});

// -------------------- CONDITIONS --------------------
app.get('/api/conditions', dataLimiter, async (req, res) => {
  try {
    const conditionsFile = join(DATA_DIR, 'sources', '5e.tools', 'conditionsdiseases.json');
    const data = await readJSON(conditionsFile);
    res.json(data);
  } catch (error) {
    logger.error('Error loading conditions', { error: error.message });
    res.status(500).json({ error: 'Failed to load conditions' });
  }
});

// -------------------- LEGENDARY GROUPS (LAIR ACTIONS) --------------------
app.get('/api/legendary-groups/:name', dataLimiter, async (req, res) => {
  try {
    const groupName = decodeURIComponent(req.params.name);
    const groupFile = join(DATA_DIR, 'sources', '5e.tools', 'bestiary', 'bestiary', 'legendarygroups.json');

    if (!existsSync(groupFile)) {
      return res.status(404).json({ error: 'Legendary groups file not found' });
    }

    const data = readJSON(groupFile, { legendaryGroup: [] });
    const group = data.legendaryGroup.find(g =>
      g.name.toLowerCase() === groupName.toLowerCase()
    );

    if (!group) {
      return res.status(404).json({ error: 'Legendary group not found' });
    }

    res.json(group);
  } catch (error) {
    logger.error('Error loading legendary group', { group: req.params.name, error: error.message });
    res.status(500).json({ error: 'Failed to load legendary group' });
  }
});

// -------------------- PLAYER CHARACTERS --------------------
app.get('/api/characters', (req, res) => {
  const db = readJSON(PLAYER_CHARACTERS_PATH, []);
  const q = (req.query.search || '').toString().toLowerCase();
  const filtered = q
    ? db.filter(pc => {
        const name = (pc.name || '').toLowerCase();
        const className = (pc.class || '').toLowerCase();
        return name.includes(q) || className.includes(q);
      })
    : db;
  res.json(filtered);
});

app.post('/api/characters', requireAuth, async (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: 'name is required' });
  const db = readJSON(PLAYER_CHARACTERS_PATH, []);
  const id = (body.id && String(body.id)) || nanoid();
  const pc = {
    id,
    createdBy: req.userEmail,
    createdAt: Date.now(),
    ...body
  };
  const i = db.findIndex(c => c.id === pc.id);
  if (i === -1) db.push(pc); else db[i] = pc;
  await writeJSON(PLAYER_CHARACTERS_PATH, db);
  res.status(201).json(pc);
});

app.delete('/api/characters/:id', requireAuth, async (req, res) => {
  const db = readJSON(PLAYER_CHARACTERS_PATH, []);
  const before = db.length;
  const next = db.filter(c => c.id !== req.params.id);
  if (next.length === before) return res.status(404).json({ error: 'Not found' });
  await writeJSON(PLAYER_CHARACTERS_PATH, next);
  res.status(204).end();
});

// D&D Beyond character import
app.post('/api/characters/import/ddb', requireAuth, async (req, res) => {
  let { characterId, cobaltToken } = req.body || {};

  if (!characterId) {
    return res.status(400).json({ error: 'characterId or URL is required' });
  }

  // Extract character ID from URL if full URL is provided
  // Supports: https://www.dndbeyond.com/characters/12345
  //           https://www.dndbeyond.com/characters/12345/abc
  //           dndbeyond.com/characters/12345
  //           12345
  const urlMatch = characterId.match(/characters\/(\d+)/);
  if (urlMatch) {
    characterId = urlMatch[1];
  }

  // Load user settings to get saved Cobalt token if not provided
  if (!cobaltToken) {
    const settings = readJSON(USER_SETTINGS_PATH, {});
    const userSettings = settings[req.userEmail] || {};
    const encryptedToken = userSettings.ddbCobaltToken;
    // Decrypt the stored token
    cobaltToken = decryptToken(encryptedToken);
  } else {
    // Save the provided token for future use (encrypted)
    const settings = readJSON(USER_SETTINGS_PATH, {});
    settings[req.userEmail] = {
      ...settings[req.userEmail],
      ddbCobaltToken: encryptToken(cobaltToken)
    };
    await writeJSON(USER_SETTINGS_PATH, settings);
  }

  try {
    // D&D Beyond character endpoint
    const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;

    const headers = {
      'User-Agent': 'Encounter++ Character Importer',
    };

    // Add Cobalt session token if available (for private characters)
    if (cobaltToken) {
      headers['Cookie'] = `CobaltSession=${cobaltToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return res.status(403).json({
          error: 'Character not accessible. For private characters, provide a valid Cobalt Session token.'
        });
      }
      return res.status(response.status).json({
        error: `D&D Beyond API error: ${response.statusText}`
      });
    }

    const ddbData = await response.json();

    // Transform D&D Beyond character to our format
    const character = transformDDBCharacter(ddbData);

    // Save character
    const db = readJSON(PLAYER_CHARACTERS_PATH, []);
    const existing = db.findIndex(c => c.ddbId === character.ddbId);

    if (existing !== -1) {
      db[existing] = { ...db[existing], ...character, updatedAt: Date.now() };
    } else {
      character.createdBy = req.userEmail;
      character.createdAt = Date.now();
      db.push(character);
    }

    await writeJSON(PLAYER_CHARACTERS_PATH, db);

    logger.info('D&D Beyond character imported', { characterId, user: req.userEmail });
    res.json({
      ok: true,
      character,
      message: existing !== -1 ? 'Character updated' : 'Character imported'
    });

  } catch (error) {
    logger.error('D&D Beyond import error', { characterId, user: req.userEmail, error: error.message });
    res.status(500).json({ error: 'Failed to import character from D&D Beyond' });
  }
});

// Transform D&D Beyond character data to our format
function transformDDBCharacter(ddbData) {
  const data = ddbData.data || ddbData;

  // Extract ability scores
  const stats = {};
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((ability, idx) => {
    const stat = data.stats?.[idx] || data.overrideStats?.[idx];
    stats[ability] = stat?.value || 10;
  });

  // Calculate AC
  const baseAc = data.armorClass || 10;

  // Extract HP
  const maxHp = data.overrideHitPoints || data.baseHitPoints || 0;
  const currentHp = data.removedHitPoints !== undefined
    ? maxHp - data.removedHitPoints
    : maxHp;

  // Extract class info
  const classes = data.classes || [];
  const mainClass = classes[0];
  const className = classes.map(c => `${c.definition?.name || 'Unknown'} ${c.level}`).join(' / ');
  const totalLevel = classes.reduce((sum, c) => sum + (c.level || 0), 0);

  // Extract race
  const race = data.race?.fullName || data.race?.baseName || 'Unknown';

  // Calculate initiative
  const dexMod = Math.floor((stats.dex - 10) / 2);
  const initiativeMod = dexMod + (data.bonusStats?.find(b => b.name === 'initiative')?.value || 0);

  // Speed
  const speed = data.race?.weightSpeeds?.normal?.walk || 30;

  // Extract spells
  const spells = [];
  if (data.spells) {
    // Class spells
    if (data.spells.class) {
      data.spells.class.forEach(spell => {
        if (spell && spell.definition) {
          spells.push({
            name: spell.definition.name,
            level: spell.definition.level,
            school: spell.definition.school,
            castingTime: spell.definition.activation?.activationTime
              ? `${spell.definition.activation.activationTime} ${spell.definition.activation.activationType}`
              : 'Unknown',
            range: spell.definition.range?.origin || 'Self',
            duration: spell.definition.duration?.durationType || 'Instantaneous',
            description: spell.definition.description || '',
            components: {
              verbal: spell.definition.componentsDescription?.includes('V') || false,
              somatic: spell.definition.componentsDescription?.includes('S') || false,
              material: spell.definition.componentsDescription?.includes('M') || false,
              materialComponents: spell.definition.componentsDescription || ''
            },
            concentration: spell.definition.concentration || false,
            ritual: spell.definition.ritual || false,
            prepared: spell.prepared || false
          });
        }
      });
    }

    // Race spells
    if (data.spells.race) {
      data.spells.race.forEach(spell => {
        if (spell && spell.definition) {
          spells.push({
            name: spell.definition.name,
            level: spell.definition.level,
            school: spell.definition.school,
            castingTime: spell.definition.activation?.activationTime
              ? `${spell.definition.activation.activationTime} ${spell.definition.activation.activationType}`
              : 'Unknown',
            range: spell.definition.range?.origin || 'Self',
            duration: spell.definition.duration?.durationType || 'Instantaneous',
            description: spell.definition.description || '',
            components: {
              verbal: spell.definition.componentsDescription?.includes('V') || false,
              somatic: spell.definition.componentsDescription?.includes('S') || false,
              material: spell.definition.componentsDescription?.includes('M') || false,
              materialComponents: spell.definition.componentsDescription || ''
            },
            concentration: spell.definition.concentration || false,
            ritual: spell.definition.ritual || false,
            prepared: true, // Race spells are always available
            source: 'racial'
          });
        }
      });
    }
  }

  // Extract spell slots
  const spellSlots = {};
  if (data.spellSlots) {
    data.spellSlots.forEach(slot => {
      if (slot && slot.level) {
        spellSlots[`level${slot.level}`] = {
          max: slot.available || 0,
          used: slot.used || 0
        };
      }
    });
  }

  // Extract pact magic slots (Warlock)
  if (data.pactMagic) {
    data.pactMagic.forEach(pact => {
      if (pact && pact.level) {
        spellSlots.pact = {
          level: pact.level,
          max: pact.available || 0,
          used: pact.used || 0
        };
      }
    });
  }

  // Extract campaign info
  let campaignName = null;
  if (data.campaign) {
    campaignName = data.campaign.name || null;
  }

  // Extract features and actions
  const features = [];
  const actions = [];

  // Class features
  if (data.classFeatures) {
    data.classFeatures.forEach(feature => {
      if (feature && feature.definition) {
        features.push({
          name: feature.definition.name,
          description: feature.definition.description || '',
          source: 'class'
        });
      }
    });
  }

  // Race features
  if (data.race?.racialTraits) {
    data.race.racialTraits.forEach(trait => {
      if (trait && trait.definition) {
        features.push({
          name: trait.definition.name,
          description: trait.definition.description || '',
          source: 'racial'
        });
      }
    });
  }

  // Feats
  if (data.feats) {
    data.feats.forEach(feat => {
      if (feat && feat.definition) {
        features.push({
          name: feat.definition.name,
          description: feat.definition.description || '',
          source: 'feat'
        });
      }
    });
  }

  // Actions
  if (data.actions) {
    // Custom actions
    if (data.actions.class) {
      data.actions.class.forEach(action => {
        if (action && action.name) {
          actions.push({
            name: action.name,
            description: action.snippet || action.description || '',
            actionType: action.activation?.activationType || 'action'
          });
        }
      });
    }

    // Race actions
    if (data.actions.race) {
      data.actions.race.forEach(action => {
        if (action && action.name) {
          actions.push({
            name: action.name,
            description: action.snippet || action.description || '',
            actionType: action.activation?.activationType || 'action',
            source: 'racial'
          });
        }
      });
    }
  }

  // Build tags
  const tags = ['ddb-import'];
  if (campaignName) {
    tags.push(campaignName);
  }

  return {
    id: nanoid(),
    ddbId: data.id,
    name: data.name || 'Unnamed Character',
    class: className,
    level: totalLevel,
    race,
    ac: baseAc,
    hp: maxHp,
    currentHp,
    tempHp: data.temporaryHitPoints || 0,
    initiativeMod,
    speed: `${speed} ft.`,
    stats,
    proficiencyBonus: data.proficiencyBonus || Math.floor((totalLevel - 1) / 4) + 2,
    source: 'ddb-import',
    avatarUrl: data.decorations?.avatarUrl || data.avatarUrl,
    tags,
    spells: spells.length > 0 ? spells : undefined,
    spellSlots: Object.keys(spellSlots).length > 0 ? spellSlots : undefined,
    features: features.length > 0 ? features : undefined,
    actions: actions.length > 0 ? actions : undefined,
    campaignName,
    notes: ''
  };
}

// -------------------- CAMPAIGNS --------------------
app.get('/api/campaigns', requireAuth, (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_PATH, []);
  const userCampaigns = campaigns.filter(c => c.createdBy === req.userEmail);
  res.json(userCampaigns);
});

app.post('/api/campaigns', requireAuth, async (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_PATH, []);
  const now = new Date().toISOString();
  const campaign = {
    id: nanoid(),
    name: req.body.name || 'Neue Kampagne',
    description: req.body.description || '',
    encounters: [],
    playerCharacters: [],
    monsters: [],
    createdBy: req.userEmail,
    createdAt: now,
    updatedAt: now,
  };
  campaigns.push(campaign);
  await writeJSON(CAMPAIGNS_PATH, campaigns);
  res.status(201).json(campaign);
});

app.get('/api/campaigns/:id', requireAuth, (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_PATH, []);
  const campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
  if (campaign.createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(campaign);
});

app.put('/api/campaigns/:id', requireAuth, async (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_PATH, []);
  const i = campaigns.findIndex(c => c.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
  if (campaigns[i].createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const updated = {
    ...campaigns[i],
    ...req.body,
    id: req.params.id,
    createdBy: campaigns[i].createdBy,
    createdAt: campaigns[i].createdAt,
    updatedAt: new Date().toISOString()
  };
  campaigns[i] = updated;
  await writeJSON(CAMPAIGNS_PATH, campaigns);
  res.json(updated);
});

app.delete('/api/campaigns/:id', requireAuth, async (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_PATH, []);
  const campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
  if (campaign.createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const next = campaigns.filter(c => c.id !== req.params.id);
  await writeJSON(CAMPAIGNS_PATH, next);
  res.status(204).end();
});

// Get all player characters for a specific campaign
app.get('/api/campaigns/:id/characters', requireAuth, (req, res) => {
  const campaigns = readJSON(CAMPAIGNS_PATH, []);
  const campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
  if (campaign.createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const allCharacters = readJSON(PLAYER_CHARACTERS_PATH, []);
  const userCharacters = allCharacters.filter(c => c.createdBy === req.userEmail);
  const campaignCharacterIds = campaign.playerCharacters || [];
  const campaignCharacters = userCharacters.filter(c => campaignCharacterIds.includes(c.id));

  res.json(campaignCharacters);
});

// -------------------- FOLDERS --------------------
// Folders are user-specific hierarchical structures for organizing encounters
// Format: { id, name, path, parentId, createdBy, createdAt, updatedAt }

app.get('/api/folders', requireAuth, (req, res) => {
  const db = readJSON(FOLDERS_PATH, { folders: [] });
  const userFolders = db.folders.filter(f => f.createdBy === req.userEmail);
  res.json(userFolders);
});

app.post('/api/folders', requireAuth, async (req, res) => {
  const db = readJSON(FOLDERS_PATH, { folders: [] });
  const now = new Date().toISOString();

  const parentId = req.body.parentId || null;
  let path = req.body.name || 'Neuer Ordner';

  // Calculate path based on parent
  if (parentId) {
    const parent = db.folders.find(f => f.id === parentId && f.createdBy === req.userEmail);
    if (!parent) {
      return res.status(400).json({ error: 'Parent folder not found or access denied' });
    }
    path = `${parent.path}/${req.body.name || 'Neuer Ordner'}`;
  }

  const folder = {
    id: nanoid(),
    name: req.body.name || 'Neuer Ordner',
    path,
    parentId,
    createdBy: req.userEmail,
    createdAt: now,
    updatedAt: now,
  };

  db.folders.push(folder);
  await writeJSON(FOLDERS_PATH, db);
  logger.info('Folder created', { folderId: folder.id, path: folder.path, user: req.userEmail });
  res.status(201).json(folder);
});

app.put('/api/folders/:id', requireAuth, async (req, res) => {
  const db = readJSON(FOLDERS_PATH, { folders: [] });
  const i = db.folders.findIndex(f => f.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Ordner nicht gefunden' });

  // Check ownership
  if (db.folders[i].createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const oldPath = db.folders[i].path;
  const newName = req.body.name || db.folders[i].name;
  const parentId = req.body.parentId !== undefined ? req.body.parentId : db.folders[i].parentId;

  // Calculate new path
  let newPath = newName;
  if (parentId) {
    const parent = db.folders.find(f => f.id === parentId && f.createdBy === req.userEmail);
    if (parent) {
      newPath = `${parent.path}/${newName}`;
    }
  }

  // Update folder
  db.folders[i] = {
    ...db.folders[i],
    name: newName,
    path: newPath,
    parentId,
    updatedAt: new Date().toISOString()
  };

  // Update all child folders' paths
  if (oldPath !== newPath) {
    db.folders.forEach((folder, idx) => {
      if (folder.path.startsWith(oldPath + '/') && folder.createdBy === req.userEmail) {
        db.folders[idx].path = folder.path.replace(oldPath, newPath);
        db.folders[idx].updatedAt = new Date().toISOString();
      }
    });

    // Update all encounters in this folder and subfolders
    const encDb = readJSON(ENCOUNTERS_PATH, { encounters: [] });
    let encountersUpdated = false;
    encDb.encounters.forEach((enc, idx) => {
      if (enc.createdBy === req.userEmail && enc.folder) {
        if (enc.folder === oldPath || enc.folder.startsWith(oldPath + '/')) {
          encDb.encounters[idx].folder = enc.folder.replace(oldPath, newPath);
          encountersUpdated = true;
        }
      }
    });
    if (encountersUpdated) {
      await writeJSON(ENCOUNTERS_PATH, encDb);
    }
  }

  await writeJSON(FOLDERS_PATH, db);
  logger.info('Folder updated', { folderId: req.params.id, oldPath, newPath, user: req.userEmail });
  res.json(db.folders[i]);
});

app.delete('/api/folders/:id', requireAuth, async (req, res) => {
  const db = readJSON(FOLDERS_PATH, { folders: [] });
  const folder = db.folders.find(f => f.id === req.params.id);
  if (!folder) return res.status(404).json({ error: 'Ordner nicht gefunden' });

  // Check ownership
  if (folder.createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const folderPath = folder.path;

  // Check if folder has children
  const hasChildren = db.folders.some(f => f.parentId === req.params.id && f.createdBy === req.userEmail);

  // Check if folder has encounters
  const encDb = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const hasEncounters = encDb.encounters.some(e =>
    e.createdBy === req.userEmail && e.folder &&
    (e.folder === folderPath || e.folder.startsWith(folderPath + '/'))
  );

  if (hasChildren || hasEncounters) {
    return res.status(400).json({
      error: 'Ordner kann nicht gelöscht werden. Bitte zuerst alle Unterordner und Encounters entfernen.'
    });
  }

  // Delete folder
  db.folders = db.folders.filter(f => f.id !== req.params.id);
  await writeJSON(FOLDERS_PATH, db);
  logger.info('Folder deleted', { folderId: req.params.id, path: folderPath, user: req.userEmail });
  res.status(204).end();
});

// -------------------- ENCOUNTERS --------------------
app.get('/api/encounters', requireAuth, (req, res) => {
  const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const userEncounters = db.encounters.filter(e => e.createdBy === req.userEmail);
  res.json(userEncounters.map(e => ({
    id: e.id,
    name: e.name,
    updatedAt: e.updatedAt,
    campaignId: e.campaignId,
    folder: e.folder,
    tags: e.tags || []
  })));
});

app.post('/api/encounters', requireAuth, async (req, res) => {
  const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const now = new Date().toISOString();
  const enc = {
    id: nanoid(),
    name: req.body.name || 'Neues Encounter',
    round: 1,
    turnIndex: 0,
    initiativeOrder: [],
    combatants: {},
    campaignId: req.body.campaignId || null,
    folder: req.body.folder || null,
    tags: req.body.tags || [],
    createdBy: req.userEmail,
    createdAt: now,
    updatedAt: now,
  };
  db.encounters.push(enc);
  await writeJSON(ENCOUNTERS_PATH, db);
  res.status(201).json(enc);
});

// In-memory storage for player screen tokens (secure, time-limited)
const playerScreenTokens = new Map();

// Generate player screen token
app.post('/api/player-screen/token', requireAuth, (req, res) => {
  // Generate a secure random token
  const token = crypto.randomBytes(32).toString('hex');

  // Store token with user email and expiration (24 hours)
  playerScreenTokens.set(token, {
    userEmail: req.userEmail,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });

  // Clean up expired tokens
  for (const [key, value] of playerScreenTokens.entries()) {
    if (value.expiresAt < Date.now()) {
      playerScreenTokens.delete(key);
    }
  }

  res.json({ token });
});

// GET current active encounter for user (for follow mode) - secured with token
app.get('/api/encounters/current/active', playerScreenLimiter, (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).json({ error: 'token parameter required' });
  }

  // Validate token
  const tokenData = playerScreenTokens.get(token);
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check if token is expired
  if (tokenData.expiresAt < Date.now()) {
    playerScreenTokens.delete(token);
    return res.status(401).json({ error: 'Token expired' });
  }

  const userEmail = tokenData.userEmail;
  const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const userEncounters = db.encounters.filter(e => e.createdBy === userEmail);

  // Find the most recently updated encounter
  const currentEncounter = userEncounters.reduce((latest, current) => {
    if (!latest) return current;
    const latestTime = new Date(latest.updatedAt || latest.createdAt).getTime();
    const currentTime = new Date(current.updatedAt || current.createdAt).getTime();
    return currentTime > latestTime ? current : latest;
  }, null);

  if (!currentEncounter) {
    return res.status(404).json({ error: 'No encounters found' });
  }

  res.json(currentEncounter);
});

// GET encounter - uses player screen limiter for player screen access
app.get('/api/encounters/:id', playerScreenLimiter, (req, res) => {
  const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const enc = db.encounters.find(e => e.id === req.params.id);
  if (!enc) return res.status(404).json({ error: 'Not found' });
  // Check ownership if user is authenticated
  if (req.userEmail && enc.createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(enc);
});

app.put('/api/encounters/:id', requireAuth, async (req, res) => {
  const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const i = db.encounters.findIndex(e => e.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  // Check ownership
  if (db.encounters[i].createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const updated = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
  db.encounters[i] = updated;
  await writeJSON(ENCOUNTERS_PATH, db);
  res.json(updated);
});

app.delete('/api/encounters/:id', requireAuth, async (req, res) => {
  const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const enc = db.encounters.find(e => e.id === req.params.id);
  if (!enc) return res.status(404).json({ error: 'Not found' });
  // Check ownership
  if (enc.createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const next = db.encounters.filter(e => e.id !== req.params.id);
  await writeJSON(ENCOUNTERS_PATH, { encounters: next });
  res.status(204).end();
});

// -------------------- SHARE CODES FOR MOBILE APP --------------------
// Share codes allow players to connect to encounters via mobile app
// Format: 4-digit alphanumeric code (e.g. AB12)

/**
 * Helper to generate a random 4-character share code
 */
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0,O,1,I)
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/encounters/:id/share-code
 * Generate a share code for user's encounters (DM only)
 * Share code is tied to the user, not a specific encounter
 * This allows switching encounters without reconnecting
 * Returns: { shareCode, qrCode (data URL), expiresAt }
 */
app.post('/api/encounters/:id/share-code', requireAuth, async (req, res) => {
  try {
    const forceNew = req.query.forceNew === 'true';

    // Verify encounter exists and user owns it
    const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
    const encounter = db.encounters.find(e => e.id === req.params.id);

    if (!encounter) {
      return res.status(404).json({ error: 'Encounter not found' });
    }

    if (encounter.createdBy !== req.userEmail) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Load or create share codes database
    const shareCodes = readJSON(SHARE_CODES_PATH, { codes: {} });

    // Check if a valid code already exists for this USER (not encounter)
    let existingCode = null;
    if (!forceNew) {
      for (const [code, data] of Object.entries(shareCodes.codes)) {
        if (data.userEmail === req.userEmail && data.expiresAt > Date.now()) {
          existingCode = code;
          break;
        }
      }
    }

    let shareCode;
    if (existingCode) {
      shareCode = existingCode;
    } else {
      // If forcing new code, delete old codes for this user
      if (forceNew) {
        for (const [code, data] of Object.entries(shareCodes.codes)) {
          if (data.userEmail === req.userEmail) {
            delete shareCodes.codes[code];
          }
        }
      }

      // Generate new unique code
      do {
        shareCode = generateShareCode();
      } while (shareCodes.codes[shareCode]);

      // Store code tied to USER, not encounter (expires in 24 hours)
      shareCodes.codes[shareCode] = {
        userEmail: req.userEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      };

      await writeJSON(SHARE_CODES_PATH, shareCodes);
    }

    // Generate QR code with deep link format
    const deepLink = `encounterpp://share/${shareCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(deepLink, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    logger.info('Share code generated', {
      shareCode,
      user: req.userEmail,
      isNew: !existingCode
    });

    res.json({
      shareCode,
      qrCode: qrCodeDataUrl,
      expiresAt: shareCodes.codes[shareCode].expiresAt,
      deepLink
    });
  } catch (error) {
    logger.error('Error generating share code', {
      error: error.message,
      encounterId: req.params.id
    });
    res.status(500).json({ error: 'Failed to generate share code' });
  }
});

/**
 * GET /api/player-screen/:shareCode
 * Get CURRENT encounter data for the user via share code
 * Returns the user's currently active encounter (last opened/edited)
 * This allows DMs to switch encounters and players see the new one automatically
 */
app.get('/api/player-screen/:shareCode', playerScreenLimiter, (req, res) => {
  try {
    const shareCode = req.params.shareCode.toUpperCase();

    // Load share codes
    const shareCodes = readJSON(SHARE_CODES_PATH, { codes: {} });
    const codeData = shareCodes.codes[shareCode];

    if (!codeData) {
      return res.status(404).json({ error: 'Invalid share code' });
    }

    // Check expiration
    if (codeData.expiresAt < Date.now()) {
      return res.status(410).json({ error: 'Share code expired' });
    }

    // Load all encounters for this user
    const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
    const userEncounters = db.encounters.filter(e => e.createdBy === codeData.userEmail);

    if (userEncounters.length === 0) {
      return res.status(404).json({ error: 'No encounters found for this user' });
    }

    // Find the most recently updated encounter (user's current encounter)
    const currentEncounter = userEncounters.reduce((latest, current) => {
      const latestTime = new Date(latest.updatedAt || latest.createdAt).getTime();
      const currentTime = new Date(current.updatedAt || current.createdAt).getTime();
      return currentTime > latestTime ? current : latest;
    });

    logger.info('Player screen accessed via share code', {
      shareCode,
      userEmail: codeData.userEmail,
      encounterId: currentEncounter.id,
      encounterName: currentEncounter.name
    });

    res.json(currentEncounter);
  } catch (error) {
    logger.error('Error accessing player screen', {
      error: error.message,
      shareCode: req.params.shareCode
    });
    res.status(500).json({ error: 'Failed to load encounter' });
  }
});

/**
 * DELETE /api/encounters/:id/share-code
 * Revoke/delete share code for the user (not encounter-specific)
 */
app.delete('/api/encounters/:id/share-code', requireAuth, async (req, res) => {
  try {
    const shareCodes = readJSON(SHARE_CODES_PATH, { codes: {} });

    // Find and delete all codes for this user
    let deleted = false;
    for (const [code, data] of Object.entries(shareCodes.codes)) {
      if (data.userEmail === req.userEmail) {
        delete shareCodes.codes[code];
        deleted = true;
      }
    }

    if (deleted) {
      await writeJSON(SHARE_CODES_PATH, shareCodes);
      logger.info('Share code revoked', {
        user: req.userEmail
      });
    }

    res.json({ ok: true, deleted });
  } catch (error) {
    logger.error('Error revoking share code', {
      error: error.message,
      user: req.userEmail
    });
    res.status(500).json({ error: 'Failed to revoke share code' });
  }
});

app.post('/api/import/encounter', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'Invalid JSON' });
  const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const now = new Date().toISOString();
  const enc = {
    id: nanoid(),
    name: payload.name || 'Imported Encounter',
    round: payload.round || 1,
    turnIndex: payload.turnIndex || 0,
    initiativeOrder: payload.initiativeOrder || [],
    combatants: payload.combatants || {},
    createdBy: req.userEmail,
    createdAt: now,
    updatedAt: now,
  };
  db.encounters.push(enc);
  await writeJSON(ENCOUNTERS_PATH, db);
  res.status(201).json(enc);
});

app.get('/api/export/encounter/:id', requireAuth, (req, res) => {
  const db = readJSON(ENCOUNTERS_PATH, { encounters: [] });
  const enc = db.encounters.find(e => e.id === req.params.id);
  if (!enc) return res.status(404).json({ error: 'Not found' });
  // Check ownership
  if (enc.createdBy !== req.userEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(enc);
});

const PORT = process.env.PORT || 4000;

// -------------------- STARTUP VALIDATION --------------------
function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Required for email-based OTP auth
  if (!process.env.EMAIL_USER) {
    errors.push('EMAIL_USER is not set in .env file');
  }
  if (!process.env.EMAIL_PASSWORD) {
    errors.push('EMAIL_PASSWORD is not set in .env file');
  }
  if (!process.env.ALLOWED_EMAILS || process.env.ALLOWED_EMAILS.trim() === '') {
    errors.push('ALLOWED_EMAILS is not set in .env file');
  }

  // Encryption key warning (non-fatal but important)
  if (!process.env.ENCRYPTION_KEY) {
    warnings.push('ENCRYPTION_KEY is not set - using random key (will change on restart!)');
  }

  // Production-specific checks
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.ALLOWED_ORIGINS) {
      warnings.push('ALLOWED_ORIGINS not set in production - using defaults');
    }
    if (!process.env.ENCRYPTION_KEY) {
      errors.push('ENCRYPTION_KEY must be set in production environment');
    }
  }

  // Log warnings
  warnings.forEach(warning => logger.warn(`⚠️  ${warning}`));

  // Fatal errors - stop server
  if (errors.length > 0) {
    logger.error('❌ FATAL: Server configuration errors detected:');
    errors.forEach(error => logger.error(`  - ${error}`));
    logger.error('Please check your .env file configuration');
    logger.error('See .env.example for reference');
    process.exit(1);
  }

  logger.info('✅ Environment validation passed');
}

// Image proxy to bypass CORS for 5e.tools images with file caching
const IMAGE_CACHE_DIR = join(__dirname, '../data/image-cache');

// Ensure cache directory exists
if (!existsSync(IMAGE_CACHE_DIR)) {
  mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}

// Route: /api/token/:source/:name
app.get('/api/token/:source/:name', async (req, res) => {
  const { source, name } = req.params;

  if (!source || !name) {
    logger.warn('Image proxy: Missing source or name', { source, name });
    return res.status(400).json({ error: 'Source and name required' });
  }

  // Build 5e.tools image URL - try tokens first, fallback to full images
  const tokenUrl = `https://5e.tools/img/bestiary/tokens/${source}/${name}.webp`;
  const fullImageUrl = `https://5e.tools/img/bestiary/${source}/${name}.webp`;
  logger.info(`Image proxy: Requesting ${source}/${name}`);

  try {
    // Create a cache key from source and name
    const cacheKey = `${source}_${name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cacheFile = join(IMAGE_CACHE_DIR, `${cacheKey}.webp`);

    // Check if file exists in cache
    if (existsSync(cacheFile)) {
      const cached = readFileSync(cacheFile);
      logger.info(`Image proxy: Cache HIT for ${source}/${name}`);

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.send(cached);
    }

    // Try token URL first, fallback to full image
    logger.info(`Image proxy: Fetching from 5e.tools: ${tokenUrl}`);
    let response = await fetch(tokenUrl);

    // If token not found, try full image
    if (!response.ok && response.status === 404) {
      logger.info(`Image proxy: Token not found, trying full image: ${fullImageUrl}`);
      response = await fetch(fullImageUrl);
    }

    if (!response.ok) {
      logger.warn(`Image proxy: Failed to fetch from 5e.tools (${response.status})`);
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    const buffer = await response.arrayBuffer();
    const bufferData = Buffer.from(buffer);

    // Save to cache
    writeFileSync(cacheFile, bufferData);
    logger.info(`Image proxy: Cached ${source}/${name} (${bufferData.length} bytes)`);

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(bufferData);
  } catch (error) {
    logger.error('Image proxy error:', { error: error.message, source, name });
    res.status(500).json({ error: 'Failed to load token' });
  }
});

// Validate environment before starting server
validateEnvironment();

// Server starten und Creatures vorladen
app.listen(PORT, async () => {
  logger.info(`🚀 Server started on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Allowed origins: ${allowedOrigins.join(', ')}`);

  try {
    logger.info('Loading creatures from 5e.tools...');
    const startTime = Date.now();
    const creatures = await creatureCache.load(CREATURES_PATH);
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`✓ Loaded ${creatures.length} creatures from 5e.tools (${loadTime}s)`);

    const srdData = readJSON(SRD_PATH, { monsters: [] });
    const monsters = srdData.monsters || [];
    logger.info(`✓ Loaded ${monsters.length} homebrew/SRD monsters`);

    logger.info(`Total: ${creatures.length + monsters.length} monsters available`);
    logger.info(`API: GET http://localhost:${PORT}/api/monsters`);
  } catch (error) {
    logger.error('⚠ Error loading creatures', { error: error.message, stack: error.stack });
    logger.error('Server will continue but monsters may not be available');
  }
});
