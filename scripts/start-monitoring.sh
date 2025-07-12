#!/bin/bash

# AutoWeave Backend Monitoring Setup Script
# Starts Prometheus, Grafana, and AlertManager for monitoring

set -e

echo "🚀 Starting AutoWeave Backend Monitoring Stack..."

# Check if Docker and Docker Compose are available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories if they don't exist
echo "📁 Creating directory structure..."
mkdir -p logs monitoring/prometheus/data monitoring/grafana/data monitoring/alertmanager/data

# Set proper permissions for Grafana
echo "🔧 Setting up permissions..."
sudo chown -R 472:472 monitoring/grafana/data 2>/dev/null || echo "⚠️  Could not set Grafana permissions (may need to run with sudo)"

# Create Docker network if it doesn't exist
echo "🌐 Creating Docker network..."
docker network create autoweave-network 2>/dev/null || echo "ℹ️  Network already exists"

# Copy environment template if .env doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Grafana Configuration
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123

# AlertManager Configuration (optional)
SLACK_WEBHOOK_URL=
SMTP_USERNAME=
SMTP_PASSWORD=
PAGERDUTY_SERVICE_KEY=

# Prometheus retention
PROMETHEUS_RETENTION=30d
EOF
    echo "✅ Created .env file with default values"
fi

# Start monitoring stack
echo "🐳 Starting monitoring containers..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo "🔍 Checking service status..."

# Check Prometheus
if curl -s http://localhost:9091/api/v1/status/config > /dev/null 2>&1; then
    echo "✅ Prometheus is running at http://localhost:9091"
else
    echo "❌ Prometheus is not responding"
fi

# Check Grafana
if curl -s http://localhost:3003/api/health > /dev/null 2>&1; then
    echo "✅ Grafana is running at http://localhost:3003"
    echo "   Login: admin / admin123"
else
    echo "❌ Grafana is not responding"
fi

# Check AlertManager
if curl -s http://localhost:9093/api/v1/status > /dev/null 2>&1; then
    echo "✅ AlertManager is running at http://localhost:9093"
else
    echo "❌ AlertManager is not responding"
fi

# Check Node Exporter
if curl -s http://localhost:9100/metrics > /dev/null 2>&1; then
    echo "✅ Node Exporter is running at http://localhost:9100"
else
    echo "❌ Node Exporter is not responding"
fi

echo ""
echo "🎉 Monitoring stack started successfully!"
echo ""
echo "📊 Access Points:"
echo "   • Prometheus: http://localhost:9091"
echo "   • Grafana: http://localhost:3003 (admin/admin123)"
echo "   • AlertManager: http://localhost:9093"
echo "   • Node Exporter: http://localhost:9100"
echo ""
echo "📈 Default Dashboards:"
echo "   • AutoWeave Backend Overview"
echo "   • AutoWeave Services Detail"
echo ""
echo "🔧 To stop monitoring:"
echo "   docker-compose -f docker-compose.monitoring.yml down"
echo ""
echo "🗑️  To stop and remove volumes:"
echo "   docker-compose -f docker-compose.monitoring.yml down -v"