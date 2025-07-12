import AnalyticsEngine from '../../../src/services/analytics/analytics-engine.js';

describe('AnalyticsEngine', () => {
  let analyticsEngine;
  let mockLogger;
  let mockEventBus;
  let mockStorageAdapters;
  let mockConfig;

  beforeEach(() => {
    mockLogger = global.testUtils.createMockLogger();
    mockEventBus = global.testUtils.createMockEventBus();
    
    mockStorageAdapters = {
      qdrant: {
        store: jest.fn().mockResolvedValue(true),
        search: jest.fn().mockResolvedValue([]),
        isConnected: jest.fn().mockReturnValue(true)
      },
      redis: {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        incr: jest.fn().mockResolvedValue(1),
        zadd: jest.fn().mockResolvedValue(1),
        zrange: jest.fn().mockResolvedValue([])
      }
    };

    mockConfig = {
      analytics: {
        retentionDays: 30,
        aggregationInterval: 60000,
        enableRealtime: true,
        samplingRate: 1.0
      }
    };

    analyticsEngine = new AnalyticsEngine({
      logger: mockLogger,
      config: mockConfig,
      eventBus: mockEventBus,
      storageAdapters: mockStorageAdapters
    });
  });

  afterEach(async () => {
    await analyticsEngine.stop();
    jest.clearAllMocks();
  });

  describe('event tracking', () => {
    it('should track events successfully', async () => {
      const eventData = {
        event: 'page_view',
        properties: { page: '/home', duration: 1500 },
        userId: 'user123'
      };

      const result = await analyticsEngine.track(eventData);

      expect(result.success).toBe(true);
      expect(result.eventId).toBeDefined();
      expect(mockStorageAdapters.qdrant.store).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'analytics.event.tracked',
        expect.any(Object)
      );
    });

    it('should handle sampling rate', async () => {
      analyticsEngine.samplingRate = 0; // 0% sampling

      const result = await analyticsEngine.track({
        event: 'test_event',
        userId: 'user123'
      });

      expect(result.sampled).toBe(false);
      expect(mockStorageAdapters.qdrant.store).not.toHaveBeenCalled();
    });

    it('should validate event data', async () => {
      await expect(analyticsEngine.track({}))
        .rejects.toThrow('Event name is required');

      await expect(analyticsEngine.track({ event: '' }))
        .rejects.toThrow('Event name is required');
    });

    it('should enrich events with metadata', async () => {
      await analyticsEngine.track({
        event: 'test_event',
        userId: 'user123'
      });

      const storedEvent = mockStorageAdapters.qdrant.store.mock.calls[0][1];
      
      expect(storedEvent).toMatchObject({
        id: expect.any(String),
        event: 'test_event',
        userId: 'user123',
        timestamp: expect.any(Date),
        sessionId: expect.any(String)
      });
    });
  });

  describe('metrics aggregation', () => {
    it('should aggregate metrics correctly', async () => {
      // Track multiple events
      await analyticsEngine.track({
        event: 'api_request',
        properties: { duration: 100, status: 200 }
      });
      await analyticsEngine.track({
        event: 'api_request',
        properties: { duration: 150, status: 200 }
      });
      await analyticsEngine.track({
        event: 'api_request',
        properties: { duration: 200, status: 500 }
      });

      const metrics = await analyticsEngine.getMetrics('api_request_duration', {
        groupBy: 'hour'
      });

      expect(metrics.data).toBeDefined();
      expect(metrics.aggregation).toBe('hour');
    });

    it('should support different aggregation periods', async () => {
      const periods = ['minute', 'hour', 'day', 'week', 'month'];

      for (const period of periods) {
        const metrics = await analyticsEngine.getMetrics('test_metric', {
          groupBy: period
        });

        expect(metrics.aggregation).toBe(period);
      }
    });
  });

  describe('funnel analysis', () => {
    beforeEach(async () => {
      // Set up test data
      const userId = 'funnel-user';
      const events = [
        { event: 'page_view', timestamp: new Date(Date.now() - 3000) },
        { event: 'product_view', timestamp: new Date(Date.now() - 2000) },
        { event: 'add_to_cart', timestamp: new Date(Date.now() - 1000) },
        { event: 'purchase', timestamp: new Date() }
      ];

      for (const event of events) {
        await analyticsEngine.track({ ...event, userId });
      }
    });

    it('should analyze conversion funnels', async () => {
      const funnel = await analyticsEngine.analyzeFunnel({
        steps: ['page_view', 'product_view', 'add_to_cart', 'purchase']
      });

      expect(funnel.steps).toHaveLength(4);
      expect(funnel.steps[0]).toMatchObject({
        name: 'page_view',
        count: expect.any(Number),
        conversionRate: 100
      });
      expect(funnel.overallConversion).toBeGreaterThan(0);
    });

    it('should handle incomplete funnels', async () => {
      // Track partial journey
      await analyticsEngine.track({
        event: 'page_view',
        userId: 'partial-user'
      });
      await analyticsEngine.track({
        event: 'product_view',
        userId: 'partial-user'
      });

      const funnel = await analyticsEngine.analyzeFunnel({
        steps: ['page_view', 'product_view', 'add_to_cart', 'purchase'],
        userId: 'partial-user'
      });

      expect(funnel.steps[2].count).toBe(0);
      expect(funnel.steps[3].count).toBe(0);
    });
  });

  describe('cohort analysis', () => {
    it('should analyze user cohorts', async () => {
      // Create cohort data
      const cohortDate = new Date('2024-01-01');
      const users = ['user1', 'user2', 'user3'];

      for (const userId of users) {
        await analyticsEngine.track({
          event: 'user_signup',
          userId,
          timestamp: cohortDate
        });
      }

      // Some users return
      await analyticsEngine.track({
        event: 'session_start',
        userId: 'user1',
        timestamp: new Date('2024-01-02')
      });
      await analyticsEngine.track({
        event: 'session_start',
        userId: 'user2',
        timestamp: new Date('2024-01-02')
      });

      const cohorts = await analyticsEngine.analyzeCohorts({
        cohortType: 'daily',
        metric: 'retention',
        periods: 7
      });

      expect(cohorts.cohorts).toBeDefined();
      expect(cohorts.cohorts[0]).toMatchObject({
        period: expect.any(String),
        size: 3,
        metrics: expect.any(Array)
      });
    });
  });

  describe('real-time analytics', () => {
    it('should provide real-time statistics', async () => {
      // Simulate real-time events
      const events = Array(10).fill(null).map((_, i) => ({
        event: 'realtime_event',
        userId: `user${i}`,
        properties: { value: Math.random() * 100 }
      }));

      for (const event of events) {
        await analyticsEngine.track(event);
      }

      const realtime = await analyticsEngine.getRealtimeStats();

      expect(realtime).toMatchObject({
        activeUsers: expect.any(Number),
        eventsPerSecond: expect.any(Number),
        errorRate: expect.any(Number),
        avgResponseTime: expect.any(Number)
      });
    });
  });

  describe('user analytics', () => {
    it('should aggregate user-level analytics', async () => {
      const userId = 'analytics-user';
      
      // Track various events for the user
      await analyticsEngine.track({
        event: 'page_view',
        userId,
        properties: { page: '/home' }
      });
      await analyticsEngine.track({
        event: 'page_view',
        userId,
        properties: { page: '/products' }
      });
      await analyticsEngine.track({
        event: 'purchase',
        userId,
        properties: { amount: 99.99 }
      });

      const userAnalytics = await analyticsEngine.getUserAnalytics(userId);

      expect(userAnalytics).toMatchObject({
        userId,
        totalEvents: 3,
        firstSeen: expect.any(Date),
        lastSeen: expect.any(Date),
        eventBreakdown: expect.any(Array)
      });
    });
  });

  describe('data export', () => {
    it('should export analytics data', async () => {
      // Add some test data
      await analyticsEngine.track({
        event: 'export_test',
        properties: { value: 100 }
      });

      const exportData = await analyticsEngine.exportData({
        metrics: ['events_total'],
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(),
        format: 'json'
      });

      expect(exportData.format).toBe('json');
      expect(exportData.data).toBeDefined();
      expect(exportData.metadata).toMatchObject({
        exportDate: expect.any(Date),
        metrics: ['events_total']
      });
    });

    it('should support CSV export format', async () => {
      const exportData = await analyticsEngine.exportData({
        metrics: ['page_views_total'],
        format: 'csv'
      });

      expect(exportData.format).toBe('csv');
      expect(typeof exportData.data).toBe('string');
      expect(exportData.data).toContain('timestamp,');
    });
  });

  describe('performance analysis', () => {
    it('should track performance metrics', async () => {
      const perfEvents = [
        { duration: 100, endpoint: '/api/users' },
        { duration: 150, endpoint: '/api/users' },
        { duration: 200, endpoint: '/api/products' },
        { duration: 1500, endpoint: '/api/slow' }
      ];

      for (const perf of perfEvents) {
        await analyticsEngine.track({
          event: 'api_request',
          properties: perf
        });
      }

      const perfAnalysis = analyticsEngine.performanceAnalyzer.analyze();

      expect(perfAnalysis.percentiles).toBeDefined();
      expect(perfAnalysis.slowRequests).toBeDefined();
      expect(perfAnalysis.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('error handling', () => {
    it('should handle storage failures gracefully', async () => {
      mockStorageAdapters.qdrant.store.mockRejectedValueOnce(
        new Error('Storage error')
      );

      const result = await analyticsEngine.track({
        event: 'test_event',
        userId: 'user123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should continue operating with degraded storage', async () => {
      mockStorageAdapters.qdrant.isConnected.mockReturnValue(false);

      const result = await analyticsEngine.track({
        event: 'degraded_test',
        userId: 'user123'
      });

      // Should still track in Redis
      expect(result.success).toBe(true);
      expect(mockStorageAdapters.redis.zadd).toHaveBeenCalled();
    });
  });
});