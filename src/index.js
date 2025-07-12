import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import winston from 'winston';

// Core components
import ServiceManager from './core/service-manager/index.js';
import EventBus from './core/event-bus/index.js';
import config from './config/index.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Import monitoring components
import { metrics } from './monitoring/metrics.js';
import { 
  createMonitoringMiddleware, 
  monitorWebSocket,
  monitorService,
  monitorEventBus,
  monitorAnalytics,
  monitorPipeline,
  monitorIntegrations,
  monitorDatabase
} from './middleware/monitoring.js';

// Initialize Express app
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Redis for auth with graceful degradation
import Redis from 'ioredis';
let redis = null;
let redisHealthy = false;

try {
  redis = new Redis({
    ...config.redis,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true
  });
  
  // Test connection
  await redis.ping();
  redisHealthy = true;
  logger.info('Redis connected successfully');
} catch (error) {
  logger.warn('Redis connection failed, running in degraded mode:', error.message);
  redis = null;
}

// Apply monitoring middleware
app.use(createMonitoringMiddleware());

// Initialize core components
const serviceManager = monitorService(new ServiceManager({ logger, config }));
const eventBus = monitorEventBus(new EventBus({ logger, config }));

// Health check endpoint with detailed service status
app.get('/health', async (req, res) => {
  const services = {
    redis: redisHealthy ? 'healthy' : 'degraded',
    neo4j: storageAdapters.neo4j ? 'healthy' : 'unavailable',
    qdrant: storageAdapters.qdrant ? 'healthy' : 'unavailable',
    core: coreConnector?.connected ? 'connected' : 'disconnected'
  };
  
  // Determine overall status
  const hasUnavailable = Object.values(services).includes('unavailable');
  const hasDegraded = Object.values(services).includes('degraded');
  const overallStatus = hasUnavailable ? 'degraded' : (hasDegraded ? 'warning' : 'healthy');
  
  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
    version: process.env.npm_package_version || '1.0.0',
    mode: hasUnavailable || hasDegraded ? 'degraded' : 'full',
    message: hasUnavailable || hasDegraded ? 
      'Some services are unavailable, running with limited functionality' : 
      'All services operational'
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.getContentType());
  res.end(await metrics.getMetrics());
});

// Initialize services
import DataPipelineService from './services/data-pipeline/index.js';
import StorageAdapterFactory from './services/data-pipeline/adapters/index.js';
import IntegrationHub from './services/integration/integration-hub.js';
import AnalyticsEngine from './services/analytics/analytics-engine.js';

// Create storage adapters with graceful degradation
const storageAdapterFactory = new StorageAdapterFactory({ config, logger });
const storageAdapters = {};

// Try to create each adapter, but continue if they fail
const adapterConfigs = [
  { name: 'qdrant', config: config.qdrant },
  { name: 'redis', config: config.redis },
  { name: 'neo4j', config: config.neo4j }
];

for (const { name, config: adapterConfig } of adapterConfigs) {
  try {
    storageAdapters[name] = storageAdapterFactory.createAdapter(name, adapterConfig);
    logger.info(`${name} adapter created successfully`);
  } catch (error) {
    logger.warn(`Failed to create ${name} adapter, service will run without it:`, error.message);
    storageAdapters[name] = null;
  }
}

const monitoredAdapters = monitorDatabase(storageAdapters);

// Initialize data pipeline with available adapters
let dataPipeline = null;
try {
  dataPipeline = monitorPipeline(new DataPipelineService({
    logger,
    config: config.dataPipeline,
    eventBus,
    storageAdapters: monitoredAdapters
  }));
  logger.info('Data pipeline initialized successfully');
} catch (error) {
  logger.warn('Data pipeline initialization failed, running without it:', error.message);
}

// Initialize integration hub if data pipeline is available
let integrationHub = null;
if (dataPipeline) {
  try {
    integrationHub = monitorIntegrations(new IntegrationHub({
      logger,
      config: config,
      eventBus,
      dataPipeline,
      serviceManager
    }));
    logger.info('Integration hub initialized successfully');
  } catch (error) {
    logger.warn('Integration hub initialization failed:', error.message);
  }
} else {
  logger.warn('Skipping integration hub initialization (no data pipeline)');
}

// Initialize analytics engine with available adapters
let analyticsEngine = null;
try {
  analyticsEngine = monitorAnalytics(new AnalyticsEngine({
    logger,
    config: config,
    eventBus,
    storageAdapters: monitoredAdapters
  }));
  logger.info('Analytics engine initialized successfully');
} catch (error) {
  logger.warn('Analytics engine initialization failed:', error.message);
}

// Import AutoWeave Core Connector
import AutoWeaveCoreConnector from './connectors/autoweave-core-connector.js';

// Initialize Core Connector
const coreConnector = new AutoWeaveCoreConnector({
  logger,
  config,
  eventBus,
  serviceManager
});

// Import authentication
import { createAuthMiddleware } from './middleware/auth.js';
import { createUserService } from './services/user-service.js';

// Initialize authentication with fallback
let userService = null;
let authMiddleware = null;

if (redis) {
  try {
    userService = createUserService({ logger, redis, config });
    authMiddleware = createAuthMiddleware({ config, logger, redis });
    logger.info('Authentication services initialized');
  } catch (error) {
    logger.warn('Authentication initialization failed:', error.message);
  }
} else {
  logger.warn('Authentication disabled (no Redis connection)');
  // Create a dummy auth middleware that allows all requests
  authMiddleware = {
    cors: () => (req, res, next) => next(),
    rateLimit: () => (req, res, next) => next(),
    authenticate: () => (req, res, next) => {
      logger.warn('Authentication bypassed in degraded mode');
      next();
    }
  };
}

// Import route handlers
import createServicesRouter from './routes/services.js';
import createEventsRouter from './routes/events.js';
import createAnalyticsRouter from './routes/analytics.js';
import createIntegrationRouter from './routes/integration.js';
import createCoreRouter from './routes/core.js';
import createAuthRouter from './routes/auth.js';

// Apply security middleware
app.use(authMiddleware.cors());
app.use(authMiddleware.rateLimit());

// Setup Swagger documentation
import { setupSwagger } from './middleware/swagger.js';
const swaggerInfo = setupSwagger(app, '/api-docs');

// Public routes
app.use('/api/auth', createAuthRouter(authMiddleware, userService));

// Protected API Routes - only mount if services are available
app.use('/api/services', authMiddleware.authenticate(), createServicesRouter(serviceManager));
app.use('/api/events', authMiddleware.authenticate(), createEventsRouter(eventBus));

if (analyticsEngine) {
  app.use('/api/analytics', authMiddleware.authenticate(), createAnalyticsRouter(analyticsEngine));
} else {
  app.use('/api/analytics', (req, res) => res.status(503).json({ error: 'Analytics service unavailable' }));
}

if (integrationHub) {
  app.use('/api/integration', authMiddleware.authenticate(), createIntegrationRouter(integrationHub));
} else {
  app.use('/api/integration', (req, res) => res.status(503).json({ error: 'Integration service unavailable' }));
}

if (dataPipeline) {
  app.use('/api/pipeline', authMiddleware.authenticate(), (await import('./routes/pipeline.js')).default(dataPipeline));
} else {
  app.use('/api/pipeline', (req, res) => res.status(503).json({ error: 'Pipeline service unavailable' }));
}

app.use('/api/core', authMiddleware.authenticate(), createCoreRouter(coreConnector));

// WebSocket handling with monitoring
monitorWebSocket(wss);

wss.on('connection', (ws, req) => {
  logger.info('WebSocket connection established', {
    ip: req.socket.remoteAddress
  });
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle different message types
      switch (data.type) {
        case 'subscribe':
          eventBus.subscribe(data.topic, (event) => {
            ws.send(JSON.stringify({
              type: 'event',
              topic: data.topic,
              data: event
            }));
          });
          break;
          
        case 'publish':
          await eventBus.publish(data.topic, data.data);
          break;
          
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type'
          }));
      }
    } catch (error) {
      logger.error('WebSocket message error', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error', error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Start server
const PORT = process.env.PORT || 3001;
const METRICS_PORT = process.env.METRICS_PORT || 9090;

// Start metrics server separately
if (METRICS_PORT !== PORT) {
  const metricsApp = express();
  metricsApp.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.getContentType());
    res.end(await metrics.getMetrics());
  });
  
  metricsApp.listen(METRICS_PORT, () => {
    logger.info(`Metrics server listening on port ${METRICS_PORT}`);
  });
}

server.listen(PORT, async () => {
  logger.info(`AutoWeave Backend server listening on port ${PORT}`);
  logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}${swaggerInfo.ui}`);
  
  // Check operational mode
  const degradedServices = [];
  if (!redisHealthy) degradedServices.push('Redis');
  if (!storageAdapters.neo4j) degradedServices.push('Neo4j');
  if (!storageAdapters.qdrant) degradedServices.push('Qdrant');
  if (!dataPipeline) degradedServices.push('Data Pipeline');
  if (!analyticsEngine) degradedServices.push('Analytics');
  if (!integrationHub) degradedServices.push('Integration Hub');
  
  if (degradedServices.length > 0) {
    logger.warn('='.repeat(60));
    logger.warn('RUNNING IN DEGRADED MODE');
    logger.warn(`Unavailable services: ${degradedServices.join(', ')}`);
    logger.warn('Some functionality may be limited');
    logger.warn('='.repeat(60));
  } else {
    logger.info('All services operational - running in full mode');
  }
  
  // Initialize services with graceful handling
  try {
    await serviceManager.startAll();
    logger.info('Service manager started successfully');
  } catch (error) {
    logger.warn('Some services failed to start:', error.message);
    // Continue running in degraded mode
  }
  
  // Connect to AutoWeave Core (non-blocking)
  if (coreConnector) {
    coreConnector.connect().catch(error => {
      logger.warn('Failed to connect to AutoWeave Core:', error.message);
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close WebSocket connections
  wss.clients.forEach(ws => {
    ws.close();
  });
  
  // Disconnect from AutoWeave Core
  await coreConnector.disconnect();
  
  // Stop analytics engine if available
  if (analyticsEngine) {
    try {
      await analyticsEngine.stop();
    } catch (error) {
      logger.error('Error stopping analytics engine:', error);
    }
  }
  
  // Stop integration hub if available
  if (integrationHub) {
    try {
      await integrationHub.stop();
    } catch (error) {
      logger.error('Error stopping integration hub:', error);
    }
  }
  
  // Stop data pipeline if available
  if (dataPipeline) {
    try {
      await dataPipeline.shutdown();
    } catch (error) {
      logger.error('Error stopping data pipeline:', error);
    }
  }
  
  // Stop services
  await serviceManager.stopAll();
  
  // Close event bus
  await eventBus.close();
  
  process.exit(0);
});

export default app;