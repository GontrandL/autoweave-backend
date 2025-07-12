#!/bin/bash

# AutoWeave Backend - Full Stack Deployment Script
# Deploys all required services with health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
COMPOSE_FILE="docker-compose.yml"
FULL_STACK_FILE="docker-compose.full-stack.yml"
ENV_FILE=".env"
DOCKER_ENV_FILE=".env.docker"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed!"
        exit 1
    fi
    log_success "Docker installed: $(docker --version)"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed!"
        exit 1
    fi
    log_success "Docker Compose installed: $(docker-compose --version)"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running!"
        exit 1
    fi
    log_success "Docker daemon is running"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment..."
    
    # Create .env from template if it doesn't exist
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$DOCKER_ENV_FILE" ]; then
            log_info "Creating .env from .env.docker template..."
            cp "$DOCKER_ENV_FILE" "$ENV_FILE"
            log_success "Created .env file"
        else
            log_error ".env file not found and no template available!"
            exit 1
        fi
    else
        log_success ".env file exists"
    fi
    
    # Create necessary directories
    mkdir -p logs
    log_success "Created logs directory"
}

# Deploy stack
deploy_stack() {
    local compose_file="${1:-$COMPOSE_FILE}"
    
    log_info "Deploying stack using $compose_file..."
    
    # Pull latest images
    log_info "Pulling Docker images..."
    docker-compose -f "$compose_file" pull
    
    # Build backend image
    log_info "Building AutoWeave Backend image..."
    docker-compose -f "$compose_file" build --no-cache autoweave-backend
    
    # Start services
    log_info "Starting services..."
    docker-compose -f "$compose_file" up -d
    
    log_success "Stack deployment initiated"
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to be healthy..."
    
    local services=("redis" "neo4j" "qdrant" "autoweave-backend")
    local max_wait=300  # 5 minutes
    local waited=0
    
    for service in "${services[@]}"; do
        log_info "Checking $service..."
        
        while [ $waited -lt $max_wait ]; do
            if docker-compose ps | grep "$service" | grep -q "healthy"; then
                log_success "$service is healthy"
                break
            elif docker-compose ps | grep "$service" | grep -q "Exit"; then
                log_error "$service has exited!"
                docker-compose logs "$service" | tail -20
                exit 1
            fi
            
            sleep 5
            waited=$((waited + 5))
            echo -n "."
        done
        
        if [ $waited -ge $max_wait ]; then
            log_error "Timeout waiting for $service to be healthy"
            docker-compose logs "$service" | tail -20
            exit 1
        fi
        
        waited=0
    done
    
    log_success "All services are healthy!"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check backend health
    if curl -s -f http://localhost:3001/health > /dev/null; then
        log_success "Backend API is responding"
        curl -s http://localhost:3001/health | jq '.' || true
    else
        log_error "Backend API is not responding"
        exit 1
    fi
    
    # Check metrics endpoint
    if curl -s -f http://localhost:9090/metrics > /dev/null; then
        log_success "Metrics endpoint is responding"
    else
        log_warning "Metrics endpoint is not responding"
    fi
    
    # Show running services
    log_info "Running services:"
    docker-compose ps
}

# Show access information
show_access_info() {
    echo ""
    log_success "🎉 AutoWeave Backend Stack Deployed Successfully!"
    echo ""
    echo "📡 Access Points:"
    echo "  • Backend API: http://localhost:3001"
    echo "  • API Docs: http://localhost:3001/api-docs"
    echo "  • Health Check: http://localhost:3001/health"
    echo "  • Metrics: http://localhost:9090/metrics"
    echo "  • Neo4j Browser: http://localhost:7474 (neo4j/password)"
    echo ""
    echo "📊 Monitoring (if deployed):"
    echo "  • Grafana: http://localhost:3003 (admin/admin123)"
    echo "  • Prometheus: http://localhost:9091"
    echo ""
    echo "🔧 Useful Commands:"
    echo "  • View logs: docker-compose logs -f [service]"
    echo "  • Stop stack: docker-compose down"
    echo "  • Stop and remove data: docker-compose down -v"
    echo ""
}

# Main execution
main() {
    log_info "🚀 AutoWeave Backend Stack Deployment"
    log_info "===================================="
    
    # Parse arguments
    case "${1:-}" in
        "--full"|"-f")
            COMPOSE_FILE="$FULL_STACK_FILE"
            log_info "Using full stack configuration"
            ;;
        "--help"|"-h")
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --full, -f    Deploy full stack with monitoring"
            echo "  --help, -h    Show this help"
            exit 0
            ;;
    esac
    
    # Execute deployment steps
    check_prerequisites
    setup_environment
    deploy_stack "$COMPOSE_FILE"
    wait_for_services
    verify_deployment
    show_access_info
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi