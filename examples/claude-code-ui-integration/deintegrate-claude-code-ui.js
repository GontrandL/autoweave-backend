#!/usr/bin/env node

/**
 * Claude Code UI De-integration Example
 * 
 * This example shows how to properly de-integrate Claude Code UI from AutoWeave
 */

import fetch from 'node-fetch';
import readline from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

// Fix for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const AUTOWEAVE_API = process.env.AUTOWEAVE_API || 'http://localhost:3001';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompt user for input
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

/**
 * Get integration details
 */
async function getIntegrationDetails(integrationId, token) {
  const response = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get integration details: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Check integration health and status
 */
async function checkIntegrationStatus(integrationId, token) {
  console.log('\n🔍 Checking integration status...\n');
  
  try {
    // Get integration details
    const integration = await getIntegrationDetails(integrationId, token);
    console.log('📋 Integration Details:');
    console.log('   Name:', integration.name);
    console.log('   Type:', integration.type);
    console.log('   Status:', integration.status);
    console.log('   Created:', new Date(integration.created).toLocaleString());
    
    // Check health
    const healthRes = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}/health`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (healthRes.ok) {
      const health = await healthRes.json();
      console.log('\n💚 Health Status:');
      console.log('   Healthy:', health.healthy ? 'Yes' : 'No');
      console.log('   API:', health.details?.api ? 'Connected' : 'Disconnected');
      console.log('   WebSocket:', health.details?.websocket ? 'Connected' : 'Disconnected');
      console.log('   Active Sessions:', health.details?.activeSessions || 0);
    }
    
    // Check for active operations
    const metricsRes = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}/metrics`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (metricsRes.ok) {
      const metrics = await metricsRes.json();
      console.log('\n📊 Usage Metrics:');
      console.log('   Total Operations:', metrics.totalOperations || 0);
      console.log('   Active Operations:', metrics.activeOperations || 0);
      console.log('   Failed Operations:', metrics.failedOperations || 0);
    }
    
    return integration;
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    throw error;
  }
}

/**
 * De-integrate Claude Code UI
 */
async function deintegrateClaudeCodeUI(integrationId, token, options = {}) {
  console.log('\n🔄 Starting de-integration process...\n');
  
  const {
    policy = 'graceful',
    preserveData = true,
    force = false
  } = options;
  
  console.log('📋 De-integration Options:');
  console.log('   Policy:', policy);
  console.log('   Preserve Data:', preserveData ? 'Yes' : 'No');
  console.log('   Force:', force ? 'Yes' : 'No');
  
  try {
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/${integrationId}/deintegrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        policy,
        preserveData,
        notifyDependents: true,
        force
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`De-integration failed: ${error}`);
    }
    
    const result = await response.json();
    console.log('\n✅ De-integration initiated!');
    console.log('   De-integration ID:', result.id);
    console.log('   Status:', result.status);
    
    // Monitor de-integration progress
    await monitorDeintegration(result.id, token);
    
    return result;
    
  } catch (error) {
    console.error('❌ De-integration failed:', error.message);
    throw error;
  }
}

/**
 * Monitor de-integration progress
 */
async function monitorDeintegration(deintegrationId, token) {
  console.log('\n⏳ Monitoring de-integration progress...\n');
  
  let completed = false;
  let lastStatus = '';
  
  while (!completed) {
    try {
      const response = await fetch(`${AUTOWEAVE_API}/api/integration/deintegration/${deintegrationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const deintegration = await response.json();
        
        if (deintegration.status !== lastStatus) {
          lastStatus = deintegration.status;
          console.log(`📊 Status: ${deintegration.status}`);
          
          // Show completed steps
          if (deintegration.steps) {
            deintegration.steps.forEach(step => {
              const icon = step.status === 'completed' ? '✅' : 
                         step.status === 'failed' ? '❌' : '⏳';
              console.log(`   ${icon} ${step.name} (${step.status})`);
            });
          }
        }
        
        if (deintegration.status === 'completed' || deintegration.status === 'failed') {
          completed = true;
          
          if (deintegration.status === 'completed') {
            console.log('\n✅ De-integration completed successfully!');
            console.log('   Duration:', deintegration.duration, 'ms');
            
            if (deintegration.preserveData) {
              console.log('   State saved for potential re-integration');
              console.log('   De-integration ID:', deintegration.id);
            }
          } else {
            console.log('\n❌ De-integration failed!');
            console.log('   Error:', deintegration.error);
          }
        }
      }
      
      if (!completed) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error('❌ Monitoring error:', error.message);
      break;
    }
  }
}

/**
 * List previous de-integrations
 */
async function listDeintegrations(token) {
  console.log('\n📋 Previous de-integrations:\n');
  
  try {
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/deintegrations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const deintegrations = await response.json();
      
      if (deintegrations.length === 0) {
        console.log('   No previous de-integrations found');
      } else {
        deintegrations.forEach(deint => {
          console.log(`   ID: ${deint.id}`);
          console.log(`   Integration: ${deint.integrationId}`);
          console.log(`   Date: ${new Date(deint.endTime).toLocaleString()}`);
          console.log(`   Status: ${deint.status}`);
          console.log(`   Data Preserved: ${deint.options?.preserveData ? 'Yes' : 'No'}`);
          console.log('   ---');
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to list de-integrations:', error.message);
  }
}

/**
 * Re-integrate a previously de-integrated service
 */
async function reintegrate(deintegrationId, token) {
  console.log('\n🔄 Re-integrating service...\n');
  
  try {
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/reintegrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        deintegrationId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Re-integration failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Re-integration successful!');
    console.log('   Integration ID:', result.integrationId);
    console.log('   Status:', result.status);
    
    return result;
    
  } catch (error) {
    console.error('❌ Re-integration failed:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔌 Claude Code UI De-integration Demo');
  console.log('='.repeat(50));
  
  try {
    // Get integration ID from command line or prompt
    let integrationId = process.argv[2];
    if (!integrationId) {
      integrationId = await prompt('Enter Integration ID to de-integrate: ');
    }
    
    // Login to get token
    console.log('\n🔐 Authenticating...');
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
    console.log('✅ Authenticated');
    
    // Check integration status
    await checkIntegrationStatus(integrationId, token);
    
    // Ask for de-integration options
    console.log('\n📋 De-integration Options:');
    console.log('   1. Graceful (recommended) - Wait for operations to complete');
    console.log('   2. Immediate - Remove everything now');
    console.log('   3. Scheduled - Schedule for later');
    console.log('   4. List previous de-integrations');
    console.log('   5. Re-integrate from previous de-integration');
    console.log('   6. Cancel');
    
    const choice = await prompt('\nSelect option (1-6): ');
    
    switch (choice) {
      case '1':
        // Graceful de-integration
        await deintegrateClaudeCodeUI(integrationId, token, {
          policy: 'graceful',
          preserveData: true
        });
        break;
        
      case '2':
        // Immediate de-integration
        const confirm = await prompt('⚠️  This will remove everything immediately. Continue? (y/N): ');
        if (confirm.toLowerCase() === 'y') {
          await deintegrateClaudeCodeUI(integrationId, token, {
            policy: 'immediate',
            preserveData: false,
            force: true
          });
        }
        break;
        
      case '3':
        // Scheduled de-integration
        const hours = await prompt('Schedule de-integration in how many hours? ');
        const scheduledTime = new Date(Date.now() + (parseInt(hours) * 3600000));
        console.log(`\n📅 Scheduling de-integration for ${scheduledTime.toLocaleString()}`);
        
        await deintegrateClaudeCodeUI(integrationId, token, {
          policy: 'scheduled',
          scheduledTime
        });
        break;
        
      case '4':
        // List de-integrations
        await listDeintegrations(token);
        break;
        
      case '5':
        // Re-integrate
        const deintId = await prompt('Enter de-integration ID to restore: ');
        await reintegrate(deintId, token);
        break;
        
      case '6':
        console.log('\n❌ De-integration cancelled');
        break;
        
      default:
        console.log('\n❌ Invalid option');
    }
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the demo
if (import.meta.url === `file://${__filename}`) {
  main().catch(console.error);
}