import { EventEmitter } from 'eventemitter3';
import WebSocket from 'ws';
import fetch from 'node-fetch';

/**
 * AutoWeave Core Connector - Bridges backend services with AutoWeave Core
 */
class AutoWeaveCoreConnector extends EventEmitter {
  constructor({ logger, config, eventBus, serviceManager }) {
    super();
    this.logger = logger;
    this.config = config;
    this.eventBus = eventBus;
    this.serviceManager = serviceManager;
    
    // Connection state
    this.connected = false;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    
    // Core endpoints
    this.coreBaseUrl = config.autoweaveCore?.baseUrl || 'http://localhost:3000';
    this.coreWsUrl = config.autoweaveCore?.wsUrl || 'ws://localhost:3000/ws';
    this.anpServerUrl = config.autoweaveCore?.anpServerUrl || 'http://localhost:8083';
    
    // Event synchronization
    this.eventForwarders = new Map();
    this.pendingRequests = new Map();
    
    // Service registration
    this.registeredServices = new Map();
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Forward specific events to AutoWeave Core
    const eventsToForward = [
      'agent.created',
      'agent.deployed',
      'agent.status.changed',
      'integration.created',
      'integration.updated',
      'memory.updated',
      'analytics.insight'
    ];
    
    for (const eventPattern of eventsToForward) {
      this.eventBus.subscribe(eventPattern, (event) => {
        this.forwardEventToCore(eventPattern, event);
      });
    }
    
    // Listen for events from Core
    this.on('core:event', this.handleCoreEvent.bind(this));
  }

  /**
   * Connect to AutoWeave Core
   */
  async connect() {
    this.logger.info('Connecting to AutoWeave Core...');
    
    try {
      // Test HTTP connectivity first
      const healthResponse = await fetch(`${this.coreBaseUrl}/health`);
      if (!healthResponse.ok) {
        throw new Error(`Core health check failed: ${healthResponse.status}`);
      }
      
      const health = await healthResponse.json();
      this.logger.info('AutoWeave Core health:', health);
      
      // Establish WebSocket connection
      await this.connectWebSocket();
      
      // Register backend services with Core
      await this.registerBackendServices();
      
      // Sync initial state
      await this.syncInitialState();
      
      this.connected = true;
      this.emit('connected');
      
      this.logger.success('Connected to AutoWeave Core');
      
    } catch (error) {
      this.logger.error('Failed to connect to AutoWeave Core:', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Connect WebSocket to AG-UI interface
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.coreWsUrl, {
        headers: {
          'X-Client-Type': 'autoweave-backend',
          'X-Client-Id': this.config.app?.nodeId || 'backend-default'
        }
      });
      
      this.ws.on('open', () => {
        this.logger.info('WebSocket connected to AutoWeave Core');
        this.reconnectAttempts = 0;
        
        // Send identification message
        this.sendWebSocketMessage({
          type: 'identify',
          content: {
            clientType: 'backend',
            nodeId: this.config.app?.nodeId,
            services: Array.from(this.serviceManager.listServices().map(s => s.name))
          }
        });
        
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          this.logger.error('Failed to parse WebSocket message:', error);
        }
      });
      
      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        this.logger.warn('WebSocket connection closed');
        this.connected = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });
      
      // Set timeout for connection
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle WebSocket message from Core
   */
  handleWebSocketMessage(message) {
    const { type, content } = message;
    
    switch (type) {
      case 'command':
        this.handleCoreCommand(content);
        break;
        
      case 'event':
        this.handleCoreEvent(content);
        break;
        
      case 'request':
        this.handleCoreRequest(content);
        break;
        
      case 'response':
        this.handleCoreResponse(content);
        break;
        
      default:
        this.logger.debug(`Unknown message type from Core: ${type}`);
    }
  }

  /**
   * Handle command from Core
   */
  async handleCoreCommand(command) {
    const { action, params, requestId } = command;
    
    try {
      let result;
      
      switch (action) {
        case 'create-agent':
          result = await this.createAgentFromCore(params);
          break;
          
        case 'get-analytics':
          result = await this.getAnalyticsData(params);
          break;
          
        case 'execute-pipeline':
          result = await this.executePipeline(params);
          break;
          
        case 'list-integrations':
          result = await this.listIntegrations(params);
          break;
          
        default:
          throw new Error(`Unknown command action: ${action}`);
      }
      
      // Send response back to Core
      if (requestId) {
        this.sendWebSocketMessage({
          type: 'response',
          content: {
            requestId,
            success: true,
            result
          }
        });
      }
      
    } catch (error) {
      this.logger.error(`Command execution failed: ${action}`, error);
      
      if (requestId) {
        this.sendWebSocketMessage({
          type: 'response',
          content: {
            requestId,
            success: false,
            error: error.message
          }
        });
      }
    }
  }

  /**
   * Handle event from Core
   */
  async handleCoreEvent(event) {
    const { topic, data } = event;
    
    // Forward to local event bus
    this.eventBus.publish(`core.${topic}`, data);
    
    // Handle specific events
    switch (topic) {
      case 'agent.workflow.created':
        await this.handleAgentWorkflowCreated(data);
        break;
        
      case 'memory.search.request':
        await this.handleMemorySearchRequest(data);
        break;
        
      case 'config.generate.request':
        await this.handleConfigGenerateRequest(data);
        break;
    }
  }

  /**
   * Register backend services with Core
   */
  async registerBackendServices() {
    const services = this.serviceManager.listServices();
    
    for (const service of services) {
      try {
        // Register via ANP if available
        if (service.endpoints && service.endpoints.length > 0) {
          await this.registerServiceViaANP(service);
        }
        
        // Also register via WebSocket for real-time communication
        this.sendWebSocketMessage({
          type: 'command',
          content: {
            action: 'register-service',
            params: {
              id: service.id,
              name: service.name,
              version: service.version,
              endpoints: service.endpoints,
              status: service.status,
              capabilities: this.getServiceCapabilities(service)
            }
          }
        });
        
        this.registeredServices.set(service.id, service);
        
      } catch (error) {
        this.logger.error(`Failed to register service ${service.name}:`, error);
      }
    }
  }

  /**
   * Register service via ANP Server
   */
  async registerServiceViaANP(service) {
    const anpRegistration = {
      id: service.id,
      name: service.name,
      version: service.version,
      endpoints: service.endpoints.map(ep => ({
        path: `/backend${ep.path}`,
        method: ep.method,
        description: ep.description,
        parameters: ep.parameters,
        responses: ep.responses
      })),
      capabilities: this.getServiceCapabilities(service),
      baseUrl: `${this.config.app?.baseUrl || 'http://localhost:3001'}/api`
    };
    
    // Register with ANP server
    const response = await fetch(`${this.anpServerUrl}/agent/external/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(anpRegistration)
    });
    
    if (!response.ok) {
      throw new Error(`ANP registration failed: ${response.status}`);
    }
    
    this.logger.info(`Service ${service.name} registered with ANP`);
  }

  /**
   * Get service capabilities for Core
   */
  getServiceCapabilities(service) {
    const capabilities = [];
    
    // Determine capabilities based on service type
    if (service.name.includes('analytics')) {
      capabilities.push('analytics', 'metrics', 'reporting');
    }
    if (service.name.includes('integration')) {
      capabilities.push('integration', 'api-management');
    }
    if (service.name.includes('pipeline')) {
      capabilities.push('data-processing', 'etl');
    }
    
    // Add from service metadata
    if (service.metadata?.capabilities) {
      capabilities.push(...service.metadata.capabilities);
    }
    
    return [...new Set(capabilities)]; // Remove duplicates
  }

  /**
   * Sync initial state with Core
   */
  async syncInitialState() {
    try {
      // Get current agents from Core
      const agentsResponse = await fetch(`${this.coreBaseUrl}/api/agents`);
      if (agentsResponse.ok) {
        const agents = await agentsResponse.json();
        
        // Process each agent
        for (const agent of agents) {
          this.eventBus.publish('core.agent.synced', agent);
        }
      }
      
      // Send backend status
      this.sendWebSocketMessage({
        type: 'event',
        content: {
          topic: 'backend.status',
          data: {
            services: this.serviceManager.getHealthStatus(),
            integrations: this.getIntegrationsSummary(),
            pipelines: this.getPipelinesSummary()
          }
        }
      });
      
    } catch (error) {
      this.logger.error('Failed to sync initial state:', error);
    }
  }

  /**
   * Forward event to Core
   */
  forwardEventToCore(topic, event) {
    if (!this.connected || !this.ws) return;
    
    this.sendWebSocketMessage({
      type: 'event',
      content: {
        topic: `backend.${topic}`,
        data: event.data,
        timestamp: event.timestamp || new Date()
      }
    });
  }

  /**
   * Send WebSocket message
   */
  sendWebSocketMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.logger.warn('WebSocket not ready, queuing message');
      // Could implement message queue here
    }
  }

  /**
   * Create agent from Core request
   */
  async createAgentFromCore(params) {
    const { description, tools, config } = params;
    
    // Forward to agent creation endpoint
    const response = await fetch(`${this.coreBaseUrl}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        tools,
        config,
        source: 'backend-integration'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Agent creation failed: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Get analytics data for Core
   */
  async getAnalyticsData(params) {
    const { metric, period, filters } = params;
    
    // This would call the analytics engine
    // For now, return mock data
    return {
      metric,
      period,
      data: [
        { timestamp: new Date(), value: 100 },
        { timestamp: new Date(Date.now() - 3600000), value: 85 }
      ]
    };
  }

  /**
   * Execute pipeline from Core request
   */
  async executePipeline(params) {
    const { pipelineId, options } = params;
    
    // This would call the data pipeline service
    // For now, return mock result
    return {
      pipelineId,
      executionId: `exec-${Date.now()}`,
      status: 'started',
      startedAt: new Date()
    };
  }

  /**
   * List integrations for Core
   */
  async listIntegrations(params) {
    // This would call the integration hub
    // For now, return mock data
    return [
      {
        id: 'integration-1',
        name: 'GitHub API',
        type: 'openapi',
        status: 'active'
      },
      {
        id: 'integration-2',
        name: 'Slack Webhook',
        type: 'webhook',
        status: 'active'
      }
    ];
  }

  /**
   * Handle agent workflow created in Core
   */
  async handleAgentWorkflowCreated(data) {
    const { workflow, agentId } = data;
    
    // Create backend services for the agent if needed
    if (workflow.requiresBackend) {
      try {
        // Register agent-specific service
        const serviceId = await this.serviceManager.registerService({
          name: `agent-${agentId}`,
          version: '1.0.0',
          endpoints: workflow.endpoints || [],
          metadata: {
            agentId,
            workflow: workflow.name
          }
        });
        
        // Start the service
        await this.serviceManager.startService(serviceId);
        
        this.logger.info(`Backend service created for agent ${agentId}`);
        
      } catch (error) {
        this.logger.error(`Failed to create backend service for agent ${agentId}:`, error);
      }
    }
  }

  /**
   * Handle memory search request from Core
   */
  async handleMemorySearchRequest(data) {
    const { query, filters, requestId } = data;
    
    // This would call the memory service
    // For now, return mock results
    const results = {
      memories: [
        {
          id: 'mem-1',
          content: 'Sample memory',
          relevance: 0.95,
          timestamp: new Date()
        }
      ],
      total: 1
    };
    
    // Send results back to Core
    this.sendWebSocketMessage({
      type: 'response',
      content: {
        requestId,
        success: true,
        result: results
      }
    });
  }

  /**
   * Handle config generation request from Core
   */
  async handleConfigGenerateRequest(data) {
    const { intent, platform, requestId } = data;
    
    // This would call the config intelligence service
    // For now, return mock config
    const config = {
      platform,
      components: ['web-server', 'database', 'cache'],
      configuration: {
        webServer: { port: 8080 },
        database: { type: 'postgres' }
      }
    };
    
    // Send config back to Core
    this.sendWebSocketMessage({
      type: 'response',
      content: {
        requestId,
        success: true,
        result: config
      }
    });
  }

  /**
   * Get integrations summary
   */
  getIntegrationsSummary() {
    // This would query the integration hub
    return {
      total: 5,
      active: 4,
      types: {
        openapi: 2,
        webhook: 2,
        database: 1
      }
    };
  }

  /**
   * Get pipelines summary
   */
  getPipelinesSummary() {
    // This would query the data pipeline service
    return {
      total: 3,
      active: 2,
      scheduled: 1,
      lastRun: new Date()
    };
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    this.logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        this.logger.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Make request to Core API
   */
  async requestToCore(endpoint, method = 'GET', data = null) {
    const url = `${this.coreBaseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Backend-Node': this.config.app?.nodeId || 'backend-default'
      }
    };
    
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Core API request failed: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Get agent from Core
   */
  async getAgent(agentId) {
    return await this.requestToCore(`/api/agents/${agentId}`);
  }

  /**
   * Update agent in Core
   */
  async updateAgent(agentId, updates) {
    return await this.requestToCore(`/api/agents/${agentId}`, 'PATCH', updates);
  }

  /**
   * Create memory in Core
   */
  async createMemory(memory) {
    return await this.requestToCore('/api/memory', 'POST', memory);
  }

  /**
   * Search memories in Core
   */
  async searchMemories(query) {
    return await this.requestToCore('/api/memory/search', 'POST', query);
  }

  /**
   * Disconnect from Core
   */
  async disconnect() {
    this.connected = false;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.emit('disconnected');
    this.logger.info('Disconnected from AutoWeave Core');
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      coreUrl: this.coreBaseUrl,
      wsState: this.ws ? this.ws.readyState : 'closed',
      reconnectAttempts: this.reconnectAttempts,
      registeredServices: this.registeredServices.size
    };
  }
}

export default AutoWeaveCoreConnector;