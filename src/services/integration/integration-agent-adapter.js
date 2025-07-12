import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Integration Agent Adapter - Bridges AutoWeave IntegrationAgent with Backend services
 */
class IntegrationAgentAdapter extends EventEmitter {
  constructor({ logger, eventBus, dataPipeline, serviceManager }) {
    super();
    this.logger = logger;
    this.eventBus = eventBus;
    this.dataPipeline = dataPipeline;
    this.serviceManager = serviceManager;
    
    // Store integration instances
    this.integrations = new Map();
    this.integrationAgents = new Map();
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for auto-integration
   */
  setupEventHandlers() {
    // Listen for new module discoveries
    this.eventBus.subscribe('integration.module.discovered', this.handleModuleDiscovery.bind(this));
    
    // Listen for integration requests
    this.eventBus.subscribe('integration.request.*', this.handleIntegrationRequest.bind(this));
    
    // Listen for OpenAPI spec updates
    this.eventBus.subscribe('integration.openapi.updated', this.handleOpenAPIUpdate.bind(this));
    
    // Listen for service registration events
    this.serviceManager.on('service:registered', this.handleServiceRegistered.bind(this));
  }

  /**
   * Handle module discovery event
   */
  async handleModuleDiscovery(event) {
    const { module, metadata } = event.data;
    
    this.logger.info(`New module discovered: ${module.name}`);
    
    try {
      // Check if module has OpenAPI spec
      if (metadata.openAPI) {
        await this.createIntegrationFromOpenAPI({
          name: module.name,
          openAPISpec: metadata.openAPI,
          module: module,
          autoRegister: true
        });
      }
      
      // Check if module has integration manifest
      if (metadata.integrationManifest) {
        await this.createIntegrationFromManifest({
          name: module.name,
          manifest: metadata.integrationManifest,
          module: module
        });
      }
      
      // Emit integration created event
      this.eventBus.publish('integration.created', {
        module: module.name,
        integrationId: module.integrationId,
        type: metadata.openAPI ? 'openapi' : 'manifest'
      });
      
    } catch (error) {
      this.logger.error(`Failed to create integration for module ${module.name}:`, error);
      
      this.eventBus.publish('integration.failed', {
        module: module.name,
        error: error.message
      });
    }
  }

  /**
   * Create integration from OpenAPI specification
   */
  async createIntegrationFromOpenAPI(config) {
    const { name, openAPISpec, module, autoRegister = false } = config;
    
    const integrationId = `integration-${name}-${uuidv4()}`;
    
    // Create integration configuration
    const integration = {
      id: integrationId,
      name: name,
      type: 'openapi',
      spec: openAPISpec,
      module: module,
      status: 'initializing',
      createdAt: new Date(),
      endpoints: this.extractEndpoints(openAPISpec),
      authentication: this.extractAuthentication(openAPISpec)
    };
    
    this.integrations.set(integrationId, integration);
    
    // Create data pipeline for integration
    await this.createIntegrationPipeline(integration);
    
    // Register as service if requested
    if (autoRegister) {
      await this.registerIntegrationService(integration);
    }
    
    // Setup monitoring
    await this.setupIntegrationMonitoring(integration);
    
    integration.status = 'active';
    
    this.logger.info(`Integration created from OpenAPI: ${integrationId}`);
    this.emit('integration:created', integration);
    
    return integration;
  }

  /**
   * Create integration from manifest
   */
  async createIntegrationFromManifest(config) {
    const { name, manifest, module } = config;
    
    const integrationId = `integration-${name}-${uuidv4()}`;
    
    const integration = {
      id: integrationId,
      name: name,
      type: 'manifest',
      manifest: manifest,
      module: module,
      status: 'initializing',
      createdAt: new Date(),
      capabilities: manifest.capabilities || [],
      dependencies: manifest.dependencies || []
    };
    
    this.integrations.set(integrationId, integration);
    
    // Process manifest capabilities
    for (const capability of integration.capabilities) {
      await this.registerCapability(integration, capability);
    }
    
    // Setup event subscriptions from manifest
    if (manifest.subscriptions) {
      for (const subscription of manifest.subscriptions) {
        this.eventBus.subscribe(subscription.topic, (event) => {
          this.handleIntegrationEvent(integration, subscription, event);
        });
      }
    }
    
    integration.status = 'active';
    
    this.logger.info(`Integration created from manifest: ${integrationId}`);
    this.emit('integration:created', integration);
    
    return integration;
  }

  /**
   * Create data pipeline for integration
   */
  async createIntegrationPipeline(integration) {
    const pipelineConfig = {
      name: `${integration.name}-sync-pipeline`,
      source: {
        type: 'integration',
        config: {
          integrationId: integration.id,
          endpoints: integration.endpoints
        }
      },
      destination: {
        type: 'qdrant',
        config: {
          collection: `integration_${integration.name}`,
          autoCreate: true
        }
      },
      processors: ['enrichmentProcessor', 'validationProcessor'],
      transformers: ['fieldMappingTransformer'],
      schedule: {
        interval: 300000 // 5 minutes
      }
    };
    
    // Register custom integration source adapter
    this.dataPipeline.storageAdapters['integration'] = new IntegrationSourceAdapter({
      integration,
      logger: this.logger
    });
    
    const pipelineId = await this.dataPipeline.registerPipeline(pipelineConfig);
    integration.pipelineId = pipelineId;
    
    return pipelineId;
  }

  /**
   * Register integration as a service
   */
  async registerIntegrationService(integration) {
    const serviceConfig = {
      name: `integration-${integration.name}`,
      version: integration.spec?.info?.version || '1.0.0',
      endpoints: integration.endpoints.map(ep => ({
        method: ep.method,
        path: ep.path,
        handler: this.createEndpointHandler(integration, ep)
      })),
      healthCheck: {
        interval: 30000,
        endpoint: '/health',
        handler: () => this.checkIntegrationHealth(integration)
      },
      metadata: {
        integrationId: integration.id,
        type: 'integration',
        openAPIVersion: integration.spec?.openapi
      }
    };
    
    const serviceId = await this.serviceManager.registerService(serviceConfig);
    integration.serviceId = serviceId;
    
    // Start service
    await this.serviceManager.startService(serviceId);
    
    return serviceId;
  }

  /**
   * Setup monitoring for integration
   */
  async setupIntegrationMonitoring(integration) {
    // Create monitoring configuration
    const monitoringConfig = {
      integrationId: integration.id,
      metrics: [
        {
          name: 'integration_requests_total',
          type: 'counter',
          labels: ['endpoint', 'method', 'status']
        },
        {
          name: 'integration_request_duration_seconds',
          type: 'histogram',
          labels: ['endpoint', 'method']
        },
        {
          name: 'integration_errors_total',
          type: 'counter',
          labels: ['endpoint', 'error_type']
        }
      ],
      alerts: [
        {
          name: 'high_error_rate',
          condition: 'rate(integration_errors_total[5m]) > 0.1',
          severity: 'warning'
        }
      ]
    };
    
    // Subscribe to integration events for monitoring
    this.eventBus.subscribe(`integration.${integration.id}.*`, (event) => {
      this.updateIntegrationMetrics(integration, event);
    });
    
    integration.monitoring = monitoringConfig;
  }

  /**
   * Handle integration request event
   */
  async handleIntegrationRequest(event) {
    const { integrationId, action, params } = event.data;
    
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    try {
      const result = await this.executeIntegrationAction(integration, action, params);
      
      // Reply to request
      await this.eventBus.reply(event, {
        success: true,
        result
      });
      
    } catch (error) {
      this.logger.error(`Integration request failed: ${integrationId}`, error);
      
      await this.eventBus.reply(event, {
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle OpenAPI specification update
   */
  async handleOpenAPIUpdate(event) {
    const { integrationId, openAPISpec } = event.data;
    
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      this.logger.warn(`Integration ${integrationId} not found for OpenAPI update`);
      return;
    }
    
    // Update integration
    integration.spec = openAPISpec;
    integration.endpoints = this.extractEndpoints(openAPISpec);
    integration.authentication = this.extractAuthentication(openAPISpec);
    integration.updatedAt = new Date();
    
    // Update service endpoints if registered
    if (integration.serviceId) {
      await this.updateIntegrationService(integration);
    }
    
    this.logger.info(`Integration ${integrationId} updated with new OpenAPI spec`);
    this.emit('integration:updated', integration);
  }

  /**
   * Handle service registered event
   */
  async handleServiceRegistered(service) {
    // Check if this is an external service that can be integrated
    if (service.metadata?.integratable) {
      this.logger.info(`Integratable service registered: ${service.name}`);
      
      // Attempt auto-discovery
      await this.discoverServiceIntegration(service);
    }
  }

  /**
   * Discover service integration capabilities
   */
  async discoverServiceIntegration(service) {
    try {
      // Check for OpenAPI endpoint
      if (service.metadata?.openAPIEndpoint) {
        const openAPISpec = await this.fetchOpenAPISpec(service.metadata.openAPIEndpoint);
        
        await this.createIntegrationFromOpenAPI({
          name: service.name,
          openAPISpec,
          module: { service },
          autoRegister: true
        });
      }
      
      // Check for GraphQL schema
      if (service.metadata?.graphQLEndpoint) {
        await this.createGraphQLIntegration(service);
      }
      
      // Check for gRPC reflection
      if (service.metadata?.grpcEndpoint) {
        await this.createGRPCIntegration(service);
      }
      
    } catch (error) {
      this.logger.error(`Failed to discover integration for service ${service.name}:`, error);
    }
  }

  /**
   * Extract endpoints from OpenAPI specification
   */
  extractEndpoints(openAPISpec) {
    const endpoints = [];
    
    if (openAPISpec.paths) {
      for (const [path, pathItem] of Object.entries(openAPISpec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
            endpoints.push({
              path,
              method: method.toUpperCase(),
              operationId: operation.operationId,
              summary: operation.summary,
              parameters: operation.parameters || [],
              requestBody: operation.requestBody,
              responses: operation.responses
            });
          }
        }
      }
    }
    
    return endpoints;
  }

  /**
   * Extract authentication from OpenAPI specification
   */
  extractAuthentication(openAPISpec) {
    const auth = {
      schemes: {},
      required: []
    };
    
    if (openAPISpec.components?.securitySchemes) {
      auth.schemes = openAPISpec.components.securitySchemes;
    }
    
    if (openAPISpec.security) {
      auth.required = openAPISpec.security;
    }
    
    return auth;
  }

  /**
   * Create endpoint handler for integration
   */
  createEndpointHandler(integration, endpoint) {
    return async (req, res) => {
      const startTime = Date.now();
      
      try {
        // Execute integration endpoint
        const result = await this.executeEndpoint(integration, endpoint, {
          params: req.params,
          query: req.query,
          body: req.body,
          headers: req.headers
        });
        
        // Update metrics
        this.eventBus.publish(`integration.${integration.id}.request`, {
          endpoint: endpoint.path,
          method: endpoint.method,
          duration: Date.now() - startTime,
          status: 'success'
        });
        
        res.json(result);
        
      } catch (error) {
        // Update error metrics
        this.eventBus.publish(`integration.${integration.id}.error`, {
          endpoint: endpoint.path,
          method: endpoint.method,
          error: error.message,
          type: error.constructor.name
        });
        
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      }
    };
  }

  /**
   * Execute integration endpoint
   */
  async executeEndpoint(integration, endpoint, request) {
    // This would be implemented based on the integration type
    // For now, we'll create a placeholder
    return {
      integration: integration.name,
      endpoint: endpoint.path,
      method: endpoint.method,
      timestamp: new Date(),
      request: request
    };
  }

  /**
   * Check integration health
   */
  async checkIntegrationHealth(integration) {
    const health = {
      status: 'healthy',
      checks: {}
    };
    
    // Check pipeline health
    if (integration.pipelineId) {
      try {
        const pipelineStatus = this.dataPipeline.getPipelineStatus(integration.pipelineId);
        health.checks.pipeline = {
          status: pipelineStatus.enabled ? 'healthy' : 'unhealthy',
          lastRun: pipelineStatus.lastRun
        };
      } catch (error) {
        health.checks.pipeline = {
          status: 'error',
          error: error.message
        };
      }
    }
    
    // Check service health
    if (integration.serviceId) {
      const service = this.serviceManager.getService(integration.serviceId);
      health.checks.service = {
        status: service?.status === 'running' ? 'healthy' : 'unhealthy',
        uptime: service?.startedAt ? Date.now() - service.startedAt.getTime() : 0
      };
    }
    
    // Overall health
    const unhealthyChecks = Object.values(health.checks).filter(
      check => check.status !== 'healthy'
    );
    
    if (unhealthyChecks.length > 0) {
      health.status = 'unhealthy';
    }
    
    return health;
  }

  /**
   * Get all integrations
   */
  getAllIntegrations() {
    return Array.from(this.integrations.values());
  }

  /**
   * Get integration by ID
   */
  getIntegration(integrationId) {
    return this.integrations.get(integrationId);
  }

  /**
   * Delete integration
   */
  async deleteIntegration(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    // Stop pipeline
    if (integration.pipelineId) {
      await this.dataPipeline.deletePipeline(integration.pipelineId);
    }
    
    // Stop service
    if (integration.serviceId) {
      await this.serviceManager.deregisterService(integration.serviceId);
    }
    
    // Remove integration
    this.integrations.delete(integrationId);
    
    this.logger.info(`Integration deleted: ${integrationId}`);
    this.emit('integration:deleted', { integrationId });
  }
}

/**
 * Integration Source Adapter for Data Pipeline
 */
class IntegrationSourceAdapter {
  constructor({ integration, logger }) {
    this.integration = integration;
    this.logger = logger;
  }

  async createCursor(config) {
    const endpoints = config.endpoints || this.integration.endpoints;
    let currentIndex = 0;
    
    return {
      async next(batchSize) {
        if (currentIndex >= endpoints.length) {
          return [];
        }
        
        const batch = endpoints.slice(currentIndex, currentIndex + batchSize);
        currentIndex += batch.length;
        
        // Transform endpoints to data items
        return batch.map(endpoint => ({
          id: `${this.integration.id}-${endpoint.operationId || endpoint.path}`,
          type: 'endpoint',
          integration: this.integration.name,
          endpoint: endpoint.path,
          method: endpoint.method,
          metadata: {
            operationId: endpoint.operationId,
            summary: endpoint.summary
          }
        }));
      }
    };
  }

  async healthCheck() {
    return { 
      healthy: true, 
      type: 'integration',
      integration: this.integration.name 
    };
  }
}

export default IntegrationAgentAdapter;