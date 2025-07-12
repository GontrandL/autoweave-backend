#!/bin/bash

# Check all AutoWeave Backend dependencies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
check_service() {
    local name=$1
    local host=$2
    local port=$3
    local optional=${4:-false}
    
    echo -n "Checking $name ($host:$port)... "
    
    if nc -z -w2 "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✅ Available${NC}"
        return 0
    else
        if [ "$optional" = true ]; then
            echo -e "${YELLOW}⚠️  Not available (optional)${NC}"
            return 0
        else
            echo -e "${RED}❌ Not available (required)${NC}"
            return 1
        fi
    fi
}

# Header
echo -e "${BLUE}AutoWeave Backend Dependency Check${NC}"
echo "=================================="
echo ""

# Required services
echo -e "${BLUE}Required Services:${NC}"
REQUIRED_OK=true

check_service "Redis" "localhost" "6379" || REQUIRED_OK=false
check_service "Neo4j Bolt" "localhost" "7687" || REQUIRED_OK=false
check_service "Neo4j Browser" "localhost" "7474" || REQUIRED_OK=false
check_service "Qdrant" "localhost" "6333" || REQUIRED_OK=false

echo ""

# Optional services
echo -e "${BLUE}Optional Services:${NC}"
check_service "AutoWeave Core" "localhost" "3000" true
check_service "ANP Server" "localhost" "8083" true
check_service "Prometheus" "localhost" "9091" true
check_service "Grafana" "localhost" "3003" true
check_service "Jaeger" "localhost" "14268" true

echo ""

# Backend status
echo -e "${BLUE}Backend Status:${NC}"
check_service "Backend API" "localhost" "3001" true
check_service "Backend Metrics" "localhost" "9090" true

echo ""

# Docker status
echo -e "${BLUE}Docker Services:${NC}"
if command -v docker &> /dev/null; then
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(autoweave|redis|neo4j|qdrant)" || echo "No AutoWeave containers running"
else
    echo -e "${YELLOW}Docker not installed${NC}"
fi

echo ""

# Summary
if [ "$REQUIRED_OK" = true ]; then
    echo -e "${GREEN}✅ All required dependencies are available!${NC}"
    echo ""
    echo "You can start the backend with:"
    echo "  npm start"
else
    echo -e "${RED}❌ Some required dependencies are missing!${NC}"
    echo ""
    echo "To deploy all dependencies, run:"
    echo "  ./scripts/deploy-stack.sh"
fi