// server/server.js
'use strict';
require('dotenv').config({ path: './.env' });
const app = require('./app');
const connectDB = require('./config/db');
const config = require('./config/config');
const logger = require('./utils/logger');

// Handle uncaught exceptions BEFORE anything else
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
  process.exit(1);
});

connectDB().then(() => {
  const server = app.listen(config.port, () => {
    logger.info(`ClinicOS server running on port ${config.port} [${config.env}]`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', err);
    server.close(() => process.exit(1));
  });

  // Graceful shutdown on SIGTERM (Docker / Heroku)
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Graceful shutdown...');
    server.close(() => {
      logger.info('Server closed.');
      process.exit(0);
    });
  });
});
