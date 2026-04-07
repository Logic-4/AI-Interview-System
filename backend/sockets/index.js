const { registerInterviewHandlers } = require('./interviewHandler');
const logger = require('../utils/logger');

/**
 * Initialize all socket handlers
 * @param {Server} io - Socket.io server instance
 */
const initializeSocketHandlers = (io) => {
  // Global connection logging
  io.on('connection', (socket) => {
    logger.info(`🔌 Global socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`🔌 Global socket disconnected: ${socket.id}`);
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  // Register namespace handlers
  registerInterviewHandlers(io);

  logger.info('🔌 All socket handlers registered');
};

module.exports = { initializeSocketHandlers };
