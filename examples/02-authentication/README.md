# Authentication Example

Complete guide to authentication with AutoWeave Backend.

## Overview

This example demonstrates:
- JWT token authentication
- API key authentication
- Token refresh
- User management
- Permission-based access control
- Rate limiting

## Authentication Methods

### 1. JWT Tokens (User Sessions)

Best for:
- Web applications
- Mobile apps
- User-specific operations

```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});

const { token, refreshToken } = await response.json();
```

### 2. API Keys (Service-to-Service)

Best for:
- Server-to-server communication
- CI/CD pipelines
- Long-running services

```javascript
// Generate API key
const response = await fetch('/api/auth/api-keys', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'my-service-key',
    permissions: ['services:read', 'analytics:write']
  })
});

const { apiKey } = await response.json();
```

## Running the Example

```bash
cd examples/02-authentication
npm install
npm start
```

## Code Examples

### Complete Authentication Flow

```javascript
class AuthExample {
  async loginWithPassword() {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    const result = await response.json();
    this.token = result.token;
    this.refreshToken = result.refreshToken;
    
    return result;
  }

  async refreshAccessToken() {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: this.refreshToken
      })
    });

    const result = await response.json();
    this.token = result.token;
    
    return result;
  }

  async createApiKey(name, permissions = []) {
    const response = await fetch('/api/auth/api-keys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, permissions })
    });

    return response.json();
  }

  async makeAuthenticatedRequest(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }
}
```

### API Key Usage

```javascript
// Using API key for authentication
const response = await fetch('/api/services', {
  headers: {
    'x-api-key': 'your-api-key-here'
  }
});
```

### Permission System

The backend uses a flexible permission system:

```javascript
// Permission format: "resource:action"
const permissions = [
  'services:read',     // Read services
  'services:write',    // Create/update services
  'analytics:read',    // Read analytics
  'analytics:write',   // Track events
  'pipeline:execute',  // Execute pipelines
  '*'                  // All permissions (admin)
];
```

## User Management

### Default Users

The backend comes with default users:

```javascript
const defaultUsers = [
  {
    username: 'admin',
    password: 'admin123',
    permissions: ['*'] // All permissions
  },
  {
    username: 'demo',
    password: 'demo123',
    permissions: ['services:read', 'analytics:read']
  }
];
```

### Creating New Users

```javascript
// Note: User creation endpoint needs to be implemented
// This is an example of how it would work
async function createUser() {
  const response = await fetch('/api/auth/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: 'newuser',
      password: 'securepassword',
      permissions: ['services:read']
    })
  });

  return response.json();
}
```

## Security Best Practices

### 1. Token Storage

```javascript
// ✅ Good: Store in httpOnly cookie or secure storage
localStorage.setItem('autoweave_token', token); // Only for demo

// ✅ Better: Use httpOnly cookies in production
document.cookie = `token=${token}; HttpOnly; Secure; SameSite=Strict`;
```

### 2. Token Rotation

```javascript
class SecureAuthManager {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.refreshTimer = null;
  }

  async login(username, password) {
    const result = await this.loginWithPassword(username, password);
    this.scheduleTokenRefresh(result.expiresAt);
    return result;
  }

  scheduleTokenRefresh(expiresAt) {
    const refreshTime = new Date(expiresAt).getTime() - Date.now() - 60000; // 1 min before expiry
    
    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Redirect to login
      }
    }, refreshTime);
  }
}
```

### 3. API Key Management

```javascript
class ApiKeyManager {
  async rotateApiKey(keyName) {
    // Create new key
    const newKey = await this.createApiKey(`${keyName}-new`);
    
    // Update services to use new key
    await this.updateServicesWithNewKey(newKey.key);
    
    // Delete old key
    await this.deleteApiKey(keyName);
    
    // Rename new key
    await this.renameApiKey(`${keyName}-new`, keyName);
    
    return newKey;
  }

  async deleteApiKey(name) {
    const response = await fetch(`/api/auth/api-keys/${name}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return response.json();
  }
}
```

## Rate Limiting

The backend includes rate limiting:

```javascript
// Default limits
const rateLimits = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // requests per window
};

// Handle rate limit responses
async function makeRequest(url, options) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited. Retry after ${retryAfter} seconds`);
    
    // Implement exponential backoff
    await sleep(parseInt(retryAfter) * 1000);
    return makeRequest(url, options);
  }
  
  return response;
}
```

## Error Handling

```javascript
class AuthErrorHandler {
  static async handleAuthError(response) {
    switch (response.status) {
      case 401:
        // Unauthorized - token expired or invalid
        console.log('Authentication required');
        // Redirect to login or refresh token
        break;
        
      case 403:
        // Forbidden - insufficient permissions
        console.log('Insufficient permissions');
        // Show error message to user
        break;
        
      case 429:
        // Rate limited
        const retryAfter = response.headers.get('Retry-After');
        console.log(`Rate limited. Retry after ${retryAfter}s`);
        break;
        
      default:
        const error = await response.json();
        console.error('Auth error:', error);
    }
  }
}
```

## Testing Authentication

```javascript
// Test script
async function testAuthentication() {
  const auth = new AuthExample();
  
  try {
    // 1. Login
    console.log('Testing login...');
    await auth.loginWithPassword();
    
    // 2. Make authenticated request
    console.log('Testing authenticated request...');
    const response = await auth.makeAuthenticatedRequest('/api/services');
    
    // 3. Create API key
    console.log('Testing API key creation...');
    const apiKey = await auth.createApiKey('test-key', ['services:read']);
    
    // 4. Test API key
    console.log('Testing API key usage...');
    const apiResponse = await fetch('/api/services', {
      headers: { 'x-api-key': apiKey.key }
    });
    
    // 5. Refresh token
    console.log('Testing token refresh...');
    await auth.refreshAccessToken();
    
    console.log('✅ All authentication tests passed!');
    
  } catch (error) {
    console.error('❌ Authentication test failed:', error);
  }
}
```

## Next Steps

- Explore [Service Management](../03-service-management/)
- Learn about [Event-Driven Architecture](../06-event-driven/)
- Set up [Monitoring](../09-monitoring/) for auth metrics