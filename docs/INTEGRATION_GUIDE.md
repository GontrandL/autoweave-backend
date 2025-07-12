# Integration Guide

This guide explains how the AutoWeave Backend integrates with the existing IntegrationAgent and provides auto-integration capabilities.

## Architecture Overview

The integration system consists of three main components:

1. **IntegrationAgent** (from autoweave-agents): Handles OpenAPI to Kubernetes manifest generation
2. **IntegrationAgentAdapter**: Bridges the IntegrationAgent with backend services
3. **IntegrationHub**: Central hub for managing all types of integrations

## Integration Flow

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ External Module │────▶│ Integration Hub      │────▶│ IntegrationAgent│
└─────────────────┘     │ - Auto-discovery     │     │ - K8s manifests │
                        │ - Plugin management  │     │ - Validation    │
                        │ - Webhook handling   │     └─────────────────┘
                        └──────────────────────┘              │
                                   │                          │
                                   ▼                          ▼
                        ┌──────────────────────┐     ┌─────────────────┐
                        │ Data Pipeline        │     │ Service Manager │
                        │ - Data sync          │     │ - Lifecycle     │
                        │ - Transformations    │     │ - Health checks │
                        └──────────────────────┘     └─────────────────┘
```

## Auto-Integration Features

### 1. Module Discovery

The system automatically discovers and integrates modules through:

- **Service Registration**: When services register with metadata indicating they're integratable
- **OpenAPI Discovery**: Automatic detection of OpenAPI endpoints
- **Manifest-based**: Modules with integration manifests are auto-configured
- **Plugin Scanning**: Periodic scans for new plugins

### 2. Supported Integration Types

#### OpenAPI Integrations
```javascript
{
  name: 'my-api',
  type: 'openapi',
  config: {
    openAPISpec: { /* OpenAPI 3.0 spec */ },
    autoRegister: true  // Auto-register as service
  }
}
```

#### Webhook Integrations
```javascript
{
  name: 'event-handler',
  type: 'webhook',
  config: {
    url: 'https://webhook.endpoint',
    events: ['event.type.*'],
    secret: 'webhook-secret'
  }
}
```

#### Plugin Integrations
```javascript
{
  name: 'custom-processor',
  type: 'plugin',
  config: {
    source: 'npm',  // npm, local, or url
    name: '@company/processor',
    version: '1.0.0'
  }
}
```

#### Database Integrations
```javascript
{
  name: 'user-database',
  type: 'database',
  config: {
    dbType: 'postgres',
    connectionString: 'postgresql://...',
    syncEnabled: true,
    syncDestination: 'qdrant'
  }
}
```

### 3. Event-Driven Integration

The system uses events for loose coupling:

```javascript
// Module discovery event
eventBus.publish('integration.module.discovered', {
  module: { name: 'new-module' },
  metadata: { openAPI: spec }
});

// Integration request
const response = await eventBus.request('integration.request.execute', {
  integrationId: 'integration-123',
  action: 'getData',
  params: {}
});
```

## Using the Integration System

### Registering an Integration

```javascript
// Via REST API
POST /api/integration/register
{
  "name": "github-api",
  "type": "openapi",
  "config": {
    "openAPISpec": { /* GitHub API spec */ }
  }
}

// Via Event Bus
eventBus.publish('integration.module.discovered', {
  module: { name: 'github-api' },
  metadata: { openAPI: githubSpec }
});
```

### Creating Data Pipelines

Integrations can automatically create data pipelines:

```javascript
POST /api/pipeline/register
{
  "name": "api-to-vector-sync",
  "source": {
    "type": "integration",
    "config": {
      "integrationId": "integration-123"
    }
  },
  "destination": {
    "type": "qdrant",
    "config": {
      "collection": "api_data"
    }
  }
}
```

### Monitoring Integrations

```javascript
// Get integration metrics
GET /api/integration/{id}/metrics

// Check integration health
POST /api/integration/{id}/test

// View integration logs
GET /api/integration/{id}/logs
```

## Integration with Existing AutoWeave Components

### 1. AutoWeave Core
- Integrations register as services via Service Manager
- Event Bus enables communication between integrations and core
- Data Pipeline syncs integration data to vector/graph stores

### 2. AutoWeave Agents
- IntegrationAgent generates Kubernetes manifests
- Agents can be created from integrated APIs
- Auto-discovery of agent capabilities

### 3. AutoWeave Memory
- Integration data stored in Qdrant for semantic search
- Relationships mapped in Neo4j/Memgraph
- Automatic indexing of API endpoints

### 4. AutoWeave UI
- Real-time integration status via WebSocket
- Integration management dashboard
- Visual pipeline configuration

## Best Practices

1. **Use Events for Loose Coupling**
   ```javascript
   // Good: Event-based
   eventBus.publish('user.created', userData);
   
   // Avoid: Direct coupling
   integration.handleUserCreated(userData);
   ```

2. **Enable Auto-Discovery**
   ```javascript
   // Add metadata to services
   serviceConfig.metadata = {
     integratable: true,
     openAPIEndpoint: '/openapi.json'
   };
   ```

3. **Configure Data Pipelines**
   ```javascript
   // Sync integration data automatically
   integrationConfig.syncEnabled = true;
   integrationConfig.syncSchedule = { interval: 300000 };
   ```

4. **Monitor Integration Health**
   ```javascript
   // Set up health checks
   integrationConfig.healthCheck = {
     endpoint: '/health',
     interval: 30000
   };
   ```

## Troubleshooting

### Integration Not Auto-Discovered
- Check if service has `integratable: true` metadata
- Verify auto-discovery is enabled in config
- Check logs for discovery errors

### Data Not Syncing
- Verify pipeline is active: `GET /api/pipeline/{id}/status`
- Check storage adapter health
- Review pipeline metrics for errors

### Integration Failing
- Test integration: `POST /api/integration/{id}/test`
- Check integration logs
- Verify configuration and credentials

## Advanced Features

### Custom Storage Adapters
```javascript
class CustomAdapter {
  async createCursor(config) { /* ... */ }
  async writeBatch(batch, config) { /* ... */ }
  async healthCheck() { /* ... */ }
}

storageAdapterFactory.registerAdapter('custom', CustomAdapter);
```

### Custom Processors
```javascript
dataPipeline.registerProcessor('custom', async (item, context) => {
  // Process item
  return transformedItem;
});
```

### Integration Plugins
```javascript
class MyPlugin {
  async initialize({ eventBus, logger }) { /* ... */ }
  async processData(data) { /* ... */ }
  async destroy() { /* ... */ }
}
```

## Security Considerations

1. **Authentication**: All integrations support configurable authentication
2. **Secrets Management**: Use environment variables for sensitive data
3. **Rate Limiting**: Built-in rate limiting for external API calls
4. **Validation**: All inputs validated before processing

## Performance Optimization

1. **Batch Processing**: Use data pipelines for bulk operations
2. **Caching**: Redis adapter provides caching layer
3. **Circuit Breakers**: Prevent cascade failures
4. **Connection Pooling**: Reuse connections for databases

## Future Enhancements

- GraphQL integration support
- gRPC service discovery
- Advanced transformation pipelines
- Machine learning model integrations
- Real-time streaming integrations