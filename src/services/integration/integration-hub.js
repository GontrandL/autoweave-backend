import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import IntegrationAgentAdapter from './integration-agent-adapter.js';

/**
 * Integration Hub - Central hub for managing all integrations
 */
class IntegrationHub extends EventEmitter {
  constructor({ logger, config, eventBus, dataPipeline, serviceManager }) {
    super();
    this.logger = logger;
    this.config = config;
    this.eventBus = eventBus;
    this.dataPipeline = dataPipeline;
    this.serviceManager = serviceManager;
    
    // Initialize adapter
    this.adapter = new IntegrationAgentAdapter({
      logger,
      eventBus,
      dataPipeline,
      serviceManager
    });
    
    // Integration registry
    this.registry = new Map();
    this.plugins = new Map();
    this.webhooks = new Map();
    
    // Metrics
    this.metrics = {
      totalIntegrations: 0,
      activeIntegrations: 0,
      totalRequests: 0,
      totalErrors: 0,
      requestsByIntegration: new Map()
    };
    
    this.setupEventHandlers();
    this.startAutoDiscovery();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Forward adapter events
    this.adapter.on('integration:created', (integration) => {
      this.emit('integration:created', integration);
      this.metrics.totalIntegrations++;
      this.metrics.activeIntegrations++;
    });
    
    this.adapter.on('integration:updated', (integration) => {
      this.emit('integration:updated', integration);
    });
    
    this.adapter.on('integration:deleted', (data) => {
      this.emit('integration:deleted', data);
      this.metrics.activeIntegrations--;
    });
    
    // Listen for integration events
    this.eventBus.subscribe('integration.*', this.handleIntegrationEvent.bind(this));
  }

  /**
   * Start auto-discovery process
   */
  startAutoDiscovery() {
    if (!this.config.autoIntegration?.enabled) return;
    
    const scanInterval = this.config.autoIntegration?.scanInterval || 300000; // 5 minutes
    
    // Initial scan
    this.scanForIntegrations();
    
    // Schedule periodic scans
    this.scanIntervalId = setInterval(() => {
      this.scanForIntegrations();
    }, scanInterval);
    
    this.logger.info('Auto-discovery started');
  }

  /**
   * Scan for new integrations
   */
  async scanForIntegrations() {
    this.logger.debug('Scanning for new integrations...');
    
    try {
      // Scan registered services
      const services = this.serviceManager.listServices();
      
      for (const service of services) {
        if (service.metadata?.integratable && !this.isServiceIntegrated(service)) {
          await this.integrateService(service);
        }
      }
      
      // Scan for plugins
      await this.scanForPlugins();
      
      // Scan for webhook configurations
      await this.scanForWebhooks();
      
      this.logger.debug(`Scan complete. Active integrations: ${this.metrics.activeIntegrations}`);
      
    } catch (error) {
      this.logger.error('Integration scan failed:', error);
    }
  }

  /**
   * Register a new integration
   */
  async registerIntegration(integrationConfig) {
    const { name, type, config } = integrationConfig;
    
    if (!name || !type) {
      throw new Error('Integration name and type are required');
    }
    
    const integrationId = `hub-${type}-${uuidv4()}`;
    
    const integration = {
      id: integrationId,
      name,
      type,
      config,
      status: 'initializing',
      createdAt: new Date(),
      metrics: {
        requests: 0,
        errors: 0,
        lastRequest: null,
        avgResponseTime: 0
      }
    };
    
    // Type-specific initialization
    switch (type) {
      case 'openapi':
        if (!config.openAPISpec) {
          throw new Error('OpenAPI specification is required');
        }
        await this.adapter.createIntegrationFromOpenAPI({
          name,
          openAPISpec: config.openAPISpec,
          module: integration,
          autoRegister: config.autoRegister !== false
        });
        break;
        
      case 'webhook':
        await this.registerWebhook(integration);
        break;
        
      case 'plugin':
        await this.registerPlugin(integration);
        break;
        
      case 'database':
        await this.registerDatabaseIntegration(integration);
        break;
        
      case 'message-queue':
        await this.registerMessageQueueIntegration(integration);
        break;
        
      default:
        throw new Error(`Unknown integration type: ${type}`);
    }
    
    // Store in registry
    this.registry.set(integrationId, integration);
    
    // Update status
    integration.status = 'active';
    
    this.logger.info(`Integration registered: ${name} (${integrationId})`);
    this.emit('integration:registered', integration);
    
    return integrationId;
  }

  /**
   * Register webhook integration
   */
  async registerWebhook(integration) {
    const { url, events, secret, headers } = integration.config;
    
    const webhook = {
      id: integration.id,
      url,
      events: events || ['*'],
      secret,
      headers: headers || {},
      active: true,
      deliveries: []
    };
    
    this.webhooks.set(integration.id, webhook);
    
    // Subscribe to specified events
    for (const event of webhook.events) {
      this.eventBus.subscribe(event, async (eventData) => {
        await this.deliverWebhook(webhook, eventData);
      });
    }
    
    integration.webhook = webhook;
  }

  /**
   * Register plugin integration
   */
  async registerPlugin(integration) {
    const { source, name: pluginName, version } = integration.config;
    
    const plugin = {
      id: integration.id,
      source,
      name: pluginName,
      version,
      status: 'loading',
      instance: null
    };
    
    try {
      // Load plugin based on source
      if (source === 'npm') {
        plugin.instance = await this.loadNpmPlugin(pluginName, version);
      } else if (source === 'local') {
        plugin.instance = await this.loadLocalPlugin(integration.config.path);
      } else if (source === 'url') {
        plugin.instance = await this.loadRemotePlugin(integration.config.url);
      }
      
      // Initialize plugin
      if (plugin.instance && typeof plugin.instance.initialize === 'function') {
        await plugin.instance.initialize({
          eventBus: this.eventBus,
          logger: this.logger,
          config: integration.config.pluginConfig || {}
        });
      }
      
      plugin.status = 'active';
      this.plugins.set(integration.id, plugin);
      
      integration.plugin = plugin;
      
    } catch (error) {
      plugin.status = 'error';
      plugin.error = error.message;
      throw error;
    }
  }

  /**
   * Register database integration
   */
  async registerDatabaseIntegration(integration) {
    const { dbType, connectionString, options } = integration.config;
    
    // Create database adapter based on type
    let adapter;
    switch (dbType) {
      case 'postgres':
        adapter = await this.createPostgresAdapter(connectionString, options);
        break;
      case 'mongodb':
        adapter = await this.createMongoAdapter(connectionString, options);
        break;
      case 'mysql':
        adapter = await this.createMySQLAdapter(connectionString, options);
        break;
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
    
    // Register as data pipeline source/destination
    this.dataPipeline.storageAdapters[`db-${integration.id}`] = adapter;
    
    // Create sync pipeline if requested
    if (integration.config.syncEnabled) {
      const pipelineId = await this.dataPipeline.registerPipeline({
        name: `${integration.name}-sync`,
        source: {
          type: `db-${integration.id}`,
          config: integration.config.sourceConfig || {}
        },
        destination: {
          type: integration.config.syncDestination || 'qdrant',
          config: integration.config.destinationConfig || {}
        },
        schedule: integration.config.syncSchedule
      });
      
      integration.pipelineId = pipelineId;
    }
    
    integration.adapter = adapter;
  }

  /**
   * Register message queue integration
   */
  async registerMessageQueueIntegration(integration) {
    const { mqType, connectionConfig, topics } = integration.config;
    
    let mqClient;
    switch (mqType) {
      case 'kafka':
        mqClient = await this.createKafkaClient(connectionConfig);
        break;
      case 'rabbitmq':
        mqClient = await this.createRabbitMQClient(connectionConfig);
        break;
      case 'redis-streams':
        mqClient = await this.createRedisStreamsClient(connectionConfig);
        break;
      default:
        throw new Error(`Unsupported message queue type: ${mqType}`);
    }
    
    // Subscribe to topics
    if (topics && topics.length > 0) {
      for (const topic of topics) {
        await mqClient.subscribe(topic, async (message) => {
          await this.handleMessageQueueMessage(integration, topic, message);
        });
      }
    }
    
    integration.mqClient = mqClient;
  }

  /**
   * Enable integration
   */
  async enableIntegration(integrationId) {
    const integration = this.registry.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    if (integration.status === 'active') {
      return; // Already active
    }
    
    // Type-specific enable logic
    switch (integration.type) {
      case 'webhook':
        const webhook = this.webhooks.get(integrationId);
        if (webhook) webhook.active = true;
        break;
        
      case 'plugin':
        const plugin = this.plugins.get(integrationId);
        if (plugin && plugin.instance && typeof plugin.instance.enable === 'function') {
          await plugin.instance.enable();
        }
        break;
        
      default:
        // Generic enable
        if (integration.pipelineId) {
          await this.dataPipeline.resumePipeline(integration.pipelineId);
        }
    }
    
    integration.status = 'active';
    
    this.logger.info(`Integration enabled: ${integrationId}`);
    this.emit('integration:enabled', { integrationId });
  }

  /**
   * Disable integration
   */
  async disableIntegration(integrationId) {
    const integration = this.registry.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    if (integration.status === 'disabled') {
      return; // Already disabled
    }
    
    // Type-specific disable logic
    switch (integration.type) {
      case 'webhook':
        const webhook = this.webhooks.get(integrationId);
        if (webhook) webhook.active = false;
        break;
        
      case 'plugin':
        const plugin = this.plugins.get(integrationId);
        if (plugin && plugin.instance && typeof plugin.instance.disable === 'function') {
          await plugin.instance.disable();
        }
        break;
        
      default:
        // Generic disable
        if (integration.pipelineId) {
          await this.dataPipeline.pausePipeline(integration.pipelineId);
        }
    }
    
    integration.status = 'disabled';
    
    this.logger.info(`Integration disabled: ${integrationId}`);
    this.emit('integration:disabled', { integrationId });
  }

  /**
   * Test integration connection
   */
  async testIntegration(integrationId) {
    const integration = this.registry.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    const result = {
      success: false,
      message: '',
      details: {}
    };
    
    try {
      switch (integration.type) {
        case 'webhook':
          result.success = await this.testWebhook(integration);
          result.message = result.success ? 'Webhook is reachable' : 'Webhook test failed';
          break;
          
        case 'database':
          result.success = await integration.adapter.healthCheck();
          result.message = result.success ? 'Database connection successful' : 'Database connection failed';
          break;
          
        case 'plugin':
          const plugin = this.plugins.get(integrationId);
          result.success = plugin && plugin.status === 'active';
          result.message = result.success ? 'Plugin is active' : 'Plugin is not active';
          result.details = { status: plugin?.status };
          break;
          
        default:
          result.success = integration.status === 'active';
          result.message = `Integration is ${integration.status}`;
      }
      
    } catch (error) {
      result.success = false;
      result.message = error.message;
      result.details.error = error.stack;
    }
    
    return result;
  }

  /**
   * Execute integration action
   */
  async executeAction(integrationId, action, params) {
    const integration = this.registry.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    if (integration.status !== 'active') {
      throw new Error(`Integration ${integrationId} is not active`);
    }
    
    // Update metrics
    integration.metrics.requests++;
    this.metrics.totalRequests++;
    
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (integration.type) {
        case 'plugin':
          const plugin = this.plugins.get(integrationId);
          if (!plugin || !plugin.instance) {
            throw new Error('Plugin not loaded');
          }
          if (typeof plugin.instance[action] !== 'function') {
            throw new Error(`Action ${action} not found in plugin`);
          }
          result = await plugin.instance[action](params);
          break;
          
        case 'database':
          result = await this.executeDatabaseAction(integration, action, params);
          break;
          
        case 'webhook':
          result = await this.executeWebhookAction(integration, action, params);
          break;
          
        default:
          // Delegate to adapter
          result = await this.adapter.executeIntegrationAction(integration, action, params);
      }
      
      // Update metrics
      const duration = Date.now() - startTime;
      integration.metrics.lastRequest = new Date();
      integration.metrics.avgResponseTime = 
        (integration.metrics.avgResponseTime * (integration.metrics.requests - 1) + duration) / 
        integration.metrics.requests;
      
      return result;
      
    } catch (error) {
      integration.metrics.errors++;
      this.metrics.totalErrors++;
      throw error;
    }
  }

  /**
   * Get integration metrics
   */
  async getIntegrationMetrics(integrationId, period = '1h') {
    const integration = this.registry.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    const metrics = {
      ...integration.metrics,
      period,
      health: await this.testIntegration(integrationId)
    };
    
    // Add type-specific metrics
    switch (integration.type) {
      case 'webhook':
        const webhook = this.webhooks.get(integrationId);
        metrics.webhook = {
          deliveries: webhook.deliveries.length,
          recentDeliveries: webhook.deliveries.slice(-10)
        };
        break;
        
      case 'database':
        if (integration.pipelineId) {
          metrics.pipeline = this.dataPipeline.getPipelineStatus(integration.pipelineId);
        }
        break;
    }
    
    return metrics;
  }

  /**
   * Update integration configuration
   */
  async updateIntegrationConfig(integrationId, config) {
    const integration = this.registry.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    // Validate config based on type
    this.validateIntegrationConfig(integration.type, config);
    
    // Update config
    integration.config = {
      ...integration.config,
      ...config
    };
    
    integration.updatedAt = new Date();
    
    // Apply configuration changes
    await this.applyConfigChanges(integration);
    
    this.logger.info(`Integration configuration updated: ${integrationId}`);
    this.emit('integration:updated', integration);
  }

  /**
   * Delete integration
   */
  async deleteIntegration(integrationId) {
    const integration = this.registry.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    // Disable first
    await this.disableIntegration(integrationId);
    
    // Type-specific cleanup
    switch (integration.type) {
      case 'webhook':
        this.webhooks.delete(integrationId);
        break;
        
      case 'plugin':
        const plugin = this.plugins.get(integrationId);
        if (plugin && plugin.instance && typeof plugin.instance.destroy === 'function') {
          await plugin.instance.destroy();
        }
        this.plugins.delete(integrationId);
        break;
        
      case 'database':
        if (integration.adapter && typeof integration.adapter.close === 'function') {
          await integration.adapter.close();
        }
        delete this.dataPipeline.storageAdapters[`db-${integrationId}`];
        break;
    }
    
    // Remove from registry
    this.registry.delete(integrationId);
    
    // If it's an adapter integration, delete it there too
    if (integration.module) {
      await this.adapter.deleteIntegration(integrationId);
    }
    
    this.logger.info(`Integration deleted: ${integrationId}`);
    this.emit('integration:deleted', { integrationId });
  }

  /**
   * List integrations with filters
   */
  listIntegrations(filters = {}) {
    let integrations = Array.from(this.registry.values());
    
    // Add adapter integrations
    const adapterIntegrations = this.adapter.getAllIntegrations();
    integrations = [...integrations, ...adapterIntegrations];
    
    // Apply filters
    if (filters.type) {
      integrations = integrations.filter(i => i.type === filters.type);
    }
    
    if (filters.status) {
      integrations = integrations.filter(i => i.status === filters.status);
    }
    
    if (filters.tag) {
      integrations = integrations.filter(i => 
        i.tags && i.tags.includes(filters.tag)
      );
    }
    
    return integrations;
  }

  /**
   * Get integration by ID
   */
  getIntegration(integrationId) {
    // Check local registry first
    let integration = this.registry.get(integrationId);
    
    // Check adapter if not found
    if (!integration) {
      integration = this.adapter.getIntegration(integrationId);
    }
    
    return integration;
  }

  /**
   * Discover available integrations
   */
  async discoverAvailable() {
    const available = [];
    
    // Discover from package registries
    try {
      const npmIntegrations = await this.discoverNpmIntegrations();
      available.push(...npmIntegrations);
    } catch (error) {
      this.logger.warn('Failed to discover NPM integrations:', error);
    }
    
    // Discover from integration marketplaces
    try {
      const marketplaceIntegrations = await this.discoverMarketplaceIntegrations();
      available.push(...marketplaceIntegrations);
    } catch (error) {
      this.logger.warn('Failed to discover marketplace integrations:', error);
    }
    
    // Discover local integrations
    try {
      const localIntegrations = await this.discoverLocalIntegrations();
      available.push(...localIntegrations);
    } catch (error) {
      this.logger.warn('Failed to discover local integrations:', error);
    }
    
    return available;
  }

  /**
   * Install integration from source
   */
  async installIntegration({ source, name, version }) {
    this.logger.info(`Installing integration: ${name}@${version} from ${source}`);
    
    let integrationConfig;
    
    switch (source) {
      case 'npm':
        integrationConfig = await this.installNpmIntegration(name, version);
        break;
        
      case 'github':
        integrationConfig = await this.installGithubIntegration(name, version);
        break;
        
      case 'url':
        integrationConfig = await this.installUrlIntegration(name, version);
        break;
        
      default:
        throw new Error(`Unknown integration source: ${source}`);
    }
    
    // Register the installed integration
    return await this.registerIntegration(integrationConfig);
  }

  /**
   * Get integration logs
   */
  async getIntegrationLogs(integrationId, options = {}) {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    const logs = [];
    
    // Collect logs based on integration type
    // This would integrate with your logging system
    
    return logs;
  }

  /**
   * Sync integration data
   */
  async syncIntegration(integrationId, options = {}) {
    const integration = this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }
    
    const startTime = Date.now();
    let synced = 0;
    
    try {
      if (integration.pipelineId) {
        // Execute pipeline for sync
        const result = await this.dataPipeline.executePipeline(
          integration.pipelineId,
          { force: options.full }
        );
        synced = result.processed;
      } else {
        // Manual sync based on type
        switch (integration.type) {
          case 'database':
            synced = await this.syncDatabaseIntegration(integration, options);
            break;
            
          case 'webhook':
            synced = await this.syncWebhookIntegration(integration, options);
            break;
            
          default:
            throw new Error('Sync not supported for this integration type');
        }
      }
      
      const duration = Date.now() - startTime;
      
      this.logger.info(`Integration sync completed: ${integrationId}`, {
        synced,
        duration
      });
      
      return { synced, duration };
      
    } catch (error) {
      this.logger.error(`Integration sync failed: ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Handle integration event
   */
  async handleIntegrationEvent(event) {
    // Update global metrics
    const topic = event.topic;
    
    if (topic.includes('.request')) {
      this.metrics.totalRequests++;
    } else if (topic.includes('.error')) {
      this.metrics.totalErrors++;
    }
  }

  /**
   * Stop the integration hub
   */
  async stop() {
    // Clear auto-discovery interval
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }
    
    // Disable all active integrations
    for (const integration of this.registry.values()) {
      if (integration.status === 'active') {
        try {
          await this.disableIntegration(integration.id);
        } catch (error) {
          this.logger.error(`Failed to disable integration ${integration.id}:`, error);
        }
      }
    }
    
    this.logger.info('Integration hub stopped');
    this.emit('stopped');
  }

  // Helper methods would be implemented here...
  isServiceIntegrated(service) {
    return Array.from(this.registry.values()).some(
      i => i.serviceId === service.id
    );
  }

  validateIntegrationConfig(type, config) {
    // Validation logic based on type
    return true;
  }

  async applyConfigChanges(integration) {
    // Apply configuration changes based on type
  }

  async testWebhook(integration) {
    // Test webhook connectivity
    return true;
  }

  async deliverWebhook(webhook, eventData) {
    // Deliver webhook
  }

  // Placeholder methods for different integration types
  async loadNpmPlugin(name, version) { return {}; }
  async loadLocalPlugin(path) { return {}; }
  async loadRemotePlugin(url) { return {}; }
  async createPostgresAdapter(conn, opts) { return {}; }
  async createMongoAdapter(conn, opts) { return {}; }
  async createMySQLAdapter(conn, opts) { return {}; }
  async createKafkaClient(config) { return {}; }
  async createRabbitMQClient(config) { return {}; }
  async createRedisStreamsClient(config) { return {}; }
  async executeDatabaseAction(integration, action, params) { return {}; }
  async executeWebhookAction(integration, action, params) { return {}; }
  async discoverNpmIntegrations() { return []; }
  async discoverMarketplaceIntegrations() { return []; }
  async discoverLocalIntegrations() { return []; }
  async installNpmIntegration(name, version) { return {}; }
  async installGithubIntegration(name, version) { return {}; }
  async installUrlIntegration(name, version) { return {}; }
  async syncDatabaseIntegration(integration, options) { return 0; }
  async syncWebhookIntegration(integration, options) { return 0; }
  async scanForPlugins() {}
  async scanForWebhooks() {}
  async integrateService(service) {}
  async handleMessageQueueMessage(integration, topic, message) {}
}

export default IntegrationHub;