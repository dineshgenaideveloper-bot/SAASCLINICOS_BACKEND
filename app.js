// server/app.js

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const hpp = require('hpp');

const config = require('./config/config');
const logger = require('./utils/logger');
const startSubscriptionCron = require('./cron/subscriptionCron');

const { globalErrorHandler } = require('./middleware/error.middleware');

// All Routes
const routes = require('./routes');

const app = express();

// ─────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
      },
    },
  })
);

// ─────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,

    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
    ],
  })
);

// ─────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────


startSubscriptionCron();
console.log('Subscription cron job scheduled');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: config.env === 'development' ? 100000 : 200,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    status: 'fail',
    message: 'Too many requests. Please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: config.env === 'development' ? 100000 : 10,

  message: {
    status: 'fail',
    message:
      'Too many login attempts. Please try again later.',
  },

  skipSuccessfulRequests: true,
});

if (config.env === 'production') {
  app.use('/api', globalLimiter);

  app.use('/api/auth/login', authLimiter);

  app.use('/api/auth/register', authLimiter);
}

// ─────────────────────────────────────────────────────────────
// Body Parser
// ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));

app.use(
  express.urlencoded({
    extended: true,
    limit: '10kb',
  })
);

app.use(cookieParser());

// ─────────────────────────────────────────────────────────────
// Mongo Sanitize
// ─────────────────────────────────────────────────────────────

app.use(mongoSanitize());

// ─────────────────────────────────────────────────────────────
// HPP Protection
// ─────────────────────────────────────────────────────────────

app.use(
  hpp({
    whitelist: ['status', 'department', 'sort'],
  })
);

// ─────────────────────────────────────────────────────────────
// Compression
// ─────────────────────────────────────────────────────────────

app.use(compression());

// ─────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────

if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (msg) => logger.info(msg.trim()),
      },
    })
  );
}

// ─────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    env: config.env,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────

app.use('/api', routes);

// ─────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────

app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} not found.`,
  });
});

// ─────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────

app.use(globalErrorHandler);

module.exports = app;