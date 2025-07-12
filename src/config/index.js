import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

/**
 * Application configuration
 */
const config = {
  // Application
  app: {
    name: process.env.APP_NAME || 'AutoWeave Backend',
    version: process.env.APP_VERSION || '1.0.0',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    nodeId: process.env.NODE_ID || uuidv4(),
    cluster: process.env.CLUSTER_NAME || 'autoweave-cluster'
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'autoweave:',
    retryStrategy: (times) => Math.min(times * 50, 2000)
  },

  // Qdrant
  qdrant: {
    host: process.env.QDRANT_HOST || 'localhost',
    port: parseInt(process.env.QDRANT_PORT || '6333', 10),
    apiKey: process.env.QDRANT_API_KEY,
    https: process.env.QDRANT_HTTPS === 'true',
    collections: {
      events: 'autoweave_events',
      services: 'autoweave_services',
      metrics: 'autoweave_metrics'
    }
  },

  // Neo4j
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j',
    maxConnectionPoolSize: parseInt(process.env.NEO4J_MAX_POOL_SIZE || '100', 10)
  },

  // Monitoring
  monitoring: {
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    enableTracing: process.env.ENABLE_TRACING === 'true',
    tracingEndpoint: process.env.TRACING_ENDPOINT || 'http://localhost:14268/api/traces',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Event Bus
  eventBus: {
    maxHistorySize: parseInt(process.env.EVENT_HISTORY_SIZE || '1000', 10),
    defaultTTL: parseInt(process.env.EVENT_DEFAULT_TTL || '3600000', 10), // 1 hour
    enablePersistence: process.env.EVENT_PERSISTENCE === 'true',
    compressionThreshold: parseInt(process.env.EVENT_COMPRESSION_THRESHOLD || '1024', 10)
  },

  // Service Manager
  serviceManager: {
    discoveryInterval: parseInt(process.env.SERVICE_DISCOVERY_INTERVAL || '60000', 10),
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    circuitBreakerResetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET || '60000', 10)
  },

  // Data Pipeline
  dataPipeline: {
    batchSize: parseInt(process.env.PIPELINE_BATCH_SIZE || '100', 10),
    processingTimeout: parseInt(process.env.PIPELINE_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.PIPELINE_MAX_RETRIES || '3', 10),
    deadLetterQueue: process.env.PIPELINE_DLQ === 'true'
  },

  // Auto Integration
  autoIntegration: {
    enabled: process.env.AUTO_INTEGRATION_ENABLED !== 'false',
    scanInterval: parseInt(process.env.AUTO_INTEGRATION_SCAN_INTERVAL || '300000', 10), // 5 minutes
    maxConcurrentScans: parseInt(process.env.AUTO_INTEGRATION_MAX_SCANS || '5', 10),
    validationLevel: process.env.AUTO_INTEGRATION_VALIDATION || 'strict'
  },

  // Analytics
  analytics: {
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '30', 10),
    aggregationInterval: parseInt(process.env.ANALYTICS_AGGREGATION_INTERVAL || '60000', 10),
    enableRealtime: process.env.ANALYTICS_REALTIME !== 'false',
    samplingRate: parseFloat(process.env.ANALYTICS_SAMPLING_RATE || '1.0')
  },

  // Performance
  performance: {
    enableProfiling: process.env.ENABLE_PROFILING === 'true',
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10),
    memoryAlertThreshold: parseInt(process.env.MEMORY_ALERT_THRESHOLD || '1073741824', 10), // 1GB
    cpuAlertThreshold: parseFloat(process.env.CPU_ALERT_THRESHOLD || '0.8')
  },

  // External Services
  external: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    slackWebhook: process.env.SLACK_WEBHOOK_URL,
    sentryDsn: process.env.SENTRY_DSN,
    datadogApiKey: process.env.DATADOG_API_KEY
  },
  
  // AutoWeave Core connection
  autoweaveCore: {
    baseUrl: process.env.AUTOWEAVE_CORE_URL || 'http://localhost:3000',
    wsUrl: process.env.AUTOWEAVE_CORE_WS_URL || 'ws://localhost:3000/ws',
    anpServerUrl: process.env.ANP_SERVER_URL || 'http://localhost:8083'
  }
};

/**
 * Validate configuration
 */
function validateConfig() {
  const errors = [];

  // Check required environment variables in production
  if (config.app.env === 'production') {
    if (config.security.jwtSecret === 'change-me-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }
    
    if (!config.redis.password) {
      errors.push('REDIS_PASSWORD should be set in production');
    }
    
    if (config.neo4j.password === 'password') {
      errors.push('NEO4J_PASSWORD should be changed in production');
    }
  }

  // Validate numeric ranges
  if (config.app.port < 1 || config.app.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (config.analytics.samplingRate < 0 || config.analytics.samplingRate > 1) {
    errors.push('ANALYTICS_SAMPLING_RATE must be between 0 and 1');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

// Validate on load
validateConfig();

export default config;