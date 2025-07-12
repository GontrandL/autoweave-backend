#!/usr/bin/env node

/**
 * Complete AutoWeave Backend Example
 * ==================================
 * 
 * This example demonstrates all major features of the AutoWeave Backend:
 * - Authentication (JWT & API Keys)
 * - Service Registration & Management
 * - Event Bus (Pub/Sub)
 * - Data Pipeline
 * - Analytics
 * - Integration Hub
 * - Core Integration
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3001';
let accessToken = '';

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (accessToken && !headers.Authorization) {
        headers.Authorization = `Bearer ${accessToken}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(`API Error: ${data.error || response.statusText}`);
    }
    
    return data;
}

// 1. Authentication
async function demonstrateAuthentication() {
    console.log('\n🔐 Authentication Demo\n' + '='.repeat(50));
    
    // Login
    console.log('1. Logging in...');
    const loginResponse = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            username: 'admin',
            password: 'admin123'
        })
    });
    
    accessToken = loginResponse.token;
    console.log('✓ Login successful');
    console.log(`  Access Token: ${accessToken.substring(0, 50)}...`);
    console.log(`  Refresh Token: ${loginResponse.refreshToken.substring(0, 50)}...`);
    
    // Create API Key
    console.log('\n2. Creating API key...');
    const apiKeyResponse = await apiCall('/api/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({
            name: 'Demo API Key',
            permissions: ['read:services', 'write:services']
        })
    });
    
    console.log('✓ API Key created');
    console.log(`  Key: ${apiKeyResponse.key}`);
    console.log(`  ID: ${apiKeyResponse.id}`);
    
    return apiKeyResponse.key;
}

// 2. Service Management
async function demonstrateServiceManagement() {
    console.log('\n🔧 Service Management Demo\n' + '='.repeat(50));
    
    // Register a service
    console.log('1. Registering a new service...');
    const service = await apiCall('/api/services/register', {
        method: 'POST',
        body: JSON.stringify({
            name: 'demo-service',
            type: 'analytics',
            url: 'http://demo-service:8080',
            healthCheck: {
                endpoint: '/health',
                interval: 30000
            }
        })
    });
    
    console.log('✓ Service registered');
    console.log(`  ID: ${service.id}`);
    console.log(`  Status: ${service.status}`);
    
    // List services
    console.log('\n2. Listing all services...');
    const services = await apiCall('/api/services');
    console.log(`✓ Found ${services.length} services`);
    services.forEach(s => {
        console.log(`  - ${s.name} (${s.type}): ${s.status}`);
    });
    
    // Check health
    console.log('\n3. Checking service health...');
    const health = await apiCall(`/api/services/${service.id}/health`);
    console.log(`✓ Health status: ${health.status}`);
    
    return service.id;
}

// 3. Event Bus Demo
async function demonstrateEventBus() {
    console.log('\n📡 Event Bus Demo\n' + '='.repeat(50));
    
    // Publish an event
    console.log('1. Publishing an event...');
    await apiCall('/api/events/publish', {
        method: 'POST',
        body: JSON.stringify({
            topic: 'demo.events',
            event: {
                type: 'user.action',
                data: {
                    userId: '12345',
                    action: 'login',
                    timestamp: new Date().toISOString()
                }
            }
        })
    });
    console.log('✓ Event published');
    
    // Subscribe to events (WebSocket)
    console.log('\n2. Subscribing to events via WebSocket...');
    const ws = new WebSocket(`ws://localhost:3001/api/events/subscribe`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    return new Promise((resolve) => {
        ws.on('open', () => {
            console.log('✓ WebSocket connected');
            
            // Subscribe to topic
            ws.send(JSON.stringify({
                action: 'subscribe',
                topics: ['demo.events', 'system.events']
            }));
            
            // Publish another event
            setTimeout(async () => {
                await apiCall('/api/events/publish', {
                    method: 'POST',
                    body: JSON.stringify({
                        topic: 'demo.events',
                        event: {
                            type: 'test.event',
                            data: { message: 'Hello from demo!' }
                        }
                    })
                });
            }, 1000);
        });
        
        ws.on('message', (data) => {
            const message = JSON.parse(data);
            console.log('✓ Received event:', message);
            
            // Close after receiving event
            setTimeout(() => {
                ws.close();
                resolve();
            }, 1000);
        });
    });
}

// 4. Data Pipeline Demo
async function demonstrateDataPipeline() {
    console.log('\n🔄 Data Pipeline Demo\n' + '='.repeat(50));
    
    // Create a pipeline
    console.log('1. Creating a data pipeline...');
    const pipeline = await apiCall('/api/pipeline/create', {
        method: 'POST',
        body: JSON.stringify({
            name: 'demo-pipeline',
            description: 'Demo data processing pipeline',
            stages: [
                {
                    name: 'extract',
                    type: 'source',
                    config: {
                        source: 'api',
                        endpoint: 'https://api.example.com/data'
                    }
                },
                {
                    name: 'transform',
                    type: 'processor',
                    config: {
                        operations: ['normalize', 'enrich']
                    }
                },
                {
                    name: 'load',
                    type: 'sink',
                    config: {
                        destination: 'qdrant',
                        collection: 'demo_data'
                    }
                }
            ]
        })
    });
    
    console.log('✓ Pipeline created');
    console.log(`  ID: ${pipeline.id}`);
    console.log(`  Status: ${pipeline.status}`);
    
    // Process data
    console.log('\n2. Processing data through pipeline...');
    const job = await apiCall(`/api/pipeline/${pipeline.id}/process`, {
        method: 'POST',
        body: JSON.stringify({
            data: [
                { id: 1, name: 'Item 1', value: 100 },
                { id: 2, name: 'Item 2', value: 200 }
            ]
        })
    });
    
    console.log('✓ Processing job started');
    console.log(`  Job ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    
    return pipeline.id;
}

// 5. Analytics Demo
async function demonstrateAnalytics() {
    console.log('\n📊 Analytics Demo\n' + '='.repeat(50));
    
    // Send metrics
    console.log('1. Sending metrics...');
    await apiCall('/api/analytics/metrics', {
        method: 'POST',
        body: JSON.stringify({
            metrics: [
                {
                    name: 'api.requests',
                    value: 142,
                    tags: { endpoint: '/api/users', method: 'GET' }
                },
                {
                    name: 'api.latency',
                    value: 23.5,
                    tags: { endpoint: '/api/users', method: 'GET' }
                }
            ]
        })
    });
    console.log('✓ Metrics sent');
    
    // Track event
    console.log('\n2. Tracking analytics event...');
    await apiCall('/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify({
            event: 'user.signup',
            properties: {
                plan: 'premium',
                source: 'organic'
            },
            timestamp: new Date().toISOString()
        })
    });
    console.log('✓ Event tracked');
    
    // Query analytics
    console.log('\n3. Querying analytics data...');
    const analytics = await apiCall('/api/analytics/query', {
        method: 'POST',
        body: JSON.stringify({
            metric: 'api.requests',
            aggregation: 'sum',
            groupBy: 'endpoint',
            timeRange: {
                start: new Date(Date.now() - 3600000).toISOString(),
                end: new Date().toISOString()
            }
        })
    });
    
    console.log('✓ Analytics query results:');
    console.log(JSON.stringify(analytics, null, 2));
}

// 6. Integration Hub Demo
async function demonstrateIntegrationHub() {
    console.log('\n🔌 Integration Hub Demo\n' + '='.repeat(50));
    
    // Register an integration
    console.log('1. Registering an integration...');
    const integration = await apiCall('/api/integrations/register', {
        method: 'POST',
        body: JSON.stringify({
            name: 'demo-webhook',
            type: 'webhook',
            config: {
                url: 'https://webhook.site/demo',
                method: 'POST',
                headers: {
                    'X-Custom-Header': 'AutoWeave'
                }
            },
            events: ['user.created', 'user.updated']
        })
    });
    
    console.log('✓ Integration registered');
    console.log(`  ID: ${integration.id}`);
    console.log(`  Status: ${integration.status}`);
    
    // Trigger integration
    console.log('\n2. Triggering integration...');
    await apiCall(`/api/integrations/${integration.id}/trigger`, {
        method: 'POST',
        body: JSON.stringify({
            event: 'user.created',
            data: {
                userId: '67890',
                email: 'demo@example.com',
                name: 'Demo User'
            }
        })
    });
    console.log('✓ Integration triggered');
    
    return integration.id;
}

// 7. Core Integration Demo
async function demonstrateCoreIntegration() {
    console.log('\n🔗 AutoWeave Core Integration Demo\n' + '='.repeat(50));
    
    // Check Core connection status
    console.log('1. Checking Core connection...');
    try {
        const status = await apiCall('/api/core/status');
        console.log(`✓ Core connection: ${status.connected ? 'Connected' : 'Disconnected'}`);
        
        if (!status.connected) {
            console.log('\n2. Connecting to Core...');
            await apiCall('/api/core/connect', { method: 'POST' });
            console.log('✓ Connected to AutoWeave Core');
        }
        
        // Search Core memory
        console.log('\n3. Searching Core memory...');
        const memories = await apiCall('/api/core/memory/search', {
            method: 'POST',
            body: JSON.stringify({
                query: 'agent configuration',
                limit: 5
            })
        });
        
        console.log(`✓ Found ${memories.results?.length || 0} memories`);
        
        // Forward event to Core
        console.log('\n4. Forwarding event to Core...');
        await apiCall('/api/core/events', {
            method: 'POST',
            body: JSON.stringify({
                type: 'backend.demo',
                data: {
                    message: 'Hello from Backend!',
                    timestamp: new Date().toISOString()
                }
            })
        });
        console.log('✓ Event forwarded to Core');
        
    } catch (error) {
        console.log('⚠️  Core not available (this is normal if Core is not running)');
    }
}

// Main demo runner
async function runCompleteDemo() {
    console.log('🚀 AutoWeave Backend Complete Demo');
    console.log('==================================\n');
    
    try {
        // Check if backend is running
        const health = await fetch(`${BASE_URL}/health`);
        if (!health.ok) {
            throw new Error('Backend is not running. Please start it first.');
        }
        
        // Run all demos
        const apiKey = await demonstrateAuthentication();
        const serviceId = await demonstrateServiceManagement();
        await demonstrateEventBus();
        const pipelineId = await demonstrateDataPipeline();
        await demonstrateAnalytics();
        const integrationId = await demonstrateIntegrationHub();
        await demonstrateCoreIntegration();
        
        // Cleanup
        console.log('\n🧹 Cleanup\n' + '='.repeat(50));
        console.log('Cleaning up demo resources...');
        
        // Clean up in reverse order
        try {
            await apiCall(`/api/integrations/${integrationId}`, { method: 'DELETE' });
            await apiCall(`/api/pipeline/${pipelineId}`, { method: 'DELETE' });
            await apiCall(`/api/services/${serviceId}`, { method: 'DELETE' });
            console.log('✓ Cleanup complete');
        } catch (error) {
            console.log('⚠️  Some cleanup operations failed (this is normal)');
        }
        
        console.log('\n✅ Demo completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Check the API documentation at http://localhost:3001/api-docs');
        console.log('2. Monitor metrics at http://localhost:3001/metrics');
        console.log('3. View logs with: docker-compose logs -f autoweave-backend');
        
    } catch (error) {
        console.error('\n❌ Demo failed:', error.message);
        console.error('\nMake sure the backend is running:');
        console.error('  ./scripts/deploy-stack.sh');
        process.exit(1);
    }
}

// Run the demo
runCompleteDemo().catch(console.error);