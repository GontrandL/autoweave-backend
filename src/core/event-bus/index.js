import { EventEmitter } from 'eventemitter3';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event Bus - Distributed event system for service communication
 */
class EventBus extends EventEmitter {
  constructor({ logger, config }) {
    super();
    this.logger = logger;
    this.config = config;
    this.localSubscriptions = new Map();
    this.eventHistory = [];
    this.maxHistorySize = config.maxHistorySize || 1000;
    
    // Redis for distributed events
    if (config.redis) {
      this.publisher = new Redis(config.redis);
      this.subscriber = new Redis(config.redis);
      this.setupRedis();
    }
    
    // Event metrics
    this.metrics = {
      published: 0,
      received: 0,
      errors: 0,
      latency: []
    };
  }

  /**
   * Setup Redis pub/sub
   */
  setupRedis() {
    // Handle Redis errors
    this.publisher.on('error', (err) => {
      this.logger.error('Redis publisher error:', err);
      this.metrics.errors++;
    });
    
    this.subscriber.on('error', (err) => {
      this.logger.error('Redis subscriber error:', err);
      this.metrics.errors++;
    });
    
    // Handle messages
    this.subscriber.on('message', async (channel, message) => {
      try {
        const event = JSON.parse(message);
        await this.handleRemoteEvent(channel, event);
      } catch (error) {
        this.logger.error('Error handling Redis message:', error);
        this.metrics.errors++;
      }
    });
    
    this.logger.info('Redis event bus connected');
  }

  /**
   * Publish an event
   * @param {string} topic - Event topic
   * @param {Object} data - Event data
   * @param {Object} options - Publishing options
   * @returns {string} Event ID
   */
  async publish(topic, data, options = {}) {
    const event = {
      id: options.id || uuidv4(),
      topic,
      data,
      timestamp: new Date().toISOString(),
      source: options.source || 'system',
      correlationId: options.correlationId,
      metadata: options.metadata || {},
      ttl: options.ttl
    };

    try {
      // Local subscribers
      const localSubs = this.localSubscriptions.get(topic) || [];
      const wildcardSubs = this.getWildcardSubscriptions(topic);
      const allSubs = [...localSubs, ...wildcardSubs];
      
      // Notify local subscribers
      for (const { handler, options: subOptions } of allSubs) {
        this.processEvent(handler, event, subOptions);
      }

      // Distributed publish
      if (this.publisher) {
        await this.publisher.publish(topic, JSON.stringify(event));
        
        // Publish to wildcard channels
        const topicParts = topic.split('.');
        for (let i = 1; i <= topicParts.length; i++) {
          const wildcardTopic = topicParts.slice(0, i).join('.') + '.*';
          await this.publisher.publish(wildcardTopic, JSON.stringify(event));
        }
      }

      // Add to history
      this.addToHistory(event);
      
      // Update metrics
      this.metrics.published++;
      
      this.logger.debug(`Event published: ${topic}`, { eventId: event.id });
      this.emit('event:published', event);
      
      return event.id;
      
    } catch (error) {
      this.logger.error('Error publishing event:', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Subscribe to events
   * @param {string} topic - Topic pattern (supports wildcards)
   * @param {Function} handler - Event handler
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(topic, handler, options = {}) {
    // Local subscription
    if (!this.localSubscriptions.has(topic)) {
      this.localSubscriptions.set(topic, []);
      
      // Redis subscription
      if (this.subscriber) {
        this.subscriber.subscribe(topic).catch(err => {
          this.logger.error(`Failed to subscribe to ${topic}:`, err);
        });
      }
    }
    
    const subscription = { handler, options, id: uuidv4() };
    this.localSubscriptions.get(topic).push(subscription);
    
    this.logger.debug(`Subscribed to: ${topic}`);
    this.emit('subscription:created', { topic, subscriptionId: subscription.id });
    
    // Return unsubscribe function
    return () => {
      const subs = this.localSubscriptions.get(topic);
      if (subs) {
        const index = subs.findIndex(sub => sub.id === subscription.id);
        if (index !== -1) {
          subs.splice(index, 1);
          
          // Unsubscribe from Redis if no more local subscribers
          if (subs.length === 0) {
            this.localSubscriptions.delete(topic);
            if (this.subscriber) {
              this.subscriber.unsubscribe(topic).catch(err => {
                this.logger.error(`Failed to unsubscribe from ${topic}:`, err);
              });
            }
          }
          
          this.logger.debug(`Unsubscribed from: ${topic}`);
          this.emit('subscription:removed', { topic, subscriptionId: subscription.id });
        }
      }
    };
  }

  /**
   * Subscribe once to an event
   * @param {string} topic - Event topic
   * @param {Function} handler - Event handler
   * @param {Object} options - Subscription options
   * @returns {Promise} Promise that resolves with the event
   */
  once(topic, handler, options = {}) {
    return new Promise((resolve) => {
      const unsubscribe = this.subscribe(topic, (event) => {
        unsubscribe();
        if (handler) handler(event);
        resolve(event);
      }, options);
    });
  }

  /**
   * Wait for an event with timeout
   * @param {string} topic - Event topic
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Promise that resolves with the event
   */
  async waitFor(topic, timeout = 30000) {
    return Promise.race([
      this.once(topic),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout waiting for ${topic}`)), timeout)
      )
    ]);
  }

  /**
   * Process an event
   * @param {Function} handler - Event handler
   * @param {Object} event - Event object
   * @param {Object} options - Processing options
   */
  async processEvent(handler, event, options = {}) {
    try {
      const start = Date.now();
      
      // Apply filters
      if (options.filter && !options.filter(event)) {
        return;
      }
      
      // Handle event
      await handler(event);
      
      // Track latency
      const latency = Date.now() - start;
      this.metrics.latency.push(latency);
      if (this.metrics.latency.length > 100) {
        this.metrics.latency.shift();
      }
      
    } catch (error) {
      this.logger.error('Error processing event:', error);
      this.metrics.errors++;
      
      // Emit error event
      this.emit('event:error', { event, error });
      
      // Retry logic
      if (options.retry && options.retry > 0) {
        setTimeout(() => {
          this.processEvent(handler, event, { 
            ...options, 
            retry: options.retry - 1 
          });
        }, options.retryDelay || 1000);
      }
    }
  }

  /**
   * Handle remote event from Redis
   * @param {string} channel - Redis channel
   * @param {Object} event - Event object
   */
  async handleRemoteEvent(channel, event) {
    // Skip if we published this event
    if (event.source === this.config.nodeId) {
      return;
    }
    
    // Update metrics
    this.metrics.received++;
    
    // Process for local subscribers
    const subscribers = this.localSubscriptions.get(channel) || [];
    for (const { handler, options } of subscribers) {
      this.processEvent(handler, event, options);
    }
    
    // Add to history
    this.addToHistory(event);
    
    this.emit('event:received', event);
  }

  /**
   * Get wildcard subscriptions matching a topic
   * @param {string} topic - Event topic
   * @returns {Array} Matching subscriptions
   */
  getWildcardSubscriptions(topic) {
    const matches = [];
    const topicParts = topic.split('.');
    
    for (const [pattern, subs] of this.localSubscriptions) {
      if (pattern.includes('*')) {
        const patternParts = pattern.split('.');
        if (this.matchesWildcard(topicParts, patternParts)) {
          matches.push(...subs);
        }
      }
    }
    
    return matches;
  }

  /**
   * Check if topic matches wildcard pattern
   * @param {Array} topicParts - Topic parts
   * @param {Array} patternParts - Pattern parts
   * @returns {boolean} Match result
   */
  matchesWildcard(topicParts, patternParts) {
    if (patternParts.length > topicParts.length) {
      return false;
    }
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '*') {
        return true;
      }
      if (patternParts[i] !== topicParts[i]) {
        return false;
      }
    }
    
    return patternParts.length === topicParts.length;
  }

  /**
   * Add event to history
   * @param {Object} event - Event object
   */
  addToHistory(event) {
    this.eventHistory.push(event);
    
    // Limit history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // Clean up expired events
    if (event.ttl) {
      setTimeout(() => {
        const index = this.eventHistory.findIndex(e => e.id === event.id);
        if (index !== -1) {
          this.eventHistory.splice(index, 1);
        }
      }, event.ttl);
    }
  }

  /**
   * Get event history
   * @param {Object} filter - Filter criteria
   * @returns {Array} Filtered events
   */
  getHistory(filter = {}) {
    let events = [...this.eventHistory];
    
    // Filter by topic
    if (filter.topic) {
      events = events.filter(e => 
        e.topic === filter.topic || 
        (filter.topic.includes('*') && this.matchesWildcard(
          e.topic.split('.'), 
          filter.topic.split('.')
        ))
      );
    }
    
    // Filter by time range
    if (filter.since) {
      const since = new Date(filter.since);
      events = events.filter(e => new Date(e.timestamp) >= since);
    }
    
    if (filter.until) {
      const until = new Date(filter.until);
      events = events.filter(e => new Date(e.timestamp) <= until);
    }
    
    // Filter by correlation ID
    if (filter.correlationId) {
      events = events.filter(e => e.correlationId === filter.correlationId);
    }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit results
    if (filter.limit) {
      events = events.slice(0, filter.limit);
    }
    
    return events;
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
    this.emit('history:cleared');
  }

  /**
   * Get event bus metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    const avgLatency = this.metrics.latency.length > 0
      ? this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length
      : 0;
    
    return {
      published: this.metrics.published,
      received: this.metrics.received,
      errors: this.metrics.errors,
      averageLatency: avgLatency,
      subscriptions: this.localSubscriptions.size,
      historySize: this.eventHistory.length,
      connected: this.publisher ? this.publisher.status === 'ready' : false
    };
  }

  /**
   * Request-response pattern
   * @param {string} topic - Request topic
   * @param {Object} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise} Response promise
   */
  async request(topic, data, options = {}) {
    const correlationId = uuidv4();
    const responseTopic = `${topic}.response.${correlationId}`;
    const timeout = options.timeout || 30000;
    
    // Wait for response
    const responsePromise = this.waitFor(responseTopic, timeout);
    
    // Send request
    await this.publish(topic, data, {
      ...options,
      correlationId,
      replyTo: responseTopic
    });
    
    // Wait for and return response
    const response = await responsePromise;
    return response.data;
  }

  /**
   * Reply to a request
   * @param {Object} event - Request event
   * @param {Object} data - Response data
   */
  async reply(event, data) {
    if (!event.replyTo) {
      throw new Error('No replyTo topic in request event');
    }
    
    await this.publish(event.replyTo, data, {
      correlationId: event.correlationId,
      source: this.config.nodeId
    });
  }

  /**
   * Create a topic namespace
   * @param {string} namespace - Namespace prefix
   * @returns {Object} Namespaced event bus
   */
  namespace(namespace) {
    const self = this;
    
    return {
      publish: (topic, data, options) => 
        self.publish(`${namespace}.${topic}`, data, options),
      
      subscribe: (topic, handler, options) => 
        self.subscribe(`${namespace}.${topic}`, handler, options),
      
      once: (topic, handler, options) => 
        self.once(`${namespace}.${topic}`, handler, options),
      
      request: (topic, data, options) => 
        self.request(`${namespace}.${topic}`, data, options)
    };
  }

  /**
   * Close event bus connections
   */
  async close() {
    // Unsubscribe all
    for (const topic of this.localSubscriptions.keys()) {
      if (this.subscriber) {
        await this.subscriber.unsubscribe(topic);
      }
    }
    
    this.localSubscriptions.clear();
    
    // Close Redis connections
    if (this.publisher) {
      await this.publisher.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    
    this.logger.info('Event bus closed');
    this.emit('closed');
  }
}

export default EventBus;