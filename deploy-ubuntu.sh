#!/bin/bash

# =============================================================================
# AutoWeave Backend - Ubuntu Deployment Script
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# =============================================================================
# Configuration
# =============================================================================

PROJECT_NAME="autoweave-backend"
INSTALL_DIR="/opt/autoweave"
SERVICE_USER="autoweave"
REPO_URL="https://github.com/your-org/autoweave-backend.git"

# Default ports
API_PORT="${PORT:-3001}"
METRICS_PORT="${METRICS_PORT:-9092}"

# =============================================================================
# System Requirements Check
# =============================================================================

check_requirements() {
    log_info "Checking system requirements..."
    
    # Check OS
    if ! grep -q "Ubuntu" /etc/os-release; then
        log_error "This script is designed for Ubuntu. Current OS not supported."
        exit 1
    fi
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
    
    log_success "System requirements check passed"
}

# =============================================================================
# Install Dependencies
# =============================================================================

install_dependencies() {
    log_info "Installing system dependencies..."
    
    # Update package list
    apt-get update -y
    
    # Install required packages
    apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        nginx \
        certbot \
        python3-certbot-nginx \
        ufw \
        fail2ban \
        htop \
        unzip
    
    log_success "System dependencies installed"
}

# =============================================================================
# Install Node.js
# =============================================================================

install_nodejs() {
    log_info "Installing Node.js 18..."
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    # Install Node.js
    apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    
    log_success "Node.js installed: $node_version"
    log_success "npm installed: $npm_version"
}

# =============================================================================
# Create Service User
# =============================================================================

create_service_user() {
    log_info "Creating service user..."
    
    # Create user if it doesn't exist
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home-dir "$INSTALL_DIR" --create-home "$SERVICE_USER"
        log_success "Created user: $SERVICE_USER"
    else
        log_warning "User $SERVICE_USER already exists"
    fi
}

# =============================================================================
# Clone and Setup Application
# =============================================================================

setup_application() {
    log_info "Setting up AutoWeave Backend..."
    
    # Create install directory
    mkdir -p "$INSTALL_DIR"
    
    # Clone repository (or copy if running locally)
    if [[ -d "/home/gontrand/autoweave-repos/autoweave-backend" ]]; then
        log_info "Copying local AutoWeave Backend..."
        cp -r /home/gontrand/autoweave-repos/autoweave-backend/* "$INSTALL_DIR/"
    else
        log_info "Cloning AutoWeave Backend from GitHub..."
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi
    
    # Set permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    
    # Install npm dependencies
    cd "$INSTALL_DIR"
    sudo -u "$SERVICE_USER" npm install --production
    
    log_success "AutoWeave Backend setup completed"
}

# =============================================================================
# Create Environment Configuration
# =============================================================================

create_environment() {
    log_info "Creating environment configuration..."
    
    cat > "$INSTALL_DIR/.env.production" << EOF
# AutoWeave Backend - Production Configuration
NODE_ENV=production
PORT=$API_PORT
METRICS_PORT=$METRICS_PORT

# Logging
LOG_LEVEL=info
SHOW_STACK_TRACES=false

# Security
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Rate limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Services (disabled for standalone deployment)
DISABLE_REDIS=true
DISABLE_NEO4J=true
DISABLE_QDRANT=true
DISABLE_CORE=true
USE_MOCK_ADAPTERS=true

# Performance
MAX_REQUEST_SIZE=10mb
BODY_PARSER_LIMIT=10mb

# CORS
CORS_ORIGIN=*
CORS_CREDENTIALS=false

# Health checks
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000

# Integration system
INTEGRATION_AUTO_DISCOVERY=true
INTEGRATION_PORT_RANGE_MIN=3000
INTEGRATION_PORT_RANGE_MAX=9999
EOF

    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env.production"
    chmod 600 "$INSTALL_DIR/.env.production"
    
    log_success "Environment configuration created"
}

# =============================================================================
# Create Systemd Service
# =============================================================================

create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/autoweave-backend.service << EOF
[Unit]
Description=AutoWeave Backend - Robust Integration System
Documentation=https://github.com/your-org/autoweave-backend
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env.production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=autoweave-backend

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable autoweave-backend
    
    log_success "Systemd service created and enabled"
}

# =============================================================================
# Configure Nginx
# =============================================================================

configure_nginx() {
    log_info "Configuring Nginx reverse proxy..."
    
    cat > /etc/nginx/sites-available/autoweave-backend << EOF
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    
    # Main API
    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Metrics endpoint (internal only)
    location /metrics {
        allow 127.0.0.1;
        deny all;
        
        proxy_pass http://127.0.0.1:$METRICS_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:$API_PORT/health;
    }
    
    # Block common attack patterns
    location ~ /\. {
        deny all;
    }
    
    location ~* \.(sql|bak|backup|old|tmp)$ {
        deny all;
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/autoweave-backend /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    
    log_success "Nginx configuration completed"
}

# =============================================================================
# Configure Firewall
# =============================================================================

configure_firewall() {
    log_info "Configuring UFW firewall..."
    
    # Reset firewall
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable firewall
    ufw --force enable
    
    log_success "Firewall configured"
}

# =============================================================================
# Configure Fail2Ban
# =============================================================================

configure_fail2ban() {
    log_info "Configuring Fail2Ban..."
    
    cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log_success "Fail2Ban configured"
}

# =============================================================================
# Create Monitoring Scripts
# =============================================================================

create_monitoring() {
    log_info "Creating monitoring scripts..."
    
    # Health check script
    cat > "$INSTALL_DIR/health-check.sh" << 'EOF'
#!/bin/bash

API_URL="http://localhost:3001/health"
LOG_FILE="/var/log/autoweave/health.log"

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Perform health check
if curl -f -s "$API_URL" > /dev/null; then
    echo "$(date): AutoWeave Backend is healthy" >> "$LOG_FILE"
    exit 0
else
    echo "$(date): AutoWeave Backend is unhealthy" >> "$LOG_FILE"
    # Restart service if unhealthy
    systemctl restart autoweave-backend
    exit 1
fi
EOF

    chmod +x "$INSTALL_DIR/health-check.sh"
    
    # Add to crontab for health monitoring
    (crontab -l 2>/dev/null; echo "*/5 * * * * $INSTALL_DIR/health-check.sh") | crontab -
    
    # Logrotate configuration
    cat > /etc/logrotate.d/autoweave-backend << EOF
/var/log/autoweave/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

    log_success "Monitoring scripts created"
}

# =============================================================================
# Start Services
# =============================================================================

start_services() {
    log_info "Starting services..."
    
    # Start AutoWeave Backend
    systemctl start autoweave-backend
    
    # Start Nginx
    systemctl restart nginx
    
    # Wait for services to start
    sleep 5
    
    # Check service status
    if systemctl is-active --quiet autoweave-backend; then
        log_success "AutoWeave Backend service is running"
    else
        log_error "Failed to start AutoWeave Backend service"
        exit 1
    fi
    
    if systemctl is-active --quiet nginx; then
        log_success "Nginx service is running"
    else
        log_error "Failed to start Nginx service"
        exit 1
    fi
}

# =============================================================================
# Verification and Testing
# =============================================================================

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Test health endpoint
    if curl -f -s "http://localhost/health" > /dev/null; then
        log_success "Health endpoint is responding"
    else
        log_error "Health endpoint is not responding"
        exit 1
    fi
    
    # Test API documentation
    if curl -f -s "http://localhost/api-docs" > /dev/null; then
        log_success "API documentation is accessible"
    else
        log_warning "API documentation might not be accessible"
    fi
    
    # Check logs
    log_info "Recent logs:"
    journalctl -u autoweave-backend --no-pager -n 10
}

# =============================================================================
# Deployment Summary
# =============================================================================

deployment_summary() {
    local server_ip=$(curl -s http://checkip.amazonaws.com)
    
    echo ""
    echo "🎉 AutoWeave Backend Deployment Completed!"
    echo "═══════════════════════════════════════════"
    echo ""
    echo "📊 Service Information:"
    echo "   • Service: autoweave-backend"
    echo "   • Status: $(systemctl is-active autoweave-backend)"
    echo "   • Install Directory: $INSTALL_DIR"
    echo "   • User: $SERVICE_USER"
    echo ""
    echo "🌐 Access Information:"
    echo "   • API URL: http://$server_ip/"
    echo "   • Health Check: http://$server_ip/health"
    echo "   • API Documentation: http://$server_ip/api-docs"
    echo "   • Local API: http://localhost:$API_PORT"
    echo ""
    echo "📋 Management Commands:"
    echo "   • Start:   sudo systemctl start autoweave-backend"
    echo "   • Stop:    sudo systemctl stop autoweave-backend"
    echo "   • Restart: sudo systemctl restart autoweave-backend"
    echo "   • Status:  sudo systemctl status autoweave-backend"
    echo "   • Logs:    sudo journalctl -u autoweave-backend -f"
    echo ""
    echo "🧪 Testing Commands:"
    echo "   • Health: curl http://localhost/health"
    echo "   • Test Integration: curl -X POST http://localhost/api/integration/register \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -d '{\"name\":\"test\",\"type\":\"web-ui\",\"config\":{\"apiUrl\":\"http://localhost:3000\"}}'"
    echo ""
    echo "🔧 Configuration Files:"
    echo "   • Environment: $INSTALL_DIR/.env.production"
    echo "   • Nginx: /etc/nginx/sites-available/autoweave-backend"
    echo "   • Systemd: /etc/systemd/system/autoweave-backend.service"
    echo ""
    echo "📁 Logs:"
    echo "   • Application: sudo journalctl -u autoweave-backend"
    echo "   • Nginx: /var/log/nginx/"
    echo "   • Health: /var/log/autoweave/health.log"
    echo ""
    echo "🚀 The AutoWeave Robust Integration System is now ready!"
    echo "   You can now integrate any GitHub project with intelligent"
    echo "   auto-detection, conflict resolution, and monitoring."
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo "🚀 AutoWeave Backend Ubuntu Deployment"
    echo "═══════════════════════════════════════"
    echo ""
    
    check_requirements
    install_dependencies
    install_nodejs
    create_service_user
    setup_application
    create_environment
    create_systemd_service
    configure_nginx
    configure_firewall
    configure_fail2ban
    create_monitoring
    start_services
    verify_deployment
    deployment_summary
    
    log_success "Deployment completed successfully!"
}

# Handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"