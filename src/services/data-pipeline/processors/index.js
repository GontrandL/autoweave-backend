/**
 * Built-in data processors for pipeline
 */

/**
 * Enrichment processor - adds metadata
 */
export const enrichmentProcessor = async (item, context) => {
  return {
    ...item,
    _metadata: {
      ...item._metadata,
      processedAt: new Date().toISOString(),
      pipeline: context.pipeline.name,
      executionId: context.executionId,
      nodeId: process.env.NODE_ID || 'default'
    }
  };
};

/**
 * Validation processor - validates data structure
 */
export const validationProcessor = (schema) => async (item, context) => {
  // Simple schema validation
  for (const [key, rules] of Object.entries(schema)) {
    const value = item[key];
    
    // Required check
    if (rules.required && (value === undefined || value === null)) {
      throw new Error(`Missing required field: ${key}`);
    }
    
    // Type check
    if (value !== undefined && rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        throw new Error(`Invalid type for ${key}: expected ${rules.type}, got ${actualType}`);
      }
    }
    
    // Min/max checks
    if (rules.min !== undefined && value < rules.min) {
      throw new Error(`${key} is below minimum value ${rules.min}`);
    }
    if (rules.max !== undefined && value > rules.max) {
      throw new Error(`${key} is above maximum value ${rules.max}`);
    }
    
    // Length checks
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      throw new Error(`${key} is shorter than minimum length ${rules.minLength}`);
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      throw new Error(`${key} is longer than maximum length ${rules.maxLength}`);
    }
    
    // Pattern check
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      throw new Error(`${key} does not match pattern ${rules.pattern}`);
    }
  }
  
  return item;
};

/**
 * Deduplication processor - removes duplicates based on key
 */
export const deduplicationProcessor = (keyField = 'id') => {
  const seen = new Set();
  
  return async (item, context) => {
    const key = item[keyField];
    if (!key) {
      throw new Error(`Missing deduplication key field: ${keyField}`);
    }
    
    if (seen.has(key)) {
      return null; // Filter out duplicate
    }
    
    seen.add(key);
    
    // Clean up old entries periodically
    if (seen.size > 10000) {
      const entries = Array.from(seen);
      seen.clear();
      entries.slice(-5000).forEach(e => seen.add(e));
    }
    
    return item;
  };
};

/**
 * Rate limiting processor - limits processing rate
 */
export const rateLimitProcessor = (ratePerSecond) => {
  let lastProcessTime = 0;
  const minInterval = 1000 / ratePerSecond;
  
  return async (item, context) => {
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessTime;
    
    if (timeSinceLastProcess < minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, minInterval - timeSinceLastProcess)
      );
    }
    
    lastProcessTime = Date.now();
    return item;
  };
};

/**
 * Batching processor - groups items into batches
 */
export const batchingProcessor = (batchSize = 10, timeout = 1000) => {
  let batch = [];
  let batchPromise = null;
  let timeoutId = null;
  
  const processBatch = () => {
    const currentBatch = batch;
    batch = [];
    
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    return currentBatch;
  };
  
  return async (item, context) => {
    batch.push(item);
    
    if (batch.length >= batchSize) {
      return processBatch();
    }
    
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        if (batch.length > 0) {
          const items = processBatch();
          // Emit batch event
          context.pipeline.emit('batch:ready', items);
        }
      }, timeout);
    }
    
    return null; // Accumulating
  };
};

/**
 * Encryption processor - encrypts sensitive fields
 */
export const encryptionProcessor = (fields, encryptFn) => async (item, context) => {
  const encrypted = { ...item };
  
  for (const field of fields) {
    if (encrypted[field] !== undefined) {
      encrypted[field] = await encryptFn(encrypted[field]);
    }
  }
  
  return encrypted;
};

/**
 * Compression processor - compresses large fields
 */
export const compressionProcessor = (fields, threshold = 1024) => async (item, context) => {
  const zlib = await import('zlib');
  const { promisify } = await import('util');
  const gzip = promisify(zlib.gzip);
  
  const compressed = { ...item };
  
  for (const field of fields) {
    const value = compressed[field];
    if (value && typeof value === 'string' && value.length > threshold) {
      const buffer = await gzip(value);
      compressed[field] = {
        _compressed: true,
        data: buffer.toString('base64'),
        originalSize: value.length,
        compressedSize: buffer.length
      };
    }
  }
  
  return compressed;
};

/**
 * Metrics processor - collects processing metrics
 */
export const metricsProcessor = (metricsCollector) => {
  const startTimes = new WeakMap();
  
  return async (item, context) => {
    const start = Date.now();
    startTimes.set(item, start);
    
    // Add cleanup handler
    if (!item._cleanup) {
      item._cleanup = [];
    }
    
    item._cleanup.push(() => {
      const duration = Date.now() - start;
      metricsCollector.recordProcessingTime(context.pipeline.name, duration);
      metricsCollector.incrementProcessedCount(context.pipeline.name);
    });
    
    return item;
  };
};

/**
 * Error handling processor - wraps processing with error handling
 */
export const errorHandlingProcessor = (options = {}) => {
  const { maxRetries = 3, retryDelay = 1000, onError } = options;
  
  return async (item, context) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return item;
      } catch (error) {
        lastError = error;
        
        if (onError) {
          await onError(error, item, attempt);
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, retryDelay * Math.pow(2, attempt))
          );
        }
      }
    }
    
    throw lastError;
  };
};

/**
 * Create a custom processor
 * @param {Function} processFn - Processing function
 */
export const createProcessor = (processFn) => {
  return async (item, context) => {
    return await processFn(item, context);
  };
};

// Export all processors
export default {
  enrichmentProcessor,
  validationProcessor,
  deduplicationProcessor,
  rateLimitProcessor,
  batchingProcessor,
  encryptionProcessor,
  compressionProcessor,
  metricsProcessor,
  errorHandlingProcessor,
  createProcessor
};