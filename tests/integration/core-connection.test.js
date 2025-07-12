import fetch from 'node-fetch';

/**
 * Test script for AutoWeave Backend to Core integration
 */

const BACKEND_URL = 'http://localhost:3001';
const CORE_URL = 'http://localhost:3000';

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`)
};

async function checkService(url, name) {
  try {
    const response = await fetch(`${url}/health`);
    if (response.ok) {
      const health = await response.json();
      log.success(`${name} is healthy: ${health.status}`);
      return true;
    } else {
      log.error(`${name} health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    log.error(`${name} is not accessible: ${error.message}`);
    return false;
  }
}

async function testCoreConnection() {
  log.info('Testing AutoWeave Backend to Core connection...\n');

  // 1. Check if both services are running
  log.info('1. Checking service availability...');
  const backendAvailable = await checkService(BACKEND_URL, 'Backend');
  const coreAvailable = await checkService(CORE_URL, 'Core');

  if (!backendAvailable) {
    log.error('Backend is not running. Start it with: cd autoweave-backend && npm start');
    return;
  }

  if (!coreAvailable) {
    log.warn('Core is not running. Start it with: cd autoweave-core && npm start');
    log.info('Continuing with backend-only tests...\n');
  }

  // 2. Check Core connection status
  log.info('\n2. Checking Core connection status...');
  try {
    const statusResponse = await fetch(`${BACKEND_URL}/api/core/status`);
    const status = await statusResponse.json();
    
    log.info(`Connection status: ${status.connected ? 'Connected' : 'Disconnected'}`);
    log.info(`Core URL: ${status.coreUrl}`);
    log.info(`WebSocket state: ${status.wsState}`);
    log.info(`Registered services: ${status.registeredServices}`);

    if (!status.connected && coreAvailable) {
      log.info('\n3. Attempting to connect to Core...');
      const connectResponse = await fetch(`${BACKEND_URL}/api/core/connect`, {
        method: 'POST'
      });
      
      if (connectResponse.ok) {
        const result = await connectResponse.json();
        log.success('Connected to Core successfully!');
        log.info(`Status: ${JSON.stringify(result.status, null, 2)}`);
      } else {
        const error = await connectResponse.json();
        log.error(`Failed to connect: ${error.error}`);
      }
    }
  } catch (error) {
    log.error(`Core connection test failed: ${error.message}`);
  }

  // 3. Test event forwarding
  if (coreAvailable) {
    log.info('\n4. Testing event forwarding...');
    try {
      const eventResponse = await fetch(`${BACKEND_URL}/api/core/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'test.event',
          data: { message: 'Hello from Backend!', timestamp: new Date() }
        })
      });

      if (eventResponse.ok) {
        log.success('Event forwarded to Core successfully');
      } else {
        log.error('Failed to forward event');
      }
    } catch (error) {
      log.error(`Event forwarding failed: ${error.message}`);
    }
  }

  // 4. Test backend services
  log.info('\n5. Testing backend services...');
  
  // Test Analytics
  try {
    const analyticsResponse = await fetch(`${BACKEND_URL}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'backend.test',
        properties: { test: true },
        userId: 'test-user'
      })
    });

    if (analyticsResponse.ok) {
      log.success('Analytics service working');
    } else {
      log.error('Analytics service failed');
    }
  } catch (error) {
    log.error(`Analytics test failed: ${error.message}`);
  }

  // Test Service Manager
  try {
    const servicesResponse = await fetch(`${BACKEND_URL}/api/services`);
    if (servicesResponse.ok) {
      const services = await servicesResponse.json();
      log.success(`Service Manager working - ${services.length} services registered`);
    } else {
      log.error('Service Manager failed');
    }
  } catch (error) {
    log.error(`Service Manager test failed: ${error.message}`);
  }

  // 5. Test integration with Core APIs (if available)
  if (coreAvailable) {
    log.info('\n6. Testing Core API integration...');
    
    // Test agent listing through backend
    try {
      const requestResponse = await fetch(`${BACKEND_URL}/api/core/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/api/agents',
          method: 'GET'
        })
      });

      if (requestResponse.ok) {
        const agents = await requestResponse.json();
        log.success(`Core API integration working - ${agents.agents?.length || 0} agents found`);
      } else {
        log.error('Core API integration failed');
      }
    } catch (error) {
      log.error(`Core API test failed: ${error.message}`);
    }
  }

  // 6. Test WebSocket connection
  log.info('\n7. Testing WebSocket connectivity...');
  log.info(`Backend WebSocket available at: ws://localhost:3001`);
  log.info('WebSocket can be tested with: wscat -c ws://localhost:3001');

  log.info('\n=== Integration test completed ===');
}

// Run the test
testCoreConnection().catch(error => {
  log.error(`Test failed: ${error.message}`);
  process.exit(1);
});