import { Router } from 'express';

/**
 * Integration routes for external modules
 */
const router = Router();

export default (integrationHub) => {
  /**
   * Register a new integration
   */
  router.post('/register', async (req, res, next) => {
    try {
      const integrationConfig = req.body;
      
      if (!integrationConfig.name || !integrationConfig.type) {
        return res.status(400).json({ 
          error: 'Integration name and type are required' 
        });
      }
      
      const integrationId = await integrationHub.registerIntegration(integrationConfig);
      
      res.json({ 
        success: true,
        integrationId,
        message: 'Integration registered successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * List all integrations
   */
  router.get('/', (req, res, next) => {
    try {
      const { type, status, tag } = req.query;
      
      const integrations = integrationHub.listIntegrations({
        type,
        status,
        tag
      });
      
      res.json({ 
        integrations,
        total: integrations.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get integration details
   */
  router.get('/:id', (req, res, next) => {
    try {
      const integration = integrationHub.getIntegration(req.params.id);
      
      if (!integration) {
        return res.status(404).json({ 
          error: 'Integration not found' 
        });
      }
      
      res.json(integration);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Enable integration
   */
  router.post('/:id/enable', async (req, res, next) => {
    try {
      await integrationHub.enableIntegration(req.params.id);
      
      res.json({ 
        success: true,
        message: 'Integration enabled successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Disable integration
   */
  router.post('/:id/disable', async (req, res, next) => {
    try {
      await integrationHub.disableIntegration(req.params.id);
      
      res.json({ 
        success: true,
        message: 'Integration disabled successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Test integration connection
   */
  router.post('/:id/test', async (req, res, next) => {
    try {
      const result = await integrationHub.testIntegration(req.params.id);
      
      res.json({ 
        success: result.success,
        message: result.message,
        details: result.details
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Execute integration action
   */
  router.post('/:id/execute', async (req, res, next) => {
    try {
      const { action, params } = req.body;
      
      if (!action) {
        return res.status(400).json({ 
          error: 'Action is required' 
        });
      }
      
      const result = await integrationHub.executeAction(
        req.params.id,
        action,
        params
      );
      
      res.json({ 
        success: true,
        result 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get integration metrics
   */
  router.get('/:id/metrics', async (req, res, next) => {
    try {
      const { period = '1h' } = req.query;
      
      const metrics = await integrationHub.getIntegrationMetrics(
        req.params.id,
        period
      );
      
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Update integration configuration
   */
  router.put('/:id/config', async (req, res, next) => {
    try {
      const config = req.body;
      
      await integrationHub.updateIntegrationConfig(req.params.id, config);
      
      res.json({ 
        success: true,
        message: 'Integration configuration updated' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Delete integration
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      await integrationHub.deleteIntegration(req.params.id);
      
      res.json({ 
        success: true,
        message: 'Integration deleted successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Discover available integrations
   */
  router.get('/discover/available', async (req, res, next) => {
    try {
      const available = await integrationHub.discoverAvailable();
      
      res.json({ 
        integrations: available,
        total: available.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Install integration from registry
   */
  router.post('/install', async (req, res, next) => {
    try {
      const { source, name, version } = req.body;
      
      if (!source || !name) {
        return res.status(400).json({ 
          error: 'Source and name are required' 
        });
      }
      
      const integrationId = await integrationHub.installIntegration({
        source,
        name,
        version
      });
      
      res.json({ 
        success: true,
        integrationId,
        message: 'Integration installed successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get integration logs
   */
  router.get('/:id/logs', async (req, res, next) => {
    try {
      const { 
        startTime,
        endTime,
        level,
        limit = 100 
      } = req.query;
      
      const logs = await integrationHub.getIntegrationLogs(req.params.id, {
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        level,
        limit: parseInt(limit)
      });
      
      res.json({ 
        logs,
        total: logs.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Sync integration data
   */
  router.post('/:id/sync', async (req, res, next) => {
    try {
      const { full = false } = req.body;
      
      const result = await integrationHub.syncIntegration(req.params.id, { full });
      
      res.json({ 
        success: true,
        synced: result.synced,
        duration: result.duration,
        message: 'Integration synced successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};