import * as promClient from 'prom-client';

/**
 * Custom metrics for AutoWeave Backend monitoring
 */
export class MetricsCollector {
  constructor() {
    // Create a new registry
    this.register = new promClient.Registry();
    
    // Add default metrics
    promClient.collectDefaultMetrics({ register: this.register });
    
    // Initialize custom metrics
    this.initializeMetrics();
  }

  initializeMetrics() {
    // HTTP metrics
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status', 'service'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    this.httpRequestsTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status', 'service'],
      registers: [this.register]
    });

    this.httpRequestsActive = new promClient.Gauge({
      name: 'http_requests_active',
      help: 'Number of active HTTP requests',
      labelNames: ['service'],
      registers: [this.register]
    });

    // WebSocket metrics
    this.wsConnectionsActive = new promClient.Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      labelNames: ['service'],
      registers: [this.register]
    });

    this.wsMessagesTotal = new promClient.Counter({
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['direction', 'type'],
      registers: [this.register]
    });

    // Service metrics
    this.servicesTotal = new promClient.Gauge({
      name: 'services_total',
      help: 'Total number of registered services',
      labelNames: ['status'],
      registers: [this.register]
    });

    this.serviceHealthChecks = new promClient.Counter({
      name: 'service_health_checks_total',
      help: 'Total number of health checks performed',
      labelNames: ['service', 'status'],
      registers: [this.register]
    });

    this.serviceUptime = new promClient.Gauge({
      name: 'service_uptime_seconds',
      help: 'Service uptime in seconds',
      labelNames: ['service'],
      registers: [this.register]
    });

    // Event Bus metrics
    this.eventsPublished = new promClient.Counter({
      name: 'eventbus_events_published_total',
      help: 'Total number of events published',
      labelNames: ['topic', 'source'],
      registers: [this.register]
    });

    this.eventSubscribers = new promClient.Gauge({
      name: 'eventbus_subscribers_active',
      help: 'Number of active event subscribers',
      labelNames: ['topic'],
      registers: [this.register]
    });

    this.eventProcessingDuration = new promClient.Histogram({
      name: 'eventbus_processing_duration_seconds',
      help: 'Event processing duration in seconds',
      labelNames: ['topic', 'handler'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 5],
      registers: [this.register]
    });

    // Analytics metrics
    this.analyticsEventsTracked = new promClient.Counter({
      name: 'analytics_events_tracked_total',
      help: 'Total number of analytics events tracked',
      labelNames: ['event_type', 'sampled'],
      registers: [this.register]
    });

    this.analyticsQueryDuration = new promClient.Histogram({
      name: 'analytics_query_duration_seconds',
      help: 'Analytics query duration in seconds',
      labelNames: ['query_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
      registers: [this.register]
    });

    // Pipeline metrics
    this.pipelineExecutions = new promClient.Counter({
      name: 'pipeline_executions_total',
      help: 'Total number of pipeline executions',
      labelNames: ['pipeline', 'status'],
      registers: [this.register]
    });

    this.pipelineProcessingTime = new promClient.Histogram({
      name: 'pipeline_processing_duration_seconds',
      help: 'Pipeline processing duration in seconds',
      labelNames: ['pipeline'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
      registers: [this.register]
    });

    this.pipelineItemsProcessed = new promClient.Counter({
      name: 'pipeline_items_processed_total',
      help: 'Total number of items processed by pipelines',
      labelNames: ['pipeline', 'status'],
      registers: [this.register]
    });

    // Integration metrics
    this.integrationsActive = new promClient.Gauge({
      name: 'integrations_active',
      help: 'Number of active integrations',
      labelNames: ['type', 'status'],
      registers: [this.register]
    });

    this.integrationRequests = new promClient.Counter({
      name: 'integration_requests_total',
      help: 'Total number of integration requests',
      labelNames: ['integration', 'method', 'status'],
      registers: [this.register]
    });

    this.integrationErrors = new promClient.Counter({
      name: 'integration_errors_total',
      help: 'Total number of integration errors',
      labelNames: ['integration', 'error_type'],
      registers: [this.register]
    });

    // Database metrics
    this.dbConnectionsActive = new promClient.Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      labelNames: ['database', 'type'],
      registers: [this.register]
    });

    this.dbQueryDuration = new promClient.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['database', 'operation'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 5],
      registers: [this.register]
    });

    this.dbErrors = new promClient.Counter({
      name: 'database_errors_total',
      help: 'Total number of database errors',
      labelNames: ['database', 'operation', 'error_type'],
      registers: [this.register]
    });

    // Memory metrics
    this.memoryStorageSize = new promClient.Gauge({
      name: 'memory_storage_size_bytes',
      help: 'Size of data in memory storage',
      labelNames: ['storage_type'],
      registers: [this.register]
    });

    this.memoryOperations = new promClient.Counter({
      name: 'memory_operations_total',
      help: 'Total number of memory operations',
      labelNames: ['storage_type', 'operation'],
      registers: [this.register]
    });

    // Authentication metrics
    this.authAttempts = new promClient.Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['method', 'status'],
      registers: [this.register]
    });

    this.authTokensActive = new promClient.Gauge({
      name: 'auth_tokens_active',
      help: 'Number of active authentication tokens',
      labelNames: ['type'],
      registers: [this.register]
    });

    this.authRateLimitHits = new promClient.Counter({
      name: 'auth_rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['endpoint'],
      registers: [this.register]
    });

    // Business metrics
    this.businessOperations = new promClient.Counter({
      name: 'business_operations_total',
      help: 'Total number of business operations',
      labelNames: ['operation', 'status'],
      registers: [this.register]
    });

    this.businessValue = new promClient.Gauge({
      name: 'business_value_current',
      help: 'Current business value metrics',
      labelNames: ['metric_name'],
      registers: [this.register]
    });
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method, route, status, duration, service = 'backend') {
    this.httpRequestDuration.labels(method, route, status, service).observe(duration);
    this.httpRequestsTotal.labels(method, route, status, service).inc();
  }

  /**
   * Set active HTTP requests
   */
  setActiveHttpRequests(count, service = 'backend') {
    this.httpRequestsActive.labels(service).set(count);
  }

  /**
   * Record WebSocket metrics
   */
  recordWsConnection(delta) {
    this.wsConnectionsActive.labels('backend').inc(delta);
  }

  recordWsMessage(direction, type) {
    this.wsMessagesTotal.labels(direction, type).inc();
  }

  /**
   * Record service metrics
   */
  recordServiceStatus(status, count) {
    this.servicesTotal.labels(status).set(count);
  }

  recordServiceHealthCheck(service, status) {
    this.serviceHealthChecks.labels(service, status).inc();
  }

  setServiceUptime(service, uptime) {
    this.serviceUptime.labels(service).set(uptime);
  }

  /**
   * Record event bus metrics
   */
  recordEventPublished(topic, source = 'system') {
    this.eventsPublished.labels(topic, source).inc();
  }

  setEventSubscribers(topic, count) {
    this.eventSubscribers.labels(topic).set(count);
  }

  recordEventProcessing(topic, handler, duration) {
    this.eventProcessingDuration.labels(topic, handler).observe(duration);
  }

  /**
   * Record analytics metrics
   */
  recordAnalyticsEvent(eventType, sampled = true) {
    this.analyticsEventsTracked.labels(eventType, sampled.toString()).inc();
  }

  recordAnalyticsQuery(queryType, duration) {
    this.analyticsQueryDuration.labels(queryType).observe(duration);
  }

  /**
   * Record pipeline metrics
   */
  recordPipelineExecution(pipeline, status) {
    this.pipelineExecutions.labels(pipeline, status).inc();
  }

  recordPipelineProcessingTime(pipeline, duration) {
    this.pipelineProcessingTime.labels(pipeline).observe(duration);
  }

  recordPipelineItems(pipeline, status, count) {
    this.pipelineItemsProcessed.labels(pipeline, status).inc(count);
  }

  /**
   * Record integration metrics
   */
  setActiveIntegrations(type, status, count) {
    this.integrationsActive.labels(type, status).set(count);
  }

  recordIntegrationRequest(integration, method, status) {
    this.integrationRequests.labels(integration, method, status).inc();
  }

  recordIntegrationError(integration, errorType) {
    this.integrationErrors.labels(integration, errorType).inc();
  }

  /**
   * Record database metrics
   */
  setDbConnections(database, type, count) {
    this.dbConnectionsActive.labels(database, type).set(count);
  }

  recordDbQuery(database, operation, duration) {
    this.dbQueryDuration.labels(database, operation).observe(duration);
  }

  recordDbError(database, operation, errorType) {
    this.dbErrors.labels(database, operation, errorType).inc();
  }

  /**
   * Record memory metrics
   */
  setMemoryStorageSize(storageType, size) {
    this.memoryStorageSize.labels(storageType).set(size);
  }

  recordMemoryOperation(storageType, operation) {
    this.memoryOperations.labels(storageType, operation).inc();
  }

  /**
   * Record authentication metrics
   */
  recordAuthAttempt(method, status) {
    this.authAttempts.labels(method, status).inc();
  }

  setActiveAuthTokens(type, count) {
    this.authTokensActive.labels(type).set(count);
  }

  recordRateLimitHit(endpoint) {
    this.authRateLimitHits.labels(endpoint).inc();
  }

  /**
   * Record business metrics
   */
  recordBusinessOperation(operation, status) {
    this.businessOperations.labels(operation, status).inc();
  }

  setBusinessValue(metricName, value) {
    this.businessValue.labels(metricName).set(value);
  }

  /**
   * Get metrics for Prometheus
   */
  async getMetrics() {
    return this.register.metrics();
  }

  /**
   * Get content type for metrics
   */
  getContentType() {
    return this.register.contentType;
  }
}

// Create singleton instance
export const metrics = new MetricsCollector();