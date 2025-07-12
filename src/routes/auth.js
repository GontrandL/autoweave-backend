import { Router } from 'express';
import { createHash } from 'crypto';

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: Username or email
 *           example: admin
 *         password:
 *           type: string
 *           format: password
 *           description: User password
 *           example: admin123
 *     LoginResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: JWT authentication token
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             username:
 *               type: string
 *             permissions:
 *               type: array
 *               items:
 *                 type: string
 *     ApiKey:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: API key name
 *         permissions:
 *           type: array
 *           items:
 *             type: string
 *           description: Permissions granted to this key
 *         created:
 *           type: string
 *           format: date-time
 *         lastUsed:
 *           type: string
 *           format: date-time
 *         usageCount:
 *           type: integer
 */

/**
 * Authentication routes
 */
export default function createAuthRouter(authMiddleware, userService) {
  const router = Router();

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: User login
   *     description: Authenticate user and receive JWT token
   *     tags: [Authentication]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginRequest'
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginResponse'
   *       400:
   *         description: Invalid request
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: 'Username and password are required'
        });
      }

      // Authenticate user (this would normally check against a database)
      const user = await userService.authenticate(username, password);
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      // Generate token
      const token = authMiddleware.generateToken({
        userId: user.id,
        username: user.username,
        permissions: user.permissions || []
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          permissions: user.permissions
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  /**
   * Refresh token endpoint
   */
  router.post('/refresh', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          error: 'Token is required'
        });
      }

      const newToken = await authMiddleware.refreshToken(token);

      res.json({ token: newToken });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: error.message });
    }
  });

  /**
   * Logout endpoint
   */
  router.post('/logout', authMiddleware.authenticate(), async (req, res) => {
    try {
      // Blacklist the current token
      if (req.auth.jti) {
        await authMiddleware.blacklistToken(req.auth.jti, req.auth.exp);
      }

      res.json({ message: 'Logged out successfully' });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  /**
   * Get current user info
   */
  router.get('/me', authMiddleware.authenticate(), async (req, res) => {
    try {
      const user = await userService.getUser(req.auth.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        username: user.username,
        permissions: user.permissions,
        createdAt: user.createdAt
      });

    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  /**
   * Generate API key
   */
  router.post('/api-keys', 
    authMiddleware.authenticate(),
    authMiddleware.authorize(['api-keys:create']),
    async (req, res) => {
      try {
        const { name, permissions = [] } = req.body;

        if (!name) {
          return res.status(400).json({
            error: 'API key name is required'
          });
        }

        // Validate permissions
        const userPermissions = req.auth.permissions || [];
        const invalidPermissions = permissions.filter(perm => 
          !userPermissions.includes(perm) && !userPermissions.includes('*')
        );

        if (invalidPermissions.length > 0) {
          return res.status(403).json({
            error: 'Cannot grant permissions you do not have',
            invalid: invalidPermissions
          });
        }

        const apiKey = authMiddleware.generateApiKey(name, permissions);

        // Store API key association with user
        await userService.addApiKey(req.auth.userId, {
          name: apiKey.name,
          hashedKey: authMiddleware.hashApiKey(apiKey.key),
          permissions: apiKey.permissions,
          created: apiKey.created
        });

        res.json({
          apiKey: apiKey.key,
          name: apiKey.name,
          permissions: apiKey.permissions,
          created: apiKey.created,
          warning: 'Store this API key securely. It will not be shown again.'
        });

      } catch (error) {
        console.error('API key generation error:', error);
        res.status(500).json({ error: 'Failed to generate API key' });
      }
    }
  );

  /**
   * List API keys
   */
  router.get('/api-keys',
    authMiddleware.authenticate(),
    authMiddleware.authorize(['api-keys:read']),
    async (req, res) => {
      try {
        const apiKeys = await userService.getUserApiKeys(req.auth.userId);

        res.json({
          apiKeys: apiKeys.map(key => ({
            name: key.name,
            permissions: key.permissions,
            created: key.created,
            lastUsed: key.lastUsed,
            usageCount: key.usageCount
          }))
        });

      } catch (error) {
        console.error('List API keys error:', error);
        res.status(500).json({ error: 'Failed to list API keys' });
      }
    }
  );

  /**
   * Revoke API key
   */
  router.delete('/api-keys/:keyName',
    authMiddleware.authenticate(),
    authMiddleware.authorize(['api-keys:delete']),
    async (req, res) => {
      try {
        const { keyName } = req.params;

        const apiKey = await userService.getUserApiKey(req.auth.userId, keyName);
        
        if (!apiKey) {
          return res.status(404).json({ error: 'API key not found' });
        }

        // Revoke the key
        await authMiddleware.revokeApiKey(apiKey.hashedKey);
        await userService.removeApiKey(req.auth.userId, keyName);

        res.json({ message: 'API key revoked successfully' });

      } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
      }
    }
  );

  /**
   * Change password
   */
  router.post('/change-password',
    authMiddleware.authenticate(),
    async (req, res) => {
      try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            error: 'Current and new passwords are required'
          });
        }

        // Verify current password
        const user = await userService.authenticate(req.auth.username, currentPassword);
        
        if (!user) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        await userService.updatePassword(req.auth.userId, newPassword);

        res.json({ message: 'Password changed successfully' });

      } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
      }
    }
  );

  /**
   * Request password reset
   */
  router.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Generate reset token
      const resetToken = authMiddleware.generateSecureKey();
      await userService.createPasswordResetToken(email, resetToken);

      // In production, send email with reset link
      // For now, just return success
      res.json({ 
        message: 'Password reset instructions sent to your email'
      });

    } catch (error) {
      console.error('Password reset request error:', error);
      // Don't reveal if email exists
      res.json({ 
        message: 'Password reset instructions sent to your email'
      });
    }
  });

  /**
   * Reset password with token
   */
  router.post('/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          error: 'Token and new password are required'
        });
      }

      const userId = await userService.validatePasswordResetToken(token);
      
      if (!userId) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      await userService.updatePassword(userId, newPassword);
      await userService.invalidatePasswordResetToken(token);

      res.json({ message: 'Password reset successfully' });

    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  return router;
}