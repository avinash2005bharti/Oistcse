const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('./config/env');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const { connectMongo, getMongoHealth } = require('./config/mongo');
const { connectPostgres, getPostgresHealth } = require('./config/postgres');
const { connectQdrant, getQdrantHealth } = require('./config/qdrant');
const { setupSwagger } = require('./config/swagger');
const { initSocket } = require('./sockets/socketHandler');
const { logger } = require('./services/loggerService');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes/index');
const app = express();
const server = http.createServer(app);

// Initialize Whitelisted Origins (SEC-08 & Localhost Development Support)
const defaultLocalOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];
const productionFrontend = 'https://oistcse.onrender.com';

const parseCorsOrigins = () => {
  const envOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS,
    process.env.CORS_ORIGIN,
    process.env.CLIENT_URL
  ].filter(Boolean).join(',');

  const configured = envOrigins
    ? envOrigins.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return Array.from(new Set([
    productionFrontend,
    ...configured,
    ...defaultLocalOrigins
  ]));
};

const allowedOrigins = parseCorsOrigins();

const isLocalhostOrigin = (origin) => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests with no origin (curl, server-to-server, mobile native)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes('*') ||
      isLocalhostOrigin(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
  },
  credentials: true
};

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        isLocalhostOrigin(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow socket origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});
initSocket(io);

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false // Allow loading static uploads
}));

app.use(cors(corsOptions));

// Winston Request Logger
app.use(requestLogger);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Parsing
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static uploads directory (SEC-03: Hardened against arbitrary file and secret disclosure)
const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
const ALLOWED_STATIC_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  '.pdf', '.xlsx', '.xls', '.csv', '.doc', '.docx', '.txt'
]);

app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const ext = path.extname(req.path).toLowerCase();
  if (!ALLOWED_STATIC_EXTENSIONS.has(ext) || req.path.includes('..') || path.basename(req.path).startsWith('.')) {
    return res.status(404).json({ success: false, message: 'Resource not found.' });
  }
  next();
}, express.static(uploadPath, {
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Swagger Documentation
setupSwagger(app);

// Mount API routes (Both /api and /api/v1 for versioning)
app.use('/api/v1', routes);
app.use('/api', routes);

// Welcome / Root route
app.get('/', (req, res) => {
  res.json({
    department: 'Computer Science & Engineering (CSE)',
    system: 'CSE Department AI Agentic ERP Backend',
    version: '2.0.0',
    architecture: {
      relational: 'PostgreSQL + Prisma ORM (Source of Truth)',
      application: 'MongoDB + Mongoose (User Data & LLM STM)',
      vector: 'Qdrant (LLM LTM & RAG Knowledge)'
    },
    documentation: '/api-docs',
    health: '/api/health',
    databases: '/api/health/databases',
    status: 'Running'
  });
});

// Database Architecture Health Endpoint
app.get('/api/health/databases', async (req, res) => {
  const [pgHealth, mongoHealth, qdrantHealth] = await Promise.all([
    getPostgresHealth(),
    getMongoHealth(),
    getQdrantHealth()
  ]);

  const isPgUp = pgHealth.status === 'UP';
  const isMongoUp = Boolean(app.locals.mongoAvailable && mongoHealth.status === 'UP');

  // Relational PostgreSQL is the primary authority; MongoDB degradation does not bring down ERP (ARCH-01)
  res.status(isPgUp ? 200 : 503).json({
    status: isPgUp ? (isMongoUp ? 'HEALTHY' : 'DEGRADED') : 'UNHEALTHY',
    timestamp: new Date().toISOString(),
    databases: {
      postgres: pgHealth,
      mongodb: { ...mongoHealth, available: isMongoUp },
      qdrant: qdrantHealth
    }
  });
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start Server after validating all three database layers
const startServer = async () => {
  try {
    console.log('\n======================================================');
    console.log('  CAMPUSFLOW ERP - DATABASE ARCHITECTURE VALIDATION  ');
    console.log('======================================================');

    // 1. PostgreSQL (Prisma ORM) - Relational Source of Truth
    try {
      await connectPostgres();
      console.log('  [PostgreSQL + Prisma] : ✓ CONNECTED (Relational ERP Source of Truth)');
    } catch (pgErr) {
      console.warn(`  [PostgreSQL + Prisma] : ⚠️ INITIAL ATTEMPT FAILED - Retrying in background (${pgErr.message})`);
      setTimeout(() => connectPostgres().catch(() => {}), 5000);
    }

    // 2. MongoDB (Mongoose) - User/App Data & LLM STM (ARCH-01: Non-fatal degradation)
    app.locals.mongoAvailable = false;
    global.appInstance = app;
    try {
      await connectMongo();
      app.locals.mongoAvailable = true;
      console.log('  [MongoDB + Mongoose]  : ✓ CONNECTED (User Data & LLM STM)');
    } catch (mErr) {
      app.locals.mongoAvailable = false;
      console.warn(`  [MongoDB + Mongoose]  : ⚠️  UNAVAILABLE (${mErr.message}) - Degrading to stateless conversational memory. Core ERP remains active.`);
      const { scheduleMongoReconnect } = require('./config/mongo');
      scheduleMongoReconnect();
    }

    // 3. Qdrant Vector Database - LLM LTM & RAG
    try {
      const qOk = await connectQdrant();
      if (qOk) {
        console.log('  [Qdrant Vector DB]    : ✓ CONNECTED (LLM LTM & RAG Embeddings)');
      } else {
        console.warn('  [Qdrant Vector DB]    : ⚠️  UNAVAILABLE (Vector features in fallback mode)');
      }
    } catch (qErr) {
      console.warn(`  [Qdrant Vector DB]    : ⚠️  WARNING (${qErr.message}) - running fallback`);
    }

    console.log('======================================================\n');

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`[Server Error] Port ${PORT} is already in use by another process.`);
      } else {
        logger.error(`[Server Error]: ${err.message}`);
      }
      process.exit(1);
    });

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`======================================================`);
      logger.info(`  CSE AGENTIC ERP BACKEND RUNNING ON PORT ${PORT} `);
      logger.info(`======================================================`);
      logger.info(`• Base API:       http://localhost:${PORT}/api`);
      logger.info(`• Database Health:http://localhost:${PORT}/api/health/databases`);
      logger.info(`• Swagger Docs:   http://localhost:${PORT}/api-docs`);
      logger.info(`• Static Uploads: http://localhost:${PORT}/uploads`);
      logger.info(`• Socket.IO:      ws://localhost:${PORT}`);
      logger.info(`======================================================`);

      // Sync verified student roster to MongoDB predata for production auth
      const { syncExistingStudentsToMongo } = require('./services/studentPreDataSync');
      syncExistingStudentsToMongo().catch((err) => logger.warn(`[Sync Warning]: ${err.message}`));
    });
  } catch (err) {
    logger.error(`[Server] Fatal startup error: ${err.message}`);
    process.exit(1);
  }
};

if (require.main === module || process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, server, startServer };
