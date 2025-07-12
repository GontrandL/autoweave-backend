# 🚀 AutoWeave Backend - Startup Guide

This guide covers all the ways to start and manage the AutoWeave Backend, from quick development mode to full production deployment.

## 📋 Table of Contents

1. [Quick Start Options](#quick-start-options)
2. [Deployment Methods](#deployment-methods)
3. [Development Modes](#development-modes)
4. [Monitoring & Health](#monitoring--health)
5. [Troubleshooting](#troubleshooting)
6. [Advanced Configuration](#advanced-configuration)

## 🏃 Quick Start Options

### Fastest Start (Mock Mode)
```bash
npm run dev:quick
```
- ⚡ Starts in ~5 seconds
- 🔌 No external dependencies
- 🧪 Uses mock adapters
- 🔥 Hot reload enabled

### Development with Redis Only
```bash
npm run dev:redis
```
- 📦 Starts Redis in Docker
- 🔄 Real event bus
- 🗄️ Session storage
- 🚀 Good for API development

### Full Stack Deployment
```bash
npm run deploy
```
- 🐳 All services in Docker
- ✅ Production-like environment
- 📊 Full monitoring
- 🔒 Secure defaults

## 🚀 Deployment Methods

### 1. Standard Deployment (`deploy-stack.sh`)

The enhanced deployment script now includes:
- 📊 Visual progress bar
- 🔄 Intelligent retry mechanism
- 🏥 Comprehensive health checks
- 📈 Resource usage monitoring

```bash
# Basic deployment
./scripts/deploy-stack.sh

# Full stack with monitoring
./scripts/deploy-stack.sh --full
```

**Features:**
- ✅ Prerequisites check (Docker, memory, disk, ports)
- ✅ Step-by-step progress visualization
- ✅ Service health monitoring
- ✅ Automatic retry on failures
- ✅ Detailed verification report

### 2. Advanced Startup Manager (`startup-manager.sh`)

Professional orchestration with real-time dashboard:

```bash
# Interactive startup with dashboard
./scripts/startup-manager.sh

# Check current status
./scripts/startup-manager.sh --status

# View startup logs
./scripts/startup-manager.sh --logs
```

**Dashboard Features:**
- 📊 Real-time service status table
- ⏱️ Service startup timings
- 🔄 Dependency management
- 📝 Live activity log
- 🎯 Automatic retry handling

### 3. Development Mode (`dev-mode.sh`)

Flexible development environment:

```bash
# Degraded mode (no dependencies)
./scripts/dev-mode.sh

# Mock mode (fake services)
./scripts/dev-mode.sh --mock

# Minimal mode (Redis only)
./scripts/dev-mode.sh --redis

# No Docker mode (local services)
./scripts/dev-mode.sh --no-docker
```

## 🔧 Development Modes

### Degraded Mode
The backend now supports running without all dependencies:

```javascript
// Automatic detection and graceful degradation
if (!redis) {
  logger.warn('Redis unavailable - running in degraded mode');
  // Authentication disabled
  // Session storage disabled
  // Event bus limited
}
```

**Available in Degraded Mode:**
- ✅ Health endpoints
- ✅ Basic API routes
- ✅ Mock authentication
- ✅ Limited functionality

**Unavailable:**
- ❌ Real authentication
- ❌ Data persistence
- ❌ Analytics
- ❌ Integration hub

### Mock Mode
Perfect for frontend development:

```bash
USE_MOCK_ADAPTERS=true npm start
```

**Mock Implementations:**
- 🎭 In-memory data storage
- 🎭 Simulated delays
- 🎭 Fake responses
- 🎭 Error simulation

## 📊 Monitoring & Health

### Health Monitor (`health-monitor.sh`)

Continuous monitoring with auto-recovery:

```bash
# Basic monitoring
npm run monitor

# With auto-restart
npm run monitor:auto

# Custom settings
./scripts/health-monitor.sh --interval 5 --webhook https://alerts.example.com
```

**Monitor Features:**
- 📈 Real-time health dashboard
- 🔄 Automatic service restart
- 📧 Webhook alerts
- 📊 Uptime tracking
- 💾 History recording
- 🖥️ Resource monitoring

### Health Endpoints

Enhanced health check with detailed status:

```bash
# Check overall health
curl http://localhost:3001/health

# Response includes:
{
  "status": "healthy|warning|degraded",
  "services": {
    "redis": "healthy|degraded|unavailable",
    "neo4j": "healthy|unavailable",
    "qdrant": "healthy|unavailable",
    "core": "connected|disconnected"
  },
  "mode": "full|degraded",
  "message": "Descriptive status message"
}
```

## 🔍 Troubleshooting

### Service Won't Start

1. **Check Prerequisites:**
   ```bash
   ./scripts/check-dependencies.sh
   ```

2. **View Detailed Logs:**
   ```bash
   docker-compose logs -f [service-name]
   ```

3. **Reset and Retry:**
   ```bash
   docker-compose down -v
   ./scripts/deploy-stack.sh
   ```

### Running in Degraded Mode

If services fail to start, the backend automatically degrades:

```log
RUNNING IN DEGRADED MODE
Unavailable services: Redis, Neo4j
Some functionality may be limited
```

### Port Conflicts

The deploy script now checks ports before starting:
- 3001 (Backend API)
- 6379 (Redis)
- 7474 (Neo4j Browser)
- 7687 (Neo4j Bolt)
- 6333 (Qdrant)
- 9090 (Metrics)

## ⚙️ Advanced Configuration

### Docker Compose Override

Create custom configurations without modifying the main file:

```bash
# Copy example
cp docker-compose.override.example.yml docker-compose.override.yml

# Edit as needed
vim docker-compose.override.yml
```

Common overrides:
- Resource limits
- Volume mounts
- Environment variables
- Additional services

### Environment Variables

For development mode:
```bash
# Created automatically by dev-mode.sh
cat .env.development
```

Key variables:
- `DISABLE_REDIS` - Run without Redis
- `USE_MOCK_ADAPTERS` - Use mock implementations
- `LOG_LEVEL` - Set to 'debug' for verbose output
- `SHOW_STACK_TRACES` - Show full errors

### NPM Scripts

Convenient commands added:
```json
{
  "scripts": {
    "deploy": "./scripts/deploy-stack.sh",
    "deploy:full": "./scripts/deploy-stack.sh --full",
    "startup": "./scripts/startup-manager.sh",
    "monitor": "./scripts/health-monitor.sh",
    "monitor:auto": "./scripts/health-monitor.sh --auto-restart",
    "dev:quick": "./scripts/dev-mode.sh quick",
    "dev:mock": "./scripts/dev-mode.sh --mock",
    "dev:redis": "./scripts/dev-mode.sh --redis"
  }
}
```

## 📚 Best Practices

### For Development
1. Use `npm run dev:quick` for fastest iteration
2. Use `npm run dev:redis` when testing real Redis features
3. Enable `DEBUG=autoweave:*` for detailed logs

### For Testing
1. Use `npm run deploy` for integration tests
2. Use `npm run monitor` to watch service health
3. Check logs with `docker-compose logs -f`

### For Production
1. Always use `./scripts/deploy-stack.sh --full`
2. Enable monitoring with `npm run monitor:auto`
3. Configure proper resource limits in override file
4. Set up webhook alerts for critical failures

## 🎯 Summary

The AutoWeave Backend now offers:
- **Flexible Startup**: From mock mode to full production
- **Graceful Degradation**: Continues working with missing services
- **Visual Feedback**: Progress bars and real-time dashboards
- **Auto-Recovery**: Automatic restart of failed services
- **Developer-Friendly**: Quick start options and hot reload

Choose the right mode for your needs:
- 🏃 **Quick Development**: `npm run dev:quick`
- 🧪 **Testing**: `npm run dev:redis`
- 🚀 **Full Stack**: `npm run deploy`
- 📊 **Monitoring**: `npm run monitor:auto`