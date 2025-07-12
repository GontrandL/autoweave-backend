/**
 * @swagger
 * components:
 *   schemas:
 *     AnalyticsEvent:
 *       type: object
 *       required:
 *         - event
 *       properties:
 *         event:
 *           type: string
 *           description: Event name
 *           example: page_view
 *         properties:
 *           type: object
 *           additionalProperties: true
 *           description: Event properties
 *           example:
 *             page: /home
 *             duration: 1500
 *         userId:
 *           type: string
 *           description: User identifier
 *           default: anonymous
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Event timestamp (defaults to current time)
 *     Metric:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Metric name
 *         value:
 *           type: number
 *           description: Metric value
 *         timestamp:
 *           type: string
 *           format: date-time
 *         labels:
 *           type: object
 *           additionalProperties:
 *             type: string
 *     FunnelStep:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Step name/event
 *         count:
 *           type: integer
 *           description: Number of users who reached this step
 *         conversionRate:
 *           type: number
 *           format: float
 *           description: Conversion rate from previous step (percentage)
 *     FunnelAnalysis:
 *       type: object
 *       properties:
 *         steps:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FunnelStep'
 *         totalUsers:
 *           type: integer
 *         overallConversion:
 *           type: number
 *           format: float
 *         period:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               format: date-time
 *             end:
 *               type: string
 *               format: date-time
 *     DashboardData:
 *       type: object
 *       properties:
 *         summary:
 *           type: object
 *           properties:
 *             totalEvents:
 *               type: integer
 *             uniqueUsers:
 *               type: integer
 *             avgResponseTime:
 *               type: number
 *             errorRate:
 *               type: number
 *         topEvents:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *               count:
 *                 type: integer
 *         timeline:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               events:
 *                 type: integer
 *               users:
 *                 type: integer
 */

/**
 * @swagger
 * /api/analytics/track:
 *   post:
 *     summary: Track an event
 *     description: Track a custom analytics event
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnalyticsEvent'
 *     responses:
 *       200:
 *         description: Event tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 eventId:
 *                   type: string
 *                   format: uuid
 *                 sampled:
 *                   type: boolean
 *                   description: Whether the event was sampled
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */

/**
 * @swagger
 * /api/analytics/metrics/{metricName}:
 *   get:
 *     summary: Get metric data
 *     description: Retrieve aggregated metric data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: metricName
 *         in: path
 *         required: true
 *         description: Metric name
 *         schema:
 *           type: string
 *           example: page_views_total
 *       - name: startDate
 *         in: query
 *         description: Start date for data range
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: endDate
 *         in: query
 *         description: End date for data range
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: groupBy
 *         in: query
 *         description: Aggregation period
 *         schema:
 *           type: string
 *           enum: [minute, hour, day, week, month]
 *           default: hour
 *       - name: filter
 *         in: query
 *         description: Filter criteria as JSON
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Metric data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metric:
 *                   type: string
 *                 aggregation:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       value:
 *                         type: number
 *                       count:
 *                         type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard overview
 *     description: Get analytics dashboard with summary statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: period
 *         in: query
 *         description: Time period for dashboard data
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardData'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/funnel:
 *   post:
 *     summary: Analyze conversion funnel
 *     description: Analyze user conversion through a series of events
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - steps
 *             properties:
 *               steps:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Ordered list of events in the funnel
 *                 example: ["page_view", "add_to_cart", "checkout", "purchase"]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               userId:
 *                 type: string
 *                 description: Analyze funnel for specific user
 *     responses:
 *       200:
 *         description: Funnel analysis results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FunnelAnalysis'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/cohorts:
 *   get:
 *     summary: Get cohort analysis
 *     description: Analyze user retention by cohorts
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: cohortType
 *         in: query
 *         description: Cohort grouping type
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: weekly
 *       - name: metric
 *         in: query
 *         description: Metric to analyze
 *         schema:
 *           type: string
 *           default: retention
 *       - name: periods
 *         in: query
 *         description: Number of periods to analyze
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           default: 4
 *     responses:
 *       200:
 *         description: Cohort analysis data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cohortType:
 *                   type: string
 *                 metric:
 *                   type: string
 *                 cohorts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:
 *                         type: string
 *                       size:
 *                         type: integer
 *                       metrics:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             period:
 *                               type: integer
 *                             value:
 *                               type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/users/{userId}:
 *   get:
 *     summary: Get user analytics
 *     description: Get detailed analytics for a specific user
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 totalEvents:
 *                   type: integer
 *                 firstSeen:
 *                   type: string
 *                   format: date-time
 *                 lastSeen:
 *                   type: string
 *                   format: date-time
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sessionId:
 *                         type: string
 *                       start:
 *                         type: string
 *                         format: date-time
 *                       duration:
 *                         type: integer
 *                       events:
 *                         type: integer
 *                 eventBreakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event:
 *                         type: string
 *                       count:
 *                         type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/analytics/realtime:
 *   get:
 *     summary: Get real-time statistics
 *     description: Get current real-time analytics metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Real-time statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activeUsers:
 *                   type: integer
 *                   description: Currently active users
 *                 eventsPerSecond:
 *                   type: number
 *                   description: Average events per second
 *                 errorRate:
 *                   type: number
 *                   description: Current error rate (0-1)
 *                 avgResponseTime:
 *                   type: number
 *                   description: Average response time in ms
 *                 topPages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       page:
 *                         type: string
 *                       users:
 *                         type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/export:
 *   post:
 *     summary: Export analytics data
 *     description: Export analytics data in various formats
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metrics
 *             properties:
 *               metrics:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Metrics to export
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               format:
 *                 type: string
 *                 enum: [json, csv]
 *                 default: json
 *               groupBy:
 *                 type: string
 *                 enum: [hour, day, week, month]
 *     responses:
 *       200:
 *         description: Exported data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 format:
 *                   type: string
 *                 data:
 *                   type: string
 *                   description: Data in requested format
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     exportDate:
 *                       type: string
 *                       format: date-time
 *                     metrics:
 *                       type: array
 *                       items:
 *                         type: string
 *                     rows:
 *                       type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */