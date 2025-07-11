import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import pRetry from 'p-retry';
import PQueue from 'p-queue';

/**
 * Data Pipeline Service - Orchestrates data flows between storage systems
 */
class DataPipelineService extends EventEmitter {
  constructor({ logger, config, eventBus, storageAdapters }) {
    super();
    this.logger = logger;
    this.config = config;
    this.eventBus = eventBus;
    this.storageAdapters = storageAdapters;
    
    // Pipeline configuration
    this.pipelines = new Map();
    this.processors = new Map();
    this.transformers = new Map();
    
    // Processing queues
    this.queues = new Map();
    this.defaultQueue = new PQueue({ 
      concurrency: config.concurrency || 10,
      interval: config.interval || 1000,
      intervalCap: config.intervalCap || 100
    });
    
    // Metrics
    this.metrics = {
      processed: 0,
      failed: 0,
      inProgress: 0,
      avgProcessingTime: []
    };
    
    // Dead letter queue
    this.dlq = [];
    this.maxDLQSize = config.maxDLQSize || 10000;
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Subscribe to data events
    this.eventBus.subscribe('data.*', this.handleDataEvent.bind(this));
    
    // Subscribe to pipeline control events
    this.eventBus.subscribe('pipeline.control.*', this.handleControlEvent.bind(this));
  }

  /**
   * Register a data pipeline
   * @param {Object} pipelineConfig - Pipeline configuration
   */
  async registerPipeline(pipelineConfig) {
    const pipelineId = pipelineConfig.id || uuidv4();
    
    const pipeline = {
      id: pipelineId,
      name: pipelineConfig.name,
      source: pipelineConfig.source,
      destination: pipelineConfig.destination,
      processors: pipelineConfig.processors || [],
      transformers: pipelineConfig.transformers || [],
      filters: pipelineConfig.filters || [],
      batchSize: pipelineConfig.batchSize || 100,
      concurrency: pipelineConfig.concurrency || 5,
      retryOptions: pipelineConfig.retryOptions || { retries: 3 },
      enabled: pipelineConfig.enabled !== false,
      schedule: pipelineConfig.schedule,
      metadata: pipelineConfig.metadata || {},
      createdAt: new Date(),
      lastRun: null,
      stats: {
        runs: 0,
        successes: 0,
        failures: 0,
        totalProcessed: 0,
        avgDuration: 0
      }
    };
    
    // Validate source and destination adapters
    if (!this.storageAdapters[pipeline.source.type]) {
      throw new Error(`Source adapter ${pipeline.source.type} not found`);
    }
    if (!this.storageAdapters[pipeline.destination.type]) {
      throw new Error(`Destination adapter ${pipeline.destination.type} not found`);
    }
    
    // Create dedicated queue if needed
    if (pipelineConfig.dedicatedQueue) {
      this.queues.set(pipelineId, new PQueue({
        concurrency: pipeline.concurrency,
        interval: pipelineConfig.queueInterval || 1000,
        intervalCap: pipelineConfig.queueIntervalCap || pipeline.batchSize
      }));
    }
    
    this.pipelines.set(pipelineId, pipeline);
    
    // Schedule if needed
    if (pipeline.schedule) {
      this.schedulePipeline(pipelineId, pipeline.schedule);
    }
    
    this.logger.info(`Pipeline registered: ${pipeline.name} (${pipelineId})`);
    this.emit('pipeline:registered', pipeline);
    
    return pipelineId;
  }

  /**
   * Register a data processor
   * @param {string} name - Processor name
   * @param {Function} processor - Processor function
   */
  registerProcessor(name, processor) {
    if (typeof processor !== 'function') {
      throw new Error('Processor must be a function');
    }
    
    this.processors.set(name, processor);
    this.logger.debug(`Processor registered: ${name}`);
  }

  /**
   * Register a data transformer
   * @param {string} name - Transformer name
   * @param {Function} transformer - Transformer function
   */
  registerTransformer(name, transformer) {
    if (typeof transformer !== 'function') {
      throw new Error('Transformer must be a function');
    }
    
    this.transformers.set(name, transformer);
    this.logger.debug(`Transformer registered: ${name}`);
  }

  /**
   * Execute a pipeline
   * @param {string} pipelineId - Pipeline ID
   * @param {Object} options - Execution options
   */
  async executePipeline(pipelineId, options = {}) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }
    
    if (!pipeline.enabled && !options.force) {
      throw new Error(`Pipeline ${pipeline.name} is disabled`);
    }
    
    const executionId = uuidv4();
    const startTime = Date.now();
    
    this.logger.info(`Executing pipeline: ${pipeline.name} (${executionId})`);
    this.emit('pipeline:started', { pipelineId, executionId });
    
    try {
      // Get source adapter
      const sourceAdapter = this.storageAdapters[pipeline.source.type];
      
      // Create cursor for streaming
      const cursor = await sourceAdapter.createCursor(pipeline.source.config);
      
      let batch = [];
      let totalProcessed = 0;
      let hasMore = true;
      
      while (hasMore) {
        // Fetch batch
        const items = await cursor.next(pipeline.batchSize);
        hasMore = items.length === pipeline.batchSize;
        
        if (items.length === 0) break;
        
        // Process batch
        const processedBatch = await this.processBatch(
          items,
          pipeline,
          executionId
        );
        
        // Write to destination
        await this.writeBatch(
          processedBatch,
          pipeline,
          executionId
        );
        
        totalProcessed += processedBatch.length;
        
        // Emit progress
        this.emit('pipeline:progress', {
          pipelineId,
          executionId,
          processed: totalProcessed,
          currentBatch: processedBatch.length
        });
      }
      
      // Update pipeline stats
      const duration = Date.now() - startTime;
      pipeline.lastRun = new Date();
      pipeline.stats.runs++;
      pipeline.stats.successes++;
      pipeline.stats.totalProcessed += totalProcessed;
      pipeline.stats.avgDuration = 
        (pipeline.stats.avgDuration * (pipeline.stats.runs - 1) + duration) / 
        pipeline.stats.runs;
      
      this.logger.info(`Pipeline completed: ${pipeline.name}`, {
        executionId,
        processed: totalProcessed,
        duration: `${duration}ms`
      });
      
      this.emit('pipeline:completed', {
        pipelineId,
        executionId,
        processed: totalProcessed,
        duration
      });
      
      return { executionId, processed: totalProcessed, duration };
      
    } catch (error) {
      pipeline.stats.failures++;
      
      this.logger.error(`Pipeline failed: ${pipeline.name}`, error);
      this.emit('pipeline:failed', {
        pipelineId,
        executionId,
        error
      });
      
      throw error;
    }
  }

  /**
   * Process a batch of items
   * @param {Array} items - Items to process
   * @param {Object} pipeline - Pipeline configuration
   * @param {string} executionId - Execution ID
   */
  async processBatch(items, pipeline, executionId) {
    const queue = this.queues.get(pipeline.id) || this.defaultQueue;
    const processed = [];
    
    const processingTasks = items.map(item => 
      queue.add(async () => {
        try {
          let processedItem = item;
          
          // Apply filters
          for (const filter of pipeline.filters) {
            if (typeof filter === 'function') {
              if (!await filter(processedItem)) {
                return null; // Filtered out
              }
            }
          }
          
          // Apply processors
          for (const processorName of pipeline.processors) {
            const processor = this.processors.get(processorName);
            if (!processor) {
              throw new Error(`Processor ${processorName} not found`);
            }
            
            processedItem = await pRetry(
              () => processor(processedItem, { pipeline, executionId }),
              pipeline.retryOptions
            );
          }
          
          // Apply transformers
          for (const transformerName of pipeline.transformers) {
            const transformer = this.transformers.get(transformerName);
            if (!transformer) {
              throw new Error(`Transformer ${transformerName} not found`);
            }
            
            processedItem = await transformer(processedItem, { pipeline, executionId });
          }
          
          return processedItem;
          
        } catch (error) {
          this.logger.error('Item processing failed', error);
          
          // Add to DLQ
          if (this.config.deadLetterQueue !== false) {
            this.addToDeadLetterQueue({
              item,
              pipeline: pipeline.id,
              executionId,
              error: error.message,
              timestamp: new Date()
            });
          }
          
          this.metrics.failed++;
          throw error;
        }
      })
    );
    
    const results = await Promise.allSettled(processingTasks);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        processed.push(result.value);
        this.metrics.processed++;
      }
    }
    
    return processed;
  }

  /**
   * Write batch to destination
   * @param {Array} batch - Processed batch
   * @param {Object} pipeline - Pipeline configuration
   * @param {string} executionId - Execution ID
   */
  async writeBatch(batch, pipeline, executionId) {
    if (batch.length === 0) return;
    
    const destinationAdapter = this.storageAdapters[pipeline.destination.type];
    
    await pRetry(
      async () => {
        await destinationAdapter.writeBatch(batch, pipeline.destination.config);
        
        // Emit write event
        this.eventBus.publish('pipeline.data.written', {
          pipelineId: pipeline.id,
          executionId,
          count: batch.length,
          destination: pipeline.destination.type
        });
      },
      pipeline.retryOptions
    );
  }

  /**
   * Handle data events
   * @param {Object} event - Data event
   */
  async handleDataEvent(event) {
    const { topic, data } = event;
    
    // Find pipelines that are triggered by this event
    const triggeredPipelines = Array.from(this.pipelines.values()).filter(
      p => p.triggers && p.triggers.includes(topic)
    );
    
    for (const pipeline of triggeredPipelines) {
      try {
        await this.executePipeline(pipeline.id, { 
          triggerEvent: event,
          data: data 
        });
      } catch (error) {
        this.logger.error(`Failed to execute triggered pipeline ${pipeline.name}`, error);
      }
    }
  }

  /**
   * Handle control events
   * @param {Object} event - Control event
   */
  async handleControlEvent(event) {
    const { topic, data } = event;
    const action = topic.split('.').pop();
    
    switch (action) {
      case 'pause':
        await this.pausePipeline(data.pipelineId);
        break;
      case 'resume':
        await this.resumePipeline(data.pipelineId);
        break;
      case 'flush':
        await this.flushPipeline(data.pipelineId);
        break;
      default:
        this.logger.warn(`Unknown control action: ${action}`);
    }
  }

  /**
   * Schedule a pipeline
   * @param {string} pipelineId - Pipeline ID
   * @param {Object} schedule - Schedule configuration
   */
  schedulePipeline(pipelineId, schedule) {
    // This would integrate with a job scheduler like node-cron
    // For now, we'll use a simple interval
    if (schedule.interval) {
      const intervalId = setInterval(
        () => this.executePipeline(pipelineId).catch(err => 
          this.logger.error(`Scheduled pipeline execution failed: ${pipelineId}`, err)
        ),
        schedule.interval
      );
      
      // Store interval ID for cleanup
      const pipeline = this.pipelines.get(pipelineId);
      if (pipeline) {
        pipeline.intervalId = intervalId;
      }
    }
  }

  /**
   * Pause a pipeline
   * @param {string} pipelineId - Pipeline ID
   */
  async pausePipeline(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }
    
    pipeline.enabled = false;
    
    // Clear schedule if exists
    if (pipeline.intervalId) {
      clearInterval(pipeline.intervalId);
      delete pipeline.intervalId;
    }
    
    // Pause queue if dedicated
    const queue = this.queues.get(pipelineId);
    if (queue) {
      queue.pause();
    }
    
    this.logger.info(`Pipeline paused: ${pipeline.name}`);
    this.emit('pipeline:paused', { pipelineId });
  }

  /**
   * Resume a pipeline
   * @param {string} pipelineId - Pipeline ID
   */
  async resumePipeline(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }
    
    pipeline.enabled = true;
    
    // Reschedule if needed
    if (pipeline.schedule && !pipeline.intervalId) {
      this.schedulePipeline(pipelineId, pipeline.schedule);
    }
    
    // Resume queue if dedicated
    const queue = this.queues.get(pipelineId);
    if (queue) {
      queue.start();
    }
    
    this.logger.info(`Pipeline resumed: ${pipeline.name}`);
    this.emit('pipeline:resumed', { pipelineId });
  }

  /**
   * Flush a pipeline (process all pending items immediately)
   * @param {string} pipelineId - Pipeline ID
   */
  async flushPipeline(pipelineId) {
    const queue = this.queues.get(pipelineId) || this.defaultQueue;
    await queue.onIdle();
    
    this.logger.info(`Pipeline flushed: ${pipelineId}`);
    this.emit('pipeline:flushed', { pipelineId });
  }

  /**
   * Add item to dead letter queue
   * @param {Object} item - Failed item with metadata
   */
  addToDeadLetterQueue(item) {
    this.dlq.push(item);
    
    // Limit DLQ size
    if (this.dlq.length > this.maxDLQSize) {
      const removed = this.dlq.shift();
      this.logger.warn('DLQ size limit reached, removing oldest item', removed);
    }
    
    this.emit('dlq:added', item);
  }

  /**
   * Process dead letter queue
   * @param {Function} handler - Handler function for DLQ items
   */
  async processDeadLetterQueue(handler) {
    const items = [...this.dlq];
    this.dlq = [];
    
    for (const item of items) {
      try {
        await handler(item);
      } catch (error) {
        this.logger.error('DLQ processing failed', error);
        // Re-add to DLQ
        this.dlq.push(item);
      }
    }
  }

  /**
   * Get pipeline status
   * @param {string} pipelineId - Pipeline ID
   */
  getPipelineStatus(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }
    
    const queue = this.queues.get(pipelineId) || this.defaultQueue;
    
    return {
      id: pipeline.id,
      name: pipeline.name,
      enabled: pipeline.enabled,
      lastRun: pipeline.lastRun,
      stats: pipeline.stats,
      queue: {
        size: queue.size,
        pending: queue.pending,
        isPaused: queue.isPaused
      }
    };
  }

  /**
   * Get all pipelines
   */
  getAllPipelines() {
    return Array.from(this.pipelines.values()).map(p => ({
      id: p.id,
      name: p.name,
      source: p.source.type,
      destination: p.destination.type,
      enabled: p.enabled,
      lastRun: p.lastRun,
      stats: p.stats
    }));
  }

  /**
   * Get pipeline metrics
   */
  getMetrics() {
    const avgProcessingTime = this.metrics.avgProcessingTime.length > 0
      ? this.metrics.avgProcessingTime.reduce((a, b) => a + b) / this.metrics.avgProcessingTime.length
      : 0;
    
    return {
      totalProcessed: this.metrics.processed,
      totalFailed: this.metrics.failed,
      inProgress: this.metrics.inProgress,
      avgProcessingTime,
      dlqSize: this.dlq.length,
      pipelines: this.pipelines.size,
      processors: this.processors.size,
      transformers: this.transformers.size
    };
  }

  /**
   * Delete a pipeline
   * @param {string} pipelineId - Pipeline ID
   */
  async deletePipeline(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }
    
    // Pause first
    await this.pausePipeline(pipelineId);
    
    // Remove dedicated queue
    const queue = this.queues.get(pipelineId);
    if (queue) {
      await queue.clear();
      this.queues.delete(pipelineId);
    }
    
    // Remove pipeline
    this.pipelines.delete(pipelineId);
    
    this.logger.info(`Pipeline deleted: ${pipeline.name}`);
    this.emit('pipeline:deleted', { pipelineId });
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    this.logger.info('Shutting down data pipeline service...');
    
    // Pause all pipelines
    for (const pipelineId of this.pipelines.keys()) {
      await this.pausePipeline(pipelineId);
    }
    
    // Clear all queues
    await this.defaultQueue.clear();
    for (const queue of this.queues.values()) {
      await queue.clear();
    }
    
    this.emit('shutdown');
  }
}

export default DataPipelineService;