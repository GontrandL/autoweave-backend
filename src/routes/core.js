import { Router } from 'express';

/**
 * Core integration routes
 */
export default function createCoreRouter(coreConnector) {
  const router = Router();

  // Get connection status
  router.get('/status', (req, res) => {
    const status = coreConnector.getStatus();
    res.json(status);
  });

  // Connect to AutoWeave Core
  router.post('/connect', async (req, res) => {
    try {
      await coreConnector.connect();
      res.json({
        success: true,
        message: 'Connected to AutoWeave Core',
        status: coreConnector.getStatus()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Disconnect from Core
  router.post('/disconnect', async (req, res) => {
    try {
      await coreConnector.disconnect();
      res.json({
        success: true,
        message: 'Disconnected from AutoWeave Core'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get agent from Core
  router.get('/agents/:id', async (req, res) => {
    try {
      const agent = await coreConnector.getAgent(req.params.id);
      res.json(agent);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // Update agent in Core
  router.patch('/agents/:id', async (req, res) => {
    try {
      const result = await coreConnector.updateAgent(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // Create memory in Core
  router.post('/memory', async (req, res) => {
    try {
      const result = await coreConnector.createMemory(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // Search memories in Core
  router.post('/memory/search', async (req, res) => {
    try {
      const results = await coreConnector.searchMemories(req.body);
      res.json(results);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // Send event to Core
  router.post('/events', async (req, res) => {
    try {
      const { topic, data } = req.body;
      coreConnector.forwardEventToCore(topic, { data });
      res.json({
        success: true,
        message: 'Event forwarded to Core'
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // Request to Core API
  router.post('/request', async (req, res) => {
    try {
      const { endpoint, method = 'GET', data } = req.body;
      const result = await coreConnector.requestToCore(endpoint, method, data);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  // Register service with Core
  router.post('/services/register', async (req, res) => {
    try {
      await coreConnector.registerServiceViaANP(req.body);
      res.json({
        success: true,
        message: 'Service registered with Core'
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  });

  return router;
}