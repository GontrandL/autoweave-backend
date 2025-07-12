import { AuthMiddleware } from '../../../src/middleware/auth.js';
import jwt from 'jsonwebtoken';

describe('AuthMiddleware', () => {
  let authMiddleware;
  let mockConfig;
  let mockLogger;
  let mockRedis;

  beforeEach(() => {
    mockLogger = global.testUtils.createMockLogger();
    
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn()
    };

    mockConfig = {
      security: {
        jwtSecret: 'test-secret',
        jwtExpiresIn: '1h',
        apiKeyHeader: 'x-api-key',
        rateLimitWindow: 900000,
        rateLimitMax: 100,
        corsOrigins: ['http://localhost:3000']
      },
      redis: {
        keyPrefix: 'test:'
      }
    };

    authMiddleware = new AuthMiddleware({
      config: mockConfig,
      logger: mockLogger,
      redis: mockRedis
    });
  });

  describe('JWT operations', () => {
    it('should generate valid JWT token', () => {
      const payload = { userId: 'user123', username: 'testuser' };
      const token = authMiddleware.generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token
      const decoded = jwt.verify(token, mockConfig.security.jwtSecret);
      expect(decoded.userId).toBe('user123');
      expect(decoded.username).toBe('testuser');
      expect(decoded.iat).toBeDefined();
      expect(decoded.jti).toBeDefined();
    });

    it('should verify valid token', () => {
      const token = authMiddleware.generateToken({ userId: 'user123' });
      const decoded = authMiddleware.verifyToken(token);

      expect(decoded.userId).toBe('user123');
      expect(decoded.jti).toBeDefined();
    });

    it('should reject invalid token', () => {
      expect(() => {
        authMiddleware.verifyToken('invalid.token.here');
      }).toThrow('Invalid token');
    });

    it('should reject expired token', () => {
      const token = jwt.sign(
        { userId: 'user123' },
        mockConfig.security.jwtSecret,
        { expiresIn: '-1h' }
      );

      expect(() => {
        authMiddleware.verifyToken(token);
      }).toThrow('Token expired');
    });
  });

  describe('token refresh', () => {
    it('should refresh valid token', async () => {
      const oldToken = authMiddleware.generateToken({ userId: 'user123' });
      mockRedis.get.mockResolvedValue(null); // Not blacklisted

      const newToken = await authMiddleware.refreshToken(oldToken);

      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);
      
      // Verify old token was blacklisted
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should reject blacklisted token', async () => {
      const token = authMiddleware.generateToken({ userId: 'user123' });
      const decoded = jwt.decode(token);
      
      mockRedis.get.mockResolvedValue('1'); // Blacklisted

      await expect(authMiddleware.refreshToken(token))
        .rejects.toThrow('Failed to refresh token');
    });
  });

  describe('API key operations', () => {
    it('should generate API key', () => {
      const apiKey = authMiddleware.generateApiKey('test-key', ['read', 'write']);

      expect(apiKey).toMatchObject({
        key: expect.any(String),
        name: 'test-key',
        permissions: ['read', 'write'],
        created: expect.any(String)
      });

      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should validate API key', async () => {
      const mockMetadata = {
        name: 'test-key',
        permissions: ['read'],
        created: new Date().toISOString(),
        lastUsed: null,
        usageCount: 0
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockMetadata));

      const metadata = await authMiddleware.validateApiKey('test-key-value');

      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('test-key');
      expect(metadata.usageCount).toBe(1);
    });

    it('should return null for invalid API key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const metadata = await authMiddleware.validateApiKey('invalid-key');

      expect(metadata).toBeNull();
    });

    it('should revoke API key', async () => {
      await authMiddleware.revokeApiKey('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('test:auth:apikeys:')
      );
    });
  });

  describe('authentication middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: {},
        query: {},
        cookies: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should authenticate with valid JWT', async () => {
      const token = authMiddleware.generateToken({ userId: 'user123' });
      req.headers.authorization = `Bearer ${token}`;
      
      mockRedis.get.mockResolvedValue(null); // Not blacklisted

      const middleware = authMiddleware.authenticate();
      await middleware(req, res, next);

      expect(req.auth).toBeDefined();
      expect(req.auth.type).toBe('jwt');
      expect(req.auth.userId).toBe('user123');
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate with API key', async () => {
      req.headers['x-api-key'] = 'test-api-key';
      
      mockRedis.get.mockResolvedValue(JSON.stringify({
        name: 'test-key',
        permissions: ['read'],
        lastUsed: null,
        usageCount: 0
      }));

      const middleware = authMiddleware.authenticate();
      await middleware(req, res, next);

      expect(req.auth).toBeDefined();
      expect(req.auth.type).toBe('apikey');
      expect(req.auth.permissions).toEqual(['read']);
      expect(next).toHaveBeenCalled();
    });

    it('should reject missing authentication', async () => {
      const middleware = authMiddleware.authenticate();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow optional authentication', async () => {
      const middleware = authMiddleware.authenticate({ optional: true });
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('authorization middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { auth: null };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should authorize user with required permissions', () => {
      req.auth = {
        userId: 'user123',
        permissions: ['read', 'write']
      };

      const middleware = authMiddleware.authorize(['read']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should authorize user with wildcard permission', () => {
      req.auth = {
        userId: 'admin',
        permissions: ['*']
      };

      const middleware = authMiddleware.authorize(['read', 'write', 'delete']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject user without required permissions', () => {
      req.auth = {
        userId: 'user123',
        permissions: ['read']
      };

      const middleware = authMiddleware.authorize(['write', 'delete']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        required: ['write', 'delete'],
        provided: ['read']
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('rate limiting', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        auth: { userId: 'user123' },
        ip: '127.0.0.1'
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      };
      next = jest.fn();
    });

    it('should allow requests within rate limit', () => {
      const middleware = authMiddleware.rateLimit({ max: 5 });

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(5);
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding rate limit', () => {
      const middleware = authMiddleware.rateLimit({ max: 2 });

      // Make 3 requests
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        retryAfter: expect.any(Number)
      });
    });

    it('should set rate limit headers', () => {
      const middleware = authMiddleware.rateLimit({ max: 10 });

      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
      expect(res.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });
  });

  describe('CORS middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        headers: { origin: 'http://localhost:3000' },
        method: 'GET'
      };
      res = {
        header: jest.fn(),
        sendStatus: jest.fn()
      };
      next = jest.fn();
    });

    it('should set CORS headers for allowed origin', () => {
      const middleware = authMiddleware.cors();
      middleware(req, res, next);

      expect(res.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'http://localhost:3000'
      );
      expect(res.header).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        expect.any(String)
      );
      expect(next).toHaveBeenCalled();
    });

    it('should handle OPTIONS preflight requests', () => {
      req.method = 'OPTIONS';

      const middleware = authMiddleware.cors();
      middleware(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('should extract token from Bearer header', () => {
      const req = {
        headers: { authorization: 'Bearer token123' },
        query: {},
        cookies: {}
      };

      const token = authMiddleware.extractToken(req);
      expect(token).toBe('token123');
    });

    it('should extract token from query parameter', () => {
      const req = {
        headers: {},
        query: { token: 'token456' },
        cookies: {}
      };

      const token = authMiddleware.extractToken(req);
      expect(token).toBe('token456');
    });

    it('should generate secure random key', () => {
      const key1 = authMiddleware.generateSecureKey();
      const key2 = authMiddleware.generateSecureKey();

      expect(key1).toHaveLength(32);
      expect(key2).toHaveLength(32);
      expect(key1).not.toBe(key2);
    });

    it('should hash API key consistently', () => {
      const key = 'test-api-key';
      const hash1 = authMiddleware.hashApiKey(key);
      const hash2 = authMiddleware.hashApiKey(key);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex
    });
  });
});