import { Router } from 'express';

/**
 * Event bus routes
 */
const router = Router();

export default (eventBus) => {
  /**
   * Publish an event
   */
  router.post('/publish', async (req, res, next) => {
    try {
      const { topic, data, options } = req.body;
      
      if (!topic) {
        return res.status(400).json({ 
          error: 'Topic is required' 
        });
      }
      
      const eventId = await eventBus.publish(topic, data, options);
      
      res.json({ 
        success: true, 
        eventId,
        message: 'Event published successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get event history
   */
  router.get('/history', (req, res, next) => {
    try {
      const filter = {
        topic: req.query.topic,
        since: req.query.since,
        until: req.query.until,
        correlationId: req.query.correlationId,
        limit: parseInt(req.query.limit) || 100
      };
      
      const events = eventBus.getHistory(filter);
      
      res.json({ 
        events,
        total: events.length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Clear event history
   */
  router.delete('/history', (req, res, next) => {
    try {
      eventBus.clearHistory();
      res.json({ 
        success: true,
        message: 'Event history cleared' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get event bus metrics
   */
  router.get('/metrics', (req, res, next) => {
    try {
      const metrics = eventBus.getMetrics();
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Subscribe to events (returns subscription info for WebSocket)
   */
  router.post('/subscribe', (req, res, next) => {
    try {
      const { topic } = req.body;
      
      if (!topic) {
        return res.status(400).json({ 
          error: 'Topic is required' 
        });
      }
      
      // Return WebSocket connection info
      res.json({ 
        success: true,
        message: 'Use WebSocket connection to receive events',
        websocket: {
          url: `ws://${req.get('host')}/ws`,
          protocol: 'event-subscription',
          message: {
            type: 'subscribe',
            topic
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Request-response pattern
   */
  router.post('/request', async (req, res, next) => {
    try {
      const { topic, data, timeout } = req.body;
      
      if (!topic) {
        return res.status(400).json({ 
          error: 'Topic is required' 
        });
      }
      
      const response = await eventBus.request(topic, data, { timeout });
      
      res.json({ 
        success: true,
        response 
      });
    } catch (error) {
      if (error.message.includes('Timeout')) {
        res.status(408).json({ 
          error: 'Request timeout' 
        });
      } else {
        next(error);
      }
    }
  });

  /**
   * Get active subscriptions (debug endpoint)
   */
  router.get('/subscriptions', (req, res, next) => {
    try {
      const subscriptions = Array.from(eventBus.localSubscriptions.entries()).map(
        ([topic, subs]) => ({
          topic,
          count: subs.length
        })
      );
      
      res.json({ 
        subscriptions,
        total: subscriptions.length
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};