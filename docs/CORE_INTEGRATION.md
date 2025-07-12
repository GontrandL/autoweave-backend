# AutoWeave Core Integration Guide

This guide explains how the AutoWeave Backend integrates with AutoWeave Core, providing a unified system architecture.

## Architecture Overview

```
┌─────────────────────┐         ┌──────────────────┐
│  AutoWeave Core     │ <-----> │ AutoWeave Backend │
│  (Port 3000)        │         │  (Port 3001)      │
├─────────────────────┤         ├──────────────────┤
│ - Agent Weaver      │         │ - Service Manager │
│ - Memory System     │         │ - Event Bus       │
│ - MCP Discovery     │         │ - Analytics       │
│ - ANP Server        │         │ - Data Pipeline   │
│ - AG-UI WebSocket   │         │ - Integration Hub │
└─────────────────────┘         └──────────────────┘
        ↑                               ↑
        │                               │
        └───────────WebSocket───────────┘
                  + HTTP API
```

## Connection Flow

1. **Backend Startup**: When the backend starts, it automatically attempts to connect to AutoWeave Core
2. **Service Registration**: Backend services are registered with Core via ANP (Agent Network Protocol)
3. **Event Synchronization**: Events are synchronized bidirectionally between Core and Backend
4. **WebSocket Communication**: Real-time communication for AG-UI and event streaming

## Configuration

### Environment Variables

```env
# Core connection settings
AUTOWEAVE_CORE_URL=http://localhost:3000
AUTOWEAVE_CORE_WS_URL=ws://localhost:3000/ws
ANP_SERVER_URL=http://localhost:8083

# Backend settings
PORT=3001
NODE_ID=backend-primary
```

### Connection Configuration

The connection is managed by `AutoWeaveCoreConnector` with these features:
- Automatic reconnection with exponential backoff
- Service registration via ANP
- Event forwarding and synchronization
- Health monitoring

## API Endpoints

### Core Integration Endpoints

#### Connection Management

```http
# Get connection status
GET /api/core/status

# Connect to Core
POST /api/core/connect

# Disconnect from Core
POST /api/core/disconnect
```

#### Agent Operations

```http
# Get agent from Core
GET /api/core/agents/:id

# Update agent in Core
PATCH /api/core/agents/:id
```

#### Memory Operations

```http
# Create memory in Core
POST /api/core/memory

# Search memories in Core
POST /api/core/memory/search
```

#### Event Forwarding

```http
# Send event to Core
POST /api/core/events
{
  "topic": "backend.custom.event",
  "data": { ... }
}
```

#### Generic Core API Request

```http
# Make any request to Core API
POST /api/core/request
{
  "endpoint": "/api/agents",
  "method": "GET",
  "data": { ... }
}
```

## Event Synchronization

### Events Forwarded to Core

The backend automatically forwards these events to Core:
- `agent.created`
- `agent.deployed`
- `agent.status.changed`
- `integration.created`
- `integration.updated`
- `memory.updated`
- `analytics.insight`

### Events Received from Core

The backend listens for these events from Core:
- `agent.workflow.created` - Creates backend services for agents
- `memory.search.request` - Handles memory search requests
- `config.generate.request` - Generates configuration

### Custom Event Handling

```javascript
// Subscribe to Core events
eventBus.subscribe('core.*', (event) => {
  console.log('Event from Core:', event);
});

// Forward custom event to Core
await fetch('/api/core/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: 'backend.custom.event',
    data: { message: 'Hello Core!' }
  })
});
```

## WebSocket Integration

The backend connects to Core's AG-UI WebSocket for real-time communication:

```javascript
// Backend identifies itself
{
  "type": "identify",
  "content": {
    "clientType": "backend",
    "nodeId": "backend-primary",
    "services": ["analytics", "integration", "pipeline"]
  }
}
```

### Message Types

- **command**: Execute commands from Core
- **event**: Receive/send events
- **request**: Handle requests from Core
- **response**: Send responses back to Core

## Service Registration

Backend services are automatically registered with Core via ANP:

```javascript
// Service registration format
{
  "id": "analytics-service",
  "name": "Analytics Engine",
  "version": "1.0.0",
  "endpoints": [
    {
      "path": "/backend/api/analytics/track",
      "method": "POST",
      "description": "Track analytics event"
    }
  ],
  "capabilities": ["analytics", "metrics", "reporting"],
  "baseUrl": "http://localhost:3001/api"
}
```

## Testing the Integration

### 1. Check Connection Status

```bash
curl http://localhost:3001/api/core/status
```

Expected response:
```json
{
  "connected": true,
  "coreUrl": "http://localhost:3000",
  "wsState": "open",
  "reconnectAttempts": 0,
  "registeredServices": 5
}
```

### 2. Test Event Forwarding

```bash
curl -X POST http://localhost:3001/api/core/events \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "test.event",
    "data": { "message": "Test from backend" }
  }'
```

### 3. Run Integration Test

```bash
cd autoweave-backend
node tests/integration/core-connection.test.js
```

## Troubleshooting

### Connection Issues

1. **Core not reachable**
   - Check if Core is running: `curl http://localhost:3000/health`
   - Verify firewall settings
   - Check environment variables

2. **WebSocket connection fails**
   - Ensure WebSocket port is open
   - Check for proxy/reverse proxy issues
   - Verify WebSocket URL format

3. **Service registration fails**
   - Check ANP server is running: `curl http://localhost:8083/agent`
   - Verify service configuration
   - Check for duplicate service IDs

### Event Synchronization Issues

1. **Events not forwarding**
   - Check connection status
   - Verify event topic patterns
   - Check event bus configuration

2. **Missing events**
   - Check event subscriptions
   - Verify WebSocket connection
   - Review event filters

## Best Practices

1. **Error Handling**
   - Always handle connection failures gracefully
   - Implement retry logic for critical operations
   - Log all integration errors

2. **Performance**
   - Batch event forwarding when possible
   - Use appropriate event filtering
   - Monitor WebSocket message size

3. **Security**
   - Use authentication tokens for production
   - Validate all incoming events
   - Implement rate limiting

4. **Monitoring**
   - Track connection status metrics
   - Monitor event forwarding latency
   - Set up alerts for connection failures

## Advanced Usage

### Custom Event Forwarding

```javascript
// Forward specific backend events to Core
eventBus.subscribe('backend.metrics.*', async (event) => {
  if (event.data.critical) {
    await coreConnector.forwardEventToCore('backend.alert', event);
  }
});
```

### Dynamic Service Registration

```javascript
// Register a new service dynamically
await fetch('/api/core/services/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'custom-service',
    name: 'Custom Service',
    endpoints: [...],
    capabilities: ['custom']
  })
});
```

### Core API Proxy

```javascript
// Use backend as proxy to Core APIs
const agents = await fetch('/api/core/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: '/api/agents',
    method: 'GET'
  })
}).then(r => r.json());
```

## Development Workflow

1. **Start Core first**
   ```bash
   cd autoweave-core
   npm start
   ```

2. **Start Backend**
   ```bash
   cd autoweave-backend
   npm start
   ```

3. **Monitor connection**
   - Backend logs will show connection status
   - Use `/api/core/status` endpoint
   - Check WebSocket state

4. **Test integration**
   ```bash
   node tests/integration/core-connection.test.js
   ```

## Future Enhancements

- [ ] Implement authentication between Core and Backend
- [ ] Add message queuing for offline scenarios
- [ ] Implement event replay functionality
- [ ] Add distributed tracing support
- [ ] Create admin UI for connection management