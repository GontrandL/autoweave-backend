import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import pRetry from 'p-retry';
import ServiceRegistry from './service-registry.js';

/**
 * Service Manager - Manages lifecycle of all backend services
 */
class ServiceManager extends EventEmitter {
  constructor({ logger, config }) {
    super();
    this.logger = logger;
    this.config = config;
    this.registry = new ServiceRegistry({ logger });
    this.services = new Map();
    this.healthChecks = new Map();
    this.circuitBreakers = new Map();
  }

  /**
   * Register a new service
   * @param {Object} serviceConfig - Service configuration
   * @returns {string} Service ID
   */
  async registerService(serviceConfig) {
    const serviceId = serviceConfig.id || uuidv4();
    const service = {
      id: serviceId,
      name: serviceConfig.name,
      version: serviceConfig.version || '1.0.0',
      endpoints: serviceConfig.endpoints || [],
      healthCheck: serviceConfig.healthCheck,
      dependencies: serviceConfig.dependencies || [],
      metadata: serviceConfig.metadata || {},
      status: 'initializing',
      startedAt: null,
      lastHealthCheck: null,
      metrics: {
        requests: 0,
        errors: 0,
        latency: []
      }
    };

    // Validate dependencies
    for (const dep of service.dependencies) {
      if (!this.services.has(dep) && !this.registry.getService(dep)) {
        throw new Error(`Dependency ${dep} not found`);
      }
    }

    // Register in registry
    await this.registry.register(service);
    this.services.set(serviceId, service);

    // Initialize circuit breaker
    this.circuitBreakers.set(serviceId, {
      state: 'closed',
      failures: 0,
      successThreshold: 3,
      failureThreshold: 5,
      timeout: 30000,
      resetTimeout: 60000,
      lastFailure: null
    });

    // Setup health check
    if (service.healthCheck) {
      this.setupHealthCheck(serviceId);
    }

    this.logger.info(`Service registered: ${service.name} (${serviceId})`);
    this.emit('service:registered', service);

    return serviceId;
  }

  /**
   * Start a service
   * @param {string} serviceId - Service ID
   */
  async startService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    try {
      // Check dependencies
      for (const dep of service.dependencies) {
        const depService = this.services.get(dep) || this.registry.getService(dep);
        if (!depService || depService.status !== 'running') {
          throw new Error(`Dependency ${dep} is not running`);
        }
      }

      // Start service (custom start logic would go here)
      service.status = 'starting';
      this.emit('service:starting', service);

      // Simulate service startup
      await new Promise(resolve => setTimeout(resolve, 1000));

      service.status = 'running';
      service.startedAt = new Date();
      
      this.logger.info(`Service started: ${service.name}`);
      this.emit('service:started', service);

      // Update registry
      await this.registry.update(serviceId, service);

    } catch (error) {
      service.status = 'failed';
      this.logger.error(`Failed to start service ${service.name}:`, error);
      this.emit('service:failed', { service, error });
      throw error;
    }
  }

  /**
   * Stop a service
   * @param {string} serviceId - Service ID
   */
  async stopService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    try {
      service.status = 'stopping';
      this.emit('service:stopping', service);

      // Stop health check
      const healthCheck = this.healthChecks.get(serviceId);
      if (healthCheck) {
        clearInterval(healthCheck);
        this.healthChecks.delete(serviceId);
      }

      // Custom stop logic would go here
      await new Promise(resolve => setTimeout(resolve, 500));

      service.status = 'stopped';
      service.stoppedAt = new Date();
      
      this.logger.info(`Service stopped: ${service.name}`);
      this.emit('service:stopped', service);

      // Update registry
      await this.registry.update(serviceId, service);

    } catch (error) {
      this.logger.error(`Failed to stop service ${service.name}:`, error);
      throw error;
    }
  }

  /**
   * Setup health check for a service
   * @param {string} serviceId - Service ID
   */
  setupHealthCheck(serviceId) {
    const service = this.services.get(serviceId);
    if (!service || !service.healthCheck) return;

    const interval = service.healthCheck.interval || 30000;
    const timeout = service.healthCheck.timeout || 5000;

    const healthCheckFn = async () => {
      try {
        const start = Date.now();
        
        // Execute health check
        const result = await pRetry(
          async () => {
            // Custom health check logic would go here
            // For now, simulate a health check
            if (Math.random() > 0.95) {
              throw new Error('Health check failed');
            }
            return { status: 'healthy' };
          },
          {
            retries: 2,
            minTimeout: 1000,
            maxTimeout: timeout
          }
        );

        const latency = Date.now() - start;
        service.metrics.latency.push(latency);
        
        // Keep only last 100 latency measurements
        if (service.metrics.latency.length > 100) {
          service.metrics.latency.shift();
        }

        service.lastHealthCheck = {
          timestamp: new Date(),
          status: 'healthy',
          latency,
          details: result
        };

        // Update circuit breaker
        this.updateCircuitBreaker(serviceId, true);

        this.emit('service:health', {
          serviceId,
          health: service.lastHealthCheck
        });

      } catch (error) {
        service.lastHealthCheck = {
          timestamp: new Date(),
          status: 'unhealthy',
          error: error.message
        };

        // Update circuit breaker
        this.updateCircuitBreaker(serviceId, false);

        this.logger.warn(`Health check failed for ${service.name}:`, error.message);
        this.emit('service:unhealthy', {
          serviceId,
          error
        });
      }
    };

    // Run initial health check
    healthCheckFn();

    // Schedule periodic health checks
    const intervalId = setInterval(healthCheckFn, interval);
    this.healthChecks.set(serviceId, intervalId);
  }

  /**
   * Update circuit breaker state
   * @param {string} serviceId - Service ID
   * @param {boolean} success - Whether the operation was successful
   */
  updateCircuitBreaker(serviceId, success) {
    const breaker = this.circuitBreakers.get(serviceId);
    if (!breaker) return;

    if (success) {
      if (breaker.state === 'half-open') {
        breaker.failures = 0;
        breaker.state = 'closed';
        this.logger.info(`Circuit breaker closed for service ${serviceId}`);
      }
    } else {
      breaker.failures++;
      breaker.lastFailure = new Date();

      if (breaker.failures >= breaker.failureThreshold) {
        breaker.state = 'open';
        this.logger.warn(`Circuit breaker opened for service ${serviceId}`);
        
        // Schedule reset to half-open
        setTimeout(() => {
          breaker.state = 'half-open';
          this.logger.info(`Circuit breaker half-open for service ${serviceId}`);
        }, breaker.resetTimeout);
      }
    }
  }

  /**
   * Check if service is available (considering circuit breaker)
   * @param {string} serviceId - Service ID
   * @returns {boolean} Service availability
   */
  isServiceAvailable(serviceId) {
    const service = this.services.get(serviceId);
    if (!service || service.status !== 'running') {
      return false;
    }

    const breaker = this.circuitBreakers.get(serviceId);
    if (breaker && breaker.state === 'open') {
      return false;
    }

    return true;
  }

  /**
   * Get service health status
   * @returns {Object} Health status of all services
   */
  getHealthStatus() {
    const status = {};
    
    for (const [id, service] of this.services) {
      status[service.name] = {
        id,
        status: service.status,
        health: service.lastHealthCheck,
        circuitBreaker: this.circuitBreakers.get(id)?.state || 'unknown',
        uptime: service.startedAt ? Date.now() - service.startedAt.getTime() : 0,
        metrics: {
          requests: service.metrics.requests,
          errors: service.metrics.errors,
          averageLatency: service.metrics.latency.length > 0
            ? service.metrics.latency.reduce((a, b) => a + b, 0) / service.metrics.latency.length
            : 0
        }
      };
    }
    
    return status;
  }

  /**
   * Start all registered services
   */
  async startAll() {
    const services = Array.from(this.services.values());
    
    // Sort by dependencies
    const sorted = this.topologicalSort(services);
    
    for (const service of sorted) {
      if (service.status !== 'running') {
        await this.startService(service.id);
      }
    }
  }

  /**
   * Stop all services
   */
  async stopAll() {
    const services = Array.from(this.services.values());
    
    // Stop in reverse dependency order
    const sorted = this.topologicalSort(services).reverse();
    
    for (const service of sorted) {
      if (service.status === 'running') {
        await this.stopService(service.id);
      }
    }
  }

  /**
   * Topological sort for dependency resolution
   * @param {Array} services - Array of services
   * @returns {Array} Sorted services
   */
  topologicalSort(services) {
    const visited = new Set();
    const result = [];
    
    const visit = (service) => {
      if (visited.has(service.id)) return;
      visited.add(service.id);
      
      for (const dep of service.dependencies) {
        const depService = services.find(s => s.id === dep);
        if (depService) {
          visit(depService);
        }
      }
      
      result.push(service);
    };
    
    for (const service of services) {
      visit(service);
    }
    
    return result;
  }

  /**
   * Get service by ID
   * @param {string} serviceId - Service ID
   * @returns {Object} Service object
   */
  getService(serviceId) {
    return this.services.get(serviceId);
  }

  /**
   * List all services
   * @returns {Array} Array of services
   */
  listServices() {
    return Array.from(this.services.values());
  }

  /**
   * Deregister a service
   * @param {string} serviceId - Service ID
   */
  async deregisterService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    // Stop service if running
    if (service.status === 'running') {
      await this.stopService(serviceId);
    }

    // Remove from registry
    await this.registry.deregister(serviceId);
    
    // Clean up
    this.services.delete(serviceId);
    this.circuitBreakers.delete(serviceId);
    
    this.logger.info(`Service deregistered: ${service.name}`);
    this.emit('service:deregistered', service);
  }
}

export default ServiceManager;