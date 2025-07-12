/**
 * Integration Helper Utilities
 * Provides utility functions for robust integration handling
 */

import net from 'net';
import fetch from 'node-fetch';

export class IntegrationHelper {
  /**
   * Check if a port is available
   */
  static async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Find next available port in range
   */
  static async findAvailablePortInRange(startPort, endPort) {
    for (let port = startPort; port <= endPort; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available port found in range ${startPort}-${endPort}`);
  }

  /**
   * Validate URL format
   */
  static validateUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build health check URL with smart defaults
   */
  static buildHealthUrl(config, healthPath = '/health') {
    let baseUrl = config.apiUrl || config.url || config.host;
    
    if (!baseUrl) {
      throw new Error('No base URL found in configuration');
    }
    
    // Add protocol if missing
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `http://${baseUrl}`;
    }
    
    // Handle port
    if (config.port && !baseUrl.includes(':' + config.port)) {
      const url = new URL(baseUrl);
      url.port = config.port;
      baseUrl = url.toString();
    }
    
    // Clean up URL
    baseUrl = baseUrl.replace(/\/$/, '');
    
    return `${baseUrl}${healthPath}`;
  }

  /**
   * Perform health check with retries
   */
  static async healthCheck(url, options = {}) {
    const {
      timeout = 5000,
      retries = 3,
      retryDelay = 1000,
      userAgent = 'AutoWeave-Integration/1.0'
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          timeout,
          headers: { 'User-Agent': userAgent }
        });
        
        if (response.ok) {
          return {
            success: true,
            status: response.status,
            statusText: response.statusText,
            attempt
          };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (error) {
        lastError = error;
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }
    
    return {
      success: false,
      error: lastError.message,
      attempts: retries
    };
  }

  /**
   * Detect running processes on specific ports
   */
  static async getPortUsage(ports) {
    const usage = new Map();
    
    for (const port of ports) {
      const available = await this.isPortAvailable(port);
      usage.set(port, {
        port,
        available,
        inUse: !available
      });
    }
    
    return usage;
  }

  /**
   * Generate integration recommendations based on service type
   */
  static generateIntegrationRecommendations(serviceType, config) {
    const recommendations = {
      'web-ui': {
        healthCheckInterval: 30000,
        timeoutSettings: { health: 5000, operation: 15000 },
        retryPolicy: { maxRetries: 3, backoff: 'exponential' },
        features: ['realtime-updates', 'file-operations', 'websocket']
      },
      'development-tool': {
        healthCheckInterval: 15000,
        timeoutSettings: { health: 3000, operation: 30000 },
        retryPolicy: { maxRetries: 5, backoff: 'linear' },
        features: ['code-execution', 'project-management', 'terminal']
      },
      'api-service': {
        healthCheckInterval: 60000,
        timeoutSettings: { health: 3000, operation: 10000 },
        retryPolicy: { maxRetries: 3, backoff: 'exponential' },
        features: ['rest-api', 'batch-operations', 'rate-limiting']
      },
      'database': {
        healthCheckInterval: 120000,
        timeoutSettings: { health: 10000, operation: 60000 },
        retryPolicy: { maxRetries: 5, backoff: 'exponential' },
        features: ['connection-pooling', 'transactions', 'migrations']
      }
    };

    return recommendations[serviceType] || recommendations['api-service'];
  }

  /**
   * Validate integration configuration completeness
   */
  static validateConfiguration(config, requiredFields) {
    const missing = [];
    const invalid = [];
    
    for (const field of requiredFields) {
      if (!config[field]) {
        missing.push(field);
      } else if (field.includes('Url') && !this.validateUrl(config[field])) {
        invalid.push(field);
      }
    }
    
    return {
      valid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
      recommendations: this.generateConfigRecommendations(config)
    };
  }

  /**
   * Generate configuration recommendations
   */
  static generateConfigRecommendations(config) {
    const recommendations = [];
    
    if (!config.timeout) {
      recommendations.push('Consider setting custom timeout values');
    }
    
    if (!config.retries) {
      recommendations.push('Configure retry policy for better resilience');
    }
    
    if (!config.healthCheckInterval) {
      recommendations.push('Set appropriate health check intervals');
    }
    
    if (config.apiUrl && !config.wsUrl) {
      recommendations.push('Consider adding WebSocket URL for real-time features');
    }
    
    return recommendations;
  }

  /**
   * Create integration summary for monitoring
   */
  static createIntegrationSummary(integration) {
    return {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      status: integration.status,
      healthStatus: integration.healthStatus || 'unknown',
      capabilities: integration.capabilities || {},
      metrics: {
        uptime: integration.registeredAt ? Date.now() - integration.registeredAt.getTime() : 0,
        requests: integration.metrics?.requests || 0,
        errors: integration.metrics?.errors || 0,
        healthChecks: integration.metrics?.healthChecks || {},
        lastActivity: integration.metrics?.lastRequest || integration.lastHealthCheck
      },
      configuration: {
        hasHealthCheck: !!integration.healthCheck,
        hasWebSocket: !!integration.websocket,
        portConflictResolved: integration.portConflictResolved || false,
        autoDetectedPort: integration.config?.port !== integration.config?.originalPort
      }
    };
  }
}

export default IntegrationHelper;