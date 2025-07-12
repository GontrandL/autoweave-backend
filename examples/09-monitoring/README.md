# Monitoring Setup Example

Complete guide to setting up monitoring for AutoWeave Backend.

## Overview

This example demonstrates:
- Starting the monitoring stack
- Configuring Prometheus
- Setting up Grafana dashboards
- Creating custom alerts
- Monitoring best practices

## Quick Setup

### Start Monitoring Stack

```bash
# From the main backend directory
npm run monitoring:start
```

This starts:
- **Prometheus** on http://localhost:9091
- **Grafana** on http://localhost:3003 (admin/admin123)
- **AlertManager** on http://localhost:9093
- **Node Exporter** on http://localhost:9100

### Access Dashboards

1. Open Grafana: http://localhost:3003
2. Login with admin/admin123
3. Navigate to "AutoWeave Backend Overview" dashboard

## Custom Metrics Example

### Adding Business Metrics

```javascript
// In your application code
import { recordBusinessMetrics } from '../src/middleware/monitoring.js';

// Track user signups
recordBusinessMetrics('user_signup', 'success', 1);

// Track revenue
recordBusinessMetrics('revenue', 'success', 99.99);

// Track feature usage
recordBusinessMetrics('feature_usage', 'success', 1);
```

### Custom Prometheus Metrics

```javascript
import { metrics } from '../src/monitoring/metrics.js';
import * as promClient from 'prom-client';

// Create custom counter
const customCounter = new promClient.Counter({
  name: 'my_custom_operations_total',
  help: 'Total number of custom operations',
  labelNames: ['operation_type', 'status'],
  registers: [metrics.register]
});

// Create custom histogram
const customHistogram = new promClient.Histogram({
  name: 'my_custom_duration_seconds',
  help: 'Duration of custom operations',
  labelNames: ['operation_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [metrics.register]
});

// Use the metrics
function performCustomOperation(type) {
  const timer = customHistogram.labels(type).startTimer();
  
  try {
    // Your operation here
    customCounter.labels(type, 'success').inc();
  } catch (error) {
    customCounter.labels(type, 'error').inc();
    throw error;
  } finally {
    timer();
  }
}
```

## Custom Alerts

### Create Alert Rules

Create `monitoring/prometheus/alerts/custom-alerts.yml`:

```yaml
groups:
  - name: custom_business_alerts
    rules:
      - alert: LowUserSignupRate
        expr: |
          rate(business_operations_total{operation="user_signup"}[1h]) < 0.01
        for: 30m
        labels:
          severity: warning
          component: business
        annotations:
          summary: "Low user signup rate detected"
          description: "User signup rate is {{ $value }} per second (< 0.01/s)"

      - alert: HighErrorRate
        expr: |
          rate(my_custom_operations_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
          component: custom
        annotations:
          summary: "High error rate in custom operations"
          description: "Error rate is {{ $value }} per second"
```

### Custom Grafana Dashboard

Create a custom dashboard JSON:

```json
{
  "dashboard": {
    "title": "Custom Business Metrics",
    "panels": [
      {
        "title": "User Signups",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(business_operations_total{operation=\"user_signup\"}[1h])"
          }
        ]
      },
      {
        "title": "Revenue Trend",
        "type": "timeseries",
        "targets": [
          {
            "expr": "rate(business_value_current{metric_name=\"revenue\"}[1h])"
          }
        ]
      }
    ]
  }
}
```

## Advanced Configuration

### Prometheus Configuration

Edit `monitoring/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Add custom scrape jobs
scrape_configs:
  - job_name: 'autoweave-backend'
    static_configs:
      - targets: ['host.docker.internal:3001']
    scrape_interval: 5s
    metrics_path: '/metrics'

  # Add external services
  - job_name: 'external-service'
    static_configs:
      - targets: ['external-service:8080']
    basic_auth:
      username: 'metrics'
      password: 'secret'
```

### Grafana Data Sources

Add additional data sources in `monitoring/grafana/provisioning/datasources/`:

```yaml
# loki.yml - for logs
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
```

### AlertManager Notifications

Configure Slack notifications in `monitoring/alertmanager/alertmanager.yml`:

```yaml
route:
  routes:
    - match:
        severity: critical
      receiver: 'slack-critical'
    - match:
        component: business
      receiver: 'business-team'

receivers:
  - name: 'slack-critical'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts-critical'
        title: 'Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'business-team'
    email_configs:
      - to: 'business-team@company.com'
        subject: 'Business Metric Alert'
```

## Monitoring Patterns

### Health Check Monitoring

```javascript
// Create comprehensive health check
export class HealthMonitor {
  static async getSystemHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
      databases: {},
      external: {}
    };

    // Check services
    for (const service of this.services) {
      try {
        health.services[service.name] = await this.checkService(service);
      } catch (error) {
        health.services[service.name] = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }
    }

    // Check databases
    for (const [name, db] of Object.entries(this.databases)) {
      try {
        health.databases[name] = await this.checkDatabase(db);
      } catch (error) {
        health.databases[name] = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }
    }

    return health;
  }

  static async checkService(service) {
    const start = Date.now();
    const response = await fetch(`${service.url}/health`, { timeout: 5000 });
    const duration = Date.now() - start;

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      responseTime: duration,
      statusCode: response.status
    };
  }
}
```

### Performance Monitoring

```javascript
// Monitor function performance
export function monitorPerformance(fn, name) {
  return async function(...args) {
    const timer = customHistogram.labels(name).startTimer();
    const start = Date.now();

    try {
      const result = await fn.apply(this, args);
      customCounter.labels(name, 'success').inc();
      return result;
    } catch (error) {
      customCounter.labels(name, 'error').inc();
      throw error;
    } finally {
      timer();
      console.log(`${name} took ${Date.now() - start}ms`);
    }
  };
}

// Usage
const monitoredFunction = monitorPerformance(originalFunction, 'my_operation');
```

### SLI/SLO Monitoring

```javascript
// Service Level Indicators
export class SLIMonitor {
  static recordSLI(service, operation, success, latency) {
    // Record success rate
    const status = success ? 'success' : 'failure';
    sliCounter.labels(service, operation, status).inc();

    // Record latency
    sliHistogram.labels(service, operation).observe(latency);
  }

  static async calculateSLO(service, window = '24h') {
    // Calculate availability SLO (99.9%)
    const query = `
      sum(rate(sli_operations_total{service="${service}",status="success"}[${window}])) /
      sum(rate(sli_operations_total{service="${service}"}[${window}]))
    `;

    const result = await this.prometheusQuery(query);
    return result * 100; // Convert to percentage
  }
}
```

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Prometheus**
   ```bash
   # Check if backend is exposing metrics
   curl http://localhost:3001/metrics
   
   # Check Prometheus targets
   open http://localhost:9091/targets
   ```

2. **Grafana dashboard empty**
   ```bash
   # Check data source connection
   # Go to Configuration > Data Sources in Grafana
   # Test the Prometheus connection
   ```

3. **Alerts not firing**
   ```bash
   # Check alert rules in Prometheus
   open http://localhost:9091/alerts
   
   # Check AlertManager status
   open http://localhost:9093
   ```

### Performance Issues

```bash
# Check Prometheus storage usage
docker exec autoweave-prometheus df -h /prometheus

# Check Grafana performance
docker stats autoweave-grafana

# Reduce metrics retention if needed
# Edit monitoring/prometheus/prometheus.yml
# Add: --storage.tsdb.retention.time=7d
```

## Production Deployment

### Security Considerations

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    environment:
      - PROMETHEUS_ENABLE_ADMIN_API=false
    networks:
      - monitoring-internal
    # Remove public port exposure
```

### Backup Strategy

```bash
#!/bin/bash
# backup-monitoring.sh

# Backup Prometheus data
docker exec autoweave-prometheus tar czf /tmp/prometheus-backup.tar.gz /prometheus
docker cp autoweave-prometheus:/tmp/prometheus-backup.tar.gz ./backups/

# Backup Grafana data
docker exec autoweave-grafana tar czf /tmp/grafana-backup.tar.gz /var/lib/grafana
docker cp autoweave-grafana:/tmp/grafana-backup.tar.gz ./backups/
```

### High Availability

```yaml
# For production, consider:
services:
  prometheus-1:
    # First Prometheus instance
  prometheus-2:
    # Second Prometheus instance
  
  grafana:
    environment:
      - GF_DATABASE_TYPE=postgres
      - GF_DATABASE_HOST=postgres:5432
    depends_on:
      - postgres
```

## Next Steps

- Set up log aggregation with ELK/Loki
- Implement distributed tracing
- Configure advanced alerting rules
- Explore the [E-commerce Backend](../10-ecommerce-backend/) example