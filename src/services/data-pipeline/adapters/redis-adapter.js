import Redis from 'ioredis';

/**
 * Redis Storage Adapter for Data Pipeline
 */
class RedisAdapter {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.client = new Redis({
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || '',
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    
    // Redis Streams client for streaming operations
    this.streamClient = this.client.duplicate();
  }

  /**
   * Create a cursor for streaming data
   * @param {Object} config - Cursor configuration
   */
  async createCursor(config) {
    const { 
      pattern = '*', 
      type = 'keys', 
      stream, 
      startId = '0',
      count = 100 
    } = config;
    
    if (type === 'stream') {
      return this.createStreamCursor(stream, startId, count);
    } else {
      return this.createKeysCursor(pattern, config);
    }
  }

  /**
   * Create cursor for Redis keys
   * @param {string} pattern - Key pattern
   * @param {Object} config - Cursor configuration
   */
  createKeysCursor(pattern, config) {
    let cursor = '0';
    let finished = false;
    
    return {
      pattern,
      config,
      
      async next(batchSize) {
        if (finished) return [];
        
        try {
          const [nextCursor, keys] = await this.client.scan(
            cursor,
            'MATCH', pattern,
            'COUNT', batchSize
          );
          
          cursor = nextCursor;
          finished = cursor === '0';
          
          // Fetch values for keys
          if (keys.length > 0) {
            const pipeline = this.client.pipeline();
            
            for (const key of keys) {
              pipeline.type(key);
            }
            
            const types = await pipeline.exec();
            const results = [];
            
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              const type = types[i][1];
              let value;
              
              switch (type) {
                case 'string':
                  value = await this.client.get(key);
                  try {
                    value = JSON.parse(value);
                  } catch (e) {
                    // Keep as string
                  }
                  break;
                case 'hash':
                  value = await this.client.hgetall(key);
                  break;
                case 'list':
                  value = await this.client.lrange(key, 0, -1);
                  break;
                case 'set':
                  value = await this.client.smembers(key);
                  break;
                case 'zset':
                  value = await this.client.zrange(key, 0, -1, 'WITHSCORES');
                  break;
                default:
                  continue;
              }
              
              results.push({
                id: key,
                type,
                value,
                metadata: {
                  ttl: await this.client.ttl(key),
                  memory: await this.client.memory('usage', key)
                }
              });
            }
            
            return results;
          }
          
          return [];
          
        } catch (error) {
          this.logger.error('Redis cursor error:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Create cursor for Redis Streams
   * @param {string} stream - Stream key
   * @param {string} startId - Start ID
   * @param {number} count - Items per batch
   */
  createStreamCursor(stream, startId, count) {
    let lastId = startId;
    
    return {
      stream,
      
      async next(batchSize) {
        try {
          const entries = await this.streamClient.xread(
            'COUNT', batchSize || count,
            'STREAMS', stream, lastId
          );
          
          if (!entries || entries.length === 0) {
            return [];
          }
          
          const streamEntries = entries[0][1];
          if (streamEntries.length > 0) {
            lastId = streamEntries[streamEntries.length - 1][0];
          }
          
          return streamEntries.map(([id, fields]) => ({
            id,
            value: this.parseStreamFields(fields),
            metadata: {
              stream,
              timestamp: parseInt(id.split('-')[0])
            }
          }));
          
        } catch (error) {
          this.logger.error('Redis stream cursor error:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Write batch to Redis
   * @param {Array} batch - Batch of items to write
   * @param {Object} config - Write configuration
   */
  async writeBatch(batch, config) {
    const { 
      keyPattern = 'item:${id}',
      type = 'json',
      ttl,
      stream
    } = config;
    
    try {
      if (stream) {
        // Write to Redis Stream
        await this.writeToStream(batch, stream, config);
      } else {
        // Write as regular keys
        const pipeline = this.client.pipeline();
        
        for (const item of batch) {
          const key = this.formatKey(keyPattern, item);
          
          switch (type) {
            case 'json':
            case 'string':
              pipeline.set(key, JSON.stringify(item.value || item));
              break;
            case 'hash':
              pipeline.hset(key, item.value || item);
              break;
            case 'list':
              if (Array.isArray(item.value)) {
                pipeline.rpush(key, ...item.value);
              }
              break;
            case 'set':
              if (Array.isArray(item.value)) {
                pipeline.sadd(key, ...item.value);
              }
              break;
            case 'zset':
              if (item.scores) {
                const members = [];
                item.value.forEach((val, idx) => {
                  members.push(item.scores[idx] || idx, val);
                });
                pipeline.zadd(key, ...members);
              }
              break;
          }
          
          if (ttl) {
            pipeline.expire(key, ttl);
          }
        }
        
        await pipeline.exec();
      }
      
      this.logger.debug(`Written ${batch.length} items to Redis`);
      
    } catch (error) {
      this.logger.error('Redis write error:', error);
      throw error;
    }
  }

  /**
   * Write to Redis Stream
   * @param {Array} batch - Batch of items
   * @param {string} stream - Stream key
   * @param {Object} config - Stream configuration
   */
  async writeToStream(batch, stream, config) {
    const { maxLen = 100000, approximateMaxLen = true } = config;
    const pipeline = this.streamClient.pipeline();
    
    for (const item of batch) {
      const fields = this.flattenObject(item.value || item);
      
      pipeline.xadd(
        stream,
        approximateMaxLen ? 'MAXLEN' : 'MAXLEN',
        approximateMaxLen ? '~' : '=',
        maxLen,
        '*',
        ...fields
      );
    }
    
    await pipeline.exec();
  }

  /**
   * Delete items from Redis
   * @param {Object} filter - Deletion filter
   * @param {Object} config - Delete configuration
   */
  async delete(filter, config) {
    const { pattern } = filter;
    
    try {
      if (pattern) {
        // Use SCAN to find and delete keys
        const stream = this.client.scanStream({
          match: pattern,
          count: 100
        });
        
        stream.on('data', async (keys) => {
          if (keys.length) {
            await this.client.del(...keys);
          }
        });
        
        await new Promise((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
        });
        
        this.logger.debug(`Deleted keys matching pattern: ${pattern}`);
      }
      
    } catch (error) {
      this.logger.error('Redis delete error:', error);
      throw error;
    }
  }

  /**
   * Execute Redis commands
   * @param {Array} commands - Array of Redis commands
   */
  async execute(commands) {
    try {
      const pipeline = this.client.pipeline();
      
      for (const cmd of commands) {
        pipeline[cmd.command](...(cmd.args || []));
      }
      
      return await pipeline.exec();
      
    } catch (error) {
      this.logger.error('Redis execute error:', error);
      throw error;
    }
  }

  /**
   * Subscribe to Redis pub/sub
   * @param {string} pattern - Channel pattern
   * @param {Function} handler - Message handler
   */
  async subscribe(pattern, handler) {
    const subscriber = this.client.duplicate();
    
    subscriber.on('pmessage', (pattern, channel, message) => {
      try {
        const data = JSON.parse(message);
        handler({ channel, data });
      } catch (error) {
        handler({ channel, data: message });
      }
    });
    
    await subscriber.psubscribe(pattern);
    
    return () => subscriber.punsubscribe(pattern);
  }

  /**
   * Format key with template
   * @param {string} pattern - Key pattern
   * @param {Object} item - Item data
   */
  formatKey(pattern, item) {
    return pattern.replace(/\$\{(\w+)\}/g, (match, key) => {
      return item[key] || match;
    });
  }

  /**
   * Parse Redis Stream fields
   * @param {Array} fields - Stream fields array
   */
  parseStreamFields(fields) {
    const result = {};
    
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      let value = fields[i + 1];
      
      // Try to parse JSON
      try {
        value = JSON.parse(value);
      } catch (e) {
        // Keep as string
      }
      
      result[key] = value;
    }
    
    return result;
  }

  /**
   * Flatten object for Redis Stream
   * @param {Object} obj - Object to flatten
   * @param {string} prefix - Key prefix
   */
  flattenObject(obj, prefix = '') {
    const result = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        result.push(fullKey, '');
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        result.push(...this.flattenObject(value, fullKey));
      } else {
        result.push(fullKey, JSON.stringify(value));
      }
    }
    
    return result;
  }

  /**
   * Get Redis info
   */
  async getInfo() {
    try {
      const info = await this.client.info();
      const memory = await this.client.info('memory');
      const stats = await this.client.info('stats');
      
      return {
        info,
        memory,
        stats
      };
    } catch (error) {
      this.logger.error('Error getting Redis info:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.client.ping();
      return { healthy: true, type: 'redis' };
    } catch (error) {
      return { healthy: false, type: 'redis', error: error.message };
    }
  }

  /**
   * Close connections
   */
  async close() {
    await this.client.quit();
    await this.streamClient.quit();
  }
}

export default RedisAdapter;