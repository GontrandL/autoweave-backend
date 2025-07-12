# Claude Code UI Integration Example

This example demonstrates how to integrate Claude Code UI with AutoWeave Backend and how to properly de-integrate when needed.

## Prerequisites

1. Clone and setup Claude Code UI:
```bash
git clone https://github.com/siteboon/claudecodeui.git
cd claudecodeui
npm install
npm run dev
```

2. Ensure AutoWeave Backend is running:
```bash
cd autoweave-backend
npm run dev:redis  # Or full stack
```

## Integration Example

### 1. Basic Integration

```javascript
// integrate-claude-code-ui.js
import { IntegrationHub } from '../../src/services/integration/integration-hub.js';
import ClaudeCodeUIAdapter from '../../src/services/integration/adapters/claude-code-ui-adapter.js';

async function integrateClaudeCodeUI() {
  // Initialize Integration Hub
  const hub = new IntegrationHub({
    logger: console,
    config: {
      integrations: {
        maxRetries: 3,
        retryDelay: 5000
      }
    }
  });

  await hub.init();

  // Register Claude Code UI integration
  const integration = await hub.registerIntegration({
    name: 'claude-code-ui',
    type: 'development-tool',
    adapter: {
      type: 'claude-code-ui',
      config: {
        apiUrl: 'http://localhost:5000',
        wsUrl: 'ws://localhost:5000/socket.io/',
        projectsPath: `${process.env.HOME}/.claude/projects/`
      }
    },
    metadata: {
      description: 'Claude Code UI for interactive coding sessions',
      version: '1.0.0',
      author: 'AutoWeave'
    }
  });

  console.log('Integration registered:', integration.id);

  // Subscribe to events
  hub.on('data', (event) => {
    console.log('Received event:', event);
  });

  // List available projects
  const projects = await hub.processIntegrationData(integration.id, {
    type: 'project:list'
  });
  
  console.log('Available projects:', projects);

  // Create a new session
  const session = await hub.processIntegrationData(integration.id, {
    type: 'session:create',
    payload: {
      projectId: projects.data[0]?.id,
      description: 'AutoWeave integration test'
    }
  });

  console.log('Session created:', session);

  return { hub, integration };
}

// Run the integration
integrateClaudeCodeUI().catch(console.error);
```

### 2. Using the Integration

```javascript
// use-claude-code-ui.js
async function useClaudeCodeUI(hub, integrationId) {
  // Execute code in a session
  const result = await hub.processIntegrationData(integrationId, {
    type: 'session:execute',
    payload: {
      sessionId: 'session-123',
      code: `
        console.log('Hello from AutoWeave!');
        const sum = (a, b) => a + b;
        console.log('2 + 2 =', sum(2, 2));
      `,
      language: 'javascript'
    }
  });

  console.log('Execution result:', result);

  // Read a file
  const fileContent = await hub.processIntegrationData(integrationId, {
    type: 'file:read',
    payload: {
      path: '/path/to/file.js',
      sessionId: 'session-123'
    }
  });

  console.log('File content:', fileContent);

  // Write a file
  await hub.processIntegrationData(integrationId, {
    type: 'file:write',
    payload: {
      path: '/path/to/new-file.js',
      content: 'export const hello = () => console.log("Hello!");',
      sessionId: 'session-123'
    }
  });
}
```

## De-integration Example

### 1. Graceful De-integration

```javascript
// deintegrate-claude-code-ui.js
import DeintegrationManager from '../../src/services/integration/deintegration-manager.js';

async function deintegrateClaudeCodeUI(hub, integrationId) {
  // Initialize de-integration manager
  const deintegrationManager = new DeintegrationManager({
    logger: console,
    config: {
      deintegrationPath: './data/deintegrations'
    }
  });

  await deintegrationManager.init();

  // Perform graceful de-integration
  const deintegration = await deintegrationManager.deintegrate(integrationId, {
    policy: 'graceful',        // Wait for operations to complete
    preserveData: true,        // Save integration state
    notifyDependents: true,    // Notify dependent services
    force: false              // Validate before removing
  });

  console.log('De-integration completed:', deintegration);
  
  // The de-integration record includes:
  // - Saved state for potential re-integration
  // - Cleanup verification results
  // - Timeline of all steps taken
  
  return deintegration;
}
```

### 2. Re-integration

```javascript
// reintegrate-claude-code-ui.js
async function reintegrateClaudeCodeUI(deintegrationId) {
  const deintegrationManager = new DeintegrationManager({
    logger: console,
    config: {
      deintegrationPath: './data/deintegrations'
    }
  });

  await deintegrationManager.init();

  // Re-integrate using saved state
  const integration = await deintegrationManager.reintegrate(deintegrationId);
  
  console.log('Re-integration completed');
  
  // The integration is restored with:
  // - Previous configuration
  // - Saved sessions (if applicable)
  // - Original integration ID
  
  return integration;
}
```

### 3. Different De-integration Policies

```javascript
// Immediate cleanup (removes everything now)
await deintegrationManager.deintegrate(integrationId, {
  policy: 'immediate',
  preserveData: false
});

// Scheduled cleanup (cleanup at specific time)
await deintegrationManager.deintegrate(integrationId, {
  policy: 'scheduled',
  scheduledTime: new Date(Date.now() + 3600000) // 1 hour from now
});

// Manual cleanup (requires confirmation)
const deint = await deintegrationManager.deintegrate(integrationId, {
  policy: 'manual'
});

// Later, confirm the cleanup
await deintegrationManager.confirmManualCleanup(deint.id);
```

## Monitoring Integration Health

```javascript
// monitor-integration.js
async function monitorIntegration(hub, integrationId) {
  // Check integration health
  const health = await hub.checkIntegrationHealth(integrationId);
  console.log('Integration health:', health);

  // Get integration metrics
  const metrics = await hub.getIntegrationMetrics(integrationId);
  console.log('Integration metrics:', metrics);

  // Subscribe to integration events
  hub.on(`integration:${integrationId}:error`, (error) => {
    console.error('Integration error:', error);
  });

  hub.on(`integration:${integrationId}:disconnected`, () => {
    console.warn('Integration disconnected');
  });

  hub.on(`integration:${integrationId}:reconnected`, () => {
    console.log('Integration reconnected');
  });
}
```

## Complete Workflow Example

```javascript
// complete-workflow.js
import { runCompleteWorkflow } from './complete-workflow.js';

async function main() {
  try {
    // 1. Integrate Claude Code UI
    const { hub, integration } = await integrateClaudeCodeUI();
    
    // 2. Use the integration
    await useClaudeCodeUI(hub, integration.id);
    
    // 3. Monitor health
    await monitorIntegration(hub, integration.id);
    
    // 4. Wait for user action
    console.log('Integration active. Press Ctrl+C to de-integrate...');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nDe-integrating Claude Code UI...');
      
      // 5. De-integrate
      const deintegration = await deintegrateClaudeCodeUI(hub, integration.id);
      
      console.log('Cleanup completed. State saved to:', deintegration.id);
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Workflow error:', error);
    process.exit(1);
  }
}

// Run the complete workflow
main();
```

## Best Practices

1. **Always use graceful de-integration** unless there's an emergency
2. **Preserve data** for critical integrations to allow re-integration
3. **Monitor health** regularly to detect issues early
4. **Handle reconnections** properly for resilient integrations
5. **Test de-integration** in development before production use

## Troubleshooting

### Integration fails to connect
- Check Claude Code UI is running on the expected ports
- Verify no firewall blocking connections
- Check logs for detailed error messages

### De-integration hangs
- Use `force: true` option for immediate cleanup
- Check for stuck operations in logs
- Manually stop dependent services if needed

### Re-integration fails
- Verify saved state file exists
- Check adapter version compatibility
- Ensure required services are running