const { Server } = require('socket.io');
const logger = require('../utils/logger');
const { verifyAccessToken } = require('../utils/tokenUtils');

/**
 * Initialize Socket.io with JWT authentication middleware
 * @param {http.Server} httpServer
 * @returns {Server} Socket.io server instance
 */
const initializeSocket = (httpServer) => {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''));

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT Authentication middleware for socket connections
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      logger.warn(`Socket auth failed: ${error.message}`);
      next(new Error('Invalid or expired token'));
    }
  });

  logger.info('🔌 Socket.io initialized');
  return io;
};

module.exports = { initializeSocket };
