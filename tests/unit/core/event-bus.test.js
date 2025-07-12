import EventBus from '../../../src/core/event-bus/index.js';
import Redis from 'ioredis-mock';

describe('EventBus', () => {
  let eventBus;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    mockLogger = global.testUtils.createMockLogger();
    mockConfig = {
      eventBus: {
        maxHistorySize: 10,
        defaultTTL: 3600000,
        enablePersistence: true,
        compressionThreshold: 1024
      },
      redis: {
        host: 'localhost',
        port: 6379,
        keyPrefix: 'test:'
      }
    };
    
    eventBus = new EventBus({ logger: mockLogger, config: mockConfig });
    eventBus.redis = new Redis();
    eventBus.subscriber = new Redis();
  });

  afterEach(async () => {
    await eventBus.close();
    jest.clearAllMocks();
  });

  describe('publish/subscribe', () => {
    it('should publish and receive events', async () => {
      const handler = jest.fn();
      const testData = { message: 'test' };

      await eventBus.subscribe('test.event', handler);
      await eventBus.publish('test.event', testData);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledWith({
        topic: 'test.event',
        data: testData,
        timestamp: expect.any(Date),
        source: 'system'
      });
    });

    it('should support wildcard subscriptions', async () => {
      const handler = jest.fn();

      await eventBus.subscribe('test.*', handler);
      await eventBus.publish('test.event1', { id: 1 });
      await eventBus.publish('test.event2', { id: 2 });
      await eventBus.publish('other.event', { id: 3 });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple subscribers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await eventBus.subscribe('multi.test', handler1);
      await eventBus.subscribe('multi.test', handler2);
      await eventBus.publish('multi.test', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('namespaces', () => {
    it('should isolate events by namespace', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      await eventBus.subscribe('event', handler1, { namespace: 'ns1' });
      await eventBus.subscribe('event', handler2, { namespace: 'ns2' });

      await eventBus.publish('event', { data: 'test' }, { namespace: 'ns1' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('request/response', () => {
    it('should handle request/response pattern', async () => {
      // Set up responder
      await eventBus.subscribe('request.test', async (event) => {
        return { response: `Received: ${event.data.message}` };
      });

      const response = await eventBus.request('request.test', { message: 'hello' });

      expect(response).toEqual({
        response: 'Received: hello'
      });
    });

    it('should timeout on no response', async () => {
      await expect(
        eventBus.request('no.response', { data: 'test' }, { timeout: 100 })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('event history', () => {
    it('should maintain event history', async () => {
      await eventBus.publish('history.test', { id: 1 });
      await eventBus.publish('history.test', { id: 2 });
      await eventBus.publish('history.test', { id: 3 });

      const history = eventBus.getHistory('history.test');

      expect(history).toHaveLength(3);
      expect(history[0].data).toEqual({ id: 1 });
    });

    it('should limit history size', async () => {
      // Publish more events than max history size
      for (let i = 0; i < 15; i++) {
        await eventBus.publish('overflow.test', { id: i });
      }

      const history = eventBus.getHistory('overflow.test');

      expect(history).toHaveLength(mockConfig.eventBus.maxHistorySize);
      expect(history[0].data.id).toBe(5); // First 5 should be dropped
    });
  });

  describe('error handling', () => {
    it('should handle subscriber errors gracefully', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const successHandler = jest.fn();

      await eventBus.subscribe('error.test', errorHandler);
      await eventBus.subscribe('error.test', successHandler);

      await eventBus.publish('error.test', { data: 'test' });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in event handler'),
        expect.any(Error)
      );
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('compression', () => {
    it('should compress large payloads', async () => {
      const largeData = 'x'.repeat(2000);
      const handler = jest.fn();

      await eventBus.subscribe('compress.test', handler);
      await eventBus.publish('compress.test', { data: largeData });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { data: largeData }
        })
      );
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe handlers', async () => {
      const handler = jest.fn();

      const subscription = await eventBus.subscribe('unsub.test', handler);
      await eventBus.publish('unsub.test', { data: 'first' });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(handler).toHaveBeenCalledTimes(1);

      eventBus.unsubscribe('unsub.test', subscription);
      await eventBus.publish('unsub.test', { data: 'second' });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('metrics', () => {
    it('should track event metrics', async () => {
      await eventBus.publish('metrics.test', { data: 'test' });
      await eventBus.publish('metrics.test', { data: 'test2' });
      await eventBus.publish('other.metrics', { data: 'test' });

      const metrics = eventBus.getMetrics();

      expect(metrics.totalEvents).toBe(3);
      expect(metrics.eventCounts['metrics.test']).toBe(2);
      expect(metrics.eventCounts['other.metrics']).toBe(1);
    });
  });
});