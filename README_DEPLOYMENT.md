# AutoWeave Backend Deployment Guide

## 🏗️ Architecture Overview

AutoWeave Backend requires several services to function properly:

```
┌─────────────────────────────────────────────────────────────┐
│                   AutoWeave Backend Stack                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │    Redis    │  │   Neo4j     │  │   Qdrant     │       │
│  │  Port 6379  │  │  Port 7687  │  │  Port 6333   │       │
│  │ Event Bus & │  │   Graph     │  │   Vector     │       │
│  │    Cache    │  │  Database   │  │  Database    │       │
│  └─────────────┘  └─────────────┘  └──────────────┘       │
│         ↑                ↑                 ↑                │
│         └────────────────┴─────────────────┘                │
│                          ↓                                  │
│                ┌─────────────────┐                         │
│                │ AutoWeave       │                         │
│                │   Backend       │                         │
│                │  Port 3001 API  │                         │
│                │  Port 9090 Metrics                        │
│                └─────────────────┘                         │
│                                                             │
│  Optional Services:                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐       │
│  │ AutoWeave   │  │ Prometheus  │  │   Grafana    │       │
│  │    Core     │  │  Port 9091  │  │  Port 3003   │       │
│  │ Port 3000   │  │   Metrics   │  │  Dashboards  │       │
│  └─────────────┘  └─────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 1.29+
- 4GB RAM minimum
- 10GB disk space

### 1-Command Deployment

```bash
# Clone the repository
git clone <repository-url>
cd autoweave-backend

# Deploy everything
./scripts/deploy-stack.sh
```

This will:
1. Check prerequisites
2. Create .env from template
3. Build the backend image
4. Start all required services
5. Wait for health checks
6. Verify the deployment

## 📦 Services

### Required Services

| Service | Port | Purpose | Health Check |
|---------|------|---------|--------------|
| Redis | 6379 | Event bus, caching, sessions | `redis-cli ping` |
| Neo4j | 7687, 7474 | Graph database for relationships | HTTP on 7474 |
| Qdrant | 6333, 6334 | Vector database for embeddings | HTTP on 6333/health |

### Optional Services

| Service | Port | Purpose |
|---------|------|---------|
| AutoWeave Core | 3000, 8083 | Main orchestrator with ANP |
| Prometheus | 9091 | Metrics collection |
| Grafana | 3003 | Monitoring dashboards |
| Jaeger | 14268, 16686 | Distributed tracing |

## 🔧 Configuration

### Environment Variables

Copy `.env.docker` to `.env` and adjust:

```bash
cp .env.docker .env
```

Key variables to configure:
- `JWT_SECRET` - Change in production!
- `NEO4J_PASSWORD` - Default: password
- `OPENAI_API_KEY` - If using embeddings
- Redis/Neo4j/Qdrant hosts (default: service names)

### Networking

All services communicate on the `autoweave-network` (172.20.0.0/16).

## 🏃 Running Different Configurations

### Basic Stack (Required Services Only)
```bash
docker-compose up -d
```

### Full Stack (With Monitoring)
```bash
./scripts/deploy-stack.sh --full
# OR
docker-compose -f docker-compose.full-stack.yml up -d
```

### Development Mode
```bash
# Use local services
REDIS_HOST=localhost NEO4J_URI=bolt://localhost:7687 npm start
```

### Standalone Mode (No External Dependencies)
```bash
DISABLE_REDIS=true npm start
```

## 🔍 Verification

### Check Dependencies
```bash
./scripts/check-dependencies.sh
```

### Health Checks
```bash
# Backend health
curl http://localhost:3001/health

# Service status
docker-compose ps

# View logs
docker-compose logs -f autoweave-backend
```

## 📊 Monitoring

If deployed with `--full`:

- **Grafana**: http://localhost:3003 (admin/admin123)
- **Prometheus**: http://localhost:9091
- **Jaeger UI**: http://localhost:16686

## 🛠️ Troubleshooting

### Service Won't Start

1. Check logs:
   ```bash
   docker-compose logs <service-name>
   ```

2. Verify ports are free:
   ```bash
   ./scripts/check-dependencies.sh
   ```

3. Check Docker resources:
   ```bash
   docker system df
   docker stats
   ```

### Connection Errors

1. Verify network:
   ```bash
   docker network ls
   docker network inspect autoweave-backend_autoweave-network
   ```

2. Test connectivity:
   ```bash
   docker-compose exec autoweave-backend ping redis
   ```

### Performance Issues

1. Check resource usage:
   ```bash
   docker stats
   ```

2. Increase memory limits in docker-compose.yml

3. Check slow queries in logs

## 🔄 Maintenance

### Backup Data
```bash
# Backup all volumes
docker run --rm -v autoweave-backend_redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .
docker run --rm -v autoweave-backend_neo4j-data:/data -v $(pwd):/backup alpine tar czf /backup/neo4j-backup.tar.gz -C /data .
docker run --rm -v autoweave-backend_qdrant-data:/data -v $(pwd):/backup alpine tar czf /backup/qdrant-backup.tar.gz -C /data .
```

### Update Services
```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

### Clean Up
```bash
# Stop services
docker-compose down

# Remove all data (CAUTION!)
docker-compose down -v

# Clean Docker system
docker system prune -a
```

## 🚨 Production Considerations

1. **Security**
   - Change all default passwords
   - Use secrets management
   - Enable TLS/SSL
   - Configure firewall rules

2. **Persistence**
   - Use external volumes or bind mounts
   - Regular backups
   - Consider managed databases

3. **Scaling**
   - Use Docker Swarm or Kubernetes
   - Configure replicas
   - Load balancing

4. **Monitoring**
   - Deploy full monitoring stack
   - Configure alerts
   - Log aggregation

## 📚 Next Steps

1. Access API documentation: http://localhost:3001/api-docs
2. Run the quick-start example: `cd examples/01-quick-start`
3. Deploy monitoring: `npm run monitoring:start`
4. Read the [API Documentation](./docs/API_DOCUMENTATION.md)