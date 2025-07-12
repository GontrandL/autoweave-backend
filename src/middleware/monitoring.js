import { metrics } from '../monitoring/metrics.js';

/**
 * Monitoring middleware for automatic metrics collection
 */
export function createMonitoringMiddleware() {
  let activeRequests = 0;

  return (req, res, next) => {
    // Skip metrics endpoint to avoid recursion
    if (req.path === '/metrics') {
      return next();
    }

    const start = Date.now();
    activeRequests++;
    metrics.setActiveHttpRequests(activeRequests);

    // Capture the original end function
    const originalEnd = res.end;
    let responseSent = false;

    // Override end to capture metrics
    res.end = function(...args) {
      if (!responseSent) {
        responseSent = true;
        
        const duration = (Date.now() - start) / 1000; // Convert to seconds
        const route = req.route?.path || req.path || 'unknown';
        const method = req.method;
        const status = res.statusCode.toString();

        // Record metrics
        metrics.recordHttpRequest(method, route, status, duration);
        
        activeRequests--;
        metrics.setActiveHttpRequests(activeRequests);

        // Track auth attempts
        if (req.path === '/api/auth/login') {
          const authStatus = res.statusCode === 200 ? 'success' : 'failure';
          metrics.recordAuthAttempt('jwt', authStatus);
        }

        // Track rate limit hits
        if (res.statusCode === 429) {
          metrics.recordRateLimitHit(route);
        }
      }

      // Call the original end function
      originalEnd.apply(res, args);
    };

    next();
  };
}

/**
 * WebSocket monitoring
 */
export function monitorWebSocket(wss) {
  // Track connections
  wss.on('connection', (ws) => {
    metrics.recordWsConnection(1);

    ws.on('message', (message) => {
      metrics.recordWsMessage('incoming', 'data');
    });

    ws.on('close', () => {
      metrics.recordWsConnection(-1);
    });

    // Override send to track outgoing messages
    const originalSend = ws.send;
    ws.send = function(...args) {
      metrics.recordWsMessage('outgoing', 'data');
      return originalSend.apply(ws, args);
    };
  });
}

/**
 * Service monitoring decorator
 */
export function monitorService(serviceManager) {
  // Override service methods to add monitoring
  const originalRegister = serviceManager.registerService;
  serviceManager.registerService = async function(...args) {
    try {
      const result = await originalRegister.apply(serviceManager, args);
      updateServiceMetrics(serviceManager);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const originalHealthCheck = serviceManager.checkServiceHealth;
  serviceManager.checkServiceHealth = async function(serviceId) {
    const service = serviceManager.getService(serviceId);
    const serviceName = service?.name || 'unknown';
    
    try {
      const result = await originalHealthCheck.apply(serviceManager, [serviceId]);
      metrics.recordServiceHealthCheck(serviceName, 'success');
      return result;
    } catch (error) {
      metrics.recordServiceHealthCheck(serviceName, 'failure');
      throw error;
    }
  };

  // Update metrics periodically
  setInterval(() => {
    updateServiceMetrics(serviceManager);
    updateServiceUptimes(serviceManager);
  }, 30000); // Every 30 seconds

  return serviceManager;
}

function updateServiceMetrics(serviceManager) {
  const services = serviceManager.listServices();
  const statusCounts = services.reduce((acc, service) => {
    acc[service.status] = (acc[service.status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(statusCounts).forEach(([status, count]) => {
    metrics.recordServiceStatus(status, count);
  });
}

function updateServiceUptimes(serviceManager) {
  const services = serviceManager.listServices();
  services.forEach(service => {
    if (service.startedAt) {
      const uptime = (Date.now() - new Date(service.startedAt).getTime()) / 1000;
      metrics.setServiceUptime(service.name, uptime);
    }
  });
}

/**
 * Event bus monitoring
 */
export function monitorEventBus(eventBus) {
  const originalPublish = eventBus.publish;
  eventBus.publish = async function(topic, data, options = {}) {
    const source = options.source || 'system';
    metrics.recordEventPublished(topic, source);
    return originalPublish.apply(eventBus, [topic, data, options]);
  };

  const originalSubscribe = eventBus.subscribe;
  eventBus.subscribe = async function(topic, handler, options = {}) {
    const wrappedHandler = async (event) => {
      const start = Date.now();
      try {
        const result = await handler(event);
        const duration = (Date.now() - start) / 1000;
        metrics.recordEventProcessing(topic, handler.name || 'anonymous', duration);
        return result;
      } catch (error) {
        const duration = (Date.now() - start) / 1000;
        metrics.recordEventProcessing(topic, handler.name || 'anonymous', duration);
        throw error;
      }
    };

    const result = await originalSubscribe.apply(eventBus, [topic, wrappedHandler, options]);
    updateEventSubscribers(eventBus);
    return result;
  };

  // Update subscriber counts periodically
  setInterval(() => {
    updateEventSubscribers(eventBus);
  }, 60000); // Every minute

  return eventBus;
}

function updateEventSubscribers(eventBus) {
  if (eventBus.subscribers) {
    eventBus.subscribers.forEach((handlers, topic) => {
      metrics.setEventSubscribers(topic, handlers.length);
    });
  }
}

/**
 * Analytics monitoring
 */
export function monitorAnalytics(analyticsEngine) {
  const originalTrack = analyticsEngine.track;
  analyticsEngine.track = async function(eventData) {
    try {
      const result = await originalTrack.apply(analyticsEngine, [eventData]);
      metrics.recordAnalyticsEvent(eventData.event, result.sampled !== false);
      return result;
    } catch (error) {
      throw error;
    }
  };

  // Monitor query methods
  const queryMethods = ['getMetrics', 'analyzeFunnel', 'analyzeCohorts', 'getUserAnalytics'];
  queryMethods.forEach(method => {
    if (analyticsEngine[method]) {
      const original = analyticsEngine[method];
      analyticsEngine[method] = async function(...args) {
        const start = Date.now();
        try {
          const result = await original.apply(analyticsEngine, args);
          const duration = (Date.now() - start) / 1000;
          metrics.recordAnalyticsQuery(method, duration);
          return result;
        } catch (error) {
          const duration = (Date.now() - start) / 1000;
          metrics.recordAnalyticsQuery(method, duration);
          throw error;
        }
      };
    }
  });

  return analyticsEngine;
}

/**
 * Pipeline monitoring
 */
export function monitorPipeline(dataPipeline) {
  const originalExecute = dataPipeline.executePipeline;
  dataPipeline.executePipeline = async function(pipelineId, options = {}) {
    const pipeline = dataPipeline.pipelines.get(pipelineId);
    const pipelineName = pipeline?.name || 'unknown';
    const start = Date.now();

    try {
      const result = await originalExecute.apply(dataPipeline, [pipelineId, options]);
      
      // Monitor execution completion
      const execution = dataPipeline.executions.get(result.executionId);
      if (execution) {
        execution.onComplete = () => {
          const duration = (Date.now() - start) / 1000;
          metrics.recordPipelineExecution(pipelineName, 'success');
          metrics.recordPipelineProcessingTime(pipelineName, duration);
          metrics.recordPipelineItems(pipelineName, 'processed', execution.processedCount || 0);
        };
        
        execution.onError = () => {
          const duration = (Date.now() - start) / 1000;
          metrics.recordPipelineExecution(pipelineName, 'failure');
          metrics.recordPipelineProcessingTime(pipelineName, duration);
        };
      }
      
      return result;
    } catch (error) {
      metrics.recordPipelineExecution(pipelineName, 'failure');
      throw error;
    }
  };

  return dataPipeline;
}

/**
 * Integration monitoring
 */
export function monitorIntegrations(integrationHub) {
  // Update integration metrics periodically
  setInterval(() => {
    const integrations = integrationHub.listIntegrations();
    const typeCounts = {};
    
    integrations.forEach(integration => {
      const key = `${integration.type}-${integration.status}`;
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });
    
    Object.entries(typeCounts).forEach(([key, count]) => {
      const [type, status] = key.split('-');
      metrics.setActiveIntegrations(type, status, count);
    });
  }, 60000); // Every minute

  // Monitor integration requests
  const originalHandleRequest = integrationHub.handleIntegrationRequest;
  if (originalHandleRequest) {
    integrationHub.handleIntegrationRequest = async function(integrationId, method, ...args) {
      const integration = integrationHub.getIntegration(integrationId);
      const integrationName = integration?.name || 'unknown';
      
      try {
        const result = await originalHandleRequest.apply(integrationHub, [integrationId, method, ...args]);
        metrics.recordIntegrationRequest(integrationName, method, 'success');
        return result;
      } catch (error) {
        metrics.recordIntegrationRequest(integrationName, method, 'failure');
        metrics.recordIntegrationError(integrationName, error.name || 'unknown');
        throw error;
      }
    };
  }

  return integrationHub;
}

/**
 * Database monitoring
 */
export function monitorDatabase(storageAdapters) {
  Object.entries(storageAdapters).forEach(([name, adapter]) => {
    // Monitor queries
    const queryMethods = ['search', 'store', 'get', 'update', 'delete', 'query'];
    
    queryMethods.forEach(method => {
      if (adapter[method]) {
        const original = adapter[method];
        adapter[method] = async function(...args) {
          const start = Date.now();
          try {
            const result = await original.apply(adapter, args);
            const duration = (Date.now() - start) / 1000;
            metrics.recordDbQuery(name, method, duration);
            return result;
          } catch (error) {
            const duration = (Date.now() - start) / 1000;
            metrics.recordDbQuery(name, method, duration);
            metrics.recordDbError(name, method, error.name || 'unknown');
            throw error;
          }
        };
      }
    });

    // Monitor connection pool if available
    if (adapter.pool) {
      setInterval(() => {
        const activeConnections = adapter.pool.numUsed() || 0;
        const totalConnections = adapter.pool.numFree() + activeConnections;
        metrics.setDbConnections(name, 'active', activeConnections);
        metrics.setDbConnections(name, 'total', totalConnections);
      }, 30000); // Every 30 seconds
    }
  });

  return storageAdapters;
}

/**
 * Business metrics monitoring
 */
export function recordBusinessMetrics(operation, status, value = null) {
  metrics.recordBusinessOperation(operation, status);
  
  if (value !== null) {
    metrics.setBusinessValue(operation, value);
  }
}