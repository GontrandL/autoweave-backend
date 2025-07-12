#!/bin/bash

# AutoWeave Backend - Health Monitor
# Continuously monitors the health of all services and can auto-restart unhealthy ones

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

# Symbols
CHECK='✓'
CROSS='✗'
WARNING='⚠'
HEART='♥'
SKULL='☠'
CHART='📊'

# Configuration
MONITOR_INTERVAL=${MONITOR_INTERVAL:-10}
AUTO_RESTART=${AUTO_RESTART:-false}
MAX_RESTART_ATTEMPTS=${MAX_RESTART_ATTEMPTS:-3}
ALERT_WEBHOOK=${ALERT_WEBHOOK:-""}
LOG_FILE="/tmp/autoweave-health-monitor.log"
HISTORY_FILE="/tmp/autoweave-health-history.json"

# Service definitions
declare -A SERVICES
declare -A SERVICE_URLS
declare -A SERVICE_HEALTH_CHECKS
declare -A SERVICE_STATUS
declare -A SERVICE_UPTIME
declare -A SERVICE_DOWNTIME
declare -A SERVICE_RESTART_COUNT
declare -A SERVICE_LAST_CHECK
declare -A SERVICE_RESPONSE_TIME

SERVICES=(
    ["redis"]="Redis Cache"
    ["neo4j"]="Neo4j Database"
    ["qdrant"]="Qdrant Vector DB"
    ["backend"]="Backend API"
)

SERVICE_URLS=(
    ["redis"]="redis://localhost:6379"
    ["neo4j"]="http://localhost:7474"
    ["qdrant"]="http://localhost:6333/health"
    ["backend"]="http://localhost:3001/health"
)

SERVICE_HEALTH_CHECKS=(
    ["redis"]="docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG"
    ["neo4j"]="curl -sf http://localhost:7474 > /dev/null"
    ["qdrant"]="curl -sf http://localhost:6333/health | grep -q ok"
    ["backend"]="curl -sf http://localhost:3001/health | jq -r .status | grep -qE 'healthy|warning|degraded'"
)

# Initialize monitoring data
init_monitoring() {
    local now=$(date +%s)
    
    for service in "${!SERVICES[@]}"; do
        SERVICE_STATUS[$service]="unknown"
        SERVICE_UPTIME[$service]=0
        SERVICE_DOWNTIME[$service]=0
        SERVICE_RESTART_COUNT[$service]=0
        SERVICE_LAST_CHECK[$service]=$now
        SERVICE_RESPONSE_TIME[$service]=0
    done
    
    # Load history if exists
    if [ -f "$HISTORY_FILE" ]; then
        # TODO: Parse history file
        true
    fi
}

# Log message
log_event() {
    local level=$1
    local service=$2
    local message=$3
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] [$service] $message" >> "$LOG_FILE"
    
    # Send alert if webhook is configured
    if [ -n "$ALERT_WEBHOOK" ] && [ "$level" = "ERROR" ]; then
        send_alert "$service" "$message"
    fi
}

# Send alert via webhook
send_alert() {
    local service=$1
    local message=$2
    
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"service\":\"$service\",\"message\":\"$message\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            > /dev/null 2>&1 || true
    fi
}

# Check service health
check_service_health() {
    local service=$1
    local start_time=$(date +%s%N)
    local health_check="${SERVICE_HEALTH_CHECKS[$service]}"
    local was_healthy="${SERVICE_STATUS[$service]}"
    
    if eval "$health_check"; then
        local end_time=$(date +%s%N)
        local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to ms
        
        SERVICE_STATUS[$service]="healthy"
        SERVICE_RESPONSE_TIME[$service]=$response_time
        
        if [ "$was_healthy" != "healthy" ]; then
            log_event "INFO" "$service" "Service is now healthy (response time: ${response_time}ms)"
        fi
        
        return 0
    else
        SERVICE_STATUS[$service]="unhealthy"
        SERVICE_RESPONSE_TIME[$service]=0
        
        if [ "$was_healthy" = "healthy" ]; then
            log_event "ERROR" "$service" "Service is now unhealthy"
        fi
        
        return 1
    fi
}

# Calculate uptime/downtime
update_statistics() {
    local service=$1
    local now=$(date +%s)
    local last_check="${SERVICE_LAST_CHECK[$service]}"
    local duration=$((now - last_check))
    
    if [ "${SERVICE_STATUS[$service]}" = "healthy" ]; then
        SERVICE_UPTIME[$service]=$((SERVICE_UPTIME[$service] + duration))
    else
        SERVICE_DOWNTIME[$service]=$((SERVICE_DOWNTIME[$service] + duration))
    fi
    
    SERVICE_LAST_CHECK[$service]=$now
}

# Restart unhealthy service
restart_service() {
    local service=$1
    local container="autoweave-$service"
    
    if [ "$service" = "backend" ]; then
        container="autoweave-backend"
    fi
    
    log_event "WARNING" "$service" "Attempting to restart service"
    
    # Stop and remove container
    docker-compose stop "$service" 2>/dev/null || true
    docker-compose rm -f "$service" 2>/dev/null || true
    
    # Start container again
    if docker-compose up -d "$service" 2>/dev/null; then
        SERVICE_RESTART_COUNT[$service]=$((SERVICE_RESTART_COUNT[$service] + 1))
        log_event "INFO" "$service" "Service restarted successfully"
        return 0
    else
        log_event "ERROR" "$service" "Failed to restart service"
        return 1
    fi
}

# Draw dashboard header
draw_header() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC} ${WHITE}AutoWeave Backend Health Monitor${NC}                                            ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC} $(date '+%Y-%m-%d %H:%M:%S')                                                          ${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
}

# Draw service status table
draw_status_table() {
    echo -e "\n${WHITE}Service Status:${NC}"
    echo -e "${CYAN}┌─────────────┬──────────┬──────────────┬────────────┬──────────┬───────────┐${NC}"
    echo -e "${CYAN}│${NC} Service     ${CYAN}│${NC} Status   ${CYAN}│${NC} Response     ${CYAN}│${NC} Uptime %   ${CYAN}│${NC} Restarts ${CYAN}│${NC} Health    ${CYAN}│${NC}"
    echo -e "${CYAN}├─────────────┼──────────┼──────────────┼────────────┼──────────┼───────────┤${NC}"
    
    for service in redis neo4j qdrant backend; do
        local status="${SERVICE_STATUS[$service]}"
        local response_time="${SERVICE_RESPONSE_TIME[$service]}"
        local uptime="${SERVICE_UPTIME[$service]}"
        local downtime="${SERVICE_DOWNTIME[$service]}"
        local total=$((uptime + downtime))
        local uptime_pct=0
        local restarts="${SERVICE_RESTART_COUNT[$service]}"
        
        if [ $total -gt 0 ]; then
            uptime_pct=$((uptime * 100 / total))
        fi
        
        # Format status
        case "$status" in
            "healthy")
                status_fmt="${GREEN}${CHECK} Healthy${NC}"
                health_icon="${GREEN}${HEART}${NC}"
                ;;
            "unhealthy")
                status_fmt="${RED}${CROSS} Down${NC}"
                health_icon="${RED}${SKULL}${NC}"
                ;;
            *)
                status_fmt="${YELLOW}? Unknown${NC}"
                health_icon="${YELLOW}?${NC}"
                ;;
        esac
        
        # Format response time
        if [ "$response_time" -gt 0 ]; then
            response_fmt="${response_time}ms"
        else
            response_fmt="-"
        fi
        
        # Color uptime percentage
        if [ $uptime_pct -ge 99 ]; then
            uptime_color="${GREEN}"
        elif [ $uptime_pct -ge 95 ]; then
            uptime_color="${YELLOW}"
        else
            uptime_color="${RED}"
        fi
        
        printf "${CYAN}│${NC} %-11s ${CYAN}│${NC} %-8s ${CYAN}│${NC} %-12s ${CYAN}│${NC} ${uptime_color}%9d%%${NC} ${CYAN}│${NC} %8d ${CYAN}│${NC} %9s ${CYAN}│${NC}\n" \
            "$service" "$status_fmt" "$response_fmt" "$uptime_pct" "$restarts" "$health_icon"
    done
    
    echo -e "${CYAN}└─────────────┴──────────┴──────────────┴────────────┴──────────┴───────────┘${NC}"
}

# Draw metrics
draw_metrics() {
    echo -e "\n${WHITE}System Metrics:${NC}"
    
    # CPU and Memory usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local mem_usage=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
    
    echo -e "  ${CHART} CPU Usage: ${CYAN}${cpu_usage}%${NC}"
    echo -e "  ${CHART} Memory Usage: ${CYAN}${mem_usage}%${NC}"
    
    # Docker stats
    echo -e "\n${WHITE}Container Resources:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep -E "autoweave|CONTAINER" || true
}

# Draw recent events
draw_recent_events() {
    echo -e "\n${WHITE}Recent Events:${NC}"
    
    if [ -f "$LOG_FILE" ]; then
        tail -n 5 "$LOG_FILE" | while IFS= read -r line; do
            if echo "$line" | grep -q "ERROR"; then
                echo -e "  ${RED}$line${NC}"
            elif echo "$line" | grep -q "WARNING"; then
                echo -e "  ${YELLOW}$line${NC}"
            else
                echo -e "  $line"
            fi
        done
    else
        echo "  No events recorded yet"
    fi
}

# Monitor loop
monitor_loop() {
    while true; do
        # Draw dashboard
        draw_header
        
        # Check all services
        local unhealthy_count=0
        for service in "${!SERVICES[@]}"; do
            if ! check_service_health "$service"; then
                unhealthy_count=$((unhealthy_count + 1))
                
                # Auto-restart if enabled
                if [ "$AUTO_RESTART" = "true" ] && [ ${SERVICE_RESTART_COUNT[$service]} -lt $MAX_RESTART_ATTEMPTS ]; then
                    restart_service "$service" &
                fi
            fi
            update_statistics "$service"
        done
        
        # Draw status
        draw_status_table
        draw_metrics
        draw_recent_events
        
        # Save history
        save_history
        
        # Show options
        echo -e "\n${WHITE}Options:${NC}"
        echo -e "  ${CYAN}[q]${NC} Quit  ${CYAN}[r]${NC} Restart unhealthy  ${CYAN}[l]${NC} View logs  ${CYAN}[c]${NC} Clear history"
        echo -e "  Auto-restart: ${AUTO_RESTART} | Interval: ${MONITOR_INTERVAL}s"
        
        # Check for user input (non-blocking)
        read -t $MONITOR_INTERVAL -n 1 key || true
        
        case "$key" in
            q|Q)
                echo -e "\n${YELLOW}Stopping health monitor...${NC}"
                exit 0
                ;;
            r|R)
                for service in "${!SERVICES[@]}"; do
                    if [ "${SERVICE_STATUS[$service]}" = "unhealthy" ]; then
                        restart_service "$service" &
                    fi
                done
                ;;
            l|L)
                less "$LOG_FILE"
                ;;
            c|C)
                > "$LOG_FILE"
                > "$HISTORY_FILE"
                init_monitoring
                ;;
        esac
    done
}

# Save monitoring history
save_history() {
    {
        echo "{"
        echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
        echo "  \"services\": {"
        
        for service in "${!SERVICES[@]}"; do
            echo "    \"$service\": {"
            echo "      \"status\": \"${SERVICE_STATUS[$service]}\","
            echo "      \"uptime\": ${SERVICE_UPTIME[$service]},"
            echo "      \"downtime\": ${SERVICE_DOWNTIME[$service]},"
            echo "      \"response_time\": ${SERVICE_RESPONSE_TIME[$service]},"
            echo "      \"restart_count\": ${SERVICE_RESTART_COUNT[$service]}"
            echo "    },"
        done | sed '$ s/,$//'
        
        echo "  }"
        echo "}"
    } > "$HISTORY_FILE"
}

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Health monitor stopped${NC}"
}

# Main execution
main() {
    # Trap cleanup
    trap cleanup EXIT INT TERM
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --auto-restart)
                AUTO_RESTART=true
                shift
                ;;
            --interval)
                MONITOR_INTERVAL="$2"
                shift 2
                ;;
            --webhook)
                ALERT_WEBHOOK="$2"
                shift 2
                ;;
            --help|-h)
                echo "AutoWeave Backend Health Monitor"
                echo ""
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --auto-restart      Enable automatic restart of unhealthy services"
                echo "  --interval SECONDS  Set monitoring interval (default: 10)"
                echo "  --webhook URL       Send alerts to webhook URL"
                echo "  --help, -h          Show this help"
                echo ""
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check if services are running
    if ! docker-compose ps | grep -q "Up"; then
        echo -e "${RED}No services are running. Please start the stack first.${NC}"
        echo "Run: ./scripts/deploy-stack.sh"
        exit 1
    fi
    
    # Initialize and start monitoring
    init_monitoring
    log_event "INFO" "monitor" "Health monitoring started"
    monitor_loop
}

# Run main
main "$@"