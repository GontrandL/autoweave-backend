import neo4j from 'neo4j-driver';

/**
 * Neo4j/Memgraph Storage Adapter for Data Pipeline
 */
class Neo4jAdapter {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.driver = neo4j.driver(
      config.uri || 'bolt://localhost:7687',
      neo4j.auth.basic(
        config.user || 'neo4j',
        config.password || 'password'
      ),
      {
        maxConnectionPoolSize: config.maxConnectionPoolSize || 100,
        connectionTimeout: config.connectionTimeout || 30000,
        logging: {
          level: 'info',
          logger: (level, message) => this.logger[level](message)
        }
      }
    );
    
    this.database = config.database || 'neo4j';
  }

  /**
   * Create a cursor for streaming data
   * @param {Object} config - Cursor configuration
   */
  async createCursor(config) {
    const { 
      query, 
      params = {}, 
      batchSize = 1000,
      labels,
      relationship
    } = config;
    
    // Build query if not provided
    const cypherQuery = query || this.buildQuery(config);
    let skip = 0;
    let hasMore = true;
    
    return {
      query: cypherQuery,
      params,
      
      async next(limit) {
        if (!hasMore) return [];
        
        const session = this.driver.session({ database: this.database });
        
        try {
          const paginatedQuery = `${cypherQuery} SKIP $skip LIMIT $limit`;
          const result = await session.run(paginatedQuery, {
            ...params,
            skip,
            limit: limit || batchSize
          });
          
          const records = result.records.map(record => {
            const data = record.toObject();
            return {
              id: this.extractId(data),
              ...this.transformRecord(data),
              metadata: {
                labels: this.extractLabels(data),
                type: this.extractType(data)
              }
            };
          });
          
          skip += records.length;
          hasMore = records.length === (limit || batchSize);
          
          return records;
          
        } catch (error) {
          this.logger.error('Neo4j cursor error:', error);
          throw error;
        } finally {
          await session.close();
        }
      }.bind(this)
    };
  }

  /**
   * Write batch to Neo4j
   * @param {Array} batch - Batch of items to write
   * @param {Object} config - Write configuration
   */
  async writeBatch(batch, config) {
    const { 
      nodeLabel = 'Node',
      mergeOn = ['id'],
      relationships = [],
      transaction = true
    } = config;
    
    const session = this.driver.session({ database: this.database });
    
    try {
      if (transaction) {
        await session.writeTransaction(async tx => {
          await this.writeBatchInTx(tx, batch, config);
        });
      } else {
        await this.writeBatchInTx(session, batch, config);
      }
      
      this.logger.debug(`Written ${batch.length} items to Neo4j`);
      
    } catch (error) {
      this.logger.error('Neo4j write error:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Write batch within transaction
   * @param {Object} tx - Transaction or session
   * @param {Array} batch - Batch of items
   * @param {Object} config - Write configuration
   */
  async writeBatchInTx(tx, batch, config) {
    const { 
      nodeLabel = 'Node',
      mergeOn = ['id'],
      relationships = [],
      properties = []
    } = config;
    
    // Create/merge nodes
    for (const item of batch) {
      const mergeProps = {};
      const setProps = {};
      
      // Separate merge and set properties
      mergeOn.forEach(prop => {
        if (item[prop] !== undefined) {
          mergeProps[prop] = item[prop];
        }
      });
      
      Object.entries(item).forEach(([key, value]) => {
        if (!mergeOn.includes(key) && this.isValidProperty(value)) {
          setProps[key] = value;
        }
      });
      
      // Build and execute merge query
      const mergeQuery = this.buildMergeQuery(nodeLabel, mergeProps, setProps);
      await tx.run(mergeQuery, { mergeProps, setProps });
      
      // Create relationships if specified
      if (relationships.length > 0 && item.relationships) {
        for (const relConfig of relationships) {
          await this.createRelationships(tx, item, relConfig);
        }
      }
    }
  }

  /**
   * Create relationships
   * @param {Object} tx - Transaction
   * @param {Object} item - Item with relationships
   * @param {Object} relConfig - Relationship configuration
   */
  async createRelationships(tx, item, relConfig) {
    const { type, direction = 'OUT', targetLabel, targetMergeOn = ['id'] } = relConfig;
    
    if (!item.relationships || !item.relationships[type]) return;
    
    const relationships = Array.isArray(item.relationships[type]) 
      ? item.relationships[type] 
      : [item.relationships[type]];
    
    for (const rel of relationships) {
      const query = this.buildRelationshipQuery(
        item,
        rel,
        type,
        direction,
        targetLabel,
        targetMergeOn
      );
      
      await tx.run(query, {
        sourceId: item.id,
        targetProps: rel,
        relProps: rel.properties || {}
      });
    }
  }

  /**
   * Search in Neo4j
   * @param {Object} query - Search query
   * @param {Object} config - Search configuration
   */
  async search(query, config) {
    const { 
      cypher,
      params = {},
      limit = 100
    } = config;
    
    const session = this.driver.session({ database: this.database });
    
    try {
      const result = await session.run(cypher, { ...params, limit });
      
      return result.records.map(record => {
        const data = record.toObject();
        return {
          ...this.transformRecord(data),
          metadata: {
            labels: this.extractLabels(data),
            score: data.score
          }
        };
      });
      
    } catch (error) {
      this.logger.error('Neo4j search error:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Delete items from Neo4j
   * @param {Object} filter - Deletion filter
   * @param {Object} config - Delete configuration
   */
  async delete(filter, config) {
    const { 
      nodeLabel,
      detachDelete = true
    } = config;
    
    const session = this.driver.session({ database: this.database });
    
    try {
      let query = `MATCH (n${nodeLabel ? ':' + nodeLabel : ''})`;
      
      // Add WHERE clause for filters
      if (Object.keys(filter).length > 0) {
        const conditions = Object.entries(filter).map(([key, value]) => 
          `n.${key} = $${key}`
        );
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      query += detachDelete ? ' DETACH DELETE n' : ' DELETE n';
      
      const result = await session.run(query, filter);
      
      this.logger.debug(`Deleted ${result.summary.counters.updates().nodesDeleted} nodes`);
      
    } catch (error) {
      this.logger.error('Neo4j delete error:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute Cypher query
   * @param {string} cypher - Cypher query
   * @param {Object} params - Query parameters
   */
  async execute(cypher, params = {}) {
    const session = this.driver.session({ database: this.database });
    
    try {
      const result = await session.run(cypher, params);
      
      return {
        records: result.records.map(r => r.toObject()),
        summary: {
          query: result.summary.query,
          counters: result.summary.counters.updates(),
          notifications: result.summary.notifications
        }
      };
      
    } catch (error) {
      this.logger.error('Neo4j execute error:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Build query from configuration
   * @param {Object} config - Query configuration
   */
  buildQuery(config) {
    const { labels, relationship, where, orderBy, properties = ['*'] } = config;
    
    let query = 'MATCH ';
    
    if (relationship) {
      query += `(n${labels ? ':' + labels.join(':') : ''})-[r:${relationship.type}]->(m)`;
    } else {
      query += `(n${labels ? ':' + labels.join(':') : ''})`;
    }
    
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    query += ' RETURN ';
    
    if (properties.includes('*')) {
      query += relationship ? 'n, r, m' : 'n';
    } else {
      query += properties.map(p => `n.${p}`).join(', ');
    }
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    return query;
  }

  /**
   * Build merge query
   * @param {string} label - Node label
   * @param {Object} mergeProps - Properties to merge on
   * @param {Object} setProps - Properties to set
   */
  buildMergeQuery(label, mergeProps, setProps) {
    const mergeClause = Object.keys(mergeProps).map(key => 
      `${key}: $mergeProps.${key}`
    ).join(', ');
    
    let query = `MERGE (n:${label} {${mergeClause}})`;
    
    if (Object.keys(setProps).length > 0) {
      query += ' SET n += $setProps';
    }
    
    return query;
  }

  /**
   * Build relationship query
   * @param {Object} source - Source node
   * @param {Object} target - Target node
   * @param {string} type - Relationship type
   * @param {string} direction - Relationship direction
   * @param {string} targetLabel - Target node label
   * @param {Array} targetMergeOn - Target merge properties
   */
  buildRelationshipQuery(source, target, type, direction, targetLabel, targetMergeOn) {
    const targetMergeClause = targetMergeOn.map(prop => 
      `${prop}: $targetProps.${prop}`
    ).join(', ');
    
    let query = `
      MATCH (source {id: $sourceId})
      MERGE (target:${targetLabel} {${targetMergeClause}})
    `;
    
    if (direction === 'OUT') {
      query += `MERGE (source)-[r:${type}]->(target)`;
    } else {
      query += `MERGE (source)<-[r:${type}]-(target)`;
    }
    
    query += ' SET r += $relProps';
    
    return query;
  }

  /**
   * Transform record to standard format
   * @param {Object} data - Neo4j record data
   */
  transformRecord(data) {
    const result = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (neo4j.isNode(value)) {
        result[key] = {
          id: value.identity.toString(),
          labels: value.labels,
          properties: value.properties
        };
      } else if (neo4j.isRelationship(value)) {
        result[key] = {
          id: value.identity.toString(),
          type: value.type,
          start: value.start.toString(),
          end: value.end.toString(),
          properties: value.properties
        };
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Extract ID from data
   * @param {Object} data - Record data
   */
  extractId(data) {
    const firstNode = Object.values(data).find(v => neo4j.isNode(v));
    if (firstNode) {
      return firstNode.properties.id || firstNode.identity.toString();
    }
    return null;
  }

  /**
   * Extract labels from data
   * @param {Object} data - Record data
   */
  extractLabels(data) {
    const labels = new Set();
    
    for (const value of Object.values(data)) {
      if (neo4j.isNode(value)) {
        value.labels.forEach(label => labels.add(label));
      }
    }
    
    return Array.from(labels);
  }

  /**
   * Extract type from data
   * @param {Object} data - Record data
   */
  extractType(data) {
    const rel = Object.values(data).find(v => neo4j.isRelationship(v));
    return rel ? rel.type : null;
  }

  /**
   * Check if value is valid Neo4j property
   * @param {any} value - Value to check
   */
  isValidProperty(value) {
    if (value === null || value === undefined) return false;
    
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') return true;
    
    if (Array.isArray(value)) {
      return value.every(v => 
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      );
    }
    
    return false;
  }

  /**
   * Get database schema
   */
  async getSchema() {
    const session = this.driver.session({ database: this.database });
    
    try {
      const result = await session.run('CALL db.schema.visualization()');
      return result.records[0].toObject();
    } catch (error) {
      // Fallback for Memgraph
      try {
        const labels = await session.run('CALL db.labels()');
        const relationships = await session.run('CALL db.relationshipTypes()');
        
        return {
          labels: labels.records.map(r => r.get(0)),
          relationships: relationships.records.map(r => r.get(0))
        };
      } catch (fallbackError) {
        this.logger.error('Error getting schema:', fallbackError);
        throw fallbackError;
      }
    } finally {
      await session.close();
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    const session = this.driver.session({ database: this.database });
    
    try {
      await session.run('RETURN 1');
      return { healthy: true, type: 'neo4j' };
    } catch (error) {
      return { healthy: false, type: 'neo4j', error: error.message };
    } finally {
      await session.close();
    }
  }

  /**
   * Close driver connection
   */
  async close() {
    await this.driver.close();
  }
}

export default Neo4jAdapter;