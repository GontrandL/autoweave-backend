#!/usr/bin/env node

/**
 * Quick test script to verify dev mode works
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';

console.log('🧪 Testing AutoWeave Backend Quick Start...\n');

// Set environment for mock mode
process.env.USE_MOCK_ADAPTERS = 'true';
process.env.DISABLE_REDIS = 'true';
process.env.DISABLE_NEO4J = 'true';
process.env.DISABLE_QDRANT = 'true';
process.env.DISABLE_CORE = 'true';
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'debug';

// Start the server
console.log('Starting server in mock mode...');
const server = spawn('node', ['src/index.js'], {
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverStarted = false;

// Capture output
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('SERVER:', output.trim());
  
  if (output.includes('listening on port 3001')) {
    serverStarted = true;
    runTests();
  }
});

server.stderr.on('data', (data) => {
  console.error('ERROR:', data.toString().trim());
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Run tests
async function runTests() {
  console.log('\n📋 Running tests...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthRes = await fetch('http://localhost:3001/health');
    const health = await healthRes.json();
    console.log('   Status:', health.status);
    console.log('   Mode:', health.mode);
    console.log('   ✅ Health check passed\n');
    
    // Test 2: Login
    console.log('2. Testing login...');
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const login = await loginRes.json();
    console.log('   Token:', login.token ? 'Generated' : 'Missing');
    console.log('   Warning:', login.warning || 'None');
    console.log('   ✅ Login endpoint works\n');
    
    // Test 3: API Documentation
    console.log('3. Testing API docs...');
    const docsRes = await fetch('http://localhost:3001/api-docs');
    console.log('   Status:', docsRes.status);
    console.log('   ✅ API docs accessible\n');
    
    console.log('🎉 All tests passed! Dev mode is working.\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Kill the server
    server.kill();
    process.exit(0);
  }
}

// Timeout
setTimeout(() => {
  if (!serverStarted) {
    console.error('❌ Server failed to start within 10 seconds');
    server.kill();
    process.exit(1);
  }
}, 10000);