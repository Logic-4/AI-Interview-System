const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

// Config & Utils
const connectDB = require('./config/db');

const { initializeSocket } = require('./config/socket');
const { initializeSocketHandlers } = require('./sockets');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { startPiper, stopPiper } = require('./utils/piperProcess');
const { startSomaliSpeech, stopSomaliSpeech } = require('./utils/somaliSpeechProcess');

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const questionRoutes = require('./routes/questionRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
// RunPod configuration is loaded directly from environment variables (.env)
const ttsRoutes = require('./routes/ttsRoutes');
const sttRoutes = require('./routes/sttRoutes');

// ─── Initialize Express App ─────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Security Middleware ─────────────────────────────
app.use(helmet());
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ───────────────────────────────────
app.use('/api/', generalLimiter);

// ─── Body Parsing ────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Logging ─────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// ─── API Health Check ────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'InterviewAI Pro API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ──────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/uploads', uploadRoutes);
// Dynamic configuration endpoints are removed (loaded from env)
app.use('/api/v1/tts', ttsRoutes);
app.use('/api/v1/stt', sttRoutes);

// ─── 404 Handler ─────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Error Handler ───────────────────────────────────
app.use(errorHandler);

// ─── Socket.io ───────────────────────────────────────
const io = initializeSocket(server);
initializeSocketHandlers(io);

// ─── Start Server ────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Piper TTS in development (PIPER_AUTO_START=true by default)
    await startPiper(logger);

    // Somali ASR/TTS warm up in background (models can take minutes on first load)
    void startSomaliSpeech(logger, { waitForReady: false }).catch((err) => {
      logger.warn(`[somali-speech] Auto-start error: ${err.message}`);
    });

    // Start listening
    server.listen(PORT, () => {
      logger.info(`
╔══════════════════════════════════════════════╗
║         InterviewAI Pro API Server           ║
╠══════════════════════════════════════════════╣
║  🚀 Server:     http://localhost:${PORT}        ║
║  📊 Environment: ${(process.env.NODE_ENV || 'development').padEnd(25)}║
║  🔌 Socket.io:  Enabled                     ║
║  📝 API Base:    /api/v1                     ║
╚══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  stopSomaliSpeech(logger);
  stopPiper(logger);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  // Close server & exit
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

module.exports = { app, server };
