import IntegrationHub from '../../../src/services/integration/integration-hub.js';

describe('IntegrationHub', () => {
  let integrationHub;
  let mockLogger;
  let mockConfig;
  let mockEventBus;
  let mockDataPipeline;
  let mockServiceManager;

  beforeEach(() => {
    mockLogger = global.testUtils.createMockLogger();
    mockEventBus = global.testUtils.createMockEventBus();
    
    mockDataPipeline = {
      registerPipeline: jest.fn().mockResolvedValue('pipeline-123'),
      executePipeline: jest.fn().mockResolvedValue({ executionId: 'exec-123' })
    };

    mockServiceManager = {
      registerService: jest.fn().mockResolvedValue('service-123'),
      startService: jest.fn().mockResolvedValue(true)
    };

    mockConfig = {
      autoIntegration: {
        enabled: true,
        validationLevel: 'strict'
      }
    };

    integrationHub = new IntegrationHub({
      logger: mockLogger,
      config: mockConfig,
      eventBus: mockEventBus,
      dataPipeline: mockDataPipeline,
      serviceManager: mockServiceManager
    });
  });

  afterEach(async () => {
    await integrationHub.stop();
    jest.clearAllMocks();
  });

  describe('OpenAPI integrations', () => {
    const openAPISpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            responses: { '200': { description: 'Success' } }
          }
        }
      }
    };

    it('should create OpenAPI integration', async () => {
      const integration = await integrationHub.createOpenAPIIntegration({
        name: 'test-api',
        spec: openAPISpec
      });

      expect(integration).toMatchObject({
        id: expect.any(String),
        name: 'test-api',
        type: 'openapi',
        status: 'active'
      });
      expect(integration.methods).toContain('getUsers');
    });

    it('should validate OpenAPI spec', async () => {
      const invalidSpec = { openapi: '3.0.0' }; // Missing required fields

      await expect(
        integrationHub.createOpenAPIIntegration({
          name: 'invalid-api',
          spec: invalidSpec
        })
      ).rejects.toThrow('Invalid OpenAPI specification');
    });

    it('should generate client methods', async () => {
      const integration = await integrationHub.createOpenAPIIntegration({
        name: 'test-api',
        spec: openAPISpec
      });

      const client = integrationHub.getIntegrationClient(integration.id);
      
      expect(client).toBeDefined();
      expect(typeof client.getUsers).toBe('function');
    });

    it('should handle API calls', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([{ id: 1, name: 'User 1' }])
      });

      const integration = await integrationHub.createOpenAPIIntegration({
        name: 'test-api',
        spec: openAPISpec
      });

      const client = integrationHub.getIntegrationClient(integration.id);
      const result = await client.getUsers();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.any(Object)
      );
      expect(result).toEqual([{ id: 1, name: 'User 1' }]);
    });
  });

  describe('webhook integrations', () => {
    it('should create webhook integration', async () => {
      const integration = await integrationHub.createWebhookIntegration({
        name: 'test-webhook',
        endpoint: '/webhooks/test',
        events: ['user.created', 'user.updated']
      });

      expect(integration).toMatchObject({
        id: expect.any(String),
        name: 'test-webhook',
        type: 'webhook',
        status: 'active',
        endpoint: expect.stringContaining('/webhooks/test')
      });
    });

    it('should handle incoming webhooks', async () => {
      const integration = await integrationHub.createWebhookIntegration({
        name: 'test-webhook',
        events: ['test.event']
      });

      const payload = { action: 'test', data: { id: 123 } };
      const result = await integrationHub.handleWebhook(
        integration.id,
        payload,
        { 'x-signature': 'test-sig' }
      );

      expect(result.success).toBe(true);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'webhook.test.event',
        expect.objectContaining({ payload })
      );
    });

    it('should validate webhook signatures', async () => {
      const integration = await integrationHub.createWebhookIntegration({
        name: 'secure-webhook',
        secret: 'webhook-secret'
      });

      const payload = { data: 'test' };
      
      await expect(
        integrationHub.handleWebhook(integration.id, payload, {})
      ).rejects.toThrow('Invalid webhook signature');
    });
  });

  describe('plugin integrations', () => {
    it('should load plugin integration', async () => {
      const mockPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        init: jest.fn().mockResolvedValue(true),
        execute: jest.fn().mockResolvedValue({ result: 'success' })
      };

      // Mock dynamic import
      integrationHub.loadPlugin = jest.fn().mockResolvedValue(mockPlugin);

      const integration = await integrationHub.createPluginIntegration({
        name: 'test-plugin',
        path: './plugins/test-plugin.js'
      });

      expect(integration.status).toBe('active');
      expect(mockPlugin.init).toHaveBeenCalled();
    });

    it('should execute plugin methods', async () => {
      const mockPlugin = {
        execute: jest.fn().mockResolvedValue({ result: 'plugin-result' })
      };

      integrationHub.plugins.set('plugin-123', mockPlugin);
      integrationHub.integrations.set('plugin-123', {
        id: 'plugin-123',
        type: 'plugin',
        status: 'active'
      });

      const result = await integrationHub.executePlugin('plugin-123', 'test-action', {
        param: 'value'
      });

      expect(result).toEqual({ result: 'plugin-result' });
      expect(mockPlugin.execute).toHaveBeenCalledWith('test-action', {
        param: 'value'
      });
    });
  });

  describe('database integrations', () => {
    it('should create database integration', async () => {
      const integration = await integrationHub.createDatabaseIntegration({
        name: 'test-db',
        type: 'postgresql',
        connectionString: 'postgresql://localhost/testdb'
      });

      expect(integration).toMatchObject({
        type: 'database',
        dbType: 'postgresql',
        status: 'active'
      });
    });

    it('should validate connection', async () => {
      // Mock database client
      const mockDbClient = {
        connect: jest.fn().mockResolvedValue(true),
        query: jest.fn().mockResolvedValue({ rows: [] }),
        end: jest.fn()
      };

      integrationHub.createDatabaseClient = jest.fn().mockReturnValue(mockDbClient);

      const integration = await integrationHub.createDatabaseIntegration({
        name: 'test-db',
        type: 'postgresql',
        connectionString: 'postgresql://localhost/testdb'
      });

      expect(mockDbClient.connect).toHaveBeenCalled();
      expect(integration.status).toBe('active');
    });
  });

  describe('message queue integrations', () => {
    it('should create message queue integration', async () => {
      const integration = await integrationHub.createMessageQueueIntegration({
        name: 'test-queue',
        type: 'rabbitmq',
        connectionUrl: 'amqp://localhost',
        queues: ['test-queue-1', 'test-queue-2']
      });

      expect(integration).toMatchObject({
        type: 'message-queue',
        mqType: 'rabbitmq',
        status: 'active',
        queues: ['test-queue-1', 'test-queue-2']
      });
    });

    it('should handle message consumption', async () => {
      const mockMqClient = {
        connect: jest.fn().mockResolvedValue(true),
        consume: jest.fn(),
        publish: jest.fn().mockResolvedValue(true)
      };

      integrationHub.messageQueues.set('mq-123', mockMqClient);
      integrationHub.integrations.set('mq-123', {
        id: 'mq-123',
        type: 'message-queue',
        queues: ['test-queue']
      });

      // Simulate message consumption
      const handler = mockMqClient.consume.mock.calls[0]?.[1];
      if (handler) {
        await handler({ content: Buffer.from(JSON.stringify({ test: 'data' })) });
      }

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'mq.message.received',
        expect.any(Object)
      );
    });
  });

  describe('integration management', () => {
    it('should list all integrations', async () => {
      await integrationHub.createOpenAPIIntegration({
        name: 'api-1',
        spec: { openapi: '3.0.0', info: { title: 'API 1', version: '1.0' } }
      });
      
      await integrationHub.createWebhookIntegration({
        name: 'webhook-1'
      });

      const integrations = integrationHub.listIntegrations();

      expect(integrations).toHaveLength(2);
      expect(integrations.map(i => i.type)).toContain('openapi');
      expect(integrations.map(i => i.type)).toContain('webhook');
    });

    it('should get integration by ID', async () => {
      const created = await integrationHub.createWebhookIntegration({
        name: 'test-webhook'
      });

      const integration = integrationHub.getIntegration(created.id);

      expect(integration).toEqual(created);
    });

    it('should update integration', async () => {
      const created = await integrationHub.createWebhookIntegration({
        name: 'test-webhook'
      });

      const updated = await integrationHub.updateIntegration(created.id, {
        name: 'updated-webhook',
        events: ['new.event']
      });

      expect(updated.name).toBe('updated-webhook');
      expect(updated.config.events).toContain('new.event');
    });

    it('should delete integration', async () => {
      const created = await integrationHub.createWebhookIntegration({
        name: 'test-webhook'
      });

      await integrationHub.deleteIntegration(created.id);

      expect(integrationHub.getIntegration(created.id)).toBeUndefined();
    });

    it('should pause and resume integrations', async () => {
      const integration = await integrationHub.createWebhookIntegration({
        name: 'test-webhook'
      });

      await integrationHub.pauseIntegration(integration.id);
      expect(integrationHub.getIntegration(integration.id).status).toBe('paused');

      await integrationHub.resumeIntegration(integration.id);
      expect(integrationHub.getIntegration(integration.id).status).toBe('active');
    });
  });

  describe('auto-discovery', () => {
    it('should discover integrations from modules', async () => {
      const mockModule = {
        name: 'discovered-module',
        openAPI: {
          openapi: '3.0.0',
          info: { title: 'Discovered API', version: '1.0' }
        }
      };

      await integrationHub.handleModuleDiscovery({
        module: mockModule,
        metadata: { openAPI: mockModule.openAPI }
      });

      const integrations = integrationHub.listIntegrations();
      expect(integrations).toHaveLength(1);
      expect(integrations[0].name).toBe('discovered-module');
    });
  });

  describe('error handling', () => {
    it('should handle integration errors gracefully', async () => {
      const integration = await integrationHub.createOpenAPIIntegration({
        name: 'error-api',
        spec: {
          openapi: '3.0.0',
          info: { title: 'Error API', version: '1.0' },
          servers: [{ url: 'https://error.example.com' }],
          paths: {
            '/error': {
              get: { operationId: 'getError' }
            }
          }
        }
      });

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const client = integrationHub.getIntegrationClient(integration.id);
      
      await expect(client.getError()).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should track integration health', async () => {
      const integration = await integrationHub.createWebhookIntegration({
        name: 'health-webhook'
      });

      // Simulate failures
      for (let i = 0; i < 5; i++) {
        try {
          await integrationHub.handleWebhook(integration.id, {}, {
            'x-signature': 'invalid'
          });
        } catch (e) {
          // Expected
        }
      }

      const health = integrationHub.getIntegrationHealth(integration.id);
      expect(health.failureCount).toBe(5);
      expect(health.status).toBe('unhealthy');
    });
  });
});