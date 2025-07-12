#!/bin/bash

# Démarrer le backend pour les tests
echo "🚀 Démarrage d'AutoWeave Backend pour tests..."

# Variables d'environnement pour éviter les conflits de ports
export USE_MOCK_ADAPTERS=true
export DISABLE_REDIS=true
export DISABLE_NEO4J=true
export DISABLE_QDRANT=true
export NODE_ENV=development
export PORT=3001
export METRICS_PORT=9092
export LOG_LEVEL=info

# Arrêter les processus existants
pkill -f "node src/index.js" 2>/dev/null || true
lsof -ti:3001,9090,9091,9092 | xargs kill -9 2>/dev/null || true

# Attendre un peu
sleep 2

echo "📡 Variables d'environnement:"
echo "   PORT: $PORT"
echo "   METRICS_PORT: $METRICS_PORT"
echo "   Mode: Mock adapters activés"

# Démarrer le backend
echo ""
echo "🔧 Démarrage en mode test..."
node src/index.js