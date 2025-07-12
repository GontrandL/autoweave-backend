# Quick Start Example

Get up and running with AutoWeave Backend in 5 minutes.

## Overview

This example demonstrates:
- Starting the AutoWeave Backend
- Basic authentication
- Creating a simple service
- Making API calls
- Viewing metrics

## Prerequisites

- Node.js 18.0.0+
- AutoWeave Backend installed and running

## Step 1: Start AutoWeave Backend

```bash
# In the main backend directory
npm start
```

The backend will start on http://localhost:3001

## Step 2: Login and Get Token

```bash
# Login with default admin user
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Save the returned token for subsequent requests.

## Step 3: Register a Service

```javascript
// example.js
import fetch from 'node-fetch';

const TOKEN = 'your-jwt-token-here';
const BASE_URL = 'http://localhost:3001';

async function quickStart() {
  // 1. Register a simple service
  const serviceResponse = await fetch(`${BASE_URL}/api/services/register`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'hello-world-service',
      description: 'A simple hello world service',
      endpoints: [
        {
          path: '/hello',
          method: 'GET',
          description: 'Returns hello world'
        }
      ],
      config: {
        port: 3100,
        healthCheck: '/health'
      }
    })
  });

  const service = await serviceResponse.json();
  console.log('Service registered:', service);

  // 2. Check service status
  const statusResponse = await fetch(`${BASE_URL}/api/services/${service.id}`, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  });

  const status = await statusResponse.json();
  console.log('Service status:', status);

  // 3. Track an analytics event
  await fetch(`${BASE_URL}/api/analytics/track`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event: 'quick_start_completed',
      properties: {
        user: 'admin',
        service: service.id,
        timestamp: new Date().toISOString()
      }
    })
  });

  console.log('Analytics event tracked');

  // 4. Check health
  const healthResponse = await fetch(`${BASE_URL}/health`);
  const health = await healthResponse.json();
  console.log('System health:', health);

  console.log('✅ Quick start completed successfully!');
}

quickStart().catch(console.error);
```

## Step 4: Run the Example

```bash
# Install dependencies
npm install node-fetch

# Set your token in the file, then run:
node example.js
```

## Step 5: View Results

1. **API Documentation**: http://localhost:3001/api-docs
2. **Metrics**: http://localhost:3001/metrics
3. **Service List**: 
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/services
   ```

## Expected Output

```
Service registered: {
  id: "hello-world-service-123",
  name: "hello-world-service",
  status: "registered",
  ...
}
Service status: {
  id: "hello-world-service-123",
  status: "healthy",
  uptime: "00:00:05",
  ...
}
Analytics event tracked
System health: {
  status: "healthy",
  services: [...],
  ...
}
✅ Quick start completed successfully!
```

## What's Next?

- Explore the [Authentication Example](../02-authentication/)
- Check out [Service Management](../03-service-management/)
- Set up [Monitoring](../09-monitoring/)

## Troubleshooting

### Common Issues

1. **Authentication failed**
   - Verify the default admin credentials
   - Check if the token is correctly set

2. **Service registration failed**
   - Ensure the service name is unique
   - Check if the port is available

3. **Connection refused**
   - Verify AutoWeave Backend is running
   - Check the correct port (3001)

### Getting Help

- Check the main documentation
- View API docs at http://localhost:3001/api-docs
- Open an issue on GitHub