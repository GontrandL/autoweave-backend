import fetch from 'node-fetch';

/**
 * Demo script showing how to use the Integration Hub
 */

const API_BASE = 'http://localhost:3001/api';

// Example OpenAPI spec for a simple REST API
const sampleOpenAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'Sample API',
    version: '1.0.0',
    description: 'A sample API for demonstration'
  },
  servers: [
    {
      url: 'https://api.example.com/v1'
    }
  ],
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: 'List all users',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      email: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: 'createUser',
        summary: 'Create a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User created'
          }
        }
      }
    },
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        summary: 'Get a user by ID',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response'
          }
        }
      }
    }
  }
};

async function demo() {
  console.log('=== AutoWeave Integration Hub Demo ===\n');

  try {
    // 1. Register an OpenAPI integration
    console.log('1. Registering OpenAPI integration...');
    const openAPIResponse = await fetch(`${API_BASE}/integration/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'sample-api',
        type: 'openapi',
        config: {
          openAPISpec: sampleOpenAPISpec,
          autoRegister: true
        }
      })
    });
    
    const openAPIResult = await openAPIResponse.json();
    console.log('OpenAPI Integration registered:', openAPIResult);
    const openAPIIntegrationId = openAPIResult.integrationId;

    // 2. Register a webhook integration
    console.log('\n2. Registering webhook integration...');
    const webhookResponse = await fetch(`${API_BASE}/integration/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'event-webhook',
        type: 'webhook',
        config: {
          url: 'https://webhook.site/unique-url',
          events: ['user.created', 'user.updated'],
          secret: 'webhook-secret-123',
          headers: {
            'X-Custom-Header': 'AutoWeave'
          }
        }
      })
    });
    
    const webhookResult = await webhookResponse.json();
    console.log('Webhook Integration registered:', webhookResult);
    const webhookIntegrationId = webhookResult.integrationId;

    // 3. List all integrations
    console.log('\n3. Listing all integrations...');
    const listResponse = await fetch(`${API_BASE}/integration`);
    const integrations = await listResponse.json();
    console.log('Total integrations:', integrations.total);
    integrations.integrations.forEach(i => {
      console.log(`  - ${i.name} (${i.type}): ${i.status}`);
    });

    // 4. Test OpenAPI integration
    console.log('\n4. Testing OpenAPI integration...');
    const testResponse = await fetch(`${API_BASE}/integration/${openAPIIntegrationId}/test`, {
      method: 'POST'
    });
    const testResult = await testResponse.json();
    console.log('Test result:', testResult);

    // 5. Execute an action on the integration
    console.log('\n5. Executing integration action...');
    const actionResponse = await fetch(`${API_BASE}/integration/${openAPIIntegrationId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'listUsers',
        params: {}
      })
    });
    const actionResult = await actionResponse.json();
    console.log('Action result:', actionResult);

    // 6. Get integration metrics
    console.log('\n6. Getting integration metrics...');
    const metricsResponse = await fetch(`${API_BASE}/integration/${openAPIIntegrationId}/metrics`);
    const metrics = await metricsResponse.json();
    console.log('Integration metrics:', metrics);

    // 7. Create a data pipeline for the integration
    console.log('\n7. Creating data pipeline for integration...');
    const pipelineResponse = await fetch(`${API_BASE}/pipeline/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'openapi-to-vector-sync',
        source: {
          type: 'integration',
          config: {
            integrationId: openAPIIntegrationId,
            endpoints: ['/users']
          }
        },
        destination: {
          type: 'qdrant',
          config: {
            collection: 'users_data',
            autoCreate: true
          }
        },
        processors: ['enrichmentProcessor'],
        transformers: ['fieldMappingTransformer'],
        schedule: {
          interval: 60000 // 1 minute
        }
      })
    });
    const pipelineResult = await pipelineResponse.json();
    console.log('Pipeline created:', pipelineResult);

    // 8. Trigger webhook event
    console.log('\n8. Triggering webhook via event bus...');
    const eventResponse = await fetch(`${API_BASE}/events/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'user.created',
        data: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com'
        }
      })
    });
    const eventResult = await eventResponse.json();
    console.log('Event published:', eventResult);

    // 9. Discover available integrations
    console.log('\n9. Discovering available integrations...');
    const discoverResponse = await fetch(`${API_BASE}/integration/discover/available`);
    const available = await discoverResponse.json();
    console.log('Available integrations:', available.total);

    // 10. Integration Hub metrics
    console.log('\n10. Getting overall integration metrics...');
    const hubMetricsResponse = await fetch(`${API_BASE}/pipeline/metrics`);
    const hubMetrics = await hubMetricsResponse.json();
    console.log('Hub metrics:', hubMetrics);

    console.log('\n=== Demo completed successfully! ===');

  } catch (error) {
    console.error('Demo error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Run demo
demo().catch(console.error);