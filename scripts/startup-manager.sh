#!/bin/bash

# AutoWeave Backend - Advanced Startup Manager
# Orchestrates service startup with dependency management and monitoring

set -e

# Colors and symbols
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Box drawing characters
BOX_TL='┌'
BOX_TR='┐'
BOX_BL='└'
BOX_BR='┘'
BOX_H='─'
BOX_V='│'
BOX_T='┬'
BOX_B='┴'
BOX_L='├'
BOX_R='┤'
BOX_X='┼'

# Status symbols
CHECK='✓'
CROSS='✗'
ARROW='→'
HOURGLASS='⏳'
WARNING='⚠'
INFO='ℹ'

# Configuration
STARTUP_LOG="/tmp/autoweave-startup.log"
STATUS_FILE="/tmp/autoweave-status.json"
MAX_RETRY=3
HEALTH_CHECK_INTERVAL=2
STARTUP_TIMEOUT=300

# Service definitions with dependencies
declare -A SERVICES
declare -A SERVICE_DEPS
declare -A SERVICE_PORTS
declare -A SERVICE_HEALTH
declare -A SERVICE_STATUS
declare -A SERVICE_START_TIME
declare -A SERVICE_LOGS

# Define services
SERVICES=(
    ["redis"]="Redis Cache & Event Bus"
    ["neo4j"]="Neo4j Graph Database"
    ["qdrant"]="Qdrant Vector Database"
    ["backend"]="AutoWeave Backend API"
)

SERVICE_DEPS=(
    ["redis"]=""
    ["neo4j"]=""
    ["qdrant"]=""
    ["backend"]="redis neo4j qdrant"
)

SERVICE_PORTS=(
    ["redis"]="6379"
    ["neo4j"]="7474,7687"
    ["qdrant"]="6333,6334"
    ["backend"]="3001,9090"
)

SERVICE_HEALTH=(
    ["redis"]="docker-compose exec -T redis redis-cli ping | grep -q PONG"
    ["neo4j"]="curl -sf http://localhost:7474 > /dev/null"
    ["qdrant"]="curl -sf http://localhost:6333/health | grep -q ok"
    ["backend"]="curl -sf http://localhost:3001/health | grep -q healthy"
)

# Initialize service status
init_services() {
    for service in "${!SERVICES[@]}"; do
        SERVICE_STATUS[$service]="pending"
        SERVICE_START_TIME[$service]=0
        SERVICE_LOGS[$service]=""
    done
}

# Clear screen and setup
setup_display() {
    clear
    echo > "$STARTUP_LOG"
    echo "{}" > "$STATUS_FILE"
}

# Draw header
draw_header() {
    local width=80
    echo -e "${CYAN}${BOX_TL}$(printf '%.0s─' $(seq 1 $((width-2))))${BOX_TR}${NC}"
    echo -e "${CYAN}${BOX_V}${NC} ${WHITE}AutoWeave Backend Startup Manager${NC}$(printf ' %.0s' $(seq 1 $((width-37))))${CYAN}${BOX_V}${NC}"
    echo -e "${CYAN}${BOX_V}${NC} $(date '+%Y-%m-%d %H:%M:%S')$(printf ' %.0s' $(seq 1 $((width-22))))${CYAN}${BOX_V}${NC}"
    echo -e "${CYAN}${BOX_BL}$(printf '%.0s─' $(seq 1 $((width-2))))${BOX_BR}${NC}"
}

# Draw service status table
draw_service_table() {
    echo -e "\n${WHITE}Service Status:${NC}"
    echo -e "${CYAN}┌─────────────┬──────────────────────────┬──────────┬───────────┬──────────┐${NC}"
    echo -e "${CYAN}│${NC} Service     ${CYAN}│${NC} Description              ${CYAN}│${NC} Status   ${CYAN}│${NC} Duration  ${CYAN}│${NC} Health   ${CYAN}│${NC}"
    echo -e "${CYAN}├─────────────┼──────────────────────────┼──────────┼───────────┼──────────┤${NC}"
    
    for service in redis neo4j qdrant backend; do
        local desc="${SERVICES[$service]}"
        local status="${SERVICE_STATUS[$service]}"
        local start_time="${SERVICE_START_TIME[$service]}"
        local duration=""
        local health=""
        
        # Calculate duration
        if [ "$start_time" -gt 0 ]; then
            local now=$(date +%s)
            local elapsed=$((now - start_time))
            duration="${elapsed}s"
        fi
        
        # Format status
        case "$status" in
            "pending")
                status_fmt="${YELLOW}${HOURGLASS} Pending${NC}"
                health="${YELLOW}-${NC}"
                ;;
            "starting")
                status_fmt="${CYAN}↻ Starting${NC}"
                health="${CYAN}...${NC}"
                ;;
            "healthy")
                status_fmt="${GREEN}${CHECK} Running${NC}"
                health="${GREEN}${CHECK} OK${NC}"
                ;;
            "failed")
                status_fmt="${RED}${CROSS} Failed${NC}"
                health="${RED}${CROSS} Error${NC}"
                ;;
            "retry")
                status_fmt="${YELLOW}↻ Retry${NC}"
                health="${YELLOW}...${NC}"
                ;;
        esac
        
        printf "${CYAN}│${NC} %-11s ${CYAN}│${NC} %-24s ${CYAN}│${NC} %-8s ${CYAN}│${NC} %-9s ${CYAN}│${NC} %-8s ${CYAN}│${NC}\n" \
            "$service" "${desc:0:24}" "$status_fmt" "$duration" "$health"
    done
    
    echo -e "${CYAN}└─────────────┴──────────────────────────┴──────────┴───────────┴──────────┘${NC}"
}

# Log message
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${timestamp} ${BLUE}[INFO]${NC} $message" | tee -a "$STARTUP_LOG"
            ;;
        "SUCCESS")
            echo -e "${timestamp} ${GREEN}[SUCCESS]${NC} $message" | tee -a "$STARTUP_LOG"
            ;;
        "WARNING")
            echo -e "${timestamp} ${YELLOW}[WARNING]${NC} $message" | tee -a "$STARTUP_LOG"
            ;;
        "ERROR")
            echo -e "${timestamp} ${RED}[ERROR]${NC} $message" | tee -a "$STARTUP_LOG"
            ;;
    esac
}

# Check dependencies
check_dependencies() {
    local service=$1
    local deps="${SERVICE_DEPS[$service]}"
    
    if [ -z "$deps" ]; then
        return 0
    fi
    
    for dep in $deps; do
        if [ "${SERVICE_STATUS[$dep]}" != "healthy" ]; then
            return 1
        fi
    done
    
    return 0
}

# Start service with retry
start_service() {
    local service=$1
    local container_name="autoweave-$service"
    
    if [ "$service" = "backend" ]; then
        container_name="autoweave-backend"
    fi
    
    SERVICE_STATUS[$service]="starting"
    SERVICE_START_TIME[$service]=$(date +%s)
    
    # Start the service
    log_message "INFO" "Starting $service..."
    
    if docker-compose up -d "$service" >> "$STARTUP_LOG" 2>&1; then
        # Wait for health check
        local attempt=0
        while [ $attempt -lt 30 ]; do
            if eval "${SERVICE_HEALTH[$service]}" 2>/dev/null; then
                SERVICE_STATUS[$service]="healthy"
                log_message "SUCCESS" "$service is healthy"
                return 0
            fi
            sleep $HEALTH_CHECK_INTERVAL
            attempt=$((attempt + 1))
        done
        
        SERVICE_STATUS[$service]="failed"
        log_message "ERROR" "$service failed health check"
        return 1
    else
        SERVICE_STATUS[$service]="failed"
        log_message "ERROR" "Failed to start $service"
        return 1
    fi
}

# Retry failed service
retry_service() {
    local service=$1
    local retry_count=$2
    
    SERVICE_STATUS[$service]="retry"
    log_message "WARNING" "Retrying $service (attempt $retry_count/$MAX_RETRY)"
    
    # Stop the service first
    docker-compose stop "$service" 2>/dev/null
    docker-compose rm -f "$service" 2>/dev/null
    
    sleep 5
    
    # Try to start again
    if start_service "$service"; then
        return 0
    else
        return 1
    fi
}

# Main startup orchestration
orchestrate_startup() {
    local all_healthy=false
    local start_time=$(date +%s)
    local retry_counts=()
    
    # Initialize retry counts
    for service in "${!SERVICES[@]}"; do
        retry_counts[$service]=0
    done
    
    while [ $all_healthy = false ]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        # Check timeout
        if [ $elapsed -gt $STARTUP_TIMEOUT ]; then
            log_message "ERROR" "Startup timeout exceeded"
            return 1
        fi
        
        # Clear screen and redraw
        clear
        draw_header
        draw_service_table
        
        # Process each service
        all_healthy=true
        for service in redis neo4j qdrant backend; do
            case "${SERVICE_STATUS[$service]}" in
                "pending")
                    # Check if dependencies are met
                    if check_dependencies "$service"; then
                        start_service "$service" &
                    fi
                    all_healthy=false
                    ;;
                "starting")
                    # Still starting, wait
                    all_healthy=false
                    ;;
                "failed")
                    # Retry if under limit
                    if [ ${retry_counts[$service]} -lt $MAX_RETRY ]; then
                        retry_counts[$service]=$((retry_counts[$service] + 1))
                        retry_service "$service" ${retry_counts[$service]} &
                    fi
                    all_healthy=false
                    ;;
                "retry")
                    # Retrying, wait
                    all_healthy=false
                    ;;
                "healthy")
                    # Service is good
                    ;;
            esac
        done
        
        # Show recent logs
        echo -e "\n${WHITE}Recent Activity:${NC}"
        tail -n 5 "$STARTUP_LOG" | while read line; do
            echo "  $line"
        done
        
        # Update status file
        {
            echo "{"
            echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
            echo "  \"elapsed\": $elapsed,"
            echo "  \"services\": {"
            for service in "${!SERVICES[@]}"; do
                echo "    \"$service\": {"
                echo "      \"status\": \"${SERVICE_STATUS[$service]}\","
                echo "      \"start_time\": ${SERVICE_START_TIME[$service]},"
                echo "      \"retry_count\": ${retry_counts[$service]}"
                echo "    },"
            done | sed '$ s/,$//'
            echo "  }"
            echo "}"
        } > "$STATUS_FILE"
        
        sleep 1
    done
    
    return 0
}

# Show final summary
show_summary() {
    clear
    draw_header
    
    echo -e "\n${GREEN}${CHECK} All services started successfully!${NC}\n"
    
    # Service summary table
    draw_service_table
    
    # Access points
    echo -e "\n${WHITE}Access Points:${NC}"
    echo -e "  ${CYAN}•${NC} Backend API: ${BLUE}http://localhost:3001${NC}"
    echo -e "  ${CYAN}•${NC} API Documentation: ${BLUE}http://localhost:3001/api-docs${NC}"
    echo -e "  ${CYAN}•${NC} Health Check: ${BLUE}http://localhost:3001/health${NC}"
    echo -e "  ${CYAN}•${NC} Metrics: ${BLUE}http://localhost:9090/metrics${NC}"
    echo -e "  ${CYAN}•${NC} Neo4j Browser: ${BLUE}http://localhost:7474${NC} (neo4j/password)"
    echo -e "  ${CYAN}•${NC} Qdrant Dashboard: ${BLUE}http://localhost:6333/dashboard${NC}"
    
    # Commands
    echo -e "\n${WHITE}Useful Commands:${NC}"
    echo -e "  ${CYAN}•${NC} View logs: ${YELLOW}docker-compose logs -f [service]${NC}"
    echo -e "  ${CYAN}•${NC} Monitor health: ${YELLOW}./scripts/health-monitor.sh${NC}"
    echo -e "  ${CYAN}•${NC} Stop services: ${YELLOW}docker-compose down${NC}"
    
    echo -e "\n${GREEN}Startup completed in $(date +%s) seconds${NC}\n"
}

# Cleanup on exit
cleanup() {
    rm -f "$STARTUP_LOG" "$STATUS_FILE"
}

# Main execution
main() {
    # Trap cleanup
    trap cleanup EXIT
    
    # Check if docker-compose file exists
    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${RED}Error: docker-compose.yml not found${NC}"
        echo "Please run this script from the project root directory"
        exit 1
    fi
    
    # Initialize
    init_services
    setup_display
    
    # Start orchestration
    if orchestrate_startup; then
        show_summary
        exit 0
    else
        echo -e "\n${RED}${CROSS} Startup failed!${NC}"
        echo -e "\nCheck the logs for details:"
        echo -e "  ${YELLOW}docker-compose logs${NC}"
        echo -e "\nOr view startup log:"
        echo -e "  ${YELLOW}cat $STARTUP_LOG${NC}"
        exit 1
    fi
}

# Parse arguments
case "${1:-}" in
    "--help"|"-h")
        echo "AutoWeave Backend Startup Manager"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help"
        echo "  --status       Check current status"
        echo "  --logs         Show startup logs"
        echo ""
        exit 0
        ;;
    "--status")
        if [ -f "$STATUS_FILE" ]; then
            cat "$STATUS_FILE" | jq .
        else
            echo "No status file found. Services may not be running."
        fi
        exit 0
        ;;
    "--logs")
        if [ -f "$STARTUP_LOG" ]; then
            cat "$STARTUP_LOG"
        else
            echo "No startup log found."
        fi
        exit 0
        ;;
esac

# Run main
main