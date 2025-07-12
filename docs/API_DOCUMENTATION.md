# API Documentation

The AutoWeave Backend provides a comprehensive REST API with OpenAPI 3.1 documentation.

## Accessing the Documentation

### Interactive Documentation (Swagger UI)

When the server is running, access the interactive API documentation at:

```
http://localhost:3001/api-docs
```

This provides:
- Interactive API explorer
- Try-it-out functionality
- Request/response examples
- Authentication testing

### OpenAPI Specification

The raw OpenAPI 3.1 specification is available at:

```
http://localhost:3001/api-docs/openapi.json
```

This can be imported into:
- Postman
- Insomnia
- API development tools
- Code generators

## API Overview

### Base URL

Development: `http://localhost:3001`
Production: `https://api.autoweave.io`

### Authentication

The API supports two authentication methods:

1. **JWT Bearer Token**
   ```
   Authorization: Bearer <token>
   ```

2. **API Key**
   ```
   x-api-key: <api-key>
   ```

### Rate Limiting

Default limits:
- 100 requests per 15 minutes per user/IP
- Rate limit headers included in responses

### Response Format

All responses follow a consistent format:

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

#### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/login` | User login | No |
| POST | `/logout` | User logout | Yes |
| POST | `/refresh` | Refresh token | No |
| GET | `/me` | Get current user | Yes |
| POST | `/api-keys` | Generate API key | Yes |
| GET | `/api-keys` | List API keys | Yes |
| DELETE | `/api-keys/:name` | Revoke API key | Yes |
| POST | `/change-password` | Change password | Yes |
| POST | `/forgot-password` | Request password reset | No |
| POST | `/reset-password` | Reset password with token | No |

### Services (`/api/services`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List all services | Yes |
| POST | `/register` | Register new service | Yes |
| GET | `/:id` | Get service details | Yes |
| GET | `/:id/health` | Get service health | Yes |
| POST | `/:id/start` | Start service | Yes |
| POST | `/:id/stop` | Stop service | Yes |
| DELETE | `/:id` | Unregister service | Yes |

### Analytics (`/api/analytics`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/track` | Track event | Yes |
| GET | `/metrics/:name` | Get metric data | Yes |
| GET | `/dashboard` | Get dashboard overview | Yes |
| POST | `/funnel` | Analyze conversion funnel | Yes |
| GET | `/cohorts` | Get cohort analysis | Yes |
| GET | `/users/:id` | Get user analytics | Yes |
| GET | `/realtime` | Get real-time stats | Yes |
| POST | `/export` | Export analytics data | Yes |

### Integration (`/api/integration`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List integrations | Yes |
| POST | `/openapi` | Create OpenAPI integration | Yes |
| POST | `/webhook` | Create webhook integration | Yes |
| POST | `/plugin` | Create plugin integration | Yes |
| POST | `/database` | Create database integration | Yes |
| POST | `/message-queue` | Create MQ integration | Yes |
| GET | `/:id` | Get integration details | Yes |
| PUT | `/:id` | Update integration | Yes |
| DELETE | `/:id` | Delete integration | Yes |
| POST | `/:id/test` | Test integration | Yes |

### Data Pipeline (`/api/pipeline`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List pipelines | Yes |
| POST | `/` | Create pipeline | Yes |
| GET | `/:id` | Get pipeline details | Yes |
| PUT | `/:id` | Update pipeline | Yes |
| DELETE | `/:id` | Delete pipeline | Yes |
| POST | `/:id/execute` | Execute pipeline | Yes |
| GET | `/:id/executions` | List executions | Yes |
| POST | `/:id/schedule` | Schedule pipeline | Yes |

### Events (`/api/events`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/publish` | Publish event | Yes |
| GET | `/subscribe` | Subscribe to events (WebSocket) | Yes |
| GET | `/history` | Get event history | Yes |
| GET | `/topics` | List available topics | Yes |

### Core Integration (`/api/core`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/status` | Get Core connection status | Yes |
| POST | `/connect` | Connect to Core | Yes |
| POST | `/disconnect` | Disconnect from Core | Yes |
| GET | `/agents/:id` | Get agent from Core | Yes |
| PATCH | `/agents/:id` | Update agent in Core | Yes |
| POST | `/memory` | Create memory in Core | Yes |
| POST | `/memory/search` | Search Core memories | Yes |
| POST | `/events` | Forward event to Core | Yes |

### Health & Monitoring (`/api`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Basic health check | No |
| GET | `/health/detailed` | Detailed health status | Yes |
| GET | `/metrics` | Prometheus metrics | No |

## Common Parameters

### Pagination

Most list endpoints support pagination:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

Example: `/api/services?page=2&limit=50`

### Filtering

Filter results using the `filter` parameter with JSON:

```
/api/analytics/metrics/page_views?filter={"page":"/home"}
```

### Sorting

Sort results using the `sort` parameter:

```
/api/services?sort=name:asc
/api/analytics/events?sort=timestamp:desc
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001?token=YOUR_TOKEN');
```

### Message Format

```javascript
// Subscribe to events
{
  "type": "subscribe",
  "topic": "service.*"
}

// Publish event
{
  "type": "publish",
  "topic": "custom.event",
  "data": { ... }
}
```

### Event Types

- `event`: Incoming event
- `error`: Error message
- `subscribed`: Subscription confirmed
- `unsubscribed`: Unsubscription confirmed

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required |
| `INVALID_TOKEN` | Invalid or expired token |
| `INSUFFICIENT_PERMISSIONS` | Missing required permissions |
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Internal server error |

## SDK Examples

### JavaScript/TypeScript

```javascript
import { AutoWeaveClient } from '@autoweave/backend-client';

const client = new AutoWeaveClient({
  baseUrl: 'http://localhost:3001',
  token: 'YOUR_JWT_TOKEN'
});

// Track event
await client.analytics.track({
  event: 'page_view',
  properties: { page: '/home' }
});

// Create service
const service = await client.services.register({
  name: 'my-service',
  endpoints: [{ path: '/api', method: 'GET' }]
});
```

### Python

```python
from autoweave_backend import Client

client = Client(
    base_url="http://localhost:3001",
    token="YOUR_JWT_TOKEN"
)

# Track event
client.analytics.track(
    event="page_view",
    properties={"page": "/home"}
)

# List services
services = client.services.list()
```

### cURL

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Track event
curl -X POST http://localhost:3001/api/analytics/track \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"test_event","properties":{"value":123}}'
```

## Monitoring

### Metrics Endpoint

The backend exposes Prometheus metrics at:

```
GET /metrics
```

This endpoint provides comprehensive metrics for:
- HTTP requests (duration, count, status codes)
- WebSocket connections and messages
- Service health and uptime
- Database operations and connection pools
- Event bus activity
- Pipeline executions
- Integration requests
- Authentication attempts
- Business operations

### Starting Monitoring Stack

```bash
# Start Prometheus, Grafana, and AlertManager
npm run monitoring:start

# Access Grafana dashboards
open http://localhost:3003
# Login: admin / admin123
```

### Monitoring Commands

```bash
# Start monitoring stack
npm run monitoring:start

# Stop monitoring stack
npm run monitoring:stop

# View monitoring logs
npm run monitoring:logs
```

See [MONITORING.md](./MONITORING.md) for complete monitoring documentation.

## Testing the API

### Using Swagger UI

1. Navigate to http://localhost:3001/api-docs
2. Click "Authorize" and enter your JWT token or API key
3. Select an endpoint and click "Try it out"
4. Fill in parameters and execute

### Using Postman

1. Import the OpenAPI spec from `/api-docs/openapi.json`
2. Set up environment variables:
   - `baseUrl`: http://localhost:3001
   - `token`: Your JWT token
3. Use the imported collection

### Generate Postman Collection

```bash
# Generate Postman collection from OpenAPI spec
npm run postman:generate
```

### Automated Testing

```javascript
// Example using Jest and supertest
import request from 'supertest';

describe('API Tests', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    token = res.body.token;
  });

  test('GET /api/services', async () => {
    const res = await request(app)
      .get('/api/services')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});
```

## Best Practices

1. **Authentication**
   - Use JWT tokens for user sessions
   - Use API keys for service-to-service communication
   - Rotate API keys regularly

2. **Error Handling**
   - Always check response status codes
   - Handle rate limiting with exponential backoff
   - Log errors for debugging

3. **Performance**
   - Use pagination for large datasets
   - Cache responses when appropriate
   - Batch multiple operations when possible

4. **Security**
   - Always use HTTPS in production
   - Never expose sensitive data in URLs
   - Validate all input data

## Changelog

### Version 1.0.0
- Initial API release
- JWT authentication
- Core service endpoints
- Analytics tracking
- OpenAPI documentation

## Support

For API support:
- Check the interactive documentation
- Review error messages and codes
- Open an issue on GitHub
- Contact the development team