import { EventEmitter } from 'events';
import WebSocket from 'ws';
import fetch from 'node-fetch';

/**
 * Claude Code UI Integration Adapter
 * Integrates siteboon/claudecodeui with AutoWeave Backend
 */
export default class ClaudeCodeUIAdapter extends EventEmitter {
  constructor({ config, logger }) {
    super();
    this.config = config;
    this.logger = logger;
    this.name = 'claude-code-ui';
    this.version = '1.0.0';
    
    // Default configuration
    this.apiUrl = config.apiUrl || 'http://localhost:5000';
    this.wsUrl = config.wsUrl || 'ws://localhost:5000/socket.io/';
    this.claudeProjectsPath = config.projectsPath || `${process.env.HOME}/.claude/projects/`;
    
    // Connection state
    this.connected = false;
    this.ws = null;
    this.sessions = new Map();
    this.integrationId = null;
  }

  /**
   * Initialize the integration
   */
  async init() {
    this.logger.info('Initializing Claude Code UI adapter', {
      apiUrl: this.apiUrl,
      projectsPath: this.claudeProjectsPath
    });

    try {
      // Test API connectivity
      const response = await fetch(`${this.apiUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`Claude Code UI API not available: ${response.statusText}`);
      }

      // Connect to WebSocket
      await this.connectWebSocket();
      
      this.connected = true;
      this.emit('connected');
      
      this.logger.info('Claude Code UI adapter initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Claude Code UI adapter', error);
      throw error;
    }
  }

  /**
   * Connect to Claude Code UI WebSocket
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.on('open', () => {
        this.logger.info('Connected to Claude Code UI WebSocket');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        this.handleWebSocketMessage(data);
      });
      
      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        this.logger.warn('WebSocket connection closed');
        this.connected = false;
        this.emit('disconnected');
        
        // Attempt reconnection
        setTimeout(() => this.reconnect(), 5000);
      });
    });
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'session:created':
          this.handleSessionCreated(message);
          break;
        case 'session:updated':
          this.handleSessionUpdated(message);
          break;
        case 'file:changed':
          this.handleFileChanged(message);
          break;
        case 'error':
          this.logger.error('Claude Code UI error', message);
          break;
        default:
          this.logger.debug('Unknown message type', message);
      }
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', error);
    }
  }

  /**
   * Process incoming data from Claude Code UI
   */
  async processData(data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'project:list':
        return await this.listProjects();
        
      case 'session:create':
        return await this.createSession(payload);
        
      case 'session:execute':
        return await this.executeInSession(payload);
        
      case 'file:read':
        return await this.readFile(payload);
        
      case 'file:write':
        return await this.writeFile(payload);
        
      default:
        throw new Error(`Unknown data type: ${type}`);
    }
  }

  /**
   * List available Claude projects
   */
  async listProjects() {
    const response = await fetch(`${this.apiUrl}/api/projects`);
    if (!response.ok) {
      throw new Error('Failed to list projects');
    }
    
    const projects = await response.json();
    
    // Transform to AutoWeave format
    return {
      type: 'project:list',
      data: projects.map(project => ({
        id: project.id,
        name: project.name,
        path: project.path,
        lastModified: project.lastModified,
        sessions: project.sessions || []
      }))
    };
  }

  /**
   * Create a new Claude Code session
   */
  async createSession({ projectId, description }) {
    const response = await fetch(`${this.apiUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        description,
        metadata: {
          source: 'autoweave',
          integrationId: this.integrationId
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create session');
    }
    
    const session = await response.json();
    this.sessions.set(session.id, session);
    
    return {
      type: 'session:created',
      data: session
    };
  }

  /**
   * Execute code in a Claude Code session
   */
  async executeInSession({ sessionId, code, language }) {
    const response = await fetch(`${this.apiUrl}/api/sessions/${sessionId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        language,
        timeout: 30000
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to execute code');
    }
    
    const result = await response.json();
    
    return {
      type: 'execution:result',
      data: {
        sessionId,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        duration: result.duration
      }
    };
  }

  /**
   * Read a file from Claude Code UI
   */
  async readFile({ path, sessionId }) {
    const response = await fetch(`${this.apiUrl}/api/files/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, sessionId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to read file');
    }
    
    const file = await response.json();
    
    return {
      type: 'file:content',
      data: file
    };
  }

  /**
   * Write a file via Claude Code UI
   */
  async writeFile({ path, content, sessionId }) {
    const response = await fetch(`${this.apiUrl}/api/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, sessionId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to write file');
    }
    
    return {
      type: 'file:written',
      data: { path, sessionId }
    };
  }

  /**
   * Handle session created event
   */
  handleSessionCreated(message) {
    const { session } = message;
    this.sessions.set(session.id, session);
    
    this.emit('data', {
      type: 'session:created',
      data: session
    });
  }

  /**
   * Handle session updated event
   */
  handleSessionUpdated(message) {
    const { session } = message;
    this.sessions.set(session.id, session);
    
    this.emit('data', {
      type: 'session:updated',
      data: session
    });
  }

  /**
   * Handle file changed event
   */
  handleFileChanged(message) {
    this.emit('data', {
      type: 'file:changed',
      data: message.file
    });
  }

  /**
   * Reconnect WebSocket
   */
  async reconnect() {
    if (this.connected) return;
    
    this.logger.info('Attempting to reconnect to Claude Code UI...');
    
    try {
      await this.connectWebSocket();
      this.connected = true;
      this.emit('reconnected');
    } catch (error) {
      this.logger.error('Reconnection failed', error);
      setTimeout(() => this.reconnect(), 10000);
    }
  }

  /**
   * Get integration capabilities
   */
  getCapabilities() {
    return {
      name: this.name,
      version: this.version,
      description: 'Claude Code UI integration for interactive coding sessions',
      features: [
        'project:management',
        'session:creation',
        'code:execution',
        'file:operations',
        'realtime:updates'
      ],
      configuration: {
        apiUrl: {
          type: 'string',
          description: 'Claude Code UI API URL',
          default: 'http://localhost:5000'
        },
        wsUrl: {
          type: 'string',
          description: 'Claude Code UI WebSocket URL',
          default: 'ws://localhost:5000/socket.io/'
        },
        projectsPath: {
          type: 'string',
          description: 'Path to Claude projects',
          default: '~/.claude/projects/'
        }
      }
    };
  }

  /**
   * Check if integration is healthy
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.apiUrl}/api/health`);
      return {
        healthy: response.ok && this.connected,
        details: {
          api: response.ok,
          websocket: this.connected,
          activeSessions: this.sessions.size
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup and disconnect (for de-integration)
   */
  async cleanup() {
    this.logger.info('Cleaning up Claude Code UI integration');
    
    // Close all active sessions
    for (const [sessionId, session] of this.sessions) {
      try {
        await fetch(`${this.apiUrl}/api/sessions/${sessionId}/close`, {
          method: 'POST'
        });
      } catch (error) {
        this.logger.error(`Failed to close session ${sessionId}`, error);
      }
    }
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear sessions
    this.sessions.clear();
    
    // Mark as disconnected
    this.connected = false;
    
    this.emit('cleanup:complete');
  }

  /**
   * Store integration state (for de-integration)
   */
  async saveState() {
    return {
      integrationId: this.integrationId,
      sessions: Array.from(this.sessions.entries()),
      configuration: {
        apiUrl: this.apiUrl,
        wsUrl: this.wsUrl,
        projectsPath: this.claudeProjectsPath
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Restore integration state
   */
  async restoreState(state) {
    this.integrationId = state.integrationId;
    
    // Restore sessions
    for (const [id, session] of state.sessions) {
      this.sessions.set(id, session);
    }
    
    // Restore configuration
    if (state.configuration) {
      this.apiUrl = state.configuration.apiUrl || this.apiUrl;
      this.wsUrl = state.configuration.wsUrl || this.wsUrl;
      this.claudeProjectsPath = state.configuration.projectsPath || this.claudeProjectsPath;
    }
    
    this.logger.info('Integration state restored', {
      sessionsRestored: this.sessions.size
    });
  }

  /**
   * Set integration ID
   */
  setIntegrationId(id) {
    this.integrationId = id;
  }
}

// Export adapter factory
export function createClaudeCodeUIAdapter(config) {
  return new ClaudeCodeUIAdapter(config);
}