import swaggerJsdoc from 'swagger-jsdoc';
import { serve, setup } from 'swagger-ui-express';

/**
 * OpenAPI/Swagger configuration
 */
export const swaggerOptions = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'AutoWeave Backend API',
      version: '1.0.0',
      description: 'Scalable backend services for the AutoWeave ecosystem',
      contact: {
        name: 'AutoWeave Team',
        url: 'https://github.com/autoweave/backend'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.autoweave.io',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key for service authentication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            }
          },
          required: ['error']
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              default: true
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {}
            },
            total: {
              type: 'integer',
              description: 'Total number of items'
            },
            page: {
              type: 'integer',
              description: 'Current page number'
            },
            limit: {
              type: 'integer',
              description: 'Items per page'
            },
            hasNext: {
              type: 'boolean',
              description: 'Has next page'
            },
            hasPrev: {
              type: 'boolean',
              description: 'Has previous page'
            }
          }
        },
        HealthStatus: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy']
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            version: {
              type: 'string'
            },
            uptime: {
              type: 'number',
              description: 'Uptime in seconds'
            },
            services: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string'
                  },
                  lastCheck: {
                    type: 'string',
                    format: 'date-time'
                  }
                }
              }
            }
          }
        }
      },
      parameters: {
        pageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1
          }
        },
        limitParam: {
          name: 'limit',
          in: 'query',
          description: 'Items per page',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          }
        },
        sortParam: {
          name: 'sort',
          in: 'query',
          description: 'Sort field and order (e.g., "name:asc")',
          schema: {
            type: 'string'
          }
        },
        filterParam: {
          name: 'filter',
          in: 'query',
          description: 'Filter criteria as JSON',
          schema: {
            type: 'string'
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Authentication required'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Insufficient permissions',
                required: ['admin:read'],
                provided: ['user:read']
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Resource not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Validation failed',
                details: {
                  field: 'email',
                  message: 'Invalid email format'
                }
              }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Too many requests',
                retryAfter: 60
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Internal server error'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Services',
        description: 'Service management and discovery'
      },
      {
        name: 'Analytics',
        description: 'Analytics and metrics collection'
      },
      {
        name: 'Integration',
        description: 'Third-party integrations'
      },
      {
        name: 'Pipeline',
        description: 'Data pipeline operations'
      },
      {
        name: 'Events',
        description: 'Event bus operations'
      },
      {
        name: 'Core',
        description: 'AutoWeave Core integration'
      },
      {
        name: 'Health',
        description: 'System health and monitoring'
      }
    ],
    security: [
      { bearerAuth: [] },
      { apiKey: [] }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/middleware/*.js',
    './src/services/**/*.js'
  ]
};

/**
 * Generate OpenAPI specification
 */
export const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Setup Swagger UI middleware
 */
export function setupSwagger(app, path = '/api-docs') {
  // Serve OpenAPI spec as JSON
  app.get(`${path}/openapi.json`, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use(path, serve, setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'AutoWeave Backend API Documentation',
    customfavIcon: '/favicon.ico'
  }));

  return {
    spec: swaggerSpec,
    ui: `${path}`,
    json: `${path}/openapi.json`
  };
}