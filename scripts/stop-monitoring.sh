#!/bin/bash

# AutoWeave Backend Monitoring Stop Script
# Stops Prometheus, Grafana, and AlertManager

set -e

echo "🛑 Stopping AutoWeave Backend Monitoring Stack..."

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi

# Stop containers
echo "🐳 Stopping monitoring containers..."
docker-compose -f docker-compose.monitoring.yml down

echo "✅ Monitoring stack stopped successfully!"

# Ask if user wants to remove volumes
read -p "🗑️  Do you want to remove persistent data volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing volumes..."
    docker-compose -f docker-compose.monitoring.yml down -v
    echo "✅ Volumes removed successfully!"
else
    echo "📦 Volumes preserved. Data will be available when you restart monitoring."
fi

echo ""
echo "💡 To start monitoring again:"
echo "   ./scripts/start-monitoring.sh"