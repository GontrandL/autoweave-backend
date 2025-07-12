import AutoWeaveCoreConnector from '../../../src/connectors/autoweave-core-connector.js';
import WebSocket from 'ws';
import fetch from 'node-fetch';

// Mock modules
jest.mock('ws');
jest.mock('node-fetch');

describe('AutoWeaveCoreConnector', () => {
  let connector;
  let mockLogger;
  let mockConfig;
  let mockEventBus;
  let mockServiceManager;
  let mockWs;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    mockLogger = global.testUtils.createMockLogger();
    mockEventBus = global.testUtils.createMockEventBus();
    
    mockServiceManager = {
      listServices: jest.fn().mockReturnValue([
        { id: 'service1', name: 'Test Service', status: 'running' }
      ]),
      getHealthStatus: jest.fn().mockReturnValue({ healthy: 1, total: 1 })
    };

    mockConfig = {
      app: { nodeId: 'test-node' },
      autoweaveCore: {
        baseUrl: 'http://localhost:3000',
        wsUrl: 'ws://localhost:3000/ws',
        anpServerUrl: 'http://localhost:8083'
      }
    };

    // Mock WebSocket instance
    mockWs = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn()
    };
    WebSocket.mockImplementation(() => mockWs);

    // Mock fetch responses
    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ status: 'healthy' })
    });

    connector = new AutoWeaveCoreConnector({
      logger: mockLogger,
      config: mockConfig,
      eventBus: mockEventBus,
      serviceManager: mockServiceManager
    });
  });

  describe('connection', () => {
    it('should connect to Core successfully', async () => {
      await connector.connect();

      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/health');
      expect(WebSocket).toHaveBeenCalledWith(
        'ws://localhost:3000/ws',
        expect.objectContaining({
          headers: {
            'X-Client-Type': 'autoweave-backend',
            'X-Client-Id': 'test-node'
          }
        })
      );
      expect(connector.connected).toBe(true);
    });

    it('should handle connection failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(connector.connect()).rejects.toThrow(
        'Core health check failed: 500'
      );
      expect(connector.connected).toBe(false);
    });

    it('should handle WebSocket connection', async () => {
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')?.[1];
      
      await connector.connectWebSocket();
      
      // Simulate WebSocket open
      openHandler?.();

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'identify',
        content: {
          clientType: 'backend',
          nodeId: 'test-node',
          services: ['Test Service']
        }
      }));
    });

    it('should reconnect on connection loss', async () => {
      jest.useFakeTimers();
      
      connector.reconnectAttempts = 0;
      connector.maxReconnectAttempts = 3;
      
      await connector.scheduleReconnect();
      
      expect(connector.reconnectAttempts).toBe(1);
      
      jest.advanceTimersByTime(1000);
      
      expect(fetch).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      connector.connected = true;
      connector.ws = mockWs;
    });

    it('should forward events to Core', async () => {
      connector.forwardEventToCore('test.event', {
        data: { message: 'test' }
      });

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'event',
        content: {
          topic: 'backend.test.event',
          data: { message: 'test' },
          timestamp: expect.any(Date)
        }
      }));
    });

    it('should handle WebSocket messages', () => {
      const messageHandler = mockWs.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      const testMessage = {
        type: 'command',
        content: {
          action: 'list-integrations',
          requestId: 'req123'
        }
      };

      messageHandler?.(JSON.stringify(testMessage));

      // Should process the command
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Unknown command action')
      );
    });

    it('should handle Core events', async () => {
      await connector.handleCoreEvent({
        topic: 'agent.workflow.created',
        data: {
          workflow: { requiresBackend: true, name: 'test-workflow' },
          agentId: 'agent123'
        }
      });

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'core.agent.workflow.created',
        expect.any(Object)
      );
    });
  });

  describe('service registration', () => {
    it('should register services with Core', async () => {
      connector.connected = true;
      connector.ws = mockWs;

      await connector.registerBackendServices();

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'command',
        content: {
          action: 'register-service',
          params: expect.objectContaining({
            id: 'service1',
            name: 'Test Service',
            status: 'running'
          })
        }
      }));
    });

    it('should register services via ANP', async () => {
      const service = {
        id: 'anp-service',
        name: 'ANP Test Service',
        version: '1.0.0',
        endpoints: [{ path: '/test', method: 'GET' }]
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true })
      });

      await connector.registerServiceViaANP(service);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8083/agent/external/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('anp-service')
        })
      );
    });
  });

  describe('Core API requests', () => {
    it('should make requests to Core API', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ agents: [] })
      });

      const result = await connector.requestToCore('/api/agents', 'GET');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Backend-Node': 'test-node'
          }
        })
      );
      expect(result).toEqual({ agents: [] });
    });

    it('should handle API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(
        connector.requestToCore('/api/notfound', 'GET')
      ).rejects.toThrow('Core API request failed: 404');
    });
  });

  describe('command handling', () => {
    beforeEach(() => {
      connector.connected = true;
      connector.ws = mockWs;
    });

    it('should handle create-agent command', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 'agent123',
          name: 'Test Agent'
        })
      });

      await connector.handleCoreCommand({
        action: 'create-agent',
        params: { description: 'Test agent' },
        requestId: 'req123'
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents',
        expect.objectContaining({
          method: 'POST'
        })
      );

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'response',
        content: {
          requestId: 'req123',
          success: true,
          result: { id: 'agent123', name: 'Test Agent' }
        }
      }));
    });

    it('should handle command errors', async () => {
      await connector.handleCoreCommand({
        action: 'invalid-command',
        requestId: 'req123'
      });

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'response',
        content: {
          requestId: 'req123',
          success: false,
          error: 'Unknown command action: invalid-command'
        }
      }));
    });
  });

  describe('status and metrics', () => {
    it('should return connection status', () => {
      connector.connected = true;
      connector.ws = mockWs;
      connector.registeredServices.set('service1', {});

      const status = connector.getStatus();

      expect(status).toEqual({
        connected: true,
        coreUrl: 'http://localhost:3000',
        wsState: WebSocket.OPEN,
        reconnectAttempts: 0,
        registeredServices: 1
      });
    });

    it('should get integration summary', () => {
      const summary = connector.getIntegrationsSummary();

      expect(summary).toEqual({
        total: 5,
        active: 4,
        types: {
          openapi: 2,
          webhook: 2,
          database: 1
        }
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect cleanly', async () => {
      connector.connected = true;
      connector.ws = mockWs;

      await connector.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
      expect(connector.connected).toBe(false);
      expect(connector.ws).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket errors', () => {
      const errorHandler = mockWs.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      errorHandler?.(new Error('WebSocket error'));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WebSocket error:',
        expect.any(Error)
      );
    });

    it('should handle malformed messages', () => {
      const messageHandler = mockWs.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      messageHandler?.('invalid json');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error)
      );
    });
  });
});