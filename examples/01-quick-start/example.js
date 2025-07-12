#!/usr/bin/env node

import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:3001';
const CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

class QuickStartExample {
  constructor() {
    this.token = null;
    this.serviceId = null;
  }

  async run() {
    console.log('🚀 AutoWeave Backend Quick Start Example\n');

    try {
      // Step 1: Authenticate
      await this.authenticate();
      
      // Step 2: Register a service
      await this.registerService();
      
      // Step 3: Check service status
      await this.checkServiceStatus();
      
      // Step 4: Track analytics event
      await this.trackAnalyticsEvent();
      
      // Step 5: Check system health
      await this.checkSystemHealth();
      
      // Step 6: List all services
      await this.listServices();

      console.log('\n✅ Quick start completed successfully!');
      console.log('\n🔗 Next steps:');
      console.log('   • View API docs: http://localhost:3001/api-docs');
      console.log('   • Check metrics: http://localhost:3001/metrics');
      console.log('   • Explore more examples in ../02-authentication/');

    } catch (error) {
      console.error('❌ Error during quick start:', error.message);
      process.exit(1);
    }
  }

  async authenticate() {
    console.log('🔑 Step 1: Authenticating...');
    
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(CREDENTIALS)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${error}`);
    }

    const result = await response.json();
    this.token = result.token;
    
    console.log('   ✓ Successfully authenticated');
    console.log(`   ✓ Token received (expires: ${new Date(result.expiresAt).toLocaleString()})\n`);
  }

  async registerService() {
    console.log('🛠️  Step 2: Registering a service...');
    
    const serviceConfig = {
      name: 'hello-world-service',
      description: 'A simple hello world service for quick start demo',
      endpoints: [
        {
          path: '/hello',
          method: 'GET',
          description: 'Returns a hello world message'
        },
        {
          path: '/health',
          method: 'GET',
          description: 'Health check endpoint'
        }
      ],
      config: {
        port: 3100,
        healthCheck: '/health',
        tags: ['demo', 'quick-start']
      }
    };

    const response = await fetch(`${BASE_URL}/api/services/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(serviceConfig)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Service registration failed: ${error}`);
    }

    const service = await response.json();
    this.serviceId = service.id;
    
    console.log('   ✓ Service registered successfully');
    console.log(`   ✓ Service ID: ${service.id}`);
    console.log(`   ✓ Service Name: ${service.name}\n`);
  }

  async checkServiceStatus() {
    console.log('📊 Step 3: Checking service status...');
    
    const response = await fetch(`${BASE_URL}/api/services/${this.serviceId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get service status: ${error}`);
    }

    const status = await response.json();
    
    console.log('   ✓ Service status retrieved');
    console.log(`   ✓ Status: ${status.status}`);
    console.log(`   ✓ Created: ${new Date(status.createdAt).toLocaleString()}\n`);
  }

  async trackAnalyticsEvent() {
    console.log('📈 Step 4: Tracking analytics event...');
    
    const eventData = {
      event: 'quick_start_completed',
      properties: {
        user: 'admin',
        service: this.serviceId,
        timestamp: new Date().toISOString(),
        example: 'quick-start',
        version: '1.0.0'
      }
    };

    const response = await fetch(`${BASE_URL}/api/analytics/track`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to track analytics: ${error}`);
    }

    console.log('   ✓ Analytics event tracked successfully');
    console.log(`   ✓ Event: ${eventData.event}\n`);
  }

  async checkSystemHealth() {
    console.log('🏥 Step 5: Checking system health...');
    
    const response = await fetch(`${BASE_URL}/health`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Health check failed: ${error}`);
    }

    const health = await response.json();
    
    console.log('   ✓ System health check completed');
    console.log(`   ✓ Status: ${health.status}`);
    console.log(`   ✓ Version: ${health.version}`);
    console.log(`   ✓ Services: ${health.services?.length || 0} registered\n`);
  }

  async listServices() {
    console.log('📋 Step 6: Listing all services...');
    
    const response = await fetch(`${BASE_URL}/api/services`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list services: ${error}`);
    }

    const services = await response.json();
    
    console.log('   ✓ Services retrieved successfully');
    console.log(`   ✓ Total services: ${services.length}`);
    
    if (services.length > 0) {
      console.log('   ✓ Service list:');
      services.forEach(service => {
        console.log(`     - ${service.name} (${service.status})`);
      });
    }
    console.log('');
  }
}

// Run the example if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const example = new QuickStartExample();
  example.run().catch(error => {
    console.error('💥 Quick start failed:', error.message);
    process.exit(1);
  });
}

export default QuickStartExample;