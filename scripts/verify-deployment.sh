#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

echo "🔍 AutoWeave Backend Deployment Verification"
echo "==========================================="

check_service() {
    local service=$1
    local port=$2
    local check_cmd=$3
    
    echo -n "Checking $service on port $port... "
    
    if eval "$check_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ RUNNING${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
    fi
}

check_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ OK (${status})${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED (${status})${NC}"
        ((FAILED++))
    fi
}

echo -e "\n${BLUE}1. Docker Services Status${NC}"
echo "---------------------------"

# Check Docker containers
if docker-compose ps --services --filter "status=running" | grep -q .; then
    echo -e "${GREEN}✓ Docker Compose stack is running${NC}"
    docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
else
    echo -e "${RED}✗ No services are running${NC}"
    exit 1
fi

echo -e "\n${BLUE}2. Service Health Checks${NC}"
echo "---------------------------"

# Check Redis
check_service "Redis" 6379 "docker-compose exec -T redis redis-cli ping | grep -q PONG"

# Check Neo4j
check_service "Neo4j" 7474 "curl -s http://localhost:7474 | grep -q neo4j"

# Check Qdrant
check_service "Qdrant" 6333 "curl -s http://localhost:6333/health | grep -q '\"ok\"'"

# Check Backend
check_service "Backend" 3001 "curl -s http://localhost:3001/health | grep -q '\"status\":\"healthy\"'"

echo -e "\n${BLUE}3. API Endpoints${NC}"
echo "---------------------------"

# Check health endpoint
check_endpoint "Health endpoint" "http://localhost:3001/health"

# Check metrics endpoint
check_endpoint "Metrics endpoint" "http://localhost:3001/metrics"

# Check API docs
check_endpoint "API documentation" "http://localhost:3001/api-docs"

# Check auth endpoints
check_endpoint "Auth login" "http://localhost:3001/api/auth/login" 401

# Check service registry
check_endpoint "Service registry" "http://localhost:3001/api/services" 401

echo -e "\n${BLUE}4. Connectivity Tests${NC}"
echo "---------------------------"

# Test backend can reach Redis
echo -n "Backend → Redis connectivity... "
if docker-compose exec -T autoweave-backend nc -zv redis 6379 2>&1 | grep -q succeeded; then
    echo -e "${GREEN}✓ OK${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

# Test backend can reach Neo4j
echo -n "Backend → Neo4j connectivity... "
if docker-compose exec -T autoweave-backend nc -zv neo4j 7687 2>&1 | grep -q succeeded; then
    echo -e "${GREEN}✓ OK${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

# Test backend can reach Qdrant
echo -n "Backend → Qdrant connectivity... "
if docker-compose exec -T autoweave-backend nc -zv qdrant 6333 2>&1 | grep -q succeeded; then
    echo -e "${GREEN}✓ OK${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

echo -e "\n${BLUE}5. Authentication Test${NC}"
echo "---------------------------"

# Try to login
echo -n "Testing authentication... "
auth_response=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' 2>/dev/null)

if echo "$auth_response" | grep -q '"token"'; then
    echo -e "${GREEN}✓ Login successful${NC}"
    ((PASSED++))
    
    # Extract token for further tests
    TOKEN=$(echo "$auth_response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    # Test authenticated endpoint
    echo -n "Testing authenticated request... "
    if curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/services | grep -q '\['; then
        echo -e "${GREEN}✓ OK${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
    fi
else
    echo -e "${RED}✗ Login failed${NC}"
    ((FAILED++))
fi

echo -e "\n${BLUE}6. Data Storage Test${NC}"
echo "---------------------------"

# Test Redis
echo -n "Testing Redis operations... "
if docker-compose exec -T redis redis-cli SET test_key "test_value" | grep -q OK && \
   docker-compose exec -T redis redis-cli GET test_key | grep -q test_value; then
    echo -e "${GREEN}✓ OK${NC}"
    ((PASSED++))
    docker-compose exec -T redis redis-cli DEL test_key > /dev/null 2>&1
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

# Test Neo4j
echo -n "Testing Neo4j connection... "
if docker-compose exec -T neo4j cypher-shell -u neo4j -p password "RETURN 1" 2>/dev/null | grep -q 1; then
    echo -e "${GREEN}✓ OK${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED++))
fi

echo -e "\n${BLUE}7. Resource Usage${NC}"
echo "---------------------------"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo -e "\n${BLUE}8. Logs Summary${NC}"
echo "---------------------------"

# Check for errors in logs
echo -n "Checking for errors in logs... "
error_count=$(docker-compose logs --tail=100 2>&1 | grep -iE "error|exception|fatal" | grep -v "Error: null" | wc -l)

if [ $error_count -eq 0 ]; then
    echo -e "${GREEN}✓ No errors found${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ Found $error_count error messages${NC}"
    echo "Recent errors:"
    docker-compose logs --tail=100 2>&1 | grep -iE "error|exception|fatal" | grep -v "Error: null" | tail -5
fi

echo -e "\n${BLUE}Summary${NC}"
echo "==========================================="
echo -e "Tests passed: ${GREEN}$PASSED${NC}"
echo -e "Tests failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! Deployment is healthy.${NC}"
    echo -e "\n${BLUE}Access Points:${NC}"
    echo "• API Documentation: http://localhost:3001/api-docs"
    echo "• Health Check: http://localhost:3001/health"
    echo "• Metrics: http://localhost:3001/metrics"
    echo "• Neo4j Browser: http://localhost:7474 (neo4j/password)"
    echo "• Qdrant Dashboard: http://localhost:6333/dashboard"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please check the logs.${NC}"
    echo -e "\nRun ${YELLOW}docker-compose logs -f${NC} to see detailed logs."
    exit 1
fi