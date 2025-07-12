# AutoWeave Backend

A scalable, event-driven backend architecture for the AutoWeave ecosystem with seamless integration to AutoWeave Core.

## Overview

The AutoWeave Backend provides enterprise-grade services including analytics, data pipelines, integration hub, and advanced monitoring. It connects seamlessly with AutoWeave Core via WebSocket and HTTP APIs, extending the agent orchestration capabilities with powerful backend services.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AutoWeave Backend                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Service    │  │   Event Bus   │  │  AutoWeave   │ │
│  │   Manager    │  │  (Redis Pub/  │  │    Core      │ │
│  │             │  │     Sub)      │  │  Connector   │ │
│  └─────────────┘  └──────────────┘  └───────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  Services Layer                  │   │
│  ├─────────────┬───────────────┬──────────────────┤   │
│  │   Data      │  Integration  │    Analytics     │   │
│  │  Pipeline   │      Hub       │     Engine       │   │
│  └─────────────┴───────────────┴──────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │               Storage Adapters                   │   │
│  ├─────────────┬───────────────┬──────────────────┤   │
│  │   Qdrant    │     Redis      │  Neo4j/Memgraph  │   │
│  │  (Vector)   │    (Cache)     │     (Graph)      │   │
│  └─────────────┴───────────────┴──────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            ↕
                    WebSocket + HTTP
                            ↕
┌─────────────────────────────────────────────────────────┐
│                    AutoWeave Core                       │
│  (Agent Weaver, Memory System, MCP Discovery, ANP)      │
└─────────────────────────────────────────────────────────┘
```

### Core Components

#### AutoWeave Core Connector
- **Bidirectional Communication**: WebSocket + HTTP connection to Core
- **Service Registration**: Automatic registration via ANP (Agent Network Protocol)
- **Event Synchronization**: Real-time event forwarding between Core and Backend
- **Auto-reconnection**: Exponential backoff retry mechanism

#### Service Manager
- **Service Registry**: Dynamic service registration and discovery
- **Health Monitoring**: Real-time health checks and circuit breakers
- **Load Balancing**: Intelligent request distribution
- **Auto-scaling**: Dynamic scaling based on metrics

#### Data Pipeline
- **Stream Processing**: Real-time data transformation
- **Batch Processing**: Scheduled data processing jobs
- **ETL Operations**: Extract, Transform, Load workflows
- **Data Validation**: Schema validation and data quality checks

#### Event Bus
- **Pub/Sub Messaging**: Decoupled service communication
- **Event Sourcing**: Complete event history and replay
- **Message Queuing**: Reliable message delivery
- **Event Routing**: Intelligent event distribution

### Services

#### Analytics Service
- Real-time metrics collection
- Custom dashboards and reports
- Predictive analytics
- Performance insights

#### Integration Hub
- Third-party API integration
- Webhook management
- API gateway functionality
- Protocol translation

#### Cost Optimizer
- Resource usage tracking
- Cost allocation
- Optimization recommendations
- Budget alerts

#### Security Scanner
- Vulnerability detection
- Compliance checking
- Access control management
- Threat monitoring

#### Performance Service
- Application performance monitoring
- Resource optimization
- Bottleneck detection
- SLA tracking

### Auto-Integration System

#### Discovery
- Automatic service detection
- API endpoint discovery
- Schema inference
- Dependency mapping

#### Generator
- Integration code generation
- API client generation
- Documentation generation
- Test generation

#### Validator
- Integration testing
- Contract validation
- Performance validation
- Security validation

### Infrastructure

#### Monitoring
- Prometheus metrics
- Custom dashboards
- Alert management
- SLO/SLI tracking

#### Logging
- Centralized logging
- Log aggregation
- Search and analysis
- Log retention policies

#### Deployment
- CI/CD pipelines
- Blue-green deployments
- Canary releases
- Rollback automation

## Getting Started

### Prerequisites
- Node.js 18+
- Redis (for event bus)
- Qdrant (for vector storage)
- Neo4j (for graph data)
- AutoWeave Core (optional, for full integration)

### Installation
```bash
npm install
```

### Configuration
Create a `.env` file:
```env
NODE_ENV=development
PORT=3001

# AutoWeave Core Connection
AUTOWEAVE_CORE_URL=http://localhost:3000
AUTOWEAVE_CORE_WS_URL=ws://localhost:3000/ws
ANP_SERVER_URL=http://localhost:8083

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Monitoring
METRICS_PORT=9090
LOG_LEVEL=info
```

### Running
```bash
# Development (auto-connects to Core if available)
npm run dev

# Production
npm start

# Run with Core integration test
npm run test:integration

# Tests
npm test

# Start monitoring stack
npm run monitoring:start
```

## 🎓 Getting Started

### Quick Start (5 minutes)
```bash
# 1. Start the backend
npm start

# 2. Login and get a token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 3. View API documentation
open http://localhost:3001/api-docs

# 4. Check system health
curl http://localhost:3001/health
```

### Complete Tutorial
Follow our comprehensive tutorial to master AutoWeave Backend:

📖 **[Start the Tutorial](./TUTORIAL.md)** - From beginner to expert in 4 hours

### Examples and Use Cases

| Example | Description | Difficulty | Time |
|---------|-------------|------------|------|
| [01-quick-start](./examples/01-quick-start/) | Get up and running in 5 minutes | Beginner | 5 min |
| [02-authentication](./examples/02-authentication/) | JWT tokens, API keys, permissions | Beginner | 15 min |
| [03-service-management](./examples/03-service-management/) | Register and manage services | Beginner | 10 min |
| [04-rest-api-integration](./examples/04-rest-api-integration/) | Connect external REST APIs | Intermediate | 20 min |
| [05-database-integration](./examples/05-database-integration/) | Multi-database connections | Intermediate | 25 min |
| [06-event-driven](./examples/06-event-driven/) | Pub/sub and event sourcing | Intermediate | 15 min |
| [07-data-pipeline](./examples/07-data-pipeline/) | Build processing pipelines | Advanced | 30 min |
| [08-analytics](./examples/08-analytics/) | Track events and build dashboards | Advanced | 30 min |
| [09-monitoring](./examples/09-monitoring/) | Prometheus, Grafana, alerting | Advanced | 30 min |
| [10-ecommerce-backend](./examples/10-ecommerce-backend/) | Complete e-commerce solution | Expert | 120 min |

### Learning Paths

#### 🔰 For Backend Developers
`01 → 02 → 03 → 04 → 05 → 06 → 07 → 09 → 10`
*Focus: APIs, databases, microservices*

#### ⚙️ For DevOps Engineers  
`01 → 02 → 09 → 03 → 04 → 05 → 10`
*Focus: Monitoring, deployment, infrastructure*

#### 🎨 For Full-Stack Developers
`01 → 02 → 03 → 08 → 04 → 06 → 10`
*Focus: API integration, analytics, user-facing features*

#### 🏗️ For System Architects
`01 → 06 → 07 → 09 → 10 → 05 → 04`
*Focus: Architecture patterns, scalability, design*
```

## API Documentation

### Core Integration
- `GET /api/core/status` - Get Core connection status
- `POST /api/core/connect` - Connect to AutoWeave Core
- `POST /api/core/disconnect` - Disconnect from Core
- `GET /api/core/agents/:id` - Get agent from Core
- `POST /api/core/memory/search` - Search Core memory
- `POST /api/core/events` - Forward event to Core

### Service Registry
- `POST /api/services/register` - Register a new service
- `GET /api/services` - List all services
- `GET /api/services/:id/health` - Check service health
- `DELETE /api/services/:id` - Deregister service

### Event Bus
- `POST /api/events/publish` - Publish an event
- `GET /api/events/subscribe` - Subscribe to events (WebSocket)
- `GET /api/events/history` - Get event history

### Analytics
- `POST /api/analytics/metrics` - Send metrics
- `GET /api/analytics/dashboard` - Get dashboard data
- `POST /api/analytics/query` - Custom analytics query

## Architecture Patterns

### Microservices
- Service isolation
- Independent deployment
- Technology agnostic
- Fault tolerance

### Event-Driven
- Loose coupling
- Asynchronous communication
- Event sourcing
- CQRS pattern

### API Gateway
- Request routing
- Authentication
- Rate limiting
- Response caching

### Data Management
- Database per service
- Distributed transactions
- Data synchronization
- Cache strategies

## Development Guidelines

### Code Style
- ES6+ modules
- Async/await for asynchronous code
- JSDoc comments
- ESLint configuration

### Testing
- Unit tests for all services
- Integration tests for APIs
- Performance tests
- Security tests

### Monitoring
- Structured logging
- Distributed tracing
- Custom metrics
- Error tracking

### Security
- API authentication
- Data encryption
- Input validation
- Security headers

## Core Integration

The backend automatically connects to AutoWeave Core on startup, providing:

- **Service Registration**: All backend services are registered with Core via ANP
- **Event Forwarding**: Key events are synchronized between systems
- **Memory Access**: Direct access to Core's memory system
- **Agent Management**: Manage agents through backend APIs

See [CORE_INTEGRATION.md](docs/CORE_INTEGRATION.md) for detailed integration guide.

## Documentation

- [Analytics Engine Guide](docs/ANALYTICS_GUIDE.md) - Comprehensive analytics documentation
- [Core Integration Guide](docs/CORE_INTEGRATION.md) - AutoWeave Core integration details
- [API Reference](docs/API_REFERENCE.md) - Complete API documentation
- [Contributing Guide](docs/CONTRIBUTING.md) - Development guidelines

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.