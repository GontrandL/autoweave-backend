# Analytics Engine Guide

The Analytics Engine provides comprehensive real-time analytics, user behavior tracking, and performance monitoring capabilities for the AutoWeave ecosystem.

## Overview

The Analytics Engine consists of several components:

1. **Core Engine**: Event tracking, metric aggregation, and real-time processing
2. **Performance Analyzer**: System and application performance analysis
3. **Behavior Analyzer**: User journey tracking and pattern recognition
4. **Storage Integration**: Persistent storage in Qdrant and Redis

## Features

### Real-time Analytics
- Event tracking with sub-second latency
- Live dashboards with key metrics
- Active user monitoring
- Error rate tracking

### User Behavior Analysis
- User journey mapping
- Conversion funnel analysis
- Cohort retention analysis
- Pattern recognition
- Predictive analytics

### Performance Monitoring
- Request/response time tracking
- Resource usage monitoring
- Anomaly detection
- Performance recommendations

### Data Export & Reporting
- Custom report generation
- Multiple export formats (JSON, CSV)
- Scheduled reports
- API for programmatic access

## API Reference

### Track Events

```http
POST /api/analytics/track
```

Track custom events with properties:

```json
{
  "event": "page_view",
  "properties": {
    "page": "/products",
    "loadTime": 1250,
    "referrer": "/home"
  },
  "userId": "user123",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Get Metrics

```http
GET /api/analytics/metrics/{metric_name}
```

Query parameters:
- `startDate`: Start date for data range
- `endDate`: End date for data range  
- `groupBy`: Aggregation period (minute, hour, day, week, month)
- `filter`: JSON filter object

Example:
```
GET /api/analytics/metrics/page_views_total?groupBy=hour&filter={"page":"/home"}
```

### Dashboard Overview

```http
GET /api/analytics/dashboard
```

Query parameters:
- `period`: Time period (1h, 24h, 7d, 30d)

Response includes:
- Summary statistics
- Top events
- User activity timeline
- Error breakdown
- Performance metrics

### Funnel Analysis

```http
POST /api/analytics/funnel
```

Analyze conversion funnels:

```json
{
  "steps": ["page_view", "add_to_cart", "checkout", "purchase"],
  "startDate": "2024-01-01",
  "endDate": "2024-01-15",
  "userId": "optional-specific-user"
}
```

### Cohort Analysis

```http
GET /api/analytics/cohorts
```

Query parameters:
- `cohortType`: daily, weekly, or monthly
- `metric`: retention (default) or custom metric
- `periods`: Number of periods to analyze

### User Analytics

```http
GET /api/analytics/users/{userId}
```

Get detailed analytics for a specific user including:
- Event history
- Session analysis
- Behavioral patterns
- Properties aggregation

### Real-time Statistics

```http
GET /api/analytics/realtime
```

Get current real-time metrics:
- Active users
- Events per second
- Current error rate
- Average response time

### Export Data

```http
POST /api/analytics/export
```

Export analytics data:

```json
{
  "metrics": ["page_views_total", "conversion_rate"],
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "format": "csv",
  "groupBy": "day"
}
```

### Custom Reports

```http
POST /api/analytics/reports
```

Create custom reports with multiple queries:

```json
{
  "name": "Weekly Performance Report",
  "queries": [
    {
      "name": "traffic",
      "type": "metric",
      "metric": "page_views_total",
      "options": { "groupBy": "day" }
    },
    {
      "name": "funnel",
      "type": "funnel",
      "options": {
        "steps": ["visit", "signup", "purchase"]
      }
    }
  ],
  "schedule": {
    "frequency": "weekly",
    "dayOfWeek": 1,
    "hour": 9
  }
}
```

## Event Types

### Standard Events

#### Page View
```javascript
{
  event: 'page_view',
  properties: {
    page: '/products',
    title: 'Products Page',
    loadTime: 1234,
    referrer: '/home'
  }
}
```

#### User Actions
```javascript
{
  event: 'button_click',
  properties: {
    button: 'add-to-cart',
    page: '/product/123',
    value: 29.99
  }
}
```

#### API Requests
```javascript
{
  event: 'api_request',
  properties: {
    endpoint: '/api/users',
    method: 'GET',
    status: 200,
    duration: 125
  }
}
```

#### Errors
```javascript
{
  event: 'error',
  properties: {
    errorType: 'ValidationError',
    message: 'Invalid email format',
    severity: 'warning',
    stack: 'Error stack trace...'
  }
}
```

#### Conversions
```javascript
{
  event: 'conversion',
  properties: {
    conversionType: 'purchase',
    conversionValue: 99.99,
    currency: 'USD',
    items: ['product-123', 'product-456']
  }
}
```

## Metrics

### Built-in Metrics

1. **events_total**: Total number of events
2. **page_views_total**: Page view count
3. **api_requests_total**: API request count
4. **errors_total**: Error count
5. **conversions_total**: Conversion count
6. **page_load_time_seconds**: Page load duration
7. **api_request_duration_seconds**: API request duration

### Custom Metrics

Track custom metrics in event properties:

```javascript
{
  event: 'custom_event',
  properties: {
    metrics: {
      processing_time: 1234,
      queue_depth: 15,
      cache_hit_rate: 0.85
    }
  }
}
```

## Behavior Analysis

### User Journey Mapping

The system automatically tracks user journeys through:
- Session detection (30-minute timeout)
- Page flow analysis
- Action sequence tracking
- Drop-off point identification

### Pattern Recognition

Identifies common patterns:
- Frequent navigation paths
- Common action sequences
- User segments based on behavior
- Predictive next actions

### Segmentation

Automatic user segmentation:
- **Power Users**: High engagement, recent activity
- **Regular Users**: Moderate engagement
- **At Risk**: Low engagement, declining activity
- **Churned**: No recent activity
- **New Users**: Recently joined

## Performance Analysis

### Request Performance

Tracks performance metrics:
- Response time percentiles (p50, p90, p95, p99)
- Slow request identification
- Error rates by endpoint
- Performance trends

### Resource Monitoring

System resource tracking:
- CPU usage
- Memory consumption
- Disk I/O
- Network throughput

### Anomaly Detection

Automatic detection of:
- Performance degradation
- Unusual error spikes
- Resource usage anomalies
- Traffic pattern changes

## Integration

### With Data Pipeline

Analytics data can be:
- Exported to data pipeline
- Synchronized to vector stores
- Processed with custom transformers

### With Event Bus

All analytics events are published to event bus:
- `analytics.event.tracked`
- `analytics.metric.updated`
- `analytics.report.generated`

### With Storage

Data persistence:
- **Qdrant**: Event vectors for similarity search
- **Redis**: Real-time metrics and cache
- **Neo4j**: User journey graphs (planned)

## Best Practices

### Event Naming
- Use consistent naming: `noun.verb` (e.g., `user.signup`)
- Keep names descriptive but concise
- Use lowercase with underscores

### Properties
- Include relevant context
- Keep property names consistent
- Avoid PII in properties
- Use appropriate data types

### Performance
- Batch events when possible
- Use sampling for high-volume events
- Set appropriate retention periods
- Monitor analytics overhead

### Privacy
- Anonymize user data
- Respect user preferences
- Implement data retention policies
- Provide data export/deletion

## Configuration

### Environment Variables

```env
# Analytics Configuration
ANALYTICS_RETENTION_DAYS=30
ANALYTICS_AGGREGATION_INTERVAL=60000
ANALYTICS_REALTIME=true
ANALYTICS_SAMPLING_RATE=1.0

# Performance Thresholds
SLOW_QUERY_THRESHOLD=1000
MEMORY_ALERT_THRESHOLD=1073741824
CPU_ALERT_THRESHOLD=0.8
```

### Sampling

For high-volume applications, configure sampling:

```javascript
// Sample 10% of events
config.analytics.samplingRate = 0.1;

// Or implement custom sampling
if (shouldSample(event)) {
  analytics.track(event);
}
```

## Troubleshooting

### Missing Events
- Check sampling configuration
- Verify event tracking code
- Check network/API errors
- Review event filters

### Incorrect Metrics
- Verify metric calculations
- Check aggregation periods
- Review timezone settings
- Validate event properties

### Performance Issues
- Increase aggregation interval
- Implement sampling
- Optimize event properties
- Review retention settings

## Examples

### E-commerce Funnel
```javascript
// Track product view
analytics.track({
  event: 'product_view',
  properties: {
    productId: '123',
    productName: 'Widget',
    price: 29.99,
    category: 'Electronics'
  }
});

// Track add to cart
analytics.track({
  event: 'add_to_cart',
  properties: {
    productId: '123',
    quantity: 2,
    cartValue: 59.98
  }
});

// Track purchase
analytics.track({
  event: 'purchase',
  properties: {
    orderId: '456',
    total: 59.98,
    items: [{ id: '123', quantity: 2 }],
    paymentMethod: 'credit_card'
  }
});
```

### SaaS Application
```javascript
// Track feature usage
analytics.track({
  event: 'feature_used',
  properties: {
    feature: 'report_generator',
    duration: 4500,
    success: true
  }
});

// Track subscription
analytics.track({
  event: 'subscription_created',
  properties: {
    plan: 'pro',
    billingPeriod: 'monthly',
    amount: 99
  }
});
```

### API Monitoring
```javascript
// Middleware to track all API requests
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    analytics.track({
      event: 'api_request',
      properties: {
        endpoint: req.path,
        method: req.method,
        status: res.statusCode,
        duration: Date.now() - start,
        userAgent: req.headers['user-agent']
      }
    });
  });
  
  next();
});
```