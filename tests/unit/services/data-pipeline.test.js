import DataPipelineService from '../../../src/services/data-pipeline/index.js';

describe('DataPipelineService', () => {
  let dataPipeline;
  let mockLogger;
  let mockEventBus;
  let mockStorageAdapters;
  let mockConfig;

  beforeEach(() => {
    mockLogger = global.testUtils.createMockLogger();
    mockEventBus = global.testUtils.createMockEventBus();
    
    mockStorageAdapters = {
      source: {
        read: jest.fn().mockResolvedValue([
          { id: 1, data: 'test1' },
          { id: 2, data: 'test2' }
        ]),
        isConnected: jest.fn().mockReturnValue(true)
      },
      destination: {
        write: jest.fn().mockResolvedValue(true),
        isConnected: jest.fn().mockReturnValue(true)
      }
    };

    mockConfig = {
      batchSize: 2,
      processingTimeout: 5000,
      maxRetries: 3,
      deadLetterQueue: true
    };

    dataPipeline = new DataPipelineService({
      logger: mockLogger,
      config: mockConfig,
      eventBus: mockEventBus,
      storageAdapters: mockStorageAdapters
    });
  });

  afterEach(async () => {
    await dataPipeline.shutdown();
    jest.clearAllMocks();
  });

  describe('pipeline registration', () => {
    it('should register a new pipeline', async () => {
      const pipelineConfig = {
        name: 'test-pipeline',
        source: 'source',
        destination: 'destination',
        processors: [],
        transformers: []
      };

      const pipelineId = await dataPipeline.registerPipeline(pipelineConfig);

      expect(pipelineId).toBeDefined();
      expect(dataPipeline.pipelines.has(pipelineId)).toBe(true);
    });

    it('should validate pipeline configuration', async () => {
      const invalidConfig = {
        name: 'invalid-pipeline',
        // Missing source and destination
      };

      await expect(dataPipeline.registerPipeline(invalidConfig))
        .rejects.toThrow('Source and destination are required');
    });

    it('should validate storage adapter existence', async () => {
      const pipelineConfig = {
        name: 'test-pipeline',
        source: 'nonexistent',
        destination: 'destination'
      };

      await expect(dataPipeline.registerPipeline(pipelineConfig))
        .rejects.toThrow('Source adapter not found: nonexistent');
    });
  });

  describe('pipeline execution', () => {
    let pipelineId;

    beforeEach(async () => {
      pipelineId = await dataPipeline.registerPipeline({
        name: 'exec-pipeline',
        source: 'source',
        destination: 'destination',
        processors: [
          { type: 'filter', config: { field: 'id', operator: '>', value: 1 } }
        ],
        transformers: [
          { type: 'map', config: { field: 'data', transform: 'uppercase' } }
        ]
      });
    });

    it('should execute pipeline successfully', async () => {
      const execution = await dataPipeline.executePipeline(pipelineId);

      expect(execution.executionId).toBeDefined();
      expect(execution.status).toBe('running');

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = dataPipeline.getExecutionStatus(execution.executionId);
      expect(status.status).toBe('completed');
      expect(status.processedCount).toBe(1); // After filter
    });

    it('should apply processors correctly', async () => {
      await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that filter was applied
      const writeCall = mockStorageAdapters.destination.write.mock.calls[0];
      expect(writeCall[0]).toHaveLength(1); // Only id:2 should pass filter
      expect(writeCall[0][0].id).toBe(2);
    });

    it('should apply transformers correctly', async () => {
      // Mock transformer
      dataPipeline.transformers.set('map', (data, config) => {
        if (config.transform === 'uppercase' && config.field === 'data') {
          return { ...data, data: data.data.toUpperCase() };
        }
        return data;
      });

      await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 100));

      const writeCall = mockStorageAdapters.destination.write.mock.calls[0];
      expect(writeCall[0][0].data).toBe('TEST2');
    });

    it('should handle execution errors', async () => {
      mockStorageAdapters.source.read.mockRejectedValueOnce(new Error('Read error'));

      const execution = await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = dataPipeline.getExecutionStatus(execution.executionId);
      expect(status.status).toBe('failed');
      expect(status.error).toBe('Read error');
    });

    it('should retry on failure', async () => {
      mockStorageAdapters.destination.write
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(true);

      await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mockStorageAdapters.destination.write).toHaveBeenCalledTimes(2);
    });
  });

  describe('batch processing', () => {
    it('should process data in batches', async () => {
      // Set up larger dataset
      const largeData = Array(10).fill(null).map((_, i) => ({
        id: i,
        data: `item${i}`
      }));
      mockStorageAdapters.source.read.mockResolvedValue(largeData);

      const pipelineId = await dataPipeline.registerPipeline({
        name: 'batch-pipeline',
        source: 'source',
        destination: 'destination',
        batchSize: 3
      });

      await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should write in batches of 3
      expect(mockStorageAdapters.destination.write).toHaveBeenCalledTimes(4);
      expect(mockStorageAdapters.destination.write.mock.calls[0][0]).toHaveLength(3);
      expect(mockStorageAdapters.destination.write.mock.calls[3][0]).toHaveLength(1);
    });
  });

  describe('scheduling', () => {
    it('should schedule pipeline execution', async () => {
      const pipelineId = await dataPipeline.registerPipeline({
        name: 'scheduled-pipeline',
        source: 'source',
        destination: 'destination'
      });

      const schedule = await dataPipeline.schedulePipeline(pipelineId, {
        interval: 100 // 100ms for testing
      });

      expect(schedule.scheduleId).toBeDefined();
      expect(schedule.nextRun).toBeDefined();

      // Wait for scheduled execution
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockStorageAdapters.source.read).toHaveBeenCalled();

      // Cancel schedule
      dataPipeline.cancelSchedule(schedule.scheduleId);
    });

    it('should handle cron expressions', async () => {
      const pipelineId = await dataPipeline.registerPipeline({
        name: 'cron-pipeline',
        source: 'source',
        destination: 'destination'
      });

      const schedule = await dataPipeline.schedulePipeline(pipelineId, {
        cron: '*/5 * * * * *' // Every 5 seconds
      });

      expect(schedule.cron).toBe('*/5 * * * * *');
      dataPipeline.cancelSchedule(schedule.scheduleId);
    });
  });

  describe('monitoring', () => {
    it('should emit pipeline events', async () => {
      const pipelineId = await dataPipeline.registerPipeline({
        name: 'event-pipeline',
        source: 'source',
        destination: 'destination'
      });

      await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'pipeline.execution.started',
        expect.any(Object)
      );
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'pipeline.execution.completed',
        expect.any(Object)
      );
    });

    it('should track pipeline metrics', async () => {
      const pipelineId = await dataPipeline.registerPipeline({
        name: 'metrics-pipeline',
        source: 'source',
        destination: 'destination'
      });

      await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = dataPipeline.getMetrics(pipelineId);

      expect(metrics).toMatchObject({
        totalExecutions: 1,
        successfulExecutions: 1,
        failedExecutions: 0,
        totalProcessed: 2,
        avgProcessingTime: expect.any(Number)
      });
    });
  });

  describe('dead letter queue', () => {
    it('should send failed items to DLQ', async () => {
      // Create processor that fails for specific items
      const failingProcessor = {
        type: 'failing',
        process: (item) => {
          if (item.id === 1) throw new Error('Processing failed');
          return item;
        }
      };

      dataPipeline.processors.set('failing', failingProcessor.process);

      const pipelineId = await dataPipeline.registerPipeline({
        name: 'dlq-pipeline',
        source: 'source',
        destination: 'destination',
        processors: [{ type: 'failing' }]
      });

      await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 100));

      const dlqItems = dataPipeline.getDeadLetterQueue(pipelineId);
      expect(dlqItems).toHaveLength(1);
      expect(dlqItems[0].item.id).toBe(1);
      expect(dlqItems[0].error).toBe('Processing failed');
    });

    it('should retry DLQ items', async () => {
      const pipelineId = await dataPipeline.registerPipeline({
        name: 'retry-dlq-pipeline',
        source: 'source',
        destination: 'destination'
      });

      // Add item to DLQ
      dataPipeline.deadLetterQueues.set(pipelineId, [{
        item: { id: 99, data: 'retry-me' },
        error: 'Previous failure',
        timestamp: new Date()
      }]);

      await dataPipeline.retryDeadLetterQueue(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockStorageAdapters.destination.write).toHaveBeenCalledWith([
        { id: 99, data: 'retry-me' }
      ]);
    });
  });

  describe('custom processors and transformers', () => {
    it('should register custom processors', () => {
      const customProcessor = jest.fn((item) => item.id > 5 ? item : null);
      
      dataPipeline.registerProcessor('custom-filter', customProcessor);

      expect(dataPipeline.processors.has('custom-filter')).toBe(true);
    });

    it('should register custom transformers', () => {
      const customTransformer = jest.fn((item) => ({
        ...item,
        transformed: true
      }));

      dataPipeline.registerTransformer('add-flag', customTransformer);

      expect(dataPipeline.transformers.has('add-flag')).toBe(true);
    });

    it('should use custom components in pipeline', async () => {
      const customProcessor = jest.fn((item) => item);
      const customTransformer = jest.fn((item) => ({ ...item, custom: true }));

      dataPipeline.registerProcessor('custom-proc', customProcessor);
      dataPipeline.registerTransformer('custom-trans', customTransformer);

      const pipelineId = await dataPipeline.registerPipeline({
        name: 'custom-pipeline',
        source: 'source',
        destination: 'destination',
        processors: [{ type: 'custom-proc' }],
        transformers: [{ type: 'custom-trans' }]
      });

      await dataPipeline.executePipeline(pipelineId);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(customProcessor).toHaveBeenCalled();
      expect(customTransformer).toHaveBeenCalled();
    });
  });
});