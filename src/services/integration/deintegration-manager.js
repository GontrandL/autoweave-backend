import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * De-integration Manager
 * Manages the clean removal and restoration of integrations
 * 
 * Features:
 * - Safe removal of integrations with state preservation
 * - Rollback capabilities
 * - Cleanup verification
 * - Integration history tracking
 */
export default class DeintegrationManager extends EventEmitter {
  constructor({ logger, config, storageAdapters }) {
    super();
    this.logger = logger;
    this.config = config;
    this.storageAdapters = storageAdapters;
    
    // De-integration state storage
    this.deintegrationPath = config.deintegrationPath || './data/deintegrations';
    this.deintegrationHistory = new Map();
    this.activeDeintegrations = new Map();
    
    // Cleanup policies
    this.cleanupPolicies = {
      immediate: this.immediateCleanup.bind(this),
      graceful: this.gracefulCleanup.bind(this),
      scheduled: this.scheduledCleanup.bind(this),
      manual: this.manualCleanup.bind(this)
    };
  }

  /**
   * Initialize de-integration manager
   */
  async init() {
    try {
      // Create de-integration storage directory
      await fs.mkdir(this.deintegrationPath, { recursive: true });
      
      // Load de-integration history
      await this.loadDeintegrationHistory();
      
      this.logger.info('De-integration manager initialized', {
        historySize: this.deintegrationHistory.size
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize de-integration manager', error);
      throw error;
    }
  }

  /**
   * De-integrate a service/adapter
   */
  async deintegrate(integrationId, options = {}) {
    const {
      policy = 'graceful',
      preserveData = true,
      notifyDependents = true,
      force = false
    } = options;
    
    this.logger.info('Starting de-integration', {
      integrationId,
      policy,
      preserveData
    });
    
    try {
      // Create de-integration record
      const deintegration = {
        id: `deint-${Date.now()}-${integrationId}`,
        integrationId,
        startTime: new Date(),
        policy,
        options,
        status: 'in_progress',
        steps: []
      };
      
      this.activeDeintegrations.set(integrationId, deintegration);
      this.emit('deintegration:started', deintegration);
      
      // Step 1: Validate de-integration is safe
      if (!force) {
        await this.validateDeintegration(integrationId, deintegration);
      }
      
      // Step 2: Notify dependent services
      if (notifyDependents) {
        await this.notifyDependents(integrationId, deintegration);
      }
      
      // Step 3: Save integration state
      if (preserveData) {
        await this.saveIntegrationState(integrationId, deintegration);
      }
      
      // Step 4: Execute cleanup policy
      const cleanupPolicy = this.cleanupPolicies[policy];
      if (!cleanupPolicy) {
        throw new Error(`Unknown cleanup policy: ${policy}`);
      }
      
      await cleanupPolicy(integrationId, deintegration);
      
      // Step 5: Verify cleanup
      await this.verifyCleanup(integrationId, deintegration);
      
      // Step 6: Update records
      deintegration.endTime = new Date();
      deintegration.status = 'completed';
      deintegration.duration = deintegration.endTime - deintegration.startTime;
      
      // Save to history
      await this.saveDeintegrationRecord(deintegration);
      this.deintegrationHistory.set(integrationId, deintegration);
      this.activeDeintegrations.delete(integrationId);
      
      this.emit('deintegration:completed', deintegration);
      
      return deintegration;
      
    } catch (error) {
      this.logger.error('De-integration failed', {
        integrationId,
        error: error.message
      });
      
      // Update deintegration record
      const deintegration = this.activeDeintegrations.get(integrationId);
      if (deintegration) {
        deintegration.status = 'failed';
        deintegration.error = error.message;
        deintegration.endTime = new Date();
        await this.saveDeintegrationRecord(deintegration);
      }
      
      throw error;
    }
  }

  /**
   * Validate that de-integration is safe
   */
  async validateDeintegration(integrationId, deintegration) {
    const step = {
      name: 'validation',
      startTime: new Date(),
      checks: []
    };
    
    try {
      // Check for active connections
      const activeConnections = await this.checkActiveConnections(integrationId);
      step.checks.push({
        name: 'active_connections',
        passed: activeConnections === 0,
        value: activeConnections
      });
      
      if (activeConnections > 0) {
        throw new Error(`Integration has ${activeConnections} active connections`);
      }
      
      // Check for pending operations
      const pendingOps = await this.checkPendingOperations(integrationId);
      step.checks.push({
        name: 'pending_operations',
        passed: pendingOps === 0,
        value: pendingOps
      });
      
      if (pendingOps > 0) {
        throw new Error(`Integration has ${pendingOps} pending operations`);
      }
      
      // Check dependencies
      const dependencies = await this.checkDependencies(integrationId);
      step.checks.push({
        name: 'dependencies',
        passed: dependencies.length === 0,
        value: dependencies
      });
      
      if (dependencies.length > 0) {
        throw new Error(`Integration has active dependencies: ${dependencies.join(', ')}`);
      }
      
      step.status = 'passed';
      step.endTime = new Date();
      deintegration.steps.push(step);
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      deintegration.steps.push(step);
      throw error;
    }
  }

  /**
   * Notify dependent services about de-integration
   */
  async notifyDependents(integrationId, deintegration) {
    const step = {
      name: 'notify_dependents',
      startTime: new Date(),
      notifications: []
    };
    
    try {
      // Get list of dependents
      const dependents = await this.getDependents(integrationId);
      
      // Notify each dependent
      for (const dependent of dependents) {
        try {
          await this.notifyService(dependent, {
            type: 'integration:removing',
            integrationId,
            deintegrationId: deintegration.id,
            scheduledTime: new Date(Date.now() + 60000) // 1 minute grace period
          });
          
          step.notifications.push({
            service: dependent,
            status: 'notified'
          });
        } catch (error) {
          step.notifications.push({
            service: dependent,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      step.status = 'completed';
      step.endTime = new Date();
      deintegration.steps.push(step);
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      deintegration.steps.push(step);
      throw error;
    }
  }

  /**
   * Save integration state before removal
   */
  async saveIntegrationState(integrationId, deintegration) {
    const step = {
      name: 'save_state',
      startTime: new Date()
    };
    
    try {
      // Get integration instance
      const integration = await this.getIntegration(integrationId);
      
      if (!integration) {
        throw new Error('Integration not found');
      }
      
      // Save state using adapter's saveState method
      let state = {};
      if (typeof integration.saveState === 'function') {
        state = await integration.saveState();
      }
      
      // Add metadata
      const stateRecord = {
        integrationId,
        deintegrationId: deintegration.id,
        timestamp: new Date(),
        state,
        metadata: {
          adapterType: integration.constructor.name,
          version: integration.version || '1.0.0'
        }
      };
      
      // Save to file
      const statePath = path.join(
        this.deintegrationPath,
        `${deintegration.id}-state.json`
      );
      
      await fs.writeFile(
        statePath,
        JSON.stringify(stateRecord, null, 2)
      );
      
      step.status = 'completed';
      step.statePath = statePath;
      step.stateSize = JSON.stringify(state).length;
      step.endTime = new Date();
      deintegration.steps.push(step);
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      deintegration.steps.push(step);
      throw error;
    }
  }

  /**
   * Immediate cleanup - remove everything now
   */
  async immediateCleanup(integrationId, deintegration) {
    const step = {
      name: 'immediate_cleanup',
      startTime: new Date()
    };
    
    try {
      const integration = await this.getIntegration(integrationId);
      
      if (integration && typeof integration.cleanup === 'function') {
        await integration.cleanup();
      }
      
      // Remove from active integrations
      await this.removeIntegration(integrationId);
      
      step.status = 'completed';
      step.endTime = new Date();
      deintegration.steps.push(step);
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      deintegration.steps.push(step);
      throw error;
    }
  }

  /**
   * Graceful cleanup - wait for operations to complete
   */
  async gracefulCleanup(integrationId, deintegration) {
    const step = {
      name: 'graceful_cleanup',
      startTime: new Date()
    };
    
    try {
      const integration = await this.getIntegration(integrationId);
      
      if (!integration) {
        step.status = 'skipped';
        deintegration.steps.push(step);
        return;
      }
      
      // Stop accepting new operations
      if (typeof integration.stopAcceptingOperations === 'function') {
        await integration.stopAcceptingOperations();
      }
      
      // Wait for pending operations
      const maxWait = 60000; // 1 minute
      const startWait = Date.now();
      
      while (Date.now() - startWait < maxWait) {
        const pendingOps = await this.checkPendingOperations(integrationId);
        if (pendingOps === 0) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Cleanup
      if (typeof integration.cleanup === 'function') {
        await integration.cleanup();
      }
      
      // Remove from active integrations
      await this.removeIntegration(integrationId);
      
      step.status = 'completed';
      step.endTime = new Date();
      deintegration.steps.push(step);
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      deintegration.steps.push(step);
      throw error;
    }
  }

  /**
   * Scheduled cleanup - cleanup at a specific time
   */
  async scheduledCleanup(integrationId, deintegration, scheduledTime) {
    const step = {
      name: 'scheduled_cleanup',
      startTime: new Date(),
      scheduledFor: scheduledTime || new Date(Date.now() + 3600000) // 1 hour
    };
    
    try {
      // Schedule the cleanup
      const delay = step.scheduledFor - Date.now();
      
      if (delay > 0) {
        setTimeout(async () => {
          await this.gracefulCleanup(integrationId, deintegration);
        }, delay);
        
        step.status = 'scheduled';
      } else {
        // If scheduled time is in the past, cleanup immediately
        await this.gracefulCleanup(integrationId, deintegration);
        step.status = 'completed';
      }
      
      step.endTime = new Date();
      deintegration.steps.push(step);
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      deintegration.steps.push(step);
      throw error;
    }
  }

  /**
   * Manual cleanup - user must manually confirm
   */
  async manualCleanup(integrationId, deintegration) {
    const step = {
      name: 'manual_cleanup',
      startTime: new Date()
    };
    
    step.status = 'awaiting_confirmation';
    step.instructions = 'Manual cleanup required. Call confirmManualCleanup() when ready.';
    step.endTime = new Date();
    deintegration.steps.push(step);
    
    // Store for later confirmation
    this.emit('deintegration:manual_required', {
      integrationId,
      deintegrationId: deintegration.id
    });
  }

  /**
   * Confirm manual cleanup
   */
  async confirmManualCleanup(deintegrationId) {
    const deintegration = Array.from(this.activeDeintegrations.values())
      .find(d => d.id === deintegrationId);
    
    if (!deintegration) {
      throw new Error('De-integration not found');
    }
    
    await this.gracefulCleanup(deintegration.integrationId, deintegration);
  }

  /**
   * Verify cleanup was successful
   */
  async verifyCleanup(integrationId, deintegration) {
    const step = {
      name: 'verify_cleanup',
      startTime: new Date(),
      checks: []
    };
    
    try {
      // Check integration is removed
      const integration = await this.getIntegration(integrationId);
      step.checks.push({
        name: 'integration_removed',
        passed: !integration
      });
      
      // Check no active connections
      const connections = await this.checkActiveConnections(integrationId);
      step.checks.push({
        name: 'no_active_connections',
        passed: connections === 0,
        value: connections
      });
      
      // Check no resources left
      const resources = await this.checkResources(integrationId);
      step.checks.push({
        name: 'resources_cleaned',
        passed: resources.length === 0,
        value: resources
      });
      
      const allPassed = step.checks.every(check => check.passed);
      
      if (!allPassed) {
        throw new Error('Cleanup verification failed');
      }
      
      step.status = 'passed';
      step.endTime = new Date();
      deintegration.steps.push(step);
      
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      deintegration.steps.push(step);
      throw error;
    }
  }

  /**
   * Re-integrate a previously de-integrated service
   */
  async reintegrate(deintegrationId) {
    this.logger.info('Starting re-integration', { deintegrationId });
    
    try {
      // Load de-integration record
      const deintegration = await this.loadDeintegrationRecord(deintegrationId);
      
      if (!deintegration) {
        throw new Error('De-integration record not found');
      }
      
      // Load saved state
      const statePath = path.join(
        this.deintegrationPath,
        `${deintegrationId}-state.json`
      );
      
      const stateData = await fs.readFile(statePath, 'utf-8');
      const stateRecord = JSON.parse(stateData);
      
      // Re-create integration
      const integration = await this.createIntegration(
        stateRecord.metadata.adapterType,
        stateRecord.state
      );
      
      // Restore state
      if (typeof integration.restoreState === 'function') {
        await integration.restoreState(stateRecord.state);
      }
      
      // Re-activate
      await this.activateIntegration(
        stateRecord.integrationId,
        integration
      );
      
      this.emit('reintegration:completed', {
        deintegrationId,
        integrationId: stateRecord.integrationId
      });
      
      return integration;
      
    } catch (error) {
      this.logger.error('Re-integration failed', {
        deintegrationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get de-integration history
   */
  async getDeintegrationHistory(integrationId) {
    if (integrationId) {
      return this.deintegrationHistory.get(integrationId);
    }
    
    return Array.from(this.deintegrationHistory.values());
  }

  /**
   * Load de-integration history from disk
   */
  async loadDeintegrationHistory() {
    try {
      const files = await fs.readdir(this.deintegrationPath);
      
      for (const file of files) {
        if (file.endsWith('-record.json')) {
          const recordPath = path.join(this.deintegrationPath, file);
          const data = await fs.readFile(recordPath, 'utf-8');
          const record = JSON.parse(data);
          
          this.deintegrationHistory.set(record.integrationId, record);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load de-integration history', error);
    }
  }

  /**
   * Save de-integration record
   */
  async saveDeintegrationRecord(deintegration) {
    const recordPath = path.join(
      this.deintegrationPath,
      `${deintegration.id}-record.json`
    );
    
    await fs.writeFile(
      recordPath,
      JSON.stringify(deintegration, null, 2)
    );
  }

  /**
   * Load de-integration record
   */
  async loadDeintegrationRecord(deintegrationId) {
    const recordPath = path.join(
      this.deintegrationPath,
      `${deintegrationId}-record.json`
    );
    
    try {
      const data = await fs.readFile(recordPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  // Helper methods (these would be implemented based on your specific system)
  async checkActiveConnections(integrationId) {
    // Implementation depends on your system
    return 0;
  }
  
  async checkPendingOperations(integrationId) {
    // Implementation depends on your system
    return 0;
  }
  
  async checkDependencies(integrationId) {
    // Implementation depends on your system
    return [];
  }
  
  async getDependents(integrationId) {
    // Implementation depends on your system
    return [];
  }
  
  async notifyService(service, notification) {
    // Implementation depends on your system
    this.emit('service:notified', { service, notification });
  }
  
  async getIntegration(integrationId) {
    // Implementation depends on your system
    return null;
  }
  
  async removeIntegration(integrationId) {
    // Implementation depends on your system
  }
  
  async checkResources(integrationId) {
    // Implementation depends on your system
    return [];
  }
  
  async createIntegration(adapterType, state) {
    // Implementation depends on your system
    return null;
  }
  
  async activateIntegration(integrationId, integration) {
    // Implementation depends on your system
  }
}

export default DeintegrationManager;