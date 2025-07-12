#!/usr/bin/env node

/**
 * Complete Claude Code UI Integration Workflow
 * 
 * This example demonstrates a complete integration lifecycle:
 * 1. Integration
 * 2. Usage
 * 3. Monitoring
 * 4. De-integration
 * 5. Re-integration
 */

import { registerIntegration, testIntegration, createTestSession, executeCode } from './integrate-claude-code-ui.js';
import fetch from 'node-fetch';
import WebSocket from 'ws';

const AUTOWEAVE_API = process.env.AUTOWEAVE_API || 'http://localhost:3001';

/**
 * Monitor integration health
 */
async function monitorIntegrationHealth(integrationId, token, duration = 30000) {
  console.log('\n📊 Monitoring integration health...\n');
  
  const startTime = Date.now();
  const healthChecks = [];
  
  const checkHealth = async () => {
    try {
      const response = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}/health`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const health = await response.json();
        healthChecks.push({
          timestamp: new Date(),
          healthy: health.healthy,
          details: health.details
        });
        
        const icon = health.healthy ? '💚' : '💔';
        console.log(`${icon} Health check at ${new Date().toLocaleTimeString()}: ${health.healthy ? 'Healthy' : 'Unhealthy'}`);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
    }
  };
  
  // Check health every 5 seconds
  const interval = setInterval(checkHealth, 5000);
  
  // Initial check
  await checkHealth();
  
  // Stop after duration
  setTimeout(() => {
    clearInterval(interval);
    
    // Summary
    console.log('\n📈 Health Monitoring Summary:');
    console.log(`   Total checks: ${healthChecks.length}`);
    console.log(`   Healthy: ${healthChecks.filter(h => h.healthy).length}`);
    console.log(`   Unhealthy: ${healthChecks.filter(h => !h.healthy).length}`);
    console.log(`   Uptime: ${((healthChecks.filter(h => h.healthy).length / healthChecks.length) * 100).toFixed(2)}%`);
  }, duration);
  
  return new Promise(resolve => setTimeout(resolve, duration));
}

/**
 * Perform de-integration
 */
async function performDeintegration(integrationId, token) {
  console.log('\n🔄 Performing graceful de-integration...\n');
  
  const response = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}/deintegrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      policy: 'graceful',
      preserveData: true,
      notifyDependents: true
    })
  });
  
  if (!response.ok) {
    throw new Error(`De-integration failed: ${response.statusText}`);
  }
  
  const deintegration = await response.json();
  console.log('✅ De-integration completed');
  console.log('   ID:', deintegration.id);
  console.log('   State preserved:', deintegration.options.preserveData);
  
  return deintegration;
}

/**
 * Perform re-integration
 */
async function performReintegration(deintegrationId, token) {
  console.log('\n🔄 Performing re-integration...\n');
  
  const response = await fetch(`${AUTOWEAVE_API}/api/integration/reintegrate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ deintegrationId })
  });
  
  if (!response.ok) {
    throw new Error(`Re-integration failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log('✅ Re-integration completed');
  console.log('   Integration ID:', result.integrationId);
  console.log('   Status:', result.status);
  
  return result;
}

/**
 * Create an agent that uses Claude Code UI
 */
async function createClaudeCodeAgent(integrationId, token) {
  console.log('\n🤖 Creating agent that uses Claude Code UI...\n');
  
  const agentDef = {
    name: 'code-assistant',
    description: 'An agent that helps with coding using Claude Code UI',
    capabilities: [
      'code:generation',
      'code:execution',
      'code:review',
      'file:operations'
    ],
    integrations: [integrationId],
    workflow: {
      steps: [
        {
          name: 'receive_request',
          type: 'input',
          description: 'Receive coding request from user'
        },
        {
          name: 'create_session',
          type: 'integration',
          integration: integrationId,
          action: 'session:create',
          description: 'Create Claude Code UI session'
        },
        {
          name: 'generate_code',
          type: 'llm',
          model: 'gpt-4',
          prompt: 'Generate code based on user request'
        },
        {
          name: 'execute_code',
          type: 'integration',
          integration: integrationId,
          action: 'session:execute',
          description: 'Execute generated code'
        },
        {
          name: 'return_results',
          type: 'output',
          description: 'Return code and execution results'
        }
      ]
    }
  };
  
  const response = await fetch(`${AUTOWEAVE_API}/api/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(agentDef)
  });
  
  if (response.ok) {
    const agent = await response.json();
    console.log('✅ Agent created successfully');
    console.log('   ID:', agent.id);
    console.log('   Name:', agent.name);
    console.log('   Integrations:', agent.integrations);
    return agent;
  } else {
    console.log('⚠️  Agent creation not available in current mode');
    return null;
  }
}

/**
 * Main workflow execution
 */
async function runCompleteWorkflow() {
  console.log('🎯 Complete Claude Code UI Integration Workflow');
  console.log('='.repeat(60));
  console.log('This demo will:');
  console.log('1. Integrate Claude Code UI');
  console.log('2. Test the integration');
  console.log('3. Monitor health');
  console.log('4. De-integrate gracefully');
  console.log('5. Re-integrate from saved state');
  console.log('='.repeat(60));
  
  try {
    // Phase 1: Integration
    console.log('\n📍 Phase 1: Integration\n');
    const { integration, token } = await registerIntegration();
    
    // Phase 2: Testing
    console.log('\n📍 Phase 2: Testing\n');
    const projects = await testIntegration(integration.id, token);
    const session = await createTestSession(integration.id, token, projects.data?.[0]?.id);
    await executeCode(integration.id, token, session.id);
    
    // Phase 3: Agent Creation (optional)
    console.log('\n📍 Phase 3: Agent Creation\n');
    const agent = await createClaudeCodeAgent(integration.id, token);
    
    // Phase 4: Health Monitoring
    console.log('\n📍 Phase 4: Health Monitoring (30 seconds)\n');
    await monitorIntegrationHealth(integration.id, token, 30000);
    
    // Phase 5: De-integration
    console.log('\n📍 Phase 5: De-integration\n');
    const deintegration = await performDeintegration(integration.id, token);
    
    // Wait a bit
    console.log('\n⏳ Waiting 5 seconds before re-integration...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Phase 6: Re-integration
    console.log('\n📍 Phase 6: Re-integration\n');
    const reintegrated = await performReintegration(deintegration.id, token);
    
    // Phase 7: Verify re-integration
    console.log('\n📍 Phase 7: Verifying re-integration\n');
    await testIntegration(reintegrated.integrationId, token);
    
    console.log('\n🎉 Complete workflow executed successfully!');
    console.log('\nKey Takeaways:');
    console.log('- Integration can be added and removed cleanly');
    console.log('- State is preserved during de-integration');
    console.log('- Re-integration restores previous configuration');
    console.log('- Health monitoring ensures reliability');
    console.log('- Agents can leverage integrated services');
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Workflow interrupted by user');
  process.exit(0);
});

// Run the workflow
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n⚠️  Prerequisites:');
  console.log('1. AutoWeave Backend running: npm run dev:redis');
  console.log('2. Claude Code UI running (optional but recommended)');
  console.log('\nPress Enter to continue or Ctrl+C to cancel...');
  
  process.stdin.once('data', () => {
    runCompleteWorkflow().catch(console.error);
  });
}