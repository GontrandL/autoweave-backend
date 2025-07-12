import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

/**
 * JWT Authentication Middleware
 */
export class AuthMiddleware {
  constructor({ config, logger, redis }) {
    this.config = config;
    this.logger = logger;
    this.redis = redis;
    
    this.jwtSecret = config.security.jwtSecret;
    this.jwtExpiresIn = config.security.jwtExpiresIn;
    this.apiKeyHeader = config.security.apiKeyHeader;
    
    // Token blacklist prefix
    this.blacklistPrefix = `${config.redis.keyPrefix}auth:blacklist:`;
    
    // API key storage prefix
    this.apiKeyPrefix = `${config.redis.keyPrefix}auth:apikeys:`;
  }

  /**
   * Generate JWT token
   */
  generateToken(payload, options = {}) {
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      jti: this.generateTokenId()
    };

    const tokenOptions = {
      expiresIn: this.jwtExpiresIn,
      ...options
    };

    return jwt.sign(tokenPayload, this.jwtSecret, tokenOptions);
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(oldToken) {
    try {
      // Verify old token (even if expired)
      const decoded = jwt.decode(oldToken);
      
      if (!decoded || !decoded.jti) {
        throw new Error('Invalid token structure');
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Generate new token with same payload
      const { iat, exp, jti, ...payload } = decoded;
      const newToken = this.generateToken(payload);

      // Blacklist old token
      await this.blacklistToken(decoded.jti, decoded.exp);

      return newToken;
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new Error('Failed to refresh token');
    }
  }

  /**
   * Blacklist token
   */
  async blacklistToken(tokenId, expiry) {
    const key = `${this.blacklistPrefix}${tokenId}`;
    const ttl = expiry ? expiry - Math.floor(Date.now() / 1000) : 86400; // 24 hours default
    
    if (ttl > 0) {
      await this.redis.setex(key, ttl, '1');
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(tokenId) {
    const key = `${this.blacklistPrefix}${tokenId}`;
    const result = await this.redis.get(key);
    return result === '1';
  }

  /**
   * Generate API key
   */
  generateApiKey(name, permissions = []) {
    const key = this.generateSecureKey();
    const hashedKey = this.hashApiKey(key);
    
    const metadata = {
      name,
      permissions,
      created: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0
    };

    // Store metadata with hashed key
    this.redis.set(
      `${this.apiKeyPrefix}${hashedKey}`,
      JSON.stringify(metadata)
    );

    return {
      key,
      name,
      permissions,
      created: metadata.created
    };
  }

  /**
   * Validate API key
   */
  async validateApiKey(key) {
    const hashedKey = this.hashApiKey(key);
    const metadataStr = await this.redis.get(`${this.apiKeyPrefix}${hashedKey}`);
    
    if (!metadataStr) {
      return null;
    }

    const metadata = JSON.parse(metadataStr);
    
    // Update usage stats
    metadata.lastUsed = new Date().toISOString();
    metadata.usageCount++;
    
    await this.redis.set(
      `${this.apiKeyPrefix}${hashedKey}`,
      JSON.stringify(metadata)
    );

    return metadata;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(key) {
    const hashedKey = this.hashApiKey(key);
    await this.redis.del(`${this.apiKeyPrefix}${hashedKey}`);
  }

  /**
   * JWT authentication middleware
   */
  authenticate(options = {}) {
    return async (req, res, next) => {
      try {
        // Check for API key first
        const apiKey = req.headers[this.apiKeyHeader];
        if (apiKey) {
          const metadata = await this.validateApiKey(apiKey);
          if (metadata) {
            req.auth = {
              type: 'apikey',
              apiKey: metadata.name,
              permissions: metadata.permissions
            };
            return next();
          }
        }

        // Check for JWT token
        const token = this.extractToken(req);
        if (!token) {
          if (options.optional) {
            return next();
          }
          return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = this.verifyToken(token);
        
        // Check blacklist
        if (decoded.jti) {
          const isBlacklisted = await this.isTokenBlacklisted(decoded.jti);
          if (isBlacklisted) {
            return res.status(401).json({ error: 'Token has been revoked' });
          }
        }

        req.auth = {
          type: 'jwt',
          ...decoded
        };

        next();
      } catch (error) {
        this.logger.error('Authentication error:', error);
        
        if (error.message === 'Token expired') {
          return res.status(401).json({ error: 'Token expired' });
        } else if (error.message === 'Invalid token') {
          return res.status(401).json({ error: 'Invalid token' });
        }
        
        return res.status(401).json({ error: 'Authentication failed' });
      }
    };
  }

  /**
   * Authorization middleware
   */
  authorize(requiredPermissions = []) {
    return (req, res, next) => {
      if (!req.auth) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userPermissions = req.auth.permissions || [];
      
      // Check if user has all required permissions
      const hasPermissions = requiredPermissions.every(perm =>
        userPermissions.includes(perm) || userPermissions.includes('*')
      );

      if (!hasPermissions) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredPermissions,
          provided: userPermissions
        });
      }

      next();
    };
  }

  /**
   * Extract token from request
   */
  extractToken(req) {
    // Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Query parameter
    if (req.query.token) {
      return req.query.token;
    }

    // Cookie
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    return null;
  }

  /**
   * Generate secure random key
   */
  generateSecureKey(length = 32) {
    return require('crypto')
      .randomBytes(length)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, length);
  }

  /**
   * Hash API key
   */
  hashApiKey(key) {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Generate token ID
   */
  generateTokenId() {
    return this.generateSecureKey(16);
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(options = {}) {
    const {
      windowMs = this.config.security.rateLimitWindow,
      max = this.config.security.rateLimitMax,
      keyGenerator = (req) => req.auth?.userId || req.ip
    } = options;

    const counters = new Map();

    return async (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();
      
      // Get or create counter
      let counter = counters.get(key);
      if (!counter || now - counter.windowStart > windowMs) {
        counter = {
          windowStart: now,
          count: 0
        };
        counters.set(key, counter);
      }

      counter.count++;

      if (counter.count > max) {
        const retryAfter = Math.ceil((counter.windowStart + windowMs - now) / 1000);
        res.set('X-RateLimit-Limit', max);
        res.set('X-RateLimit-Remaining', 0);
        res.set('X-RateLimit-Reset', new Date(counter.windowStart + windowMs).toISOString());
        res.set('Retry-After', retryAfter);
        
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter
        });
      }

      res.set('X-RateLimit-Limit', max);
      res.set('X-RateLimit-Remaining', max - counter.count);
      res.set('X-RateLimit-Reset', new Date(counter.windowStart + windowMs).toISOString());

      next();
    };
  }

  /**
   * CORS middleware
   */
  cors(options = {}) {
    const {
      origins = this.config.security.corsOrigins,
      credentials = true,
      methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers = ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
    } = options;

    return (req, res, next) => {
      const origin = req.headers.origin;
      
      // Check if origin is allowed
      if (origins.includes('*') || origins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      }

      res.header('Access-Control-Allow-Methods', methods.join(', '));
      res.header('Access-Control-Allow-Headers', headers.join(', '));
      res.header('Access-Control-Allow-Credentials', credentials);
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }

      next();
    };
  }
}

/**
 * Create auth middleware instance
 */
export function createAuthMiddleware(dependencies) {
  return new AuthMiddleware(dependencies);
}