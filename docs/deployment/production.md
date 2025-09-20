# MISC MVP Production Deployment Guide

## Overview

This document provides a complete guide for deploying MISC MVP to production, covering server setup, security hardening, deployment procedures, monitoring, and maintenance. The deployment targets a self-hosted environment using Docker with PostgreSQL database.

## Production Requirements

### Infrastructure Requirements

| Component   | Minimum          | Recommended      | Purpose                |
| ----------- | ---------------- | ---------------- | ---------------------- |
| **CPU**     | 2 cores          | 4+ cores         | Application processing |
| **RAM**     | 4 GB             | 8+ GB            | Services + caching     |
| **Storage** | 50 GB SSD        | 100+ GB SSD      | Database + backups     |
| **Network** | 100 Mbps         | 1 Gbps           | User traffic           |
| **OS**      | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS | Host system            |

### Performance Targets

| Metric              | Target | Maximum |
| ------------------- | ------ | ------- |
| Concurrent users    | 100    | 200     |
| Requests/second     | 50     | 100     |
| Response time (p99) | <200ms | 500ms   |
| Uptime              | 99%    | 99.9%   |
| Database size       | 10GB   | 50GB    |

## Pre-Deployment Checklist

### Domain & DNS

- [ ] Domain registered and configured
- [ ] DNS A record pointing to server IP
- [ ] DNS propagation completed (check with `dig`)
- [ ] CAA record for Let's Encrypt (optional)

### Server Access

- [ ] SSH key authentication configured
- [ ] Root login disabled
- [ ] Non-root sudo user created
- [ ] Firewall configured (UFW/iptables)

### Environment Variables

- [ ] Google OAuth credentials obtained
- [ ] JWT secrets generated (min 32 chars)
- [ ] Database passwords set
- [ ] All placeholders replaced in .env

### Security Audit

- [ ] Security updates installed
- [ ] Unnecessary services disabled
- [ ] Fail2ban configured
- [ ] Backup strategy defined

## Server Setup

### 1. Initial Server Configuration

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
  curl \
  git \
  ufw \
  fail2ban \
  htop \
  ncdu \
  net-tools \
  software-properties-common

# Configure timezone
sudo timedatectl set-timezone UTC

# Configure swap (if needed)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

# Verify firewall status
sudo ufw status verbose
```

### 3. Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 4. Create Application User

```bash
# Create application user
sudo useradd -m -s /bin/bash miscapp
sudo usermod -aG docker miscapp

# Create application directories
sudo mkdir -p /opt/misc
sudo chown -R miscapp:miscapp /opt/misc

# Create data directories
sudo mkdir -p /var/lib/misc/{postgres,backups,logs}
sudo chown -R miscapp:miscapp /var/lib/misc
```

## Application Deployment

### 1. Clone Repository

```bash
# Switch to application user
sudo su - miscapp

# Clone repository
cd /opt/misc
git clone https://github.com/aiaiai-copilot/misc-poc.git .
git checkout main

# Create required directories
mkdir -p docker/{nginx/ssl,postgres,scripts}
```

### 2. Environment Configuration

```bash
# Create production .env file
cat > /opt/misc/.env.production << 'EOF'
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=misc_prod
DB_PASSWORD=GENERATE_STRONG_PASSWORD_HERE
DB_NAME=misc_production
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Authentication
GOOGLE_OAUTH_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-production-secret
JWT_SECRET=GENERATE_32_CHAR_SECRET_HERE
JWT_REFRESH_SECRET=GENERATE_DIFFERENT_32_CHAR_SECRET_HERE

# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://misc.yourdomain.com
VITE_API_URL=https://misc.yourdomain.com/api

# Domain
DOMAIN=misc.yourdomain.com
SSL_EMAIL=admin@yourdomain.com

# Monitoring
SENTRY_DSN=optional-sentry-dsn
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF

# Set secure permissions
chmod 600 /opt/misc/.env.production
```

### 3. Production Docker Compose

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: misc-nginx
    restart: always
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./certbot/conf:/etc/letsencrypt:ro
    depends_on:
      - api
    networks:
      - misc-network
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'

  postgres:
    image: postgres:15-alpine
    container_name: misc-postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_INITDB_ARGS: '--encoding=UTF-8'
    volumes:
      - /var/lib/misc/postgres:/var/lib/postgresql/data
      - ./docker/postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    networks:
      - misc-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER}']
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
      target: production
    container_name: misc-api
    restart: always
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - misc-network
    logging:
      driver: 'json-file'
      options:
        max-size: '50m'
        max-file: '5'

  frontend:
    build:
      context: .
      dockerfile: packages/presentation/web/Dockerfile
      target: production
      args:
        VITE_API_URL: ${VITE_API_URL}
    container_name: misc-frontend
    restart: always
    networks:
      - misc-network

networks:
  misc-network:
    driver: bridge
```

### 4. Nginx Configuration

```nginx
# docker/nginx/nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml application/atom+xml image/svg+xml
               text/javascript application/x-font-ttf font/opentype;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name misc.yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name misc.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/misc.yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/misc.yourdomain.com/privkey.pem;

        # Frontend
        location / {
            proxy_pass http://frontend:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API with rate limiting
        location /api {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://api:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Auth endpoints with stricter rate limiting
        location /auth {
            limit_req zone=auth burst=2 nodelay;

            proxy_pass http://api:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://api:3000/health;
            access_log off;
        }
    }
}
```

### 5. SSL Certificate Setup

```bash
# Initial certificate generation
docker run -it --rm \
  -v /opt/misc/certbot/conf:/etc/letsencrypt \
  -v /opt/misc/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  -w /var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d misc.yourdomain.com

# Auto-renewal cron job
echo "0 0,12 * * * root certbot renew --quiet && docker restart misc-nginx" \
  | sudo tee /etc/cron.d/certbot-renewal
```

## Database Setup

### PostgreSQL Configuration

```conf
# docker/postgres/postgresql.conf
# Performance Tuning
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 4MB

# Connections
max_connections = 100
superuser_reserved_connections = 3

# WAL
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB

# Query Tuning
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_statement = 'all'
log_duration = off
log_min_duration_statement = 100ms
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Autovacuum
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 30s

# Security
ssl = on
ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'
```

### Database Migrations

```bash
# Run migrations
docker compose -f docker-compose.production.yml exec api \
  yarn workspace @misc-poc/backend migrate:run

# Verify migration status
docker compose -f docker-compose.production.yml exec api \
  yarn workspace @misc-poc/backend migrate:show
```

## Deployment Process

### 1. Build and Deploy Script

```bash
#!/bin/bash
# deploy.sh

set -e

echo "Starting deployment..."

# Pull latest code
git pull origin main

# Load environment
set -a
source .env.production
set +a

# Build images
docker compose -f docker-compose.production.yml build --no-cache

# Stop services
docker compose -f docker-compose.production.yml down

# Start services
docker compose -f docker-compose.production.yml up -d

# Wait for services
sleep 10

# Run migrations
docker compose -f docker-compose.production.yml exec -T api \
  yarn workspace @misc-poc/backend migrate:run

# Health check
curl -f http://localhost/health || exit 1

echo "Deployment completed successfully!"
```

### 2. Zero-Downtime Deployment

```bash
#!/bin/bash
# zero-downtime-deploy.sh

# Build new images
docker compose -f docker-compose.production.yml build

# Start new containers alongside old ones
docker compose -f docker-compose.production.yml up -d --no-deps --scale api=2 api

# Wait for new container to be healthy
sleep 30

# Remove old container
docker compose -f docker-compose.production.yml up -d --no-deps --remove-orphans api

echo "Zero-downtime deployment completed!"
```

## Monitoring Setup

### 1. Health Monitoring

```bash
# Health check script
#!/bin/bash
# /opt/misc/scripts/health-check.sh

HEALTH_URL="https://misc.yourdomain.com/health"
SLACK_WEBHOOK="your-slack-webhook-url"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response -ne 200 ]; then
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d '{"text":"⚠️ MISC Health Check Failed! Status: '$response'"}'
fi
```

### 2. Log Aggregation

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yml:/etc/promtail/config.yml:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - misc-network

  loki:
    image: grafana/loki:latest
    ports:
      - '3100:3100'
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml:ro
    networks:
      - misc-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - '3001:3000'
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - misc-network

volumes:
  grafana_data:
```

### 3. Metrics Collection

```bash
# Install Node Exporter for system metrics
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
sudo cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/

# Create systemd service
sudo tee /etc/systemd/system/node_exporter.service << EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=miscapp
Group=miscapp
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter
```

## Backup Strategy

### 1. Automated Database Backup

```bash
#!/bin/bash
# /opt/misc/scripts/backup.sh

BACKUP_DIR="/var/lib/misc/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/misc_${TIMESTAMP}.sql.gz"

# Create backup
docker compose -f /opt/misc/docker-compose.production.yml exec -T postgres \
  pg_dump -U ${DB_USER} -d ${DB_NAME} | gzip > ${BACKUP_FILE}

# Upload to S3 (optional)
aws s3 cp ${BACKUP_FILE} s3://your-backup-bucket/misc/

# Keep only last 7 daily backups locally
find ${BACKUP_DIR} -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}"
```

### 2. Backup Cron Jobs

```cron
# Database backup - daily at 2 AM
0 2 * * * /opt/misc/scripts/backup.sh >> /var/lib/misc/logs/backup.log 2>&1

# Application files backup - weekly
0 3 * * 0 tar -czf /var/lib/misc/backups/app_$(date +\%Y\%m\%d).tar.gz /opt/misc

# Log rotation
0 0 * * * /usr/sbin/logrotate /etc/logrotate.d/misc
```

### 3. Restore Procedure

```bash
#!/bin/bash
# /opt/misc/scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  exit 1
fi

# Stop application
docker compose -f docker-compose.production.yml stop api

# Restore database
gunzip -c ${BACKUP_FILE} | docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U ${DB_USER} -d ${DB_NAME}

# Start application
docker compose -f docker-compose.production.yml start api

echo "Restore completed from: ${BACKUP_FILE}"
```

## Security Hardening

### 1. Fail2ban Configuration

```ini
# /etc/fail2ban/jail.d/misc.conf
[misc-auth]
enabled = true
filter = misc-auth
logpath = /var/lib/docker/containers/*/*-json.log
maxretry = 5
bantime = 3600
findtime = 600

[misc-api]
enabled = true
filter = misc-api
logpath = /var/lib/docker/containers/*/*-json.log
maxretry = 100
bantime = 600
findtime = 60
```

### 2. Security Audit Script

```bash
#!/bin/bash
# security-audit.sh

echo "Running security audit..."

# Check for security updates
apt list --upgradable

# Check open ports
netstat -tulpn

# Check running processes
ps aux | grep -v "kernel"

# Check Docker security
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/docker-bench-security

# Check SSL configuration
nmap --script ssl-enum-ciphers -p 443 misc.yourdomain.com

echo "Security audit completed"
```

## Maintenance Procedures

### 1. Regular Maintenance Tasks

| Task                | Frequency | Command/Procedure                                    |
| ------------------- | --------- | ---------------------------------------------------- |
| Security updates    | Weekly    | `apt update && apt upgrade`                          |
| SSL renewal         | Monthly   | `certbot renew`                                      |
| Database vacuum     | Weekly    | `docker exec misc-postgres vacuumdb -U misc -d misc` |
| Log rotation        | Daily     | `logrotate /etc/logrotate.d/misc`                    |
| Backup verification | Weekly    | Test restore to staging                              |
| Performance review  | Monthly   | Check metrics and logs                               |

### 2. Update Procedure

```bash
#!/bin/bash
# update.sh

# Backup before update
/opt/misc/scripts/backup.sh

# Pull latest changes
git pull origin main

# Rebuild and deploy
/opt/misc/scripts/deploy.sh

# Verify deployment
curl -f https://misc.yourdomain.com/health || exit 1

echo "Update completed successfully"
```

## Troubleshooting

### Common Issues and Solutions

| Issue                          | Diagnosis                   | Solution                          |
| ------------------------------ | --------------------------- | --------------------------------- |
| **High memory usage**          | `docker stats`              | Increase swap, optimize queries   |
| **Slow queries**               | Check pg_stat_statements    | Add indexes, optimize queries     |
| **SSL errors**                 | `openssl s_client -connect` | Renew certificates                |
| **Container crashes**          | `docker logs misc-api`      | Check error logs, increase memory |
| **Database connection issues** | `pg_isready`                | Check credentials, network        |
| **High CPU usage**             | `htop`                      | Scale horizontally, optimize code |

### Emergency Procedures

```bash
# Emergency rollback
git checkout [previous-commit]
./deploy.sh

# Emergency database restore
docker compose down
./scripts/restore.sh /path/to/last-known-good-backup
docker compose up -d

# Emergency maintenance mode
# Add to nginx.conf:
location / {
  return 503;
  error_page 503 @maintenance;
}
location @maintenance {
  rewrite ^.*$ /maintenance.html break;
}
```

## Performance Tuning

### 1. Application Optimization

```yaml
# PM2 configuration for Node.js clustering
apps:
  - script: dist/index.js
    name: misc-api
    instances: 4
    exec_mode: cluster
    max_memory_restart: 1G
    env:
      NODE_ENV: production
```

### 2. Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM records
WHERE user_id = $1
  AND normalized_tags @> ARRAY['tag1', 'tag2'];

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_records_user_created
ON records(user_id, created_at DESC);

-- Update statistics
ANALYZE records;
```

## Monitoring Dashboards

### Key Metrics to Track

| Metric               | Target | Alert Threshold |
| -------------------- | ------ | --------------- |
| CPU Usage            | <70%   | >80%            |
| Memory Usage         | <80%   | >90%            |
| Disk Usage           | <70%   | >85%            |
| Response Time (p99)  | <200ms | >500ms          |
| Error Rate           | <1%    | >5%             |
| Active Users         | -      | Track trends    |
| Database Connections | <80    | >90             |

## Disaster Recovery

### Recovery Plan

1. **Detection** - Automated monitoring alerts
2. **Assessment** - Determine scope of issue
3. **Communication** - Notify stakeholders
4. **Recovery** - Execute appropriate procedure
5. **Verification** - Confirm service restoration
6. **Post-mortem** - Document and learn

### RTO/RPO Targets

- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 24 hours
- **Backup retention**: 30 days
- **Geographic redundancy**: Optional for MVP

## References

- [Docker Production Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
- [Let's Encrypt Production](https://letsencrypt.org/docs/)
- [OWASP Security Checklist](https://owasp.org/www-project-web-security-testing-guide/)
