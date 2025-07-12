#!/bin/bash

# AutoWeave Backend - Full Stack Deployment Script
# Deploys all required services with health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Unicode symbols
CHECK='\u2713'
CROSS='\u2717'
ARROW='\u2192'
SPINNER=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

# Functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_progress() { echo -e "${CYAN}⏳ $1${NC}"; }

# Progress bar function
progress_bar() {
    local current=$1
    local total=$2
    local width=50
    local percentage=$((current * 100 / total))
    local completed=$((width * current / total))
    
    printf "\r[${CYAN}"
    printf '%.0s=' $(seq 1 $completed)
    printf '%.0s-' $(seq $((completed + 1)) $width)
    printf "${NC}] ${percentage}%% "
}

# Spinner function
show_spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Retry function with exponential backoff
retry_with_backoff() {
    local max_attempts=$1
    local timeout=$2
    local command="${@:3}"
    local attempt=0
    local exitCode=0
    
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        
        if eval "$command"; then
            return 0
        else
            exitCode=$?
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            local wait_time=$((timeout * (2 ** (attempt - 1))))
            echo -e "${YELLOW}  Retry $attempt/$max_attempts in ${wait_time}s...${NC}"
            sleep $wait_time
        fi
    done
    
    return $exitCode
}

# Configuration
COMPOSE_FILE="docker-compose.yml"
FULL_STACK_FILE="docker-compose.full-stack.yml"
ENV_FILE=".env"
DOCKER_ENV_FILE=".env.docker"

# Check prerequisites with system requirements
check_prerequisites() {
    log_info "Checking prerequisites..."
    echo ""
    
    local checks_passed=true
    
    # Check Docker
    echo -n "  Docker: "
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}${CROSS} Not installed${NC}"
        checks_passed=false
    else
        echo -e "${GREEN}${CHECK} $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"
    fi
    
    # Check Docker Compose
    echo -n "  Docker Compose: "
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}${CROSS} Not installed${NC}"
        checks_passed=false
    else
        echo -e "${GREEN}${CHECK} $(docker-compose --version | cut -d' ' -f3 | tr -d ',')${NC}"
    fi
    
    # Check Docker daemon
    echo -n "  Docker Daemon: "
    if ! docker info &> /dev/null; then
        echo -e "${RED}${CROSS} Not running${NC}"
        checks_passed=false
    else
        echo -e "${GREEN}${CHECK} Running${NC}"
    fi
    
    # Check system resources
    echo ""
    log_info "System Resources:"
    
    # Check available memory
    echo -n "  Available Memory: "
    local mem_available=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
    if (( $(echo "$mem_available < 2" | bc -l) )); then
        echo -e "${RED}${mem_available}GB (minimum 2GB required)${NC}"
        log_warning "Low memory may cause issues"
    else
        echo -e "${GREEN}${mem_available}GB${NC}"
    fi
    
    # Check disk space
    echo -n "  Available Disk: "
    local disk_available=$(df -BG . | awk 'NR==2{print $4}' | tr -d 'G')
    if [ $disk_available -lt 10 ]; then
        echo -e "${RED}${disk_available}GB (minimum 10GB required)${NC}"
        log_warning "Low disk space may cause issues"
    else
        echo -e "${GREEN}${disk_available}GB${NC}"
    fi
    
    # Check ports
    echo ""
    log_info "Port Availability:"
    local ports=("3001" "6379" "7474" "7687" "6333" "9090")
    local port_names=("Backend" "Redis" "Neo4j Browser" "Neo4j Bolt" "Qdrant" "Metrics")
    
    for i in "${!ports[@]}"; do
        echo -n "  Port ${ports[$i]} (${port_names[$i]}): "
        if lsof -Pi :${ports[$i]} -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "${YELLOW}In use${NC}"
            log_warning "Port ${ports[$i]} is already in use"
        else
            echo -e "${GREEN}Available${NC}"
        fi
    done
    
    echo ""
    if [ "$checks_passed" = false ]; then
        log_error "Prerequisites check failed!"
        exit 1
    fi
    
    log_success "All prerequisites satisfied"
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

# Deploy stack with progress tracking
deploy_stack() {
    local compose_file="${1:-$COMPOSE_FILE}"
    
    log_info "Deploying stack using $compose_file..."
    echo ""
    
    # Define deployment steps
    local steps=(
        "Pulling Docker images"
        "Building Backend image"
        "Creating network"
        "Starting Redis"
        "Starting Neo4j"
        "Starting Qdrant"
        "Starting Backend"
    )
    
    local current_step=0
    local total_steps=${#steps[@]}
    
    # Helper function to run step with progress
    run_step() {
        local step_name="$1"
        local command="$2"
        
        current_step=$((current_step + 1))
        progress_bar $current_step $total_steps
        echo -n " $step_name"
        
        # Run command in background and show spinner
        if eval "$command" > /tmp/deploy_step.log 2>&1 & then
            local pid=$!
            show_spinner $pid
            wait $pid
            local result=$?
            
            if [ $result -eq 0 ]; then
                echo -e " ${GREEN}${CHECK}${NC}"
            else
                echo -e " ${RED}${CROSS}${NC}"
                log_error "Failed at: $step_name"
                cat /tmp/deploy_step.log
                return 1
            fi
        else
            echo -e " ${RED}${CROSS}${NC}"
            return 1
        fi
    }
    
    # Execute deployment steps
    run_step "${steps[0]}" "docker-compose -f '$compose_file' pull" || return 1
    run_step "${steps[1]}" "docker-compose -f '$compose_file' build autoweave-backend" || return 1
    run_step "${steps[2]}" "docker network create autoweave-network 2>/dev/null || true" || return 1
    run_step "${steps[3]}" "docker-compose -f '$compose_file' up -d redis" || return 1
    run_step "${steps[4]}" "docker-compose -f '$compose_file' up -d neo4j" || return 1
    run_step "${steps[5]}" "docker-compose -f '$compose_file' up -d qdrant" || return 1
    run_step "${steps[6]}" "docker-compose -f '$compose_file' up -d autoweave-backend" || return 1
    
    echo ""
    log_success "Stack deployment completed"
    
    # Clean up
    rm -f /tmp/deploy_step.log
}

# Wait for services to be healthy with visual progress
wait_for_services() {
    log_info "Waiting for services to be healthy..."
    echo ""
    
    local services=("redis" "neo4j" "qdrant" "autoweave-backend")
    local service_names=("Redis" "Neo4j" "Qdrant" "Backend")
    local service_ports=("6379" "7474" "6333" "3001")
    local max_wait=300  # 5 minutes
    local check_interval=2
    
    # Initialize service status
    declare -A service_status
    declare -A service_start_time
    for service in "${services[@]}"; do
        service_status[$service]="starting"
        service_start_time[$service]=$(date +%s)
    done
    
    # Main monitoring loop
    local all_healthy=false
    local start_time=$(date +%s)
    
    while [ $all_healthy = false ]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        # Clear previous output
        printf "\033[${#services[@]}A\r"
        
        # Check each service
        all_healthy=true
        for i in "${!services[@]}"; do
            local service="${services[$i]}"
            local name="${service_names[$i]}"
            local port="${service_ports[$i]}"
            local service_elapsed=$((current_time - service_start_time[$service]))
            
            # Skip if already healthy
            if [ "${service_status[$service]}" = "healthy" ]; then
                printf "${GREEN}${CHECK}${NC} %-15s ${GREEN}[HEALTHY]${NC} ✓\n" "$name:"
                continue
            fi
            
            # Check service status
            if docker-compose ps 2>/dev/null | grep "$service" | grep -q "healthy"; then
                service_status[$service]="healthy"
                printf "${GREEN}${CHECK}${NC} %-15s ${GREEN}[HEALTHY]${NC} ✓\n" "$name:"
            elif docker-compose ps 2>/dev/null | grep "$service" | grep -q "Exit\|Error"; then
                service_status[$service]="failed"
                printf "${RED}${CROSS}${NC} %-15s ${RED}[FAILED]${NC} ✗\n" "$name:"
                all_healthy=false
            else
                # Service is still starting
                all_healthy=false
                local spinner_index=$((service_elapsed % ${#SPINNER[@]}))
                printf "${YELLOW}${SPINNER[$spinner_index]}${NC} %-15s ${YELLOW}[STARTING]${NC} %ds\n" "$name:" "$service_elapsed"
            fi
        done
        
        # Check for timeout
        if [ $elapsed -ge $max_wait ]; then
            echo ""
            log_error "Timeout waiting for services to be healthy"
            for service in "${services[@]}"; do
                if [ "${service_status[$service]}" != "healthy" ]; then
                    echo ""
                    log_error "$service failed to start:"
                    docker-compose logs --tail=20 "$service" 2>/dev/null || true
                fi
            done
            exit 1
        fi
        
        # Check for any failed services
        for service in "${services[@]}"; do
            if [ "${service_status[$service]}" = "failed" ]; then
                echo ""
                log_error "$service has failed!"
                docker-compose logs --tail=20 "$service" 2>/dev/null || true
                exit 1
            fi
        done
        
        sleep $check_interval
    done
    
    echo ""
    log_success "All services are healthy! 🚀"
}

# Verify deployment with detailed checks
verify_deployment() {
    log_info "Verifying deployment..."
    echo ""
    
    local checks=(
        "Backend Health|curl -s -f http://localhost:3001/health"
        "API Documentation|curl -s -f http://localhost:3001/api-docs"
        "Metrics Endpoint|curl -s -f http://localhost:9090/metrics"
        "Redis Connection|docker-compose exec -T redis redis-cli ping"
        "Neo4j Connection|curl -s -f http://localhost:7474"
        "Qdrant Health|curl -s -f http://localhost:6333/health"
    )
    
    local passed=0
    local failed=0
    
    for check in "${checks[@]}"; do
        IFS='|' read -r name command <<< "$check"
        echo -n "  Checking $name... "
        
        if retry_with_backoff 3 2 "$command > /dev/null 2>&1"; then
            echo -e "${GREEN}${CHECK} OK${NC}"
            ((passed++))
        else
            echo -e "${RED}${CROSS} FAILED${NC}"
            ((failed++))
        fi
    done
    
    echo ""
    log_info "Verification Summary: ${GREEN}$passed passed${NC}, ${RED}$failed failed${NC}"
    
    if [ $failed -gt 0 ]; then
        log_warning "Some checks failed, but core services are running"
    fi
    
    # Show service status table
    echo ""
    log_info "Service Status:"
    docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
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