import { createHash, randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

/**
 * Simple user service for authentication
 * In production, this would use a proper database
 */
export class UserService {
  constructor({ logger, redis, config }) {
    this.logger = logger;
    this.redis = redis;
    this.config = config;
    
    // Redis key prefixes
    this.userPrefix = `${config.redis.keyPrefix}users:`;
    this.resetTokenPrefix = `${config.redis.keyPrefix}reset-tokens:`;
    
    // Default admin user (for demo purposes)
    this.initializeDefaultUsers();
  }

  /**
   * Initialize default users
   */
  async initializeDefaultUsers() {
    const adminUser = {
      id: 'admin',
      username: 'admin',
      email: 'admin@autoweave.local',
      passwordHash: await this.hashPassword('admin123'),
      permissions: ['*'], // All permissions
      createdAt: new Date().toISOString(),
      apiKeys: []
    };

    const demoUser = {
      id: 'demo',
      username: 'demo',
      email: 'demo@autoweave.local',
      passwordHash: await this.hashPassword('demo123'),
      permissions: [
        'agents:read',
        'agents:create',
        'analytics:read',
        'api-keys:read',
        'api-keys:create'
      ],
      createdAt: new Date().toISOString(),
      apiKeys: []
    };

    // Store default users
    await this.redis.set(
      `${this.userPrefix}admin`,
      JSON.stringify(adminUser)
    );
    await this.redis.set(
      `${this.userPrefix}demo`,
      JSON.stringify(demoUser)
    );
    
    // Also store by username for lookup
    await this.redis.set(
      `${this.userPrefix}username:admin`,
      'admin'
    );
    await this.redis.set(
      `${this.userPrefix}username:demo`,
      'demo'
    );

    this.logger.info('Default users initialized');
  }

  /**
   * Authenticate user
   */
  async authenticate(username, password) {
    try {
      // Get user ID by username
      const userId = await this.redis.get(`${this.userPrefix}username:${username}`);
      if (!userId) {
        return null;
      }

      // Get user data
      const userData = await this.redis.get(`${this.userPrefix}${userId}`);
      if (!userData) {
        return null;
      }

      const user = JSON.parse(userData);

      // Verify password
      const isValid = await this.verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return null;
      }

      // Return user without sensitive data
      const { passwordHash, ...safeUser } = user;
      return safeUser;

    } catch (error) {
      this.logger.error('Authentication error:', error);
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    try {
      const userData = await this.redis.get(`${this.userPrefix}${userId}`);
      if (!userData) {
        return null;
      }

      const user = JSON.parse(userData);
      const { passwordHash, ...safeUser } = user;
      return safeUser;

    } catch (error) {
      this.logger.error('Get user error:', error);
      return null;
    }
  }

  /**
   * Create user
   */
  async createUser(userData) {
    const userId = this.generateUserId();
    const passwordHash = await this.hashPassword(userData.password);

    const user = {
      id: userId,
      username: userData.username,
      email: userData.email,
      passwordHash,
      permissions: userData.permissions || [],
      createdAt: new Date().toISOString(),
      apiKeys: []
    };

    // Store user
    await this.redis.set(
      `${this.userPrefix}${userId}`,
      JSON.stringify(user)
    );

    // Store username mapping
    await this.redis.set(
      `${this.userPrefix}username:${userData.username}`,
      userId
    );

    // Store email mapping
    await this.redis.set(
      `${this.userPrefix}email:${userData.email}`,
      userId
    );

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Update password
   */
  async updatePassword(userId, newPassword) {
    const userData = await this.redis.get(`${this.userPrefix}${userId}`);
    if (!userData) {
      throw new Error('User not found');
    }

    const user = JSON.parse(userData);
    user.passwordHash = await this.hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();

    await this.redis.set(
      `${this.userPrefix}${userId}`,
      JSON.stringify(user)
    );
  }

  /**
   * Add API key to user
   */
  async addApiKey(userId, apiKeyData) {
    const userData = await this.redis.get(`${this.userPrefix}${userId}`);
    if (!userData) {
      throw new Error('User not found');
    }

    const user = JSON.parse(userData);
    user.apiKeys = user.apiKeys || [];
    user.apiKeys.push(apiKeyData);

    await this.redis.set(
      `${this.userPrefix}${userId}`,
      JSON.stringify(user)
    );
  }

  /**
   * Get user API keys
   */
  async getUserApiKeys(userId) {
    const userData = await this.redis.get(`${this.userPrefix}${userId}`);
    if (!userData) {
      return [];
    }

    const user = JSON.parse(userData);
    return user.apiKeys || [];
  }

  /**
   * Get specific API key
   */
  async getUserApiKey(userId, keyName) {
    const apiKeys = await this.getUserApiKeys(userId);
    return apiKeys.find(key => key.name === keyName);
  }

  /**
   * Remove API key
   */
  async removeApiKey(userId, keyName) {
    const userData = await this.redis.get(`${this.userPrefix}${userId}`);
    if (!userData) {
      throw new Error('User not found');
    }

    const user = JSON.parse(userData);
    user.apiKeys = (user.apiKeys || []).filter(key => key.name !== keyName);

    await this.redis.set(
      `${this.userPrefix}${userId}`,
      JSON.stringify(user)
    );
  }

  /**
   * Create password reset token
   */
  async createPasswordResetToken(email, token) {
    // Get user ID by email
    const userId = await this.redis.get(`${this.userPrefix}email:${email}`);
    if (!userId) {
      // Don't reveal if email exists
      return;
    }

    // Store reset token with 1 hour expiry
    await this.redis.setex(
      `${this.resetTokenPrefix}${token}`,
      3600,
      userId
    );
  }

  /**
   * Validate password reset token
   */
  async validatePasswordResetToken(token) {
    const userId = await this.redis.get(`${this.resetTokenPrefix}${token}`);
    return userId;
  }

  /**
   * Invalidate password reset token
   */
  async invalidatePasswordResetToken(token) {
    await this.redis.del(`${this.resetTokenPrefix}${token}`);
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    const salt = randomBytes(32);
    const hash = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  /**
   * Verify password
   */
  async verifyPassword(password, passwordHash) {
    const [saltHex, hashHex] = passwordHash.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const hash = Buffer.from(hashHex, 'hex');
    
    const testHash = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
    return testHash.equals(hash);
  }

  /**
   * Generate user ID
   */
  generateUserId() {
    return `user-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId) {
    const user = await this.getUser(userId);
    return user?.permissions || [];
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(userId, permissions) {
    const userData = await this.redis.get(`${this.userPrefix}${userId}`);
    if (!userData) {
      throw new Error('User not found');
    }

    const user = JSON.parse(userData);
    user.permissions = permissions;
    user.updatedAt = new Date().toISOString();

    await this.redis.set(
      `${this.userPrefix}${userId}`,
      JSON.stringify(user)
    );
  }
}

/**
 * Create user service instance
 */
export function createUserService(dependencies) {
  return new UserService(dependencies);
}