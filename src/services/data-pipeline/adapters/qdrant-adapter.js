import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Qdrant Storage Adapter for Data Pipeline
 */
class QdrantAdapter {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.client = new QdrantClient({
      host: config.host || 'localhost',
      port: config.port || 6333,
      apiKey: config.apiKey,
      https: config.https || false
    });
  }

  /**
   * Create a cursor for streaming data
   * @param {Object} config - Cursor configuration
   */
  async createCursor(config) {
    const { collection, filter, limit, offset = 0 } = config;
    
    return {
      collection,
      filter,
      limit,
      currentOffset: offset,
      
      async next(batchSize) {
        try {
          const response = await this.client.scroll(collection, {
            filter: filter || {},
            limit: batchSize,
            offset: this.currentOffset,
            with_payload: true,
            with_vector: config.includeVectors || false
          });
          
          this.currentOffset += response.points.length;
          
          return response.points.map(point => ({
            id: point.id,
            payload: point.payload,
            vector: point.vector,
            metadata: {
              collection,
              score: point.score
            }
          }));
        } catch (error) {
          this.logger.error('Qdrant cursor error:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Write batch to Qdrant
   * @param {Array} batch - Batch of items to write
   * @param {Object} config - Write configuration
   */
  async writeBatch(batch, config) {
    const { collection, upsert = true } = config;
    
    try {
      // Ensure collection exists
      await this.ensureCollection(collection, config);
      
      // Prepare points
      const points = batch.map(item => ({
        id: item.id || this.generateId(),
        vector: item.vector,
        payload: item.payload || item
      }));
      
      // Upsert points
      if (upsert) {
        await this.client.upsert(collection, {
          wait: true,
          points
        });
      } else {
        // Use batch update for better performance
        await this.client.batchUpdate(collection, {
          wait: true,
          points
        });
      }
      
      this.logger.debug(`Written ${batch.length} items to Qdrant collection: ${collection}`);
      
    } catch (error) {
      this.logger.error('Qdrant write error:', error);
      throw error;
    }
  }

  /**
   * Search in Qdrant
   * @param {Object} query - Search query
   * @param {Object} config - Search configuration
   */
  async search(query, config) {
    const { collection, limit = 10, filter } = config;
    
    try {
      const results = await this.client.search(collection, {
        vector: query.vector,
        filter: filter || query.filter,
        limit,
        with_payload: true,
        with_vector: config.includeVectors || false
      });
      
      return results.map(result => ({
        id: result.id,
        score: result.score,
        payload: result.payload,
        vector: result.vector
      }));
      
    } catch (error) {
      this.logger.error('Qdrant search error:', error);
      throw error;
    }
  }

  /**
   * Delete items from Qdrant
   * @param {Object} filter - Deletion filter
   * @param {Object} config - Delete configuration
   */
  async delete(filter, config) {
    const { collection } = config;
    
    try {
      await this.client.delete(collection, {
        wait: true,
        filter
      });
      
      this.logger.debug(`Deleted items from Qdrant collection: ${collection}`);
      
    } catch (error) {
      this.logger.error('Qdrant delete error:', error);
      throw error;
    }
  }

  /**
   * Ensure collection exists with proper configuration
   * @param {string} collection - Collection name
   * @param {Object} config - Collection configuration
   */
  async ensureCollection(collection, config) {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === collection);
      
      if (!exists && config.autoCreate !== false) {
        // Create collection
        await this.client.createCollection(collection, {
          vectors: {
            size: config.vectorSize || 1536,
            distance: config.distance || 'Cosine'
          },
          optimizers_config: {
            default_segment_number: config.segmentNumber || 2
          },
          replication_factor: config.replicationFactor || 1
        });
        
        // Create indexes if specified
        if (config.indexes) {
          for (const index of config.indexes) {
            await this.client.createFieldIndex(collection, {
              field_name: index.field,
              field_schema: index.schema || 'keyword'
            });
          }
        }
        
        this.logger.info(`Created Qdrant collection: ${collection}`);
      }
    } catch (error) {
      this.logger.error('Error ensuring collection:', error);
      throw error;
    }
  }

  /**
   * Get collection info
   * @param {string} collection - Collection name
   */
  async getCollectionInfo(collection) {
    try {
      const info = await this.client.getCollection(collection);
      return {
        name: collection,
        vectorsCount: info.vectors_count,
        pointsCount: info.points_count,
        config: info.config,
        status: info.status
      };
    } catch (error) {
      this.logger.error('Error getting collection info:', error);
      throw error;
    }
  }

  /**
   * Generate a unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.client.getCollections();
      return { healthy: true, type: 'qdrant' };
    } catch (error) {
      return { healthy: false, type: 'qdrant', error: error.message };
    }
  }
}

export default QdrantAdapter;