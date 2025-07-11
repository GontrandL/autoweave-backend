import QdrantAdapter from './qdrant-adapter.js';
import RedisAdapter from './redis-adapter.js';
import Neo4jAdapter from './neo4j-adapter.js';

/**
 * Storage adapter factory
 */
class StorageAdapterFactory {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.adapters = new Map();
    
    // Register built-in adapters
    this.registerAdapter('qdrant', QdrantAdapter);
    this.registerAdapter('redis', RedisAdapter);
    this.registerAdapter('neo4j', Neo4jAdapter);
    this.registerAdapter('memgraph', Neo4jAdapter); // Memgraph is Neo4j compatible
  }

  /**
   * Register a storage adapter
   * @param {string} type - Adapter type
   * @param {Class} AdapterClass - Adapter class
   */
  registerAdapter(type, AdapterClass) {
    this.adapters.set(type, AdapterClass);
  }

  /**
   * Create adapter instance
   * @param {string} type - Adapter type
   * @param {Object} config - Adapter configuration
   */
  createAdapter(type, config) {
    const AdapterClass = this.adapters.get(type);
    if (!AdapterClass) {
      throw new Error(`Unknown adapter type: ${type}`);
    }
    
    return new AdapterClass({
      config: { ...this.config[type], ...config },
      logger: this.logger
    });
  }

  /**
   * Get all registered adapter types
   */
  getAdapterTypes() {
    return Array.from(this.adapters.keys());
  }
}

export default StorageAdapterFactory;
export { QdrantAdapter, RedisAdapter, Neo4jAdapter };