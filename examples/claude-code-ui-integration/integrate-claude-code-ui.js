#!/usr/bin/env node

/**
 * Claude Code UI Integration Example
 * 
 * This example shows how to integrate Claude Code UI with AutoWeave Backend
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const AUTOWEAVE_API = process.env.AUTOWEAVE_API || 'http://localhost:3001';
const CLAUDE_UI_API = process.env.CLAUDE_UI_API || 'http://localhost:5000';
const CLAUDE_UI_WS = process.env.CLAUDE_UI_WS || 'ws://localhost:5000/socket.io/';

/**
 * Register Claude Code UI integration with AutoWeave
 */
async function registerIntegration() {
  console.log('📋 Registering Claude Code UI integration...\n');
  
  try {
    // First, login to get token (if auth is enabled)
    const loginRes = await fetch(`${AUTOWEAVE_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    
    // Register the integration
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'claude-code-ui',
        type: 'development-tool',
        config: {
          apiUrl: CLAUDE_UI_API,
          wsUrl: CLAUDE_UI_WS,
          projectsPath: `${process.env.HOME}/.claude/projects/`
        },
        metadata: {
          description: 'Claude Code UI for interactive coding sessions',
          version: '1.0.0',
          author: 'AutoWeave',
          features: [
            'project:management',
            'session:creation',
            'code:execution',
            'file:operations',
            'realtime:updates'
          ]
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Registration failed: ${error}`);
    }
    
    const integration = await response.json();
    console.log('✅ Integration registered successfully!');
    console.log('   ID:', integration.id);
    console.log('   Status:', integration.status);
    console.log('   Created:', new Date(integration.created).toLocaleString());
    
    return { integration, token };
    
  } catch (error) {
    console.error('❌ Registration failed:', error.message);
    throw error;
  }
}

/**
 * Test the integration by listing projects
 */
async function testIntegration(integrationId, token) {
  console.log('\n🧪 Testing integration...\n');
  
  try {
    // List available Claude projects
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'project:list'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Test failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📁 Available Claude projects:');
    
    if (result.data && result.data.length > 0) {
      result.data.forEach(project => {
        console.log(`   - ${project.name} (${project.path})`);
        console.log(`     Sessions: ${project.sessions?.length || 0}`);
        console.log(`     Modified: ${new Date(project.lastModified).toLocaleString()}`);
      });
    } else {
      console.log('   No projects found in ~/.claude/projects/');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

/**
 * Create a test session
 */
async function createTestSession(integrationId, token, projectId) {
  console.log('\n🚀 Creating test session...\n');
  
  try {
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'session:create',
        payload: {
          projectId: projectId || 'test-project',
          description: 'AutoWeave integration test session'
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Session created successfully!');
    console.log('   Session ID:', result.data.id);
    console.log('   Project:', result.data.projectId);
    console.log('   Description:', result.data.description);
    
    return result.data;
    
  } catch (error) {
    console.error('❌ Session creation failed:', error.message);
    throw error;
  }
}

/**
 * Execute code in the session
 */
async function executeCode(integrationId, token, sessionId) {
  console.log('\n💻 Executing code in session...\n');
  
  const testCode = `
// Test code from AutoWeave integration
console.log('🎉 Hello from AutoWeave + Claude Code UI!');

const fibonacci = (n) => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
};

console.log('Fibonacci sequence:');
for (let i = 0; i < 10; i++) {
  console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}

console.log('\\n✅ Code execution completed!');
`;
  
  try {
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'session:execute',
        payload: {
          sessionId,
          code: testCode,
          language: 'javascript'
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Code execution failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📝 Execution result:');
    console.log('   Exit code:', result.data.exitCode);
    console.log('   Duration:', result.data.duration, 'ms');
    console.log('\n   Output:');
    console.log('   ' + (result.data.output || '').split('\n').join('\n   '));
    
    if (result.data.error) {
      console.log('\n   Error:', result.data.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Code execution failed:', error.message);
    throw error;
  }
}

/**
 * Monitor integration events via WebSocket
 */
async function monitorEvents(integrationId, token) {
  console.log('\n📡 Connecting to event stream...\n');
  
  return new Promise((resolve) => {
    const ws = new WebSocket(`${AUTOWEAVE_API.replace('http', 'ws')}/api/integration/${integrationId}/events`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    ws.on('open', () => {
      console.log('✅ Connected to event stream');
      console.log('   Listening for Claude Code UI events...\n');
    });
    
    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data);
        console.log(`📨 Event: ${event.type}`);
        console.log('   Data:', JSON.stringify(event.data, null, 2));
      } catch (error) {
        console.log('📨 Raw event:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', () => {
      console.log('\n🔌 Event stream disconnected');
      resolve();
    });
    
    // Close after 30 seconds for demo
    setTimeout(() => {
      console.log('\n⏰ Closing event stream (demo timeout)...');
      ws.close();
    }, 30000);
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🔗 Claude Code UI + AutoWeave Integration Demo');
  console.log('='.repeat(50));
  console.log(`AutoWeave API: ${AUTOWEAVE_API}`);
  console.log(`Claude UI API: ${CLAUDE_UI_API}`);
  console.log('='.repeat(50));
  
  try {
    // Check if AutoWeave is running
    const healthRes = await fetch(`${AUTOWEAVE_API}/health`);
    if (!healthRes.ok) {
      throw new Error('AutoWeave Backend is not running. Start it with: npm run dev:redis');
    }
    
    // Register integration
    const { integration, token } = await registerIntegration();
    
    // Test integration
    const projects = await testIntegration(integration.id, token);
    
    // Create a session
    const projectId = projects.data?.[0]?.id;
    const session = await createTestSession(integration.id, token, projectId);
    
    // Execute code
    await executeCode(integration.id, token, session.id);
    
    // Monitor events (optional)
    // await monitorEvents(integration.id, token);
    
    console.log('\n✅ Integration demo completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Open Claude Code UI at http://localhost:5000');
    console.log('   2. Check the created session in the UI');
    console.log('   3. Try the de-integration example');
    console.log(`   4. Integration ID for de-integration: ${integration.id}`);
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. AutoWeave Backend is running (npm run dev:redis)');
    console.log('   2. Claude Code UI is running (see README)');
    process.exit(1);
  }
}

// Run the demo
if (import.meta.url === `file://${__filename}`) {
  main().catch(console.error);
}

// Export for use in other scripts
export { registerIntegration, testIntegration, createTestSession, executeCode };