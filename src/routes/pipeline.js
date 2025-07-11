import { Router } from 'express';

/**
 * Data pipeline routes
 */
const router = Router();

export default (dataPipeline) => {
  /**
   * Register a new pipeline
   */
  router.post('/register', async (req, res, next) => {
    try {
      const pipelineConfig = req.body;
      
      if (!pipelineConfig.name || !pipelineConfig.source || !pipelineConfig.destination) {
        return res.status(400).json({ 
          error: 'Pipeline name, source, and destination are required' 
        });
      }
      
      const pipelineId = await dataPipeline.registerPipeline(pipelineConfig);
      
      res.json({ 
        success: true,
        pipelineId,
        message: 'Pipeline registered successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Execute a pipeline
   */
  router.post('/:id/execute', async (req, res, next) => {
    try {
      const { force = false } = req.body;
      
      const result = await dataPipeline.executePipeline(req.params.id, { force });
      
      res.json({ 
        success: true,
        executionId: result.executionId,
        processed: result.processed,
        duration: result.duration
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get pipeline status
   */
  router.get('/:id/status', (req, res, next) => {
    try {
      const status = dataPipeline.getPipelineStatus(req.params.id);
      res.json(status);
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        next(error);
      }
    }
  });

  /**
   * List all pipelines
   */
  router.get('/', (req, res, next) => {
    try {
      const pipelines = dataPipeline.getAllPipelines();
      res.json({ 
        pipelines,
        total: pipelines.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Pause a pipeline
   */
  router.post('/:id/pause', async (req, res, next) => {
    try {
      await dataPipeline.pausePipeline(req.params.id);
      res.json({ 
        success: true,
        message: 'Pipeline paused successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Resume a pipeline
   */
  router.post('/:id/resume', async (req, res, next) => {
    try {
      await dataPipeline.resumePipeline(req.params.id);
      res.json({ 
        success: true,
        message: 'Pipeline resumed successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Delete a pipeline
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      await dataPipeline.deletePipeline(req.params.id);
      res.json({ 
        success: true,
        message: 'Pipeline deleted successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get pipeline metrics
   */
  router.get('/metrics', (req, res, next) => {
    try {
      const metrics = dataPipeline.getMetrics();
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Register a processor
   */
  router.post('/processors/register', (req, res, next) => {
    try {
      const { name, code } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ 
          error: 'Processor name and code are required' 
        });
      }
      
      // Create processor function from code
      const processor = new Function('return ' + code)();
      dataPipeline.registerProcessor(name, processor);
      
      res.json({ 
        success: true,
        message: 'Processor registered successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Register a transformer
   */
  router.post('/transformers/register', (req, res, next) => {
    try {
      const { name, code } = req.body;
      
      if (!name || !code) {
        return res.status(400).json({ 
          error: 'Transformer name and code are required' 
        });
      }
      
      // Create transformer function from code
      const transformer = new Function('return ' + code)();
      dataPipeline.registerTransformer(name, transformer);
      
      res.json({ 
        success: true,
        message: 'Transformer registered successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get dead letter queue
   */
  router.get('/dlq', (req, res, next) => {
    try {
      const { limit = 100 } = req.query;
      
      const dlq = dataPipeline.dlq.slice(0, parseInt(limit));
      
      res.json({ 
        items: dlq,
        total: dataPipeline.dlq.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Process dead letter queue
   */
  router.post('/dlq/process', async (req, res, next) => {
    try {
      const { handler } = req.body;
      
      if (!handler) {
        // Default handler: retry original pipeline
        await dataPipeline.processDeadLetterQueue(async (item) => {
          const pipeline = dataPipeline.pipelines.get(item.pipeline);
          if (pipeline) {
            await dataPipeline.processBatch([item.item], pipeline, item.executionId);
          }
        });
      } else {
        // Custom handler
        const handlerFn = new Function('return ' + handler)();
        await dataPipeline.processDeadLetterQueue(handlerFn);
      }
      
      res.json({ 
        success: true,
        message: 'Dead letter queue processed' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Clear dead letter queue
   */
  router.delete('/dlq', (req, res, next) => {
    try {
      const count = dataPipeline.dlq.length;
      dataPipeline.dlq = [];
      
      res.json({ 
        success: true,
        cleared: count,
        message: 'Dead letter queue cleared' 
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};