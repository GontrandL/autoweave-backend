#!/bin/bash

# AutoWeave Backend - Development Mode
# Starts the backend in development mode with minimal dependencies

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
DEV_ENV_FILE=".env.development"
MOCK_MODE=${MOCK_MODE:-false}
SERVICES_TO_START=""

# Functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Show help
show_help() {
    echo "AutoWeave Backend - Development Mode"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --mock          Use mock adapters instead of real services"
    echo "  --redis         Start only Redis (minimal mode)"
    echo "  --full          Start all services (same as deploy-stack.sh)"
    echo "  --no-docker     Run without Docker (requires local services)"
    echo "  --help, -h      Show this help"
    echo ""
    echo "Examples:"
    echo "  $0              # Start in degraded mode (no external services)"
    echo "  $0 --mock       # Start with mock adapters"
    echo "  $0 --redis      # Start with Redis only"
    echo "  $0 --full       # Start all services"
    echo ""
}

# Create development environment file
create_dev_env() {
    log_info "Creating development environment..."
    
    cat > "$DEV_ENV_FILE" << EOF
# Development Environment
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
DEBUG=autoweave:*

# Disable external services
DISABLE_REDIS=${DISABLE_REDIS:-false}
DISABLE_NEO4J=${DISABLE_NEO4J:-true}
DISABLE_QDRANT=${DISABLE_QDRANT:-true}
DISABLE_CORE=${DISABLE_CORE:-true}

# Use mock adapters
USE_MOCK_ADAPTERS=${USE_MOCK_ADAPTERS:-false}

# Development settings
SHOW_STACK_TRACES=true
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=1000

# JWT (development key - DO NOT USE IN PRODUCTION)
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Redis (if enabled)
REDIS_HOST=localhost
REDIS_PORT=6379

# Neo4j (if enabled)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Qdrant (if enabled)
QDRANT_HOST=localhost
QDRANT_PORT=6333

# AutoWeave Core (if enabled)
AUTOWEAVE_CORE_URL=http://localhost:3000
AUTOWEAVE_CORE_WS_URL=ws://localhost:3000/ws
ANP_SERVER_URL=http://localhost:8083

# Monitoring
METRICS_PORT=9090
PROMETHEUS_ENABLED=false
EOF

    log_success "Created $DEV_ENV_FILE"
}

# Start minimal services
start_minimal_services() {
    if [ -n "$SERVICES_TO_START" ]; then
        log_info "Starting services: $SERVICES_TO_START"
        docker-compose up -d $SERVICES_TO_START
        
        # Wait for services
        log_info "Waiting for services to be ready..."
        sleep 5
        
        # Check health
        if [ "$SERVICES_TO_START" = "redis" ] || [[ "$SERVICES_TO_START" == *"redis"* ]]; then
            if docker-compose exec -T redis redis-cli ping | grep -q PONG; then
                log_success "Redis is ready"
            else
                log_error "Redis failed to start"
            fi
        fi
    fi
}

# Start backend in development mode
start_backend() {
    log_info "Starting backend in development mode..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Are you in the project root?"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
    fi
    
    # Export environment
    export $(cat "$DEV_ENV_FILE" | grep -v '^#' | xargs)
    
    # Start with nodemon for hot reload
    if command -v nodemon &> /dev/null; then
        log_info "Starting with nodemon (hot reload enabled)..."
        npx nodemon src/index.js
    else
        log_info "Starting without hot reload (install nodemon for better DX)..."
        node src/index.js
    fi
}

# Stop development services
stop_dev_services() {
    log_info "Stopping development services..."
    
    if [ -n "$SERVICES_TO_START" ]; then
        docker-compose stop $SERVICES_TO_START
        docker-compose rm -f $SERVICES_TO_START
    fi
    
    log_success "Development services stopped"
}

# Main execution
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mock)
                MOCK_MODE=true
                USE_MOCK_ADAPTERS=true
                shift
                ;;
            --redis)
                SERVICES_TO_START="redis"
                DISABLE_REDIS=false
                shift
                ;;
            --full)
                log_info "Starting full stack..."
                exec ./scripts/deploy-stack.sh
                ;;
            --no-docker)
                SERVICES_TO_START=""
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Trap cleanup
    trap 'stop_dev_services' EXIT INT TERM
    
    # Display mode
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} ${WHITE}AutoWeave Backend - Development Mode${NC}                        ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ "$MOCK_MODE" = "true" ]; then
        log_info "Mode: Mock Adapters (no external dependencies)"
    elif [ -n "$SERVICES_TO_START" ]; then
        log_info "Mode: Minimal ($SERVICES_TO_START only)"
    else
        log_info "Mode: Degraded (no external services)"
    fi
    
    echo ""
    
    # Create dev environment
    create_dev_env
    
    # Start services if needed
    if [ -n "$SERVICES_TO_START" ]; then
        start_minimal_services
    fi
    
    # Start backend
    start_backend
}

# Quick start options
case "${1:-}" in
    quick)
        # Ultra-fast startup with mocks
        MOCK_MODE=true
        USE_MOCK_ADAPTERS=true
        main
        ;;
    *)
        main "$@"
        ;;
esac