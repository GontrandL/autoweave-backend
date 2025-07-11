import { Router } from 'express';

/**
 * Analytics routes
 */
const router = Router();

export default (analyticsEngine) => {
  /**
   * Track an event
   */
  router.post('/track', async (req, res, next) => {
    try {
      const { event, properties, userId, timestamp } = req.body;
      
      if (!event) {
        return res.status(400).json({ 
          error: 'Event name is required' 
        });
      }
      
      await analyticsEngine.track({
        event,
        properties: properties || {},
        userId: userId || 'anonymous',
        timestamp: timestamp || new Date()
      });
      
      res.json({ 
        success: true,
        message: 'Event tracked successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get analytics for a specific metric
   */
  router.get('/metrics/:metric', async (req, res, next) => {
    try {
      const { metric } = req.params;
      const { 
        startDate, 
        endDate, 
        groupBy = 'hour',
        filter 
      } = req.query;
      
      const data = await analyticsEngine.getMetric(metric, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        groupBy,
        filter: filter ? JSON.parse(filter) : undefined
      });
      
      res.json({ 
        metric,
        data,
        period: { startDate, endDate },
        groupBy
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get dashboard overview
   */
  router.get('/dashboard', async (req, res, next) => {
    try {
      const { period = '24h' } = req.query;
      
      const overview = await analyticsEngine.getDashboard(period);
      
      res.json(overview);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get funnel analysis
   */
  router.post('/funnel', async (req, res, next) => {
    try {
      const { steps, startDate, endDate, userId } = req.body;
      
      if (!steps || !Array.isArray(steps) || steps.length < 2) {
        return res.status(400).json({ 
          error: 'At least 2 funnel steps are required' 
        });
      }
      
      const funnel = await analyticsEngine.analyzeFunnel({
        steps,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        userId
      });
      
      res.json(funnel);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get cohort analysis
   */
  router.get('/cohorts', async (req, res, next) => {
    try {
      const { 
        cohortType = 'weekly',
        metric = 'retention',
        periods = 4 
      } = req.query;
      
      const cohorts = await analyticsEngine.analyzeCohorts({
        cohortType,
        metric,
        periods: parseInt(periods)
      });
      
      res.json(cohorts);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get user analytics
   */
  router.get('/users/:userId', async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      
      const userAnalytics = await analyticsEngine.getUserAnalytics(userId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });
      
      res.json(userAnalytics);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Export analytics data
   */
  router.post('/export', async (req, res, next) => {
    try {
      const { 
        metrics,
        startDate,
        endDate,
        format = 'json',
        groupBy = 'day'
      } = req.body;
      
      if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({ 
          error: 'Metrics array is required' 
        });
      }
      
      const data = await analyticsEngine.exportData({
        metrics,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        format,
        groupBy
      });
      
      // Set appropriate content type
      const contentTypes = {
        json: 'application/json',
        csv: 'text/csv',
        excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
      
      res.setHeader('Content-Type', contentTypes[format] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-export.${format}`);
      
      res.send(data);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get real-time analytics
   */
  router.get('/realtime', (req, res, next) => {
    try {
      const realtime = analyticsEngine.getRealtimeStats();
      res.json(realtime);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Create custom report
   */
  router.post('/reports', async (req, res, next) => {
    try {
      const reportConfig = req.body;
      
      if (!reportConfig.name || !reportConfig.queries) {
        return res.status(400).json({ 
          error: 'Report name and queries are required' 
        });
      }
      
      const reportId = await analyticsEngine.createReport(reportConfig);
      
      res.json({ 
        success: true,
        reportId,
        message: 'Report created successfully' 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get report
   */
  router.get('/reports/:reportId', async (req, res, next) => {
    try {
      const { reportId } = req.params;
      const { regenerate = false } = req.query;
      
      const report = await analyticsEngine.getReport(reportId, {
        regenerate: regenerate === 'true'
      });
      
      if (!report) {
        return res.status(404).json({ 
          error: 'Report not found' 
        });
      }
      
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  return router;
};