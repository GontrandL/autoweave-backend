# Authentication Guide

The AutoWeave Backend uses JWT (JSON Web Tokens) for authentication and API keys for service-to-service communication.

## Overview

The authentication system provides:
- JWT-based authentication for users
- API key authentication for services
- Role-based access control (RBAC)
- Rate limiting per user/IP
- Token refresh mechanism
- Password reset functionality

## Default Users

For development and testing, two default users are created:

### Admin User
- **Username**: `admin`
- **Password**: `admin123`
- **Permissions**: `*` (all permissions)

### Demo User
- **Username**: `demo`
- **Password**: `demo123`
- **Permissions**: 
  - `agents:read`
  - `agents:create`
  - `analytics:read`
  - `api-keys:read`
  - `api-keys:create`

## Authentication Flow

### 1. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin",
    "username": "admin",
    "permissions": ["*"]
  }
}
```

### 2. Using the Token

Include the token in the Authorization header:

```bash
curl http://localhost:3001/api/agents \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Refresh Token

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### 4. Logout

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## API Key Authentication

### Generate API Key

```bash
curl -X POST http://localhost:3001/api/auth/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-service-key",
    "permissions": ["agents:read", "analytics:read"]
  }'
```

Response:
```json
{
  "apiKey": "sk_live_abcdef123456...",
  "name": "my-service-key",
  "permissions": ["agents:read", "analytics:read"],
  "created": "2024-01-15T10:30:00Z",
  "warning": "Store this API key securely. It will not be shown again."
}
```

### Using API Keys

Include the API key in the custom header:

```bash
curl http://localhost:3001/api/agents \
  -H "x-api-key: sk_live_abcdef123456..."
```

## Permissions

### Permission Format

Permissions follow the format: `resource:action`

Examples:
- `agents:read` - Read agent data
- `agents:create` - Create new agents
- `agents:update` - Update existing agents
- `agents:delete` - Delete agents
- `*` - All permissions (admin only)

### Available Permissions

| Resource | Actions | Description |
|----------|---------|-------------|
| agents | read, create, update, delete | Agent management |
| analytics | read, create | Analytics data access |
| services | read, create, update, delete | Service management |
| integration | read, create, update, delete | Integration management |
| pipeline | read, create, execute | Data pipeline operations |
| api-keys | read, create, delete | API key management |
| core | * | AutoWeave Core operations |

### Authorization Middleware

Protect routes with specific permissions:

```javascript
router.get('/sensitive-data',
  authMiddleware.authenticate(),
  authMiddleware.authorize(['data:read', 'admin:*']),
  (req, res) => {
    // Handler code
  }
);
```

## Rate Limiting

Rate limiting is applied per user/IP:

- **Window**: 15 minutes (configurable)
- **Max requests**: 100 per window (configurable)

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Window reset time
- `Retry-After`: Seconds until retry (when limited)

## Security Configuration

### Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# API Key Header
API_KEY_HEADER=x-api-key

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes in ms
RATE_LIMIT_MAX=100
```

### Password Requirements

When implementing password validation, consider:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Password Reset Flow

### 1. Request Reset

```bash
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### 2. Reset Password

```bash
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset-token-from-email",
    "newPassword": "newSecurePassword123!"
  }'
```

## WebSocket Authentication

For WebSocket connections, include the token in the connection URL:

```javascript
const ws = new WebSocket('ws://localhost:3001?token=YOUR_JWT_TOKEN');
```

Or send authentication after connection:

```javascript
ws.send(JSON.stringify({
  type: 'auth',
  token: 'YOUR_JWT_TOKEN'
}));
```

## Integration with Frontend

### React Example

```javascript
// Auth service
class AuthService {
  login(username, password) {
    return fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
      localStorage.setItem('token', data.token);
      return data;
    });
  }

  getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  logout() {
    localStorage.removeItem('token');
  }
}

// API calls with auth
fetch('/api/agents', {
  headers: {
    ...authService.getAuthHeader(),
    'Content-Type': 'application/json'
  }
});
```

### Axios Interceptor

```javascript
// Request interceptor
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return axios(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

## Testing Authentication

### Test Login
```bash
# Login as admin
./tests/auth/test-login.sh admin admin123

# Login as demo user
./tests/auth/test-login.sh demo demo123
```

### Test Protected Endpoints
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# Use token
curl http://localhost:3001/api/services \
  -H "Authorization: Bearer $TOKEN"
```

## Security Best Practices

1. **Token Storage**
   - Never store tokens in localStorage for production
   - Use httpOnly cookies or secure storage
   - Implement token rotation

2. **Password Security**
   - Use strong password hashing (PBKDF2, bcrypt, or Argon2)
   - Implement password complexity requirements
   - Add account lockout after failed attempts

3. **API Key Management**
   - Rotate API keys regularly
   - Use different keys for different environments
   - Monitor API key usage

4. **HTTPS Only**
   - Always use HTTPS in production
   - Implement HSTS headers
   - Use secure cookies

5. **Session Management**
   - Implement proper session timeout
   - Clear sessions on logout
   - Validate sessions on each request

## Troubleshooting

### Invalid Token Error
- Check token expiration
- Verify JWT_SECRET matches between restarts
- Ensure token format is correct

### Permission Denied
- Verify user has required permissions
- Check authorization middleware configuration
- Ensure permissions are correctly formatted

### Rate Limit Exceeded
- Wait for rate limit window to reset
- Increase rate limit for development
- Implement token bucket for production

### CORS Issues
- Add origin to CORS_ORIGINS environment variable
- Check preflight request handling
- Verify credentials are included in requests