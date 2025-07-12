/**
 * Performance Analyzer - Analyzes system and application performance metrics
 */
class PerformanceAnalyzer {
  constructor({ logger, config }) {
    this.logger = logger;
    this.config = config;
    
    // Performance data storage
    this.performanceData = {
      requests: new Map(),
      operations: new Map(),
      resources: new Map()
    };
    
    // Thresholds
    this.thresholds = {
      slowRequest: config.slowRequestThreshold || 1000, // 1 second
      highMemory: config.highMemoryThreshold || 0.8, // 80%
      highCPU: config.highCPUThreshold || 0.8, // 80%
      errorRate: config.errorRateThreshold || 0.05 // 5%
    };
  }

  /**
   * Analyze request performance
   */
  analyzeRequest(requestData) {
    const { endpoint, method, duration, status, timestamp } = requestData;
    const key = `${method}:${endpoint}`;
    
    if (!this.performanceData.requests.has(key)) {
      this.performanceData.requests.set(key, {
        endpoint,
        method,
        samples: [],
        slowRequests: 0,
        errors: 0
      });
    }
    
    const perf = this.performanceData.requests.get(key);
    perf.samples.push({ duration, status, timestamp });
    
    // Track slow requests
    if (duration > this.thresholds.slowRequest) {
      perf.slowRequests++;
    }
    
    // Track errors
    if (status >= 400) {
      perf.errors++;
    }
    
    // Keep only recent samples (last hour)
    const oneHourAgo = Date.now() - 3600000;
    perf.samples = perf.samples.filter(s => s.timestamp > oneHourAgo);
    
    return this.calculateRequestMetrics(perf);
  }

  /**
   * Calculate request metrics
   */
  calculateRequestMetrics(perfData) {
    const durations = perfData.samples.map(s => s.duration);
    
    if (durations.length === 0) {
      return null;
    }
    
    durations.sort((a, b) => a - b);
    
    return {
      endpoint: perfData.endpoint,
      method: perfData.method,
      sampleCount: durations.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p90: durations[Math.floor(durations.length * 0.9)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      slowRequestRate: perfData.slowRequests / durations.length,
      errorRate: perfData.errors / durations.length
    };
  }

  /**
   * Analyze operation performance
   */
  analyzeOperation(operationData) {
    const { name, duration, success, resources, timestamp } = operationData;
    
    if (!this.performanceData.operations.has(name)) {
      this.performanceData.operations.set(name, {
        name,
        executions: [],
        failures: 0
      });
    }
    
    const op = this.performanceData.operations.get(name);
    op.executions.push({
      duration,
      success,
      resources: resources || {},
      timestamp
    });
    
    if (!success) {
      op.failures++;
    }
    
    // Keep only recent executions
    const oneHourAgo = Date.now() - 3600000;
    op.executions = op.executions.filter(e => e.timestamp > oneHourAgo);
    
    return this.calculateOperationMetrics(op);
  }

  /**
   * Calculate operation metrics
   */
  calculateOperationMetrics(opData) {
    if (opData.executions.length === 0) {
      return null;
    }
    
    const durations = opData.executions.map(e => e.duration);
    const cpuUsages = opData.executions
      .filter(e => e.resources.cpu)
      .map(e => e.resources.cpu);
    const memoryUsages = opData.executions
      .filter(e => e.resources.memory)
      .map(e => e.resources.memory);
    
    return {
      name: opData.name,
      executionCount: opData.executions.length,
      failureRate: opData.failures / opData.executions.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      avgCPU: cpuUsages.length > 0 
        ? cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length 
        : null,
      avgMemory: memoryUsages.length > 0
        ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
        : null
    };
  }

  /**
   * Analyze resource usage
   */
  analyzeResourceUsage(resourceData) {
    const { cpu, memory, disk, network, timestamp } = resourceData;
    
    if (!this.performanceData.resources.has('system')) {
      this.performanceData.resources.set('system', {
        samples: []
      });
    }
    
    const resources = this.performanceData.resources.get('system');
    resources.samples.push({
      cpu,
      memory,
      disk,
      network,
      timestamp
    });
    
    // Keep only recent samples
    const oneHourAgo = Date.now() - 3600000;
    resources.samples = resources.samples.filter(s => s.timestamp > oneHourAgo);
    
    return this.detectResourceAnomalies(resources);
  }

  /**
   * Detect resource anomalies
   */
  detectResourceAnomalies(resourceData) {
    const anomalies = [];
    const recent = resourceData.samples.slice(-10); // Last 10 samples
    
    if (recent.length === 0) {
      return anomalies;
    }
    
    // Check CPU usage
    const avgCPU = recent.reduce((sum, s) => sum + (s.cpu || 0), 0) / recent.length;
    if (avgCPU > this.thresholds.highCPU) {
      anomalies.push({
        type: 'high_cpu',
        severity: 'warning',
        value: avgCPU,
        threshold: this.thresholds.highCPU,
        message: `High CPU usage detected: ${(avgCPU * 100).toFixed(1)}%`
      });
    }
    
    // Check memory usage
    const avgMemory = recent.reduce((sum, s) => sum + (s.memory || 0), 0) / recent.length;
    if (avgMemory > this.thresholds.highMemory) {
      anomalies.push({
        type: 'high_memory',
        severity: 'warning',
        value: avgMemory,
        threshold: this.thresholds.highMemory,
        message: `High memory usage detected: ${(avgMemory * 100).toFixed(1)}%`
      });
    }
    
    // Check for resource spikes
    const cpuSpike = this.detectSpike(recent.map(s => s.cpu || 0));
    if (cpuSpike) {
      anomalies.push({
        type: 'cpu_spike',
        severity: 'info',
        value: cpuSpike,
        message: `CPU spike detected: ${(cpuSpike * 100).toFixed(1)}% increase`
      });
    }
    
    return anomalies;
  }

  /**
   * Detect spikes in data
   */
  detectSpike(values, threshold = 2) {
    if (values.length < 3) return null;
    
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
    );
    
    const lastValue = values[values.length - 1];
    const zScore = (lastValue - avg) / (stdDev || 1);
    
    return zScore > threshold ? (lastValue - avg) / avg : null;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary = {
      requests: {},
      operations: {},
      resources: {},
      issues: []
    };
    
    // Summarize request performance
    const requestMetrics = [];
    for (const [key, data] of this.performanceData.requests) {
      const metrics = this.calculateRequestMetrics(data);
      if (metrics) {
        requestMetrics.push(metrics);
        
        // Check for issues
        if (metrics.errorRate > this.thresholds.errorRate) {
          summary.issues.push({
            type: 'high_error_rate',
            endpoint: metrics.endpoint,
            method: metrics.method,
            errorRate: metrics.errorRate
          });
        }
        
        if (metrics.slowRequestRate > 0.1) {
          summary.issues.push({
            type: 'slow_requests',
            endpoint: metrics.endpoint,
            method: metrics.method,
            slowRate: metrics.slowRequestRate
          });
        }
      }
    }
    
    // Find slowest endpoints
    summary.requests.slowest = requestMetrics
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 5);
    
    // Find most error-prone endpoints
    summary.requests.errorProne = requestMetrics
      .filter(m => m.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5);
    
    // Overall request stats
    if (requestMetrics.length > 0) {
      summary.requests.overall = {
        totalEndpoints: requestMetrics.length,
        avgResponseTime: requestMetrics.reduce((sum, m) => sum + m.avgDuration, 0) / requestMetrics.length,
        totalRequests: requestMetrics.reduce((sum, m) => sum + m.sampleCount, 0)
      };
    }
    
    // Summarize operations
    const operationMetrics = [];
    for (const [name, data] of this.performanceData.operations) {
      const metrics = this.calculateOperationMetrics(data);
      if (metrics) {
        operationMetrics.push(metrics);
      }
    }
    
    summary.operations.all = operationMetrics
      .sort((a, b) => b.executionCount - a.executionCount)
      .slice(0, 10);
    
    // Resource summary
    const systemResources = this.performanceData.resources.get('system');
    if (systemResources && systemResources.samples.length > 0) {
      const recent = systemResources.samples.slice(-60); // Last hour
      summary.resources = {
        cpu: {
          current: recent[recent.length - 1].cpu,
          avg: recent.reduce((sum, s) => sum + (s.cpu || 0), 0) / recent.length,
          max: Math.max(...recent.map(s => s.cpu || 0))
        },
        memory: {
          current: recent[recent.length - 1].memory,
          avg: recent.reduce((sum, s) => sum + (s.memory || 0), 0) / recent.length,
          max: Math.max(...recent.map(s => s.memory || 0))
        }
      };
      
      // Add anomalies
      const anomalies = this.detectResourceAnomalies(systemResources);
      summary.issues.push(...anomalies);
    }
    
    return summary;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations() {
    const recommendations = [];
    const summary = this.getPerformanceSummary();
    
    // Check slow endpoints
    if (summary.requests.slowest) {
      for (const endpoint of summary.requests.slowest) {
        if (endpoint.p95 > this.thresholds.slowRequest * 2) {
          recommendations.push({
            type: 'optimize_endpoint',
            priority: 'high',
            endpoint: `${endpoint.method} ${endpoint.endpoint}`,
            reason: `95th percentile response time is ${endpoint.p95}ms`,
            suggestions: [
              'Add caching for frequently accessed data',
              'Optimize database queries',
              'Consider pagination for large datasets',
              'Profile the endpoint to identify bottlenecks'
            ]
          });
        }
      }
    }
    
    // Check error rates
    if (summary.requests.errorProne) {
      for (const endpoint of summary.requests.errorProne) {
        if (endpoint.errorRate > this.thresholds.errorRate) {
          recommendations.push({
            type: 'fix_errors',
            priority: 'critical',
            endpoint: `${endpoint.method} ${endpoint.endpoint}`,
            reason: `Error rate is ${(endpoint.errorRate * 100).toFixed(1)}%`,
            suggestions: [
              'Review error logs for this endpoint',
              'Add better error handling',
              'Validate input parameters',
              'Check external service dependencies'
            ]
          });
        }
      }
    }
    
    // Check resource usage
    if (summary.resources) {
      if (summary.resources.memory.avg > this.thresholds.highMemory) {
        recommendations.push({
          type: 'optimize_memory',
          priority: 'high',
          reason: `Average memory usage is ${(summary.resources.memory.avg * 100).toFixed(1)}%`,
          suggestions: [
            'Identify memory leaks',
            'Optimize data structures',
            'Implement proper garbage collection',
            'Consider horizontal scaling'
          ]
        });
      }
      
      if (summary.resources.cpu.avg > this.thresholds.highCPU) {
        recommendations.push({
          type: 'optimize_cpu',
          priority: 'high',
          reason: `Average CPU usage is ${(summary.resources.cpu.avg * 100).toFixed(1)}%`,
          suggestions: [
            'Profile CPU-intensive operations',
            'Implement caching strategies',
            'Optimize algorithms',
            'Consider asynchronous processing'
          ]
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Export performance data
   */
  exportPerformanceData() {
    const data = {
      timestamp: new Date(),
      summary: this.getPerformanceSummary(),
      recommendations: this.getOptimizationRecommendations(),
      rawData: {
        requests: Array.from(this.performanceData.requests.entries()).map(([key, value]) => ({
          key,
          ...this.calculateRequestMetrics(value)
        })),
        operations: Array.from(this.performanceData.operations.entries()).map(([key, value]) => ({
          key,
          ...this.calculateOperationMetrics(value)
        }))
      }
    };
    
    return data;
  }
}

export default PerformanceAnalyzer;