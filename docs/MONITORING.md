# AutoWeave Backend Monitoring

This document covers the complete monitoring setup for AutoWeave Backend using Prometheus, Grafana, and AlertManager.

## Overview

The monitoring stack provides:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **AlertManager**: Alert routing and notifications
- **Node Exporter**: System metrics

## Quick Start

### Start Monitoring Stack

```bash
# Start all monitoring services
npm run monitoring:start

# Or manually
./scripts/start-monitoring.sh
```

### Stop Monitoring Stack

```bash
# Stop monitoring services
npm run monitoring:stop

# Or manually
./scripts/stop-monitoring.sh
```

### View Logs

```bash
# View logs from all monitoring services
npm run monitoring:logs
```

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3003 | admin / admin123 |
| Prometheus | http://localhost:9091 | None |
| AlertManager | http://localhost:9093 | None |
| Node Exporter | http://localhost:9100 | None |

## Metrics Collected

### HTTP Metrics

- `http_request_duration_seconds`: Request duration histogram
- `http_requests_total`: Total HTTP requests counter
- `http_requests_active`: Active HTTP requests gauge

### Service Metrics

- `services_total`: Number of services by status
- `service_health_checks_total`: Health check attempts
- `service_uptime_seconds`: Service uptime

### WebSocket Metrics

- `websocket_connections_active`: Active WebSocket connections
- `websocket_messages_total`: Total WebSocket messages

### Event Bus Metrics

- `eventbus_events_published_total`: Events published
- `eventbus_subscribers_active`: Active subscribers
- `eventbus_processing_duration_seconds`: Event processing time

### Analytics Metrics

- `analytics_events_tracked_total`: Analytics events tracked
- `analytics_query_duration_seconds`: Analytics query duration

### Pipeline Metrics

- `pipeline_executions_total`: Pipeline executions
- `pipeline_processing_duration_seconds`: Pipeline processing time
- `pipeline_items_processed_total`: Items processed

### Integration Metrics

- `integrations_active`: Active integrations
- `integration_requests_total`: Integration requests
- `integration_errors_total`: Integration errors

### Database Metrics

- `database_connections_active`: Database connections
- `database_query_duration_seconds`: Database query duration
- `database_errors_total`: Database errors

### Authentication Metrics

- `auth_attempts_total`: Authentication attempts
- `auth_tokens_active`: Active tokens
- `auth_rate_limit_hits_total`: Rate limit hits

### Business Metrics

- `business_operations_total`: Business operations
- `business_value_current`: Business value metrics

## Dashboards

### AutoWeave Backend Overview

Main dashboard showing:
- Request rate by method
- Error rate gauge
- Response time P95 by route
- Active WebSocket connections
- Services by status
- Database operations rate

### AutoWeave Services Detail

Detailed service metrics:
- Service uptime
- Health check success rates
- Event bus activity
- Pipeline execution rates
- Integration request rates

## Alerts

### HTTP Alerts

- **HighErrorRate**: Error rate > 5% for 5 minutes
- **HighResponseTime**: P95 response time > 1s for 5 minutes
- **HighRequestRate**: Request rate > 1000 req/s for 2 minutes

### Service Health Alerts

- **ServiceDown**: Services in error state for 2 minutes
- **ServiceHealthCheckFailing**: Health checks failing > 0.1/s for 5 minutes

### Database Alerts

- **DatabaseConnectionPoolExhausted**: Connection pool > 90% for 5 minutes
- **DatabaseHighQueryTime**: P95 query time > 0.5s for 5 minutes

### Pipeline Alerts

- **PipelineExecutionFailures**: Failure rate > 0.1/s for 5 minutes
- **PipelineProcessingTimeSlow**: P95 processing time > 60s for 10 minutes

### Authentication Alerts

- **HighAuthFailureRate**: Auth failure rate > 30% for 5 minutes
- **RateLimitingActive**: Rate limiting > 10 req/s for 2 minutes

## Configuration

### Environment Variables

Create or modify `.env` file:

```env
# Grafana Configuration
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123

# AlertManager Configuration (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SMTP_USERNAME=your-email@example.com
SMTP_PASSWORD=your-password
PAGERDUTY_SERVICE_KEY=your-service-key

# Prometheus retention
PROMETHEUS_RETENTION=30d
```

### Slack Notifications

1. Create a Slack webhook URL
2. Set `SLACK_WEBHOOK_URL` in `.env`
3. Restart AlertManager: `docker-compose -f docker-compose.monitoring.yml restart alertmanager`

### Email Notifications

1. Configure SMTP settings in `.env`
2. Update team email addresses in `monitoring/alertmanager/alertmanager.yml`
3. Restart AlertManager

### PagerDuty Integration

1. Get PagerDuty service key
2. Set `PAGERDUTY_SERVICE_KEY` in `.env`
3. Restart AlertManager

## Custom Metrics

### Recording Business Metrics

```javascript
import { recordBusinessMetrics } from './middleware/monitoring.js';

// Record a business operation
recordBusinessMetrics('user_signup', 'success', 1);

// Record business value
recordBusinessMetrics('revenue', 'success', 99.99);
```

### Adding Custom Metrics

```javascript
import { metrics } from './monitoring/metrics.js';

// Custom counter
const myCounter = new promClient.Counter({
  name: 'my_custom_counter',
  help: 'My custom counter',
  registers: [metrics.register]
});

myCounter.inc();
```

## Troubleshooting

### Common Issues

1. **Grafana not accessible**
   - Check Docker container: `docker ps`
   - Check logs: `docker logs autoweave-grafana`

2. **No metrics in Prometheus**
   - Verify backend is running on port 3001
   - Check Prometheus targets: http://localhost:9091/targets

3. **Alerts not firing**
   - Check alert rules: http://localhost:9091/alerts
   - Verify AlertManager config: http://localhost:9093

### Logs and Debugging

```bash
# View all monitoring logs
npm run monitoring:logs

# View specific service logs
docker logs autoweave-prometheus
docker logs autoweave-grafana
docker logs autoweave-alertmanager

# Check metrics endpoint
curl http://localhost:3001/metrics
```

### Reset Everything

```bash
# Stop and remove all data
npm run monitoring:stop
# Answer 'y' when prompted to remove volumes

# Start fresh
npm run monitoring:start
```

## Performance Considerations

### Metrics Retention

- Default retention: 30 days
- Modify in `monitoring/prometheus/prometheus.yml`
- Or set `PROMETHEUS_RETENTION` environment variable

### Scrape Intervals

- Default: 15 seconds
- Modify in `monitoring/prometheus/prometheus.yml`
- Lower intervals = more data, higher resource usage

### Dashboard Refresh

- Default: 5 seconds
- Adjust in Grafana dashboard settings
- Higher refresh rates may impact performance

## Security

### Production Deployment

1. **Change default passwords**
   ```env
   GRAFANA_PASSWORD=secure-password-here
   ```

2. **Enable HTTPS**
   - Use reverse proxy (nginx, Traefik)
   - Configure SSL certificates

3. **Network Security**
   - Restrict access to monitoring ports
   - Use private Docker networks
   - Configure firewall rules

4. **Authentication**
   - Enable Grafana OAuth/LDAP
   - Restrict Prometheus/AlertManager access

### Secrets Management

- Use Docker secrets for production
- Never commit credentials to version control
- Rotate passwords regularly

## Scaling

### High Availability

For production environments:

1. **Multiple Prometheus instances**
2. **Grafana clustering**
3. **AlertManager clustering**
4. **External storage** (e.g., Thanos)

### Federation

For multi-cluster deployments:

1. Configure Prometheus federation
2. Use remote storage
3. Centralized Grafana instance

## Backup

### Prometheus Data

```bash
# Backup Prometheus data
docker exec autoweave-prometheus tar czf /tmp/prometheus-backup.tar.gz /prometheus
docker cp autoweave-prometheus:/tmp/prometheus-backup.tar.gz ./prometheus-backup.tar.gz
```

### Grafana Configuration

```bash
# Backup Grafana data
docker exec autoweave-grafana tar czf /tmp/grafana-backup.tar.gz /var/lib/grafana
docker cp autoweave-grafana:/tmp/grafana-backup.tar.gz ./grafana-backup.tar.gz
```

## Support

For monitoring issues:
1. Check this documentation
2. Review logs and metrics
3. Check Prometheus/Grafana documentation
4. Open GitHub issue with logs