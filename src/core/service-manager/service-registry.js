import { EventEmitter } from 'eventemitter3';

/**
 * Service Registry - Maintains registry of all services
 */
class ServiceRegistry extends EventEmitter {
  constructor({ logger, storage = null }) {
    super();
    this.logger = logger;
    this.storage = storage; // Optional persistent storage
    this.services = new Map();
    this.endpoints = new Map(); // Map endpoints to services
    this.tags = new Map(); // Map tags to services
    this.lastSync = null;
  }

  /**
   * Register a service
   * @param {Object} service - Service configuration
   */
  async register(service) {
    if (!service.id || !service.name) {
      throw new Error('Service must have id and name');
    }

    // Store service
    this.services.set(service.id, {
      ...service,
      registeredAt: new Date(),
      updatedAt: new Date()
    });

    // Index endpoints
    if (service.endpoints) {
      for (const endpoint of service.endpoints) {
        const key = `${endpoint.method}:${endpoint.path}`;
        if (!this.endpoints.has(key)) {
          this.endpoints.set(key, new Set());
        }
        this.endpoints.get(key).add(service.id);
      }
    }

    // Index tags
    if (service.tags) {
      for (const tag of service.tags) {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set());
        }
        this.tags.get(tag).add(service.id);
      }
    }

    // Persist if storage is available
    if (this.storage) {
      await this.persist();
    }

    this.emit('service:registered', service);
    this.logger.info(`Service registered in registry: ${service.name} (${service.id})`);
  }

  /**
   * Update a service
   * @param {string} serviceId - Service ID
   * @param {Object} updates - Service updates
   */
  async update(serviceId, updates) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found in registry`);
    }

    // Remove old endpoint mappings
    if (service.endpoints) {
      for (const endpoint of service.endpoints) {
        const key = `${endpoint.method}:${endpoint.path}`;
        const services = this.endpoints.get(key);
        if (services) {
          services.delete(serviceId);
          if (services.size === 0) {
            this.endpoints.delete(key);
          }
        }
      }
    }

    // Remove old tag mappings
    if (service.tags) {
      for (const tag of service.tags) {
        const services = this.tags.get(tag);
        if (services) {
          services.delete(serviceId);
          if (services.size === 0) {
            this.tags.delete(tag);
          }
        }
      }
    }

    // Update service
    const updatedService = {
      ...service,
      ...updates,
      updatedAt: new Date()
    };
    this.services.set(serviceId, updatedService);

    // Re-index endpoints
    if (updatedService.endpoints) {
      for (const endpoint of updatedService.endpoints) {
        const key = `${endpoint.method}:${endpoint.path}`;
        if (!this.endpoints.has(key)) {
          this.endpoints.set(key, new Set());
        }
        this.endpoints.get(key).add(serviceId);
      }
    }

    // Re-index tags
    if (updatedService.tags) {
      for (const tag of updatedService.tags) {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set());
        }
        this.tags.get(tag).add(serviceId);
      }
    }

    // Persist if storage is available
    if (this.storage) {
      await this.persist();
    }

    this.emit('service:updated', updatedService);
  }

  /**
   * Deregister a service
   * @param {string} serviceId - Service ID
   */
  async deregister(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found in registry`);
    }

    // Remove endpoint mappings
    if (service.endpoints) {
      for (const endpoint of service.endpoints) {
        const key = `${endpoint.method}:${endpoint.path}`;
        const services = this.endpoints.get(key);
        if (services) {
          services.delete(serviceId);
          if (services.size === 0) {
            this.endpoints.delete(key);
          }
        }
      }
    }

    // Remove tag mappings
    if (service.tags) {
      for (const tag of service.tags) {
        const services = this.tags.get(tag);
        if (services) {
          services.delete(serviceId);
          if (services.size === 0) {
            this.tags.delete(tag);
          }
        }
      }
    }

    // Remove service
    this.services.delete(serviceId);

    // Persist if storage is available
    if (this.storage) {
      await this.persist();
    }

    this.emit('service:deregistered', service);
    this.logger.info(`Service deregistered from registry: ${service.name} (${serviceId})`);
  }

  /**
   * Get a service by ID
   * @param {string} serviceId - Service ID
   * @returns {Object} Service object
   */
  getService(serviceId) {
    return this.services.get(serviceId);
  }

  /**
   * Get services by name
   * @param {string} name - Service name
   * @returns {Array} Array of services
   */
  getServicesByName(name) {
    return Array.from(this.services.values()).filter(
      service => service.name === name
    );
  }

  /**
   * Get services by tag
   * @param {string} tag - Service tag
   * @returns {Array} Array of services
   */
  getServicesByTag(tag) {
    const serviceIds = this.tags.get(tag);
    if (!serviceIds) return [];
    
    return Array.from(serviceIds).map(id => this.services.get(id)).filter(Boolean);
  }

  /**
   * Get services by endpoint
   * @param {string} method - HTTP method
   * @param {string} path - Endpoint path
   * @returns {Array} Array of services
   */
  getServicesByEndpoint(method, path) {
    const key = `${method}:${path}`;
    const serviceIds = this.endpoints.get(key);
    if (!serviceIds) return [];
    
    return Array.from(serviceIds).map(id => this.services.get(id)).filter(Boolean);
  }

  /**
   * Discover services matching criteria
   * @param {Object} criteria - Discovery criteria
   * @returns {Array} Array of matching services
   */
  discover(criteria = {}) {
    let services = Array.from(this.services.values());

    // Filter by status
    if (criteria.status) {
      services = services.filter(s => s.status === criteria.status);
    }

    // Filter by version
    if (criteria.version) {
      services = services.filter(s => {
        if (criteria.version.startsWith('~')) {
          // Patch version match
          const baseVersion = criteria.version.substring(1);
          return s.version.startsWith(baseVersion.split('.').slice(0, 2).join('.'));
        } else if (criteria.version.startsWith('^')) {
          // Minor version match
          const baseVersion = criteria.version.substring(1);
          return s.version.startsWith(baseVersion.split('.')[0]);
        } else {
          // Exact match
          return s.version === criteria.version;
        }
      });
    }

    // Filter by capabilities
    if (criteria.capabilities) {
      services = services.filter(s => {
        if (!s.capabilities) return false;
        return criteria.capabilities.every(cap => s.capabilities.includes(cap));
      });
    }

    // Filter by metadata
    if (criteria.metadata) {
      services = services.filter(s => {
        if (!s.metadata) return false;
        return Object.entries(criteria.metadata).every(
          ([key, value]) => s.metadata[key] === value
        );
      });
    }

    // Sort by registration time (newest first)
    services.sort((a, b) => b.registeredAt - a.registeredAt);

    return services;
  }

  /**
   * Get all services
   * @returns {Array} Array of all services
   */
  getAllServices() {
    return Array.from(this.services.values());
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    const services = Array.from(this.services.values());
    const statusCounts = {};
    const versionCounts = {};
    
    for (const service of services) {
      // Count by status
      statusCounts[service.status] = (statusCounts[service.status] || 0) + 1;
      
      // Count by version
      versionCounts[service.version] = (versionCounts[service.version] || 0) + 1;
    }

    return {
      totalServices: services.length,
      totalEndpoints: this.endpoints.size,
      totalTags: this.tags.size,
      statusCounts,
      versionCounts,
      lastSync: this.lastSync
    };
  }

  /**
   * Persist registry to storage
   */
  async persist() {
    if (!this.storage) return;

    const data = {
      services: Array.from(this.services.entries()),
      endpoints: Array.from(this.endpoints.entries()).map(([key, set]) => [key, Array.from(set)]),
      tags: Array.from(this.tags.entries()).map(([key, set]) => [key, Array.from(set)]),
      lastSync: new Date()
    };

    await this.storage.set('service-registry', data);
    this.lastSync = data.lastSync;
  }

  /**
   * Load registry from storage
   */
  async load() {
    if (!this.storage) return;

    const data = await this.storage.get('service-registry');
    if (!data) return;

    // Restore services
    this.services = new Map(data.services);

    // Restore endpoints
    this.endpoints = new Map();
    for (const [key, serviceIds] of data.endpoints) {
      this.endpoints.set(key, new Set(serviceIds));
    }

    // Restore tags
    this.tags = new Map();
    for (const [key, serviceIds] of data.tags) {
      this.tags.set(key, new Set(serviceIds));
    }

    this.lastSync = data.lastSync;
    this.logger.info(`Registry loaded from storage: ${this.services.size} services`);
  }

  /**
   * Clear registry
   */
  async clear() {
    this.services.clear();
    this.endpoints.clear();
    this.tags.clear();
    this.lastSync = null;

    if (this.storage) {
      await this.storage.delete('service-registry');
    }

    this.emit('registry:cleared');
  }

  /**
   * Export registry data
   * @returns {Object} Registry export
   */
  export() {
    return {
      services: Array.from(this.services.values()),
      endpoints: Array.from(this.endpoints.entries()).map(([key, set]) => ({
        key,
        services: Array.from(set)
      })),
      tags: Array.from(this.tags.entries()).map(([key, set]) => ({
        tag: key,
        services: Array.from(set)
      })),
      exportedAt: new Date()
    };
  }

  /**
   * Import registry data
   * @param {Object} data - Registry data to import
   */
  async import(data) {
    // Clear existing data
    await this.clear();

    // Import services
    for (const service of data.services) {
      await this.register(service);
    }

    this.logger.info(`Registry imported: ${data.services.length} services`);
  }
}

export default ServiceRegistry;