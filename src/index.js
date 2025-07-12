import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import winston from 'winston';
import * as promClient from 'prom-client';

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

// Initialize Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const activeConnections = new promClient.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register]
});

// Initialize Express app
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging and metrics
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
    
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}s`
    });
  });
  
  next();
});

// Initialize core components
const serviceManager = new ServiceManager({ logger, config });
const eventBus = new EventBus({ logger, config });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: serviceManager.getHealthStatus(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Initialize services
import DataPipelineService from './services/data-pipeline/index.js';
import StorageAdapterFactory from './services/data-pipeline/adapters/index.js';
import IntegrationHub from './services/integration/integration-hub.js';

// Create storage adapters
const storageAdapterFactory = new StorageAdapterFactory({ config, logger });
const storageAdapters = {
  qdrant: storageAdapterFactory.createAdapter('qdrant', config.qdrant),
  redis: storageAdapterFactory.createAdapter('redis', config.redis),
  neo4j: storageAdapterFactory.createAdapter('neo4j', config.neo4j)
};

// Initialize data pipeline
const dataPipeline = new DataPipelineService({
  logger,
  config: config.dataPipeline,
  eventBus,
  storageAdapters
});

// Initialize integration hub
const integrationHub = new IntegrationHub({
  logger,
  config: config,
  eventBus,
  dataPipeline,
  serviceManager
});

// Import route handlers
import createServicesRouter from './routes/services.js';
import createEventsRouter from './routes/events.js';
import createAnalyticsRouter from './routes/analytics.js';
import createIntegrationRouter from './routes/integration.js';

// API Routes
app.use('/api/services', createServicesRouter(serviceManager));
app.use('/api/events', createEventsRouter(eventBus));
app.use('/api/analytics', createAnalyticsRouter(null)); // Analytics engine to be implemented
app.use('/api/integration', createIntegrationRouter(integrationHub));
app.use('/api/pipeline', (await import('./routes/pipeline.js')).default(dataPipeline));

// WebSocket handling
wss.on('connection', (ws, req) => {
  activeConnections.inc();
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
    activeConnections.dec();
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
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  
  metricsApp.listen(METRICS_PORT, () => {
    logger.info(`Metrics server listening on port ${METRICS_PORT}`);
  });
}

server.listen(PORT, () => {
  logger.info(`AutoWeave Backend server listening on port ${PORT}`);
  logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
  
  // Initialize services
  serviceManager.startAll().catch(error => {
    logger.error('Failed to start services', error);
    process.exit(1);
  });
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
  
  // Stop integration hub
  await integrationHub.stop();
  
  // Stop data pipeline
  await dataPipeline.shutdown();
  
  // Stop services
  await serviceManager.stopAll();
  
  // Close event bus
  await eventBus.close();
  
  process.exit(0);
});

export default app;