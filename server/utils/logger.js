import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Logs directory
const logsDir = join(__dirname, '..', 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Log rotation configuration
const rotationConfig = {
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,  // Komprimiere alte Logs
  maxSize: '20m',        // Maximal 20MB pro Datei
  maxFiles: '14d',       // Behalte Logs für 14 Tage
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
};

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger with daily rotation
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat
    }),

    // Error log file with daily rotation
    new DailyRotateFile({
      ...rotationConfig,
      filename: join(logsDir, 'error-%DATE%.log'),
      level: 'error',
    }),

    // Combined log file with daily rotation
    new DailyRotateFile({
      ...rotationConfig,
      filename: join(logsDir, 'combined-%DATE%.log'),
    }),

    // Security log file with daily rotation
    new DailyRotateFile({
      ...rotationConfig,
      filename: join(logsDir, 'security-%DATE%.log'),
      level: 'warn',
    })
  ],

  // Handle uncaught exceptions
  exceptionHandlers: [
    new DailyRotateFile({
      ...rotationConfig,
      filename: join(logsDir, 'exceptions-%DATE%.log'),
      maxFiles: '30d', // Exceptions länger behalten
    })
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new DailyRotateFile({
      ...rotationConfig,
      filename: join(logsDir, 'rejections-%DATE%.log'),
      maxFiles: '30d', // Rejections länger behalten
    })
  ]
});

// Log rotation events
logger.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log file rotated', { oldFilename, newFilename });
});

// Export helper methods for specific log types
export const logAuthAttempt = (email, success, ip) => {
  logger.info('Auth attempt', { email, success, ip, type: 'auth' });
};

export const logAuthFailure = (email, reason, ip) => {
  logger.warn('Auth failure', { email, reason, ip, type: 'auth' });
};

export const logSecurityEvent = (event, details) => {
  logger.warn('Security event', { event, ...details, type: 'security' });
};

export const logApiError = (endpoint, error, user) => {
  logger.error('API error', {
    endpoint,
    error: error.message,
    stack: error.stack,
    user,
    type: 'api'
  });
};
