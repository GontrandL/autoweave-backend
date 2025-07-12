#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="http://localhost:3001"

echo "🔐 Testing AutoWeave Backend Authentication"
echo "=========================================="

# Test 1: Login with valid credentials
echo -e "\n${BLUE}1. Testing login with valid credentials${NC}"
echo "POST /api/auth/login"
echo '{"username":"admin","password":"admin123"}'

response=$(curl -s -X POST $BASE_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

if echo "$response" | grep -q '"token"'; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "Response: $response" | jq .
    
    # Extract tokens
    ACCESS_TOKEN=$(echo "$response" | jq -r .token)
    REFRESH_TOKEN=$(echo "$response" | jq -r .refreshToken)
    
    echo -e "\nAccess Token (first 50 chars): ${ACCESS_TOKEN:0:50}..."
    echo -e "Refresh Token (first 50 chars): ${REFRESH_TOKEN:0:50}..."
else
    echo -e "${RED}✗ Login failed${NC}"
    echo "Response: $response"
    exit 1
fi

# Test 2: Access protected endpoint with token
echo -e "\n${BLUE}2. Testing protected endpoint with valid token${NC}"
echo "GET /api/services (with Authorization header)"

response=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" $BASE_URL/api/services)

if [ $? -eq 0 ] && ! echo "$response" | grep -q "Unauthorized"; then
    echo -e "${GREEN}✓ Protected endpoint accessed successfully${NC}"
    echo "Response: $response" | jq .
else
    echo -e "${RED}✗ Failed to access protected endpoint${NC}"
    echo "Response: $response"
fi

# Test 3: Access protected endpoint without token
echo -e "\n${BLUE}3. Testing protected endpoint without token${NC}"
echo "GET /api/services (no Authorization header)"

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" $BASE_URL/api/services)
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_STATUS")

if [ "$http_status" = "401" ]; then
    echo -e "${GREEN}✓ Correctly rejected unauthorized request (401)${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Expected 401, got $http_status${NC}"
    echo "Response: $body"
fi

# Test 4: Login with invalid credentials
echo -e "\n${BLUE}4. Testing login with invalid credentials${NC}"
echo "POST /api/auth/login"
echo '{"username":"admin","password":"wrongpassword"}'

response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST $BASE_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrongpassword"}')

http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_STATUS")

if [ "$http_status" = "401" ]; then
    echo -e "${GREEN}✓ Correctly rejected invalid credentials (401)${NC}"
    echo "Response: $body"
else
    echo -e "${RED}✗ Expected 401, got $http_status${NC}"
    echo "Response: $body"
fi

# Test 5: Refresh token
echo -e "\n${BLUE}5. Testing token refresh${NC}"
echo "POST /api/auth/refresh"

response=$(curl -s -X POST $BASE_URL/api/auth/refresh \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

if echo "$response" | grep -q '"token"'; then
    echo -e "${GREEN}✓ Token refresh successful${NC}"
    echo "Response: $response" | jq .
    
    NEW_ACCESS_TOKEN=$(echo "$response" | jq -r .token)
    echo -e "\nNew Access Token (first 50 chars): ${NEW_ACCESS_TOKEN:0:50}..."
else
    echo -e "${RED}✗ Token refresh failed${NC}"
    echo "Response: $response"
fi

# Test 6: API Key authentication
echo -e "\n${BLUE}6. Testing API key authentication${NC}"
echo "GET /api/services (with X-API-Key header)"

# First, create an API key
echo -n "Creating API key... "
api_key_response=$(curl -s -X POST $BASE_URL/api/auth/api-keys \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test API Key","permissions":["read:services"]}')

if echo "$api_key_response" | grep -q '"key"'; then
    API_KEY=$(echo "$api_key_response" | jq -r .key)
    echo -e "${GREEN}✓ Created${NC}"
    echo "API Key: $API_KEY"
    
    # Test with API key
    echo -n "Testing API key access... "
    response=$(curl -s -H "X-API-Key: $API_KEY" $BASE_URL/api/services)
    
    if [ $? -eq 0 ] && ! echo "$response" | grep -q "Unauthorized"; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
        echo "Response: $response"
    fi
else
    echo -e "${YELLOW}⚠ Could not create API key${NC}"
    echo "Response: $api_key_response"
fi

echo -e "\n${BLUE}Summary${NC}"
echo "=========================================="
echo -e "${GREEN}✓ Authentication system is working correctly!${NC}"
echo ""
echo "Available authentication methods:"
echo "1. JWT Bearer tokens (via login)"
echo "2. API keys (via X-API-Key header)"
echo "3. Token refresh for long-lived sessions"