import ServiceManager from '../../../src/core/service-manager/index.js';

describe('ServiceManager', () => {
  let serviceManager;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    mockLogger = global.testUtils.createMockLogger();
    mockConfig = {
      serviceManager: {
        healthCheckTimeout: 100,
        circuitBreakerThreshold: 3,
        circuitBreakerResetTimeout: 1000
      }
    };
    serviceManager = new ServiceManager({ logger: mockLogger, config: mockConfig });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerService', () => {
    it('should register a new service successfully', async () => {
      const serviceConfig = {
        name: 'test-service',
        version: '1.0.0',
        endpoints: [{ path: '/test', method: 'GET' }],
        healthCheck: jest.fn().mockResolvedValue(true)
      };

      const serviceId = await serviceManager.registerService(serviceConfig);

      expect(serviceId).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Service registered'),
        expect.any(Object)
      );
    });

    it('should reject duplicate service names', async () => {
      const serviceConfig = {
        name: 'duplicate-service',
        healthCheck: jest.fn().mockResolvedValue(true)
      };

      await serviceManager.registerService(serviceConfig);
      
      await expect(serviceManager.registerService(serviceConfig))
        .rejects.toThrow('Service with name duplicate-service already exists');
    });

    it('should validate required fields', async () => {
      const invalidConfig = { version: '1.0.0' };

      await expect(serviceManager.registerService(invalidConfig))
        .rejects.toThrow('Service name is required');
    });
  });

  describe('startService', () => {
    it('should start a registered service', async () => {
      const serviceConfig = {
        name: 'start-test',
        healthCheck: jest.fn().mockResolvedValue(true),
        start: jest.fn().mockResolvedValue(true)
      };

      const serviceId = await serviceManager.registerService(serviceConfig);
      await serviceManager.startService(serviceId);

      const service = serviceManager.getService(serviceId);
      expect(service.status).toBe('running');
      expect(serviceConfig.start).toHaveBeenCalled();
    });

    it('should handle service start failure', async () => {
      const serviceConfig = {
        name: 'fail-start',
        healthCheck: jest.fn().mockResolvedValue(true),
        start: jest.fn().mockRejectedValue(new Error('Start failed'))
      };

      const serviceId = await serviceManager.registerService(serviceConfig);
      
      await expect(serviceManager.startService(serviceId))
        .rejects.toThrow('Start failed');

      const service = serviceManager.getService(serviceId);
      expect(service.status).toBe('failed');
    });
  });

  describe('health checks', () => {
    it('should perform health checks on running services', async () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      const serviceConfig = {
        name: 'health-test',
        healthCheck,
        start: jest.fn().mockResolvedValue(true)
      };

      const serviceId = await serviceManager.registerService(serviceConfig);
      await serviceManager.startService(serviceId);
      
      // Trigger health check
      await serviceManager.checkServiceHealth(serviceId);

      expect(healthCheck).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Health check passed')
      );
    });

    it('should handle health check failures', async () => {
      const healthCheck = jest.fn().mockRejectedValue(new Error('Health check failed'));
      const serviceConfig = {
        name: 'unhealthy-test',
        healthCheck,
        start: jest.fn().mockResolvedValue(true)
      };

      const serviceId = await serviceManager.registerService(serviceConfig);
      await serviceManager.startService(serviceId);
      
      await serviceManager.checkServiceHealth(serviceId);

      const service = serviceManager.getService(serviceId);
      expect(service.healthStatus).toBe('unhealthy');
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const healthCheck = jest.fn().mockRejectedValue(new Error('Failed'));
      const serviceConfig = {
        name: 'circuit-test',
        healthCheck,
        start: jest.fn().mockResolvedValue(true)
      };

      const serviceId = await serviceManager.registerService(serviceConfig);
      await serviceManager.startService(serviceId);

      // Trigger failures up to threshold
      for (let i = 0; i < mockConfig.serviceManager.circuitBreakerThreshold; i++) {
        await serviceManager.checkServiceHealth(serviceId);
      }

      const service = serviceManager.getService(serviceId);
      expect(service.circuitBreaker.isOpen).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker opened')
      );
    });
  });

  describe('service discovery', () => {
    it('should list all registered services', async () => {
      await serviceManager.registerService({ name: 'service1', healthCheck: jest.fn() });
      await serviceManager.registerService({ name: 'service2', healthCheck: jest.fn() });

      const services = serviceManager.listServices();

      expect(services).toHaveLength(2);
      expect(services.map(s => s.name)).toEqual(['service1', 'service2']);
    });

    it('should find services by status', async () => {
      const runningService = {
        name: 'running-service',
        healthCheck: jest.fn().mockResolvedValue(true),
        start: jest.fn().mockResolvedValue(true)
      };

      const stoppedService = {
        name: 'stopped-service',
        healthCheck: jest.fn().mockResolvedValue(true)
      };

      const runningId = await serviceManager.registerService(runningService);
      await serviceManager.registerService(stoppedService);
      await serviceManager.startService(runningId);

      const runningServices = serviceManager.findServicesByStatus('running');

      expect(runningServices).toHaveLength(1);
      expect(runningServices[0].name).toBe('running-service');
    });
  });

  describe('dependency management', () => {
    it('should resolve service dependencies', async () => {
      const service1 = {
        name: 'service1',
        healthCheck: jest.fn().mockResolvedValue(true)
      };

      const service2 = {
        name: 'service2',
        dependencies: ['service1'],
        healthCheck: jest.fn().mockResolvedValue(true)
      };

      await serviceManager.registerService(service1);
      const serviceId2 = await serviceManager.registerService(service2);

      const dependencies = await serviceManager.resolveDependencies(serviceId2);

      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].name).toBe('service1');
    });

    it('should detect circular dependencies', async () => {
      const service1 = {
        name: 'service1',
        dependencies: ['service2'],
        healthCheck: jest.fn()
      };

      const service2 = {
        name: 'service2',
        dependencies: ['service1'],
        healthCheck: jest.fn()
      };

      await serviceManager.registerService(service1);
      await serviceManager.registerService(service2);

      await expect(serviceManager.startAll())
        .rejects.toThrow('Circular dependency detected');
    });
  });

  describe('shutdown', () => {
    it('should stop all services gracefully', async () => {
      const stopFn1 = jest.fn().mockResolvedValue(true);
      const stopFn2 = jest.fn().mockResolvedValue(true);

      await serviceManager.registerService({
        name: 'service1',
        healthCheck: jest.fn(),
        start: jest.fn(),
        stop: stopFn1
      });

      await serviceManager.registerService({
        name: 'service2',
        healthCheck: jest.fn(),
        start: jest.fn(),
        stop: stopFn2
      });

      await serviceManager.startAll();
      await serviceManager.stopAll();

      expect(stopFn1).toHaveBeenCalled();
      expect(stopFn2).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('All services stopped');
    });
  });
});