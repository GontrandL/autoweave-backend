import fetch from 'node-fetch';

/**
 * Demo script showing Analytics Engine capabilities
 */

const API_BASE = 'http://localhost:3001/api';

// Simulate user events
const simulateUserEvents = async () => {
  const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
  const pages = ['/home', '/products', '/product/123', '/cart', '/checkout', '/success'];
  const events = [];

  // Generate realistic user journeys
  for (const userId of users) {
    const sessionStart = Date.now() - Math.random() * 86400000; // Random time in last 24h
    let currentTime = sessionStart;
    
    // User journey
    const journey = [
      { event: 'page_view', page: '/home' },
      { event: 'page_view', page: '/products' },
      { event: 'product_view', productId: '123' },
      { event: 'add_to_cart', productId: '123', value: 29.99 },
      { event: 'page_view', page: '/cart' },
      { event: 'page_view', page: '/checkout' }
    ];
    
    // Some users complete purchase
    if (Math.random() > 0.3) {
      journey.push({ event: 'purchase', value: 29.99 });
      journey.push({ event: 'page_view', page: '/success' });
    }
    
    // Generate events
    for (const step of journey) {
      currentTime += Math.random() * 60000; // 0-60 seconds between events
      
      const eventData = {
        event: step.event,
        properties: {
          ...step,
          sessionId: `session-${userId}-${sessionStart}`,
          userAgent: 'Mozilla/5.0 Demo Browser',
          duration: Math.random() * 2000 + 100 // Page load time
        },
        userId,
        timestamp: new Date(currentTime)
      };
      
      events.push(eventData);
      
      // Some users drop off
      if (Math.random() > 0.8) break;
    }
  }
  
  return events;
};

// Track events
const trackEvents = async (events) => {
  console.log(`Tracking ${events.length} events...`);
  
  for (const event of events) {
    await fetch(`${API_BASE}/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  }
  
  console.log('Events tracked successfully');
};

// Demo analytics features
async function demo() {
  console.log('=== AutoWeave Analytics Engine Demo ===\n');

  try {
    // 1. Generate and track events
    console.log('1. Generating user events...');
    const events = await simulateUserEvents();
    await trackEvents(events);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Get dashboard overview
    console.log('\n2. Getting dashboard overview...');
    const dashboardResponse = await fetch(`${API_BASE}/analytics/dashboard?period=24h`);
    const dashboard = await dashboardResponse.json();
    
    console.log('Dashboard Summary:');
    console.log(`  Total Events: ${dashboard.summary.totalEvents}`);
    console.log(`  Unique Users: ${dashboard.summary.uniqueUsers}`);
    console.log(`  Error Rate: ${(dashboard.summary.errorRate * 100).toFixed(2)}%`);
    console.log(`  Avg Response Time: ${dashboard.summary.avgResponseTime.toFixed(0)}ms`);
    
    console.log('\nTop Events:');
    dashboard.topEvents.slice(0, 5).forEach(e => {
      console.log(`  - ${e.event}: ${e.count}`);
    });

    // 3. Analyze conversion funnel
    console.log('\n3. Analyzing conversion funnel...');
    const funnelResponse = await fetch(`${API_BASE}/analytics/funnel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steps: ['page_view', 'product_view', 'add_to_cart', 'purchase']
      })
    });
    const funnel = await funnelResponse.json();
    
    console.log('Funnel Analysis:');
    funnel.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.name}: ${step.count} users (${step.conversionRate.toFixed(1)}%)`);
    });
    console.log(`  Overall Conversion: ${funnel.overallConversion.toFixed(1)}%`);

    // 4. Get metrics for specific events
    console.log('\n4. Getting page view metrics...');
    const metricsResponse = await fetch(
      `${API_BASE}/analytics/metrics/page_views_total?groupBy=hour`
    );
    const metrics = await metricsResponse.json();
    
    console.log('Page Views by Hour:');
    metrics.data.slice(-5).forEach(m => {
      const time = new Date(m.timestamp).toLocaleTimeString();
      console.log(`  ${time}: ${m.count} views`);
    });

    // 5. Analyze user cohorts
    console.log('\n5. Analyzing user cohorts...');
    const cohortsResponse = await fetch(
      `${API_BASE}/analytics/cohorts?cohortType=daily&periods=3`
    );
    const cohorts = await cohortsResponse.json();
    
    console.log('Daily Cohort Retention:');
    cohorts.cohorts.forEach(cohort => {
      console.log(`  ${cohort.period}:`);
      cohort.metrics.forEach(m => {
        console.log(`    Day ${m.period}: ${m.value.toFixed(1)}% retained`);
      });
    });

    // 6. Get user analytics
    console.log('\n6. Analyzing specific user...');
    const userResponse = await fetch(`${API_BASE}/analytics/users/user1`);
    const userAnalytics = await userResponse.json();
    
    console.log('User Analytics:');
    console.log(`  Total Events: ${userAnalytics.totalEvents}`);
    console.log(`  Sessions: ${userAnalytics.sessions.length}`);
    console.log(`  Event Breakdown:`);
    userAnalytics.eventBreakdown.slice(0, 5).forEach(e => {
      console.log(`    - ${e.event}: ${e.count}`);
    });

    // 7. Export analytics data
    console.log('\n7. Exporting analytics data...');
    const exportResponse = await fetch(`${API_BASE}/analytics/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metrics: ['page_views_total', 'events_total'],
        startDate: new Date(Date.now() - 86400000), // Last 24 hours
        format: 'json',
        groupBy: 'hour'
      })
    });
    
    if (exportResponse.ok) {
      console.log('Data exported successfully');
    }

    // 8. Get real-time stats
    console.log('\n8. Getting real-time statistics...');
    const realtimeResponse = await fetch(`${API_BASE}/analytics/realtime`);
    const realtime = await realtimeResponse.json();
    
    console.log('Real-time Stats:');
    console.log(`  Active Users: ${realtime.activeUsers}`);
    console.log(`  Events/Second: ${realtime.eventsPerSecond}`);
    console.log(`  Error Rate: ${(realtime.errorRate * 100).toFixed(2)}%`);
    console.log(`  Avg Response Time: ${realtime.avgResponseTime.toFixed(0)}ms`);

    // 9. Create custom report
    console.log('\n9. Creating custom report...');
    const reportResponse = await fetch(`${API_BASE}/analytics/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Daily Performance Report',
        queries: [
          {
            name: 'page_performance',
            type: 'metric',
            metric: 'page_views_total',
            options: { groupBy: 'hour' }
          },
          {
            name: 'conversion_funnel',
            type: 'funnel',
            options: {
              steps: ['page_view', 'add_to_cart', 'purchase']
            }
          },
          {
            name: 'overview',
            type: 'dashboard',
            period: '24h'
          }
        ]
      })
    });
    
    const reportResult = await reportResponse.json();
    console.log(`Report created: ${reportResult.reportId}`);

    // 10. Track API performance
    console.log('\n10. Tracking API performance...');
    
    // Simulate API requests
    const apiEvents = [];
    const endpoints = ['/api/users', '/api/products', '/api/orders'];
    const methods = ['GET', 'POST', 'PUT'];
    
    for (let i = 0; i < 20; i++) {
      apiEvents.push({
        event: 'api_request',
        properties: {
          endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
          method: methods[Math.floor(Math.random() * methods.length)],
          status: Math.random() > 0.9 ? 500 : 200,
          duration: Math.random() * 500 + 50
        },
        userId: 'system',
        timestamp: new Date()
      });
    }
    
    await trackEvents(apiEvents);
    
    console.log('API performance tracked');

    console.log('\n=== Demo completed successfully! ===');

  } catch (error) {
    console.error('Demo error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Utility function to generate performance metrics
const generatePerformanceMetrics = async () => {
  console.log('\n=== Generating Performance Metrics ===');
  
  // Track various performance events
  const perfEvents = [];
  
  // Page load times
  const pages = ['/home', '/products', '/about', '/contact'];
  for (const page of pages) {
    for (let i = 0; i < 10; i++) {
      perfEvents.push({
        event: 'page_view',
        properties: {
          page,
          loadTime: Math.random() * 2000 + 200, // 200-2200ms
          timestamp: new Date(Date.now() - Math.random() * 3600000)
        },
        userId: `user${Math.floor(Math.random() * 10)}`,
        timestamp: new Date()
      });
    }
  }
  
  // API request performance
  const apis = [
    { endpoint: '/api/search', avgTime: 150 },
    { endpoint: '/api/recommendations', avgTime: 300 },
    { endpoint: '/api/checkout', avgTime: 500 }
  ];
  
  for (const api of apis) {
    for (let i = 0; i < 20; i++) {
      const isError = Math.random() > 0.95;
      perfEvents.push({
        event: 'api_request',
        properties: {
          endpoint: api.endpoint,
          method: 'GET',
          duration: api.avgTime + (Math.random() - 0.5) * 100,
          status: isError ? 500 : 200,
          error: isError ? 'Internal Server Error' : undefined
        },
        userId: 'system',
        timestamp: new Date(Date.now() - Math.random() * 3600000)
      });
    }
  }
  
  await trackEvents(perfEvents);
  console.log(`Generated ${perfEvents.length} performance events`);
};

// Run demo with performance metrics
(async () => {
  await generatePerformanceMetrics();
  await demo();
})().catch(console.error);