// server/utils/logger.js
const { createLogger, format, transports } = require('winston');
const config = require('../config/config');

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts} [${level}]: ${stack || message}`;
});

// Vercel (and most serverless platforms) have a read-only filesystem,
// so file transports crash on startup. Detect that and skip them.
const isServerless = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

const loggerTransports = [
  new transports.Console({
    format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
  }),
];

if (!isServerless) {
  loggerTransports.push(
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  );
}

const logger = createLogger({
  level: config.logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: loggerTransports,
});

module.exports = logger;