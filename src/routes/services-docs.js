/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique service identifier
 *         name:
 *           type: string
 *           description: Service name
 *         version:
 *           type: string
 *           description: Service version
 *         status:
 *           type: string
 *           enum: [initializing, running, stopped, failed]
 *           description: Current service status
 *         endpoints:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               path:
 *                 type: string
 *               method:
 *                 type: string
 *               description:
 *                 type: string
 *         healthStatus:
 *           type: string
 *           enum: [healthy, unhealthy, unknown]
 *         lastHealthCheck:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *     ServiceRegistration:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Service name
 *         version:
 *           type: string
 *           description: Service version
 *           default: "1.0.0"
 *         endpoints:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               path:
 *                 type: string
 *               method:
 *                 type: string
 *               description:
 *                 type: string
 *         dependencies:
 *           type: array
 *           items:
 *             type: string
 *           description: Required service dependencies
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *     ServiceHealth:
 *       type: object
 *       properties:
 *         serviceId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [healthy, unhealthy, unknown]
 *         checks:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *               message:
 *                 type: string
 *         lastCheck:
 *           type: string
 *           format: date-time
 *         uptime:
 *           type: number
 *           description: Service uptime in seconds
 */

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: List all services
 *     description: Get a list of all registered services with their current status
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: status
 *         in: query
 *         description: Filter by service status
 *         schema:
 *           type: string
 *           enum: [running, stopped, failed]
 *       - name: healthy
 *         in: query
 *         description: Filter by health status
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/services/register:
 *   post:
 *     summary: Register a new service
 *     description: Register a new service with the service manager
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceRegistration'
 *     responses:
 *       201:
 *         description: Service registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 serviceId:
 *                   type: string
 *                   format: uuid
 *                 message:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Service already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/services/{serviceId}:
 *   get:
 *     summary: Get service details
 *     description: Get detailed information about a specific service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: serviceId
 *         in: path
 *         required: true
 *         description: Service ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Service details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/services/{serviceId}/health:
 *   get:
 *     summary: Get service health
 *     description: Get current health status of a service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: serviceId
 *         in: path
 *         required: true
 *         description: Service ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceHealth'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/services/{serviceId}/start:
 *   post:
 *     summary: Start a service
 *     description: Start a stopped service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: serviceId
 *         in: path
 *         required: true
 *         description: Service ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Service started successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Service already running
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/services/{serviceId}/stop:
 *   post:
 *     summary: Stop a service
 *     description: Stop a running service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: serviceId
 *         in: path
 *         required: true
 *         description: Service ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Service stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/services/{serviceId}:
 *   delete:
 *     summary: Unregister a service
 *     description: Remove a service from the registry
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *       - apiKey: []
 *     parameters:
 *       - name: serviceId
 *         in: path
 *         required: true
 *         description: Service ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Service unregistered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         description: Cannot delete running service
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */