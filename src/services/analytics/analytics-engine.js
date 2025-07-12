import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Analytics Engine - Real-time analytics and metrics processing
 */
class AnalyticsEngine extends EventEmitter {
  constructor({ logger, config, eventBus, storageAdapters }) {
    super();
    this.logger = logger;
    this.config = config;
    this.eventBus = eventBus;
    this.storageAdapters = storageAdapters;
    
    // Analytics storage
    this.metrics = new Map();
    this.events = [];
    this.reports = new Map();
    this.dashboards = new Map();
    
    // Real-time aggregators
    this.aggregators = new Map();
    this.realtimeStats = {
      activeUsers: new Set(),
      eventsPerSecond: 0,
      errorRate: 0,
      avgResponseTime: 0
    };
    
    // Configuration
    this.retentionDays = config.analytics?.retentionDays || 30;
    this.aggregationInterval = config.analytics?.aggregationInterval || 60000; // 1 minute
    this.samplingRate = config.analytics?.samplingRate || 1.0;
    
    this.setupEventHandlers();
    this.startAggregation();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Subscribe to all events for analytics
    this.eventBus.subscribe('*', this.handleEvent.bind(this));
    
    // Subscribe to specific metric events
    this.eventBus.subscribe('metrics.*', this.handleMetricEvent.bind(this));
  }

  /**
   * Start aggregation process
   */
  startAggregation() {
    // Periodic aggregation
    this.aggregationInterval = setInterval(() => {
      this.aggregateMetrics();
    }, this.aggregationInterval);
    
    // Real-time stats update
    this.realtimeInterval = setInterval(() => {
      this.updateRealtimeStats();
    }, 1000); // Every second
    
    // Cleanup old data
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 86400000); // Daily
    
    this.logger.info('Analytics engine aggregation started');
  }

  /**
   * Track an analytics event
   */
  async track({ event, properties = {}, userId = 'anonymous', timestamp = new Date() }) {
    // Apply sampling
    if (this.config.analytics?.samplingRate < 1.0) {
      if (Math.random() > this.config.analytics.samplingRate) {
        return; // Skip this event due to sampling
      }
    }
    
    const eventData = {
      id: uuidv4(),
      event,
      properties,
      userId,
      timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp),
      sessionId: properties.sessionId || this.getSessionId(userId),
      metadata: {
        userAgent: properties.userAgent,
        ip: properties.ip,
        referer: properties.referer
      }
    };
    
    // Store event
    this.events.push(eventData);
    
    // Update real-time stats
    this.realtimeStats.activeUsers.add(userId);
    
    // Process event for metrics
    await this.processEvent(eventData);
    
    // Store in persistent storage
    await this.persistEvent(eventData);
    
    this.emit('event:tracked', eventData);
  }

  /**
   * Process event for metrics extraction
   */
  async processEvent(eventData) {
    const { event, properties, userId, timestamp } = eventData;
    
    // Extract metrics based on event type
    const metrics = this.extractMetrics(event, properties);
    
    for (const metric of metrics) {
      await this.updateMetric(metric.name, metric.value, {
        ...metric.labels,
        userId,
        timestamp
      });
    }
    
    // Update event-specific aggregators
    if (this.aggregators.has(event)) {
      const aggregator = this.aggregators.get(event);
      aggregator.process(eventData);
    }
  }

  /**
   * Extract metrics from event
   */
  extractMetrics(event, properties) {
    const metrics = [];
    
    // Generic event counter
    metrics.push({
      name: 'events_total',
      value: 1,
      labels: { event }
    });
    
    // Event-specific metrics
    switch (event) {
      case 'page_view':
        metrics.push({
          name: 'page_views_total',
          value: 1,
          labels: { page: properties.page }
        });
        if (properties.loadTime) {
          metrics.push({
            name: 'page_load_time_seconds',
            value: properties.loadTime / 1000,
            labels: { page: properties.page }
          });
        }
        break;
        
      case 'api_request':
        metrics.push({
          name: 'api_requests_total',
          value: 1,
          labels: { 
            endpoint: properties.endpoint,
            method: properties.method,
            status: properties.status
          }
        });
        if (properties.duration) {
          metrics.push({
            name: 'api_request_duration_seconds',
            value: properties.duration / 1000,
            labels: { endpoint: properties.endpoint }
          });
        }
        break;
        
      case 'error':
        metrics.push({
          name: 'errors_total',
          value: 1,
          labels: { 
            type: properties.errorType,
            severity: properties.severity
          }
        });
        break;
        
      case 'conversion':
        metrics.push({
          name: 'conversions_total',
          value: 1,
          labels: { 
            type: properties.conversionType,
            value: properties.conversionValue
          }
        });
        break;
    }
    
    // Custom metrics from properties
    if (properties.metrics) {
      for (const [name, value] of Object.entries(properties.metrics)) {
        metrics.push({
          name: `custom_${name}`,
          value,
          labels: properties.labels || {}
        });
      }
    }
    
    return metrics;
  }

  /**
   * Update a metric
   */
  async updateMetric(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        name,
        labels,
        values: [],
        sum: 0,
        count: 0,
        min: Infinity,
        max: -Infinity
      });
    }
    
    const metric = this.metrics.get(key);
    metric.values.push({ value, timestamp: labels.timestamp || new Date() });
    metric.sum += value;
    metric.count++;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    
    // Keep only recent values
    const cutoffTime = new Date(Date.now() - this.retentionDays * 86400000);
    metric.values = metric.values.filter(v => v.timestamp > cutoffTime);
  }

  /**
   * Get metric data
   */
  async getMetric(metricName, options = {}) {
    const { startDate, endDate, groupBy = 'hour', filter } = options;
    
    // Find all metrics matching the name
    const matchingMetrics = Array.from(this.metrics.entries())
      .filter(([key, metric]) => metric.name === metricName)
      .map(([key, metric]) => metric);
    
    // Apply filters
    let filteredMetrics = matchingMetrics;
    if (filter) {
      filteredMetrics = matchingMetrics.filter(metric => 
        Object.entries(filter).every(([label, value]) => 
          metric.labels[label] === value
        )
      );
    }
    
    // Aggregate data
    const data = this.aggregateMetricData(filteredMetrics, {
      startDate,
      endDate,
      groupBy
    });
    
    return data;
  }

  /**
   * Aggregate metric data
   */
  aggregateMetricData(metrics, options) {
    const { startDate, endDate, groupBy } = options;
    const groups = new Map();
    
    for (const metric of metrics) {
      for (const { value, timestamp } of metric.values) {
        // Apply date filters
        if (startDate && timestamp < startDate) continue;
        if (endDate && timestamp > endDate) continue;
        
        // Group by time period
        const groupKey = this.getTimeGroupKey(timestamp, groupBy);
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            timestamp: groupKey,
            values: [],
            sum: 0,
            count: 0,
            avg: 0,
            min: Infinity,
            max: -Infinity
          });
        }
        
        const group = groups.get(groupKey);
        group.values.push(value);
        group.sum += value;
        group.count++;
        group.min = Math.min(group.min, value);
        group.max = Math.max(group.max, value);
      }
    }
    
    // Calculate averages
    for (const group of groups.values()) {
      group.avg = group.sum / group.count;
    }
    
    // Sort by timestamp
    return Array.from(groups.values()).sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  /**
   * Get dashboard overview
   */
  async getDashboard(period = '24h') {
    const now = new Date();
    const startDate = this.getPeriodStartDate(period);
    
    const overview = {
      period,
      timestamp: now,
      summary: {
        totalEvents: 0,
        uniqueUsers: new Set(),
        errorRate: 0,
        avgResponseTime: 0
      },
      topMetrics: [],
      topEvents: [],
      userActivity: [],
      errorBreakdown: [],
      performance: {
        p50: 0,
        p90: 0,
        p99: 0
      }
    };
    
    // Calculate summary stats
    const recentEvents = this.events.filter(e => e.timestamp > startDate);
    overview.summary.totalEvents = recentEvents.length;
    
    for (const event of recentEvents) {
      overview.summary.uniqueUsers.add(event.userId);
    }
    overview.summary.uniqueUsers = overview.summary.uniqueUsers.size;
    
    // Top events
    const eventCounts = new Map();
    for (const event of recentEvents) {
      eventCounts.set(event.event, (eventCounts.get(event.event) || 0) + 1);
    }
    overview.topEvents = Array.from(eventCounts.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Error breakdown
    const errors = recentEvents.filter(e => e.event === 'error');
    const errorTypes = new Map();
    for (const error of errors) {
      const type = error.properties.errorType || 'unknown';
      errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
    }
    overview.errorBreakdown = Array.from(errorTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    
    overview.summary.errorRate = errors.length / (recentEvents.length || 1);
    
    // Performance metrics
    const responseTimes = [];
    for (const event of recentEvents) {
      if (event.properties.duration) {
        responseTimes.push(event.properties.duration);
      }
    }
    
    if (responseTimes.length > 0) {
      responseTimes.sort((a, b) => a - b);
      overview.performance.p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
      overview.performance.p90 = responseTimes[Math.floor(responseTimes.length * 0.9)];
      overview.performance.p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
      overview.summary.avgResponseTime = 
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
    
    // User activity timeline
    const activityGroups = new Map();
    for (const event of recentEvents) {
      const hour = new Date(event.timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      
      if (!activityGroups.has(key)) {
        activityGroups.set(key, {
          timestamp: key,
          events: 0,
          users: new Set()
        });
      }
      
      const group = activityGroups.get(key);
      group.events++;
      group.users.add(event.userId);
    }
    
    overview.userActivity = Array.from(activityGroups.values())
      .map(g => ({
        timestamp: g.timestamp,
        events: g.events,
        users: g.users.size
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Top metrics
    const metricValues = new Map();
    for (const [key, metric] of this.metrics) {
      if (metric.count > 0) {
        metricValues.set(metric.name, {
          name: metric.name,
          value: metric.sum,
          count: metric.count,
          avg: metric.sum / metric.count
        });
      }
    }
    overview.topMetrics = Array.from(metricValues.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return overview;
  }

  /**
   * Analyze funnel
   */
  async analyzeFunnel({ steps, startDate, endDate, userId }) {
    if (!steps || steps.length < 2) {
      throw new Error('At least 2 funnel steps required');
    }
    
    const funnel = {
      steps: steps.map(step => ({
        name: step,
        users: new Set(),
        count: 0,
        conversionRate: 0
      })),
      overallConversion: 0,
      dropoffs: []
    };
    
    // Filter events
    let events = this.events;
    if (startDate) events = events.filter(e => e.timestamp >= startDate);
    if (endDate) events = events.filter(e => e.timestamp <= endDate);
    if (userId) events = events.filter(e => e.userId === userId);
    
    // Group events by user
    const userEvents = new Map();
    for (const event of events) {
      if (!userEvents.has(event.userId)) {
        userEvents.set(event.userId, []);
      }
      userEvents.get(event.userId).push(event);
    }
    
    // Analyze each user's journey
    for (const [userId, events] of userEvents) {
      const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
      let currentStep = 0;
      
      for (const event of sortedEvents) {
        if (currentStep < steps.length && event.event === steps[currentStep]) {
          funnel.steps[currentStep].users.add(userId);
          funnel.steps[currentStep].count++;
          currentStep++;
        }
      }
    }
    
    // Calculate conversion rates
    for (let i = 0; i < funnel.steps.length; i++) {
      if (i === 0) {
        funnel.steps[i].conversionRate = 100;
      } else {
        const previousUsers = funnel.steps[i - 1].users.size;
        const currentUsers = funnel.steps[i].users.size;
        funnel.steps[i].conversionRate = previousUsers > 0 
          ? (currentUsers / previousUsers) * 100 
          : 0;
        
        // Calculate dropoff
        funnel.dropoffs.push({
          from: steps[i - 1],
          to: steps[i],
          dropoffRate: 100 - funnel.steps[i].conversionRate,
          usersLost: previousUsers - currentUsers
        });
      }
    }
    
    // Overall conversion
    const firstStepUsers = funnel.steps[0].users.size;
    const lastStepUsers = funnel.steps[funnel.steps.length - 1].users.size;
    funnel.overallConversion = firstStepUsers > 0 
      ? (lastStepUsers / firstStepUsers) * 100 
      : 0;
    
    return funnel;
  }

  /**
   * Analyze cohorts
   */
  async analyzeCohorts({ cohortType = 'weekly', metric = 'retention', periods = 4 }) {
    const cohorts = [];
    const now = new Date();
    
    // Create cohorts
    for (let i = 0; i < periods; i++) {
      const cohortStart = new Date(now);
      const cohortEnd = new Date(now);
      
      switch (cohortType) {
        case 'daily':
          cohortStart.setDate(cohortStart.getDate() - (periods - i));
          cohortEnd.setDate(cohortEnd.getDate() - (periods - i - 1));
          break;
        case 'weekly':
          cohortStart.setDate(cohortStart.getDate() - (periods - i) * 7);
          cohortEnd.setDate(cohortEnd.getDate() - (periods - i - 1) * 7);
          break;
        case 'monthly':
          cohortStart.setMonth(cohortStart.getMonth() - (periods - i));
          cohortEnd.setMonth(cohortEnd.getMonth() - (periods - i - 1));
          break;
      }
      
      const cohort = {
        period: `${cohortType} ${i + 1}`,
        startDate: cohortStart,
        endDate: cohortEnd,
        users: new Set(),
        metrics: []
      };
      
      // Find users in this cohort
      const cohortEvents = this.events.filter(e => 
        e.timestamp >= cohortStart && e.timestamp < cohortEnd
      );
      
      for (const event of cohortEvents) {
        cohort.users.add(event.userId);
      }
      
      // Calculate metrics for each subsequent period
      for (let j = 0; j <= i; j++) {
        const metricStart = new Date(cohortStart);
        const metricEnd = new Date(cohortStart);
        
        switch (cohortType) {
          case 'daily':
            metricStart.setDate(metricStart.getDate() + j);
            metricEnd.setDate(metricEnd.getDate() + j + 1);
            break;
          case 'weekly':
            metricStart.setDate(metricStart.getDate() + j * 7);
            metricEnd.setDate(metricEnd.getDate() + (j + 1) * 7);
            break;
          case 'monthly':
            metricStart.setMonth(metricStart.getMonth() + j);
            metricEnd.setMonth(metricEnd.getMonth() + j + 1);
            break;
        }
        
        const activeUsers = new Set();
        const periodEvents = this.events.filter(e => 
          e.timestamp >= metricStart && 
          e.timestamp < metricEnd &&
          cohort.users.has(e.userId)
        );
        
        for (const event of periodEvents) {
          activeUsers.add(event.userId);
        }
        
        const metricValue = metric === 'retention' 
          ? (activeUsers.size / cohort.users.size) * 100 
          : activeUsers.size;
        
        cohort.metrics.push({
          period: j,
          value: metricValue,
          activeUsers: activeUsers.size
        });
      }
      
      cohorts.push(cohort);
    }
    
    return {
      cohortType,
      metric,
      cohorts
    };
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId, options = {}) {
    const { startDate, endDate } = options;
    
    // Filter user events
    let userEvents = this.events.filter(e => e.userId === userId);
    if (startDate) userEvents = userEvents.filter(e => e.timestamp >= startDate);
    if (endDate) userEvents = userEvents.filter(e => e.timestamp <= endDate);
    
    const analytics = {
      userId,
      totalEvents: userEvents.length,
      firstSeen: userEvents.length > 0 ? userEvents[0].timestamp : null,
      lastSeen: userEvents.length > 0 ? userEvents[userEvents.length - 1].timestamp : null,
      eventBreakdown: new Map(),
      sessions: [],
      properties: {},
      timeline: []
    };
    
    // Event breakdown
    for (const event of userEvents) {
      analytics.eventBreakdown.set(
        event.event,
        (analytics.eventBreakdown.get(event.event) || 0) + 1
      );
    }
    
    // Session analysis
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes
    let currentSession = null;
    
    for (const event of userEvents) {
      if (!currentSession || 
          event.timestamp - currentSession.endTime > sessionTimeout) {
        if (currentSession) {
          analytics.sessions.push(currentSession);
        }
        currentSession = {
          id: event.sessionId || uuidv4(),
          startTime: event.timestamp,
          endTime: event.timestamp,
          events: 1,
          pages: new Set()
        };
      } else {
        currentSession.endTime = event.timestamp;
        currentSession.events++;
      }
      
      if (event.properties.page) {
        currentSession.pages.add(event.properties.page);
      }
    }
    
    if (currentSession) {
      analytics.sessions.push(currentSession);
    }
    
    // Aggregate properties
    for (const event of userEvents) {
      for (const [key, value] of Object.entries(event.properties)) {
        if (!analytics.properties[key]) {
          analytics.properties[key] = new Set();
        }
        analytics.properties[key].add(value);
      }
    }
    
    // Convert sets to arrays
    analytics.eventBreakdown = Array.from(analytics.eventBreakdown.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);
    
    for (const key of Object.keys(analytics.properties)) {
      analytics.properties[key] = Array.from(analytics.properties[key]);
    }
    
    // Create timeline
    analytics.timeline = userEvents.map(e => ({
      timestamp: e.timestamp,
      event: e.event,
      properties: e.properties
    }));
    
    return analytics;
  }

  /**
   * Export analytics data
   */
  async exportData({ metrics, startDate, endDate, format = 'json', groupBy = 'day' }) {
    const data = {};
    
    // Collect data for each metric
    for (const metric of metrics) {
      data[metric] = await this.getMetric(metric, {
        startDate,
        endDate,
        groupBy
      });
    }
    
    // Format data based on requested format
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
        
      case 'csv':
        return this.convertToCSV(data);
        
      case 'excel':
        // This would require a library like exceljs
        throw new Error('Excel export not implemented yet');
        
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    const rows = [];
    const headers = ['metric', 'timestamp', 'value', 'count', 'avg', 'min', 'max'];
    rows.push(headers.join(','));
    
    for (const [metric, values] of Object.entries(data)) {
      for (const value of values) {
        rows.push([
          metric,
          value.timestamp,
          value.sum || 0,
          value.count || 0,
          value.avg || 0,
          value.min === Infinity ? 0 : value.min,
          value.max === -Infinity ? 0 : value.max
        ].join(','));
      }
    }
    
    return rows.join('\n');
  }

  /**
   * Get real-time statistics
   */
  getRealtimeStats() {
    return {
      ...this.realtimeStats,
      activeUsers: this.realtimeStats.activeUsers.size,
      timestamp: new Date()
    };
  }

  /**
   * Create custom report
   */
  async createReport(reportConfig) {
    const { name, queries, schedule } = reportConfig;
    
    if (!name || !queries) {
      throw new Error('Report name and queries are required');
    }
    
    const reportId = `report-${uuidv4()}`;
    
    const report = {
      id: reportId,
      name,
      queries,
      schedule,
      createdAt: new Date(),
      lastRun: null,
      results: null
    };
    
    this.reports.set(reportId, report);
    
    // Generate initial report
    await this.generateReport(reportId);
    
    // Schedule if needed
    if (schedule) {
      this.scheduleReport(reportId, schedule);
    }
    
    this.logger.info(`Report created: ${name} (${reportId})`);
    return reportId;
  }

  /**
   * Get report
   */
  async getReport(reportId, options = {}) {
    const report = this.reports.get(reportId);
    if (!report) {
      return null;
    }
    
    if (options.regenerate) {
      await this.generateReport(reportId);
    }
    
    return report;
  }

  /**
   * Generate report
   */
  async generateReport(reportId) {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }
    
    const results = {};
    
    for (const query of report.queries) {
      try {
        switch (query.type) {
          case 'metric':
            results[query.name] = await this.getMetric(query.metric, query.options);
            break;
            
          case 'funnel':
            results[query.name] = await this.analyzeFunnel(query.options);
            break;
            
          case 'cohort':
            results[query.name] = await this.analyzeCohorts(query.options);
            break;
            
          case 'dashboard':
            results[query.name] = await this.getDashboard(query.period);
            break;
            
          default:
            this.logger.warn(`Unknown query type: ${query.type}`);
        }
      } catch (error) {
        this.logger.error(`Error generating report query ${query.name}:`, error);
        results[query.name] = { error: error.message };
      }
    }
    
    report.results = results;
    report.lastRun = new Date();
  }

  /**
   * Handle general event
   */
  async handleEvent(event) {
    // Skip internal events
    if (event.topic.startsWith('analytics.')) return;
    
    // Track as analytics event if it matches patterns
    const trackablePatterns = [
      'user.',
      'page.',
      'api.',
      'error.',
      'conversion.'
    ];
    
    if (trackablePatterns.some(pattern => event.topic.startsWith(pattern))) {
      await this.track({
        event: event.topic,
        properties: event.data,
        timestamp: event.timestamp
      });
    }
  }

  /**
   * Handle metric event
   */
  async handleMetricEvent(event) {
    const { metric, value, labels } = event.data;
    
    if (metric && value !== undefined) {
      await this.updateMetric(metric, value, labels);
    }
  }

  /**
   * Aggregate metrics periodically
   */
  async aggregateMetrics() {
    try {
      // Aggregate to persistent storage
      const metricsToStore = [];
      
      for (const [key, metric] of this.metrics) {
        if (metric.values.length > 0) {
          metricsToStore.push({
            ...metric,
            aggregatedAt: new Date()
          });
        }
      }
      
      if (metricsToStore.length > 0) {
        await this.persistMetrics(metricsToStore);
      }
      
      this.logger.debug(`Aggregated ${metricsToStore.length} metrics`);
      
    } catch (error) {
      this.logger.error('Error aggregating metrics:', error);
    }
  }

  /**
   * Update real-time statistics
   */
  updateRealtimeStats() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // Events per second
    const recentEvents = this.events.filter(e => 
      e.timestamp.getTime() > oneSecondAgo
    );
    this.realtimeStats.eventsPerSecond = recentEvents.length;
    
    // Active users (last 5 minutes)
    const fiveMinutesAgo = now - 300000;
    this.realtimeStats.activeUsers.clear();
    
    for (const event of this.events) {
      if (event.timestamp.getTime() > fiveMinutesAgo) {
        this.realtimeStats.activeUsers.add(event.userId);
      }
    }
    
    // Error rate (last minute)
    const oneMinuteAgo = now - 60000;
    const recentMinuteEvents = this.events.filter(e => 
      e.timestamp.getTime() > oneMinuteAgo
    );
    const recentErrors = recentMinuteEvents.filter(e => e.event === 'error');
    this.realtimeStats.errorRate = recentMinuteEvents.length > 0
      ? recentErrors.length / recentMinuteEvents.length
      : 0;
    
    // Average response time (last minute)
    const responseTimes = [];
    for (const event of recentMinuteEvents) {
      if (event.properties.duration) {
        responseTimes.push(event.properties.duration);
      }
    }
    
    this.realtimeStats.avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
  }

  /**
   * Clean up old data
   */
  async cleanupOldData() {
    const cutoffDate = new Date(Date.now() - this.retentionDays * 86400000);
    
    // Clean events
    const beforeCount = this.events.length;
    this.events = this.events.filter(e => e.timestamp > cutoffDate);
    const eventsRemoved = beforeCount - this.events.length;
    
    // Clean metrics
    let metricsRemoved = 0;
    for (const [key, metric] of this.metrics) {
      const beforeValues = metric.values.length;
      metric.values = metric.values.filter(v => v.timestamp > cutoffDate);
      metricsRemoved += beforeValues - metric.values.length;
      
      // Remove metric if no values left
      if (metric.values.length === 0) {
        this.metrics.delete(key);
      }
    }
    
    this.logger.info(`Cleanup completed: ${eventsRemoved} events, ${metricsRemoved} metric values removed`);
  }

  /**
   * Persist event to storage
   */
  async persistEvent(eventData) {
    try {
      // Store in Qdrant for vector search
      if (this.storageAdapters.qdrant) {
        await this.storageAdapters.qdrant.writeBatch([{
          id: eventData.id,
          payload: eventData,
          vector: await this.generateEventVector(eventData)
        }], {
          collection: 'analytics_events',
          autoCreate: true
        });
      }
    } catch (error) {
      this.logger.error('Error persisting event:', error);
    }
  }

  /**
   * Persist metrics to storage
   */
  async persistMetrics(metrics) {
    try {
      // Store in Redis for fast access
      if (this.storageAdapters.redis) {
        const batch = metrics.map(metric => ({
          id: `metric:${metric.name}:${Date.now()}`,
          value: metric
        }));
        
        await this.storageAdapters.redis.writeBatch(batch, {
          type: 'json',
          ttl: this.retentionDays * 86400 // Convert days to seconds
        });
      }
    } catch (error) {
      this.logger.error('Error persisting metrics:', error);
    }
  }

  /**
   * Generate event vector for similarity search
   */
  async generateEventVector(eventData) {
    // This would use an embedding model in production
    // For now, return a dummy vector
    const vector = new Array(128).fill(0);
    
    // Simple hash-based vector generation
    const text = `${eventData.event} ${JSON.stringify(eventData.properties)}`;
    for (let i = 0; i < text.length; i++) {
      vector[i % 128] += text.charCodeAt(i) / 255;
    }
    
    return vector;
  }

  /**
   * Get metric key
   */
  getMetricKey(name, labels) {
    const labelStr = Object.entries(labels)
      .filter(([k]) => k !== 'timestamp' && k !== 'userId')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    
    return `${name}{${labelStr}}`;
  }

  /**
   * Get time group key
   */
  getTimeGroupKey(timestamp, groupBy) {
    const date = new Date(timestamp);
    
    switch (groupBy) {
      case 'minute':
        date.setSeconds(0, 0);
        break;
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const day = date.getDay();
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        break;
      case 'month':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
    }
    
    return date.toISOString();
  }

  /**
   * Get period start date
   */
  getPeriodStartDate(period) {
    const now = new Date();
    const match = period.match(/^(\d+)([hdwmh])$/);
    
    if (!match) {
      throw new Error(`Invalid period format: ${period}`);
    }
    
    const [, value, unit] = match;
    const num = parseInt(value);
    
    switch (unit) {
      case 'h': // hours
        return new Date(now.getTime() - num * 3600000);
      case 'd': // days
        return new Date(now.getTime() - num * 86400000);
      case 'w': // weeks
        return new Date(now.getTime() - num * 7 * 86400000);
      case 'm': // months
        const monthsAgo = new Date(now);
        monthsAgo.setMonth(monthsAgo.getMonth() - num);
        return monthsAgo;
      default:
        throw new Error(`Unknown period unit: ${unit}`);
    }
  }

  /**
   * Get session ID for user
   */
  getSessionId(userId) {
    // Simple session ID generation
    // In production, this would track actual sessions
    return `session-${userId}-${new Date().toISOString().split('T')[0]}`;
  }

  /**
   * Schedule report generation
   */
  scheduleReport(reportId, schedule) {
    // This would integrate with a job scheduler
    // For now, just log
    this.logger.info(`Report ${reportId} scheduled: ${JSON.stringify(schedule)}`);
  }

  /**
   * Stop the analytics engine
   */
  async stop() {
    // Clear intervals
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    if (this.realtimeInterval) {
      clearInterval(this.realtimeInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Final aggregation
    await this.aggregateMetrics();
    
    this.logger.info('Analytics engine stopped');
    this.emit('stopped');
  }
}

export default AnalyticsEngine;