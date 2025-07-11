import { Router } from 'express';

/**
 * Service management routes
 */
const router = Router();

export default (serviceManager) => {
  /**
   * Register a new service
   */
  router.post('/register', async (req, res, next) => {
    try {
      const serviceId = await serviceManager.registerService(req.body);
      res.json({ 
        success: true, 
        serviceId,
        message: 'Service registered successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Start a service
   */
  router.post('/:id/start', async (req, res, next) => {
    try {
      await serviceManager.startService(req.params.id);
      res.json({ 
        success: true,
        message: 'Service started successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Stop a service
   */
  router.post('/:id/stop', async (req, res, next) => {
    try {
      await serviceManager.stopService(req.params.id);
      res.json({ 
        success: true,
        message: 'Service stopped successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get service status
   */
  router.get('/:id/status', (req, res, next) => {
    try {
      const service = serviceManager.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ 
          error: 'Service not found' 
        });
      }
      
      res.json({
        id: service.id,
        name: service.name,
        status: service.status,
        health: service.lastHealthCheck,
        uptime: service.startedAt ? Date.now() - service.startedAt.getTime() : 0,
        metrics: service.metrics
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get all services
   */
  router.get('/', (req, res, next) => {
    try {
      const services = serviceManager.listServices();
      res.json({ 
        services: services.map(s => ({
          id: s.id,
          name: s.name,
          version: s.version,
          status: s.status,
          health: s.lastHealthCheck?.status
        })),
        total: services.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get health status of all services
   */
  router.get('/health', (req, res, next) => {
    try {
      const health = serviceManager.getHealthStatus();
      
      // Determine overall health
      const unhealthyServices = Object.values(health).filter(
        s => s.health?.status === 'unhealthy' || s.status !== 'running'
      );
      
      res.status(unhealthyServices.length > 0 ? 503 : 200).json({
        status: unhealthyServices.length > 0 ? 'degraded' : 'healthy',
        services: health,
        unhealthyCount: unhealthyServices.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Deregister a service
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      await serviceManager.deregisterService(req.params.id);
      res.json({ 
        success: true,
        message: 'Service deregistered successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Discover services
   */
  router.post('/discover', (req, res, next) => {
    try {
      const services = serviceManager.registry.discover(req.body);
      res.json({ 
        services,
        total: services.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get registry statistics
   */
  router.get('/registry/stats', (req, res, next) => {
    try {
      const stats = serviceManager.registry.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  return router;
};