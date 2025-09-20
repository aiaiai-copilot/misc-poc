# MISC MVP Docker Setup Guide

## Overview

This document provides comprehensive Docker configuration for MISC MVP, covering development, testing, and production environments. The setup uses Docker Compose for orchestration and includes all necessary services.

## Prerequisites

### Required Software

| Software       | Minimum Version | Check Command            | Purpose                     |
| -------------- | --------------- | ------------------------ | --------------------------- |
| Docker         | 20.10+          | `docker --version`       | Container runtime           |
| Docker Compose | 2.0+            | `docker compose version` | Service orchestration       |
| Make           | 3.81+           | `make --version`         | Build automation (optional) |

### System Requirements

| Resource | Development | Production |
| -------- | ----------- | ---------- |
| CPU      | 2 cores     | 4+ cores   |
| RAM      | 4 GB        | 8+ GB      |
| Disk     | 10 GB       | 50+ GB     |
| Network  | Local       | Public IP  |

## Project Structure

```
misc-poc/
├── docker-compose.yml           # Development configuration
├── docker-compose.prod.yml      # Production overrides
├── docker-compose.test.yml      # Testing configuration
├── .dockerignore               # Files to exclude from build
├── Makefile                    # Docker commands automation
├── packages/
│   ├── backend/
│   │   ├── Dockerfile         # API server image
│   │   └── .dockerignore      # Backend-specific ignores
│   └── presentation/web/
│       ├── Dockerfile         # Frontend build image
│       └── nginx.conf         # Nginx configuration
├── docker/
│   ├── postgres/
│   │   └── init.sql          # Database initialization
│   ├── nginx/
│   │   ├── nginx.conf        # Main Nginx config
│   │   └── ssl/              # SSL certificates
│   └── scripts/
│       ├── wait-for-it.sh    # Service readiness check
│       └── backup.sh          # Database backup script
└── .env.example               # Environment variables template
```

## Development Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: misc-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-misc}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-misc_password}
      POSTGRES_DB: ${DB_NAME:-misc}
      POSTGRES_INITDB_ARGS: '--encoding=UTF-8 --locale=en_US.UTF-8'
    ports:
      - '${DB_PORT:-5432}:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER:-misc} -d ${DB_NAME:-misc}']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - misc-network

  # API Backend Server
  api:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
      target: development
      args:
        NODE_VERSION: 22.18.0
    container_name: misc-api
    restart: unless-stopped
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://${DB_USER:-misc}:${DB_PASSWORD:-misc_password}@postgres:5432/${DB_NAME:-misc}
      GOOGLE_OAUTH_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID}
      GOOGLE_OAUTH_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      PORT: 3000
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:5173}
    ports:
      - '${API_PORT:-3000}:3000'
      - '9229:9229' # Node.js debugging port
    volumes:
      - ./packages:/app/packages:cached
      - /app/node_modules
      - /app/packages/backend/node_modules
    depends_on:
      postgres:
        condition: service_healthy
    command: yarn workspace @misc-poc/backend dev --inspect=0.0.0.0:9229
    networks:
      - misc-network

  # Frontend Development Server
  frontend:
    build:
      context: .
      dockerfile: packages/presentation/web/Dockerfile
      target: development
      args:
        NODE_VERSION: 22.18.0
    container_name: misc-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: development
      VITE_API_URL: ${VITE_API_URL:-http://localhost:3000}
    ports:
      - '${FRONTEND_PORT:-5173}:5173'
    volumes:
      - ./packages:/app/packages:cached
      - /app/node_modules
      - /app/packages/presentation/web/node_modules
    command: yarn workspace @misc-poc/presentation-web dev --host 0.0.0.0
    networks:
      - misc-network

  # Mailhog for email testing (optional)
  mailhog:
    image: mailhog/mailhog:latest
    container_name: misc-mailhog
    ports:
      - '1025:1025' # SMTP
      - '8025:8025' # Web UI
    networks:
      - misc-network
    profiles:
      - dev-tools

volumes:
  postgres_data:
    driver: local

networks:
  misc-network:
    driver: bridge
```

### Backend Dockerfile

```dockerfile
# packages/backend/Dockerfile

# Build stage for dependencies
FROM node:22.18.0-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY packages/backend/package.json packages/backend/
COPY packages/domain/package.json packages/domain/
COPY packages/application/package.json packages/application/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN yarn install --immutable

# Development stage
FROM node:22.18.0-alpine AS development

WORKDIR /app

# Install useful tools for debugging
RUN apk add --no-cache bash curl postgresql-client

# Copy dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/.yarn ./.yarn
COPY --from=dependencies /app/.yarnrc.yml ./

# Copy source code (will be overridden by volume in dev)
COPY . .

EXPOSE 3000 9229

CMD ["yarn", "workspace", "@misc-poc/backend", "dev"]

# Build stage for production
FROM dependencies AS builder

WORKDIR /app

# Copy all source code
COPY . .

# Build all packages
RUN yarn build

# Production stage
FROM node:22.18.0-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/packages/backend/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/backend/package.json ./

# Switch to non-root user
USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### Frontend Dockerfile

```dockerfile
# packages/presentation/web/Dockerfile

# Build stage for dependencies
FROM node:22.18.0-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY packages/presentation/web/package.json packages/presentation/web/
COPY packages/domain/package.json packages/domain/
COPY packages/application/package.json packages/application/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN yarn install --immutable

# Development stage
FROM node:22.18.0-alpine AS development

WORKDIR /app

# Copy dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/.yarn ./.yarn
COPY --from=dependencies /app/.yarnrc.yml ./

# Copy source code
COPY . .

EXPOSE 5173

CMD ["yarn", "workspace", "@misc-poc/presentation-web", "dev", "--host", "0.0.0.0"]

# Build stage
FROM dependencies AS builder

WORKDIR /app

# Copy source code
COPY . .

# Build application
RUN yarn workspace @misc-poc/presentation-web build

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy built files
COPY --from=builder /app/packages/presentation/web/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY packages/presentation/web/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## Production Configuration

### docker-compose.prod.yml

```yaml
version: '3.8'

services:
  # Nginx Reverse Proxy
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
      - frontend
    networks:
      - misc-network

  # PostgreSQL with production settings
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    networks:
      - misc-network
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  # API Server
  api:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
      target: production
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      GOOGLE_OAUTH_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID}
      GOOGLE_OAUTH_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    networks:
      - misc-network
    deploy:
      replicas: 2
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3

  # Frontend served by Nginx
  frontend:
    build:
      context: .
      dockerfile: packages/presentation/web/Dockerfile
      target: production
      args:
        VITE_API_URL: ${VITE_API_URL}
    restart: always
    networks:
      - misc-network

  # Certbot for SSL certificates
  certbot:
    image: certbot/certbot:latest
    container_name: misc-certbot
    volumes:
      - ./certbot/www:/var/www/certbot:rw
      - ./certbot/conf:/etc/letsencrypt:rw
    profiles:
      - ssl

volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/misc/postgres

networks:
  misc-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## Environment Variables

### .env.example

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=misc
DB_PASSWORD=CHANGE_THIS_IN_PRODUCTION
DB_NAME=misc
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Authentication
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
JWT_SECRET=CHANGE_THIS_MINIMUM_32_CHARACTERS
JWT_REFRESH_SECRET=CHANGE_THIS_DIFFERENT_FROM_JWT_SECRET

# Application
NODE_ENV=development
API_PORT=3000
FRONTEND_PORT=5173
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000

# Production
DOMAIN=misc.example.com
SSL_EMAIL=admin@example.com

# Optional
LOG_LEVEL=info
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
SENTRY_DSN=
```

## Docker Commands

### Makefile

```makefile
# Makefile for Docker operations

.PHONY: help
help:
	@echo "Available commands:"
	@echo "  make dev          - Start development environment"
	@echo "  make prod         - Start production environment"
	@echo "  make test         - Run tests in Docker"
	@echo "  make build        - Build all images"
	@echo "  make clean        - Stop and remove all containers"
	@echo "  make logs         - Show logs"
	@echo "  make backup       - Backup database"
	@echo "  make restore      - Restore database"
	@echo "  make migrate      - Run database migrations"
	@echo "  make ssl          - Generate SSL certificates"

.PHONY: dev
dev:
	docker compose up -d
	@echo "Development environment started:"
	@echo "  Frontend: http://localhost:5173"
	@echo "  API: http://localhost:3000"
	@echo "  Database: localhost:5432"

.PHONY: prod
prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo "Production environment started"

.PHONY: test
test:
	docker compose -f docker-compose.test.yml up --abort-on-container-exit
	docker compose -f docker-compose.test.yml down

.PHONY: build
build:
	docker compose build --no-cache

.PHONY: clean
clean:
	docker compose down -v
	docker system prune -f

.PHONY: logs
logs:
	docker compose logs -f

.PHONY: backup
backup:
	./docker/scripts/backup.sh

.PHONY: restore
restore:
	@read -p "Backup file path: " backup_file; \
	./docker/scripts/restore.sh $$backup_file

.PHONY: migrate
migrate:
	docker compose exec api yarn workspace @misc-poc/backend migrate:run

.PHONY: ssl
ssl:
	docker compose --profile ssl run --rm certbot certonly \
		--webroot -w /var/www/certbot \
		--email ${SSL_EMAIL} \
		--agree-tos \
		--no-eff-email \
		-d ${DOMAIN}
```

## Service Health Checks

### Health Check Endpoints

```yaml
healthchecks:
  postgres:
    test: pg_isready -U ${DB_USER}
    interval: 10s
    timeout: 5s
    retries: 5

  api:
    test: curl -f http://localhost:3000/health || exit 1
    interval: 30s
    timeout: 10s
    retries: 3

  frontend:
    test: curl -f http://localhost:80 || exit 1
    interval: 30s
    timeout: 10s
    retries: 3

  nginx:
    test: nginx -t || exit 1
    interval: 30s
    timeout: 10s
    retries: 3
```

## Database Backup & Restore

### Backup Script

```bash
#!/bin/bash
# docker/scripts/backup.sh

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/misc_${TIMESTAMP}.sql"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Perform backup
docker compose exec -T postgres pg_dump \
  -U ${DB_USER} \
  -d ${DB_NAME} \
  --clean \
  --if-exists \
  > ${BACKUP_FILE}

# Compress backup
gzip ${BACKUP_FILE}

echo "Backup created: ${BACKUP_FILE}.gz"

# Clean old backups (keep last 30)
find ${BACKUP_DIR} -name "*.gz" -mtime +30 -delete
```

### Restore Script

```bash
#!/bin/bash
# docker/scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  exit 1
fi

# Decompress if needed
if [[ ${BACKUP_FILE} == *.gz ]]; then
  gunzip -c ${BACKUP_FILE} | docker compose exec -T postgres psql \
    -U ${DB_USER} \
    -d ${DB_NAME}
else
  docker compose exec -T postgres psql \
    -U ${DB_USER} \
    -d ${DB_NAME} \
    < ${BACKUP_FILE}
fi

echo "Restore completed from: ${BACKUP_FILE}"
```

## Networking

### Network Architecture

```
External Traffic
       │
       ▼
   [Nginx:443]──────┐
       │            │
   [SSL Term]    [Static]
       │            │
       ▼            ▼
   [API:3000]   [Frontend:80]
       │
       ▼
  [PostgreSQL:5432]
```

### Network Configuration

```yaml
networks:
  misc-network:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/16
          gateway: 172.20.0.1
```

### Service Discovery

Services communicate using Docker's internal DNS:

- `postgres` → PostgreSQL database
- `api` → Backend API server
- `frontend` → Frontend server
- `nginx` → Reverse proxy

## Security Considerations

### Container Security

1. **Non-root users**: All containers run as non-root
2. **Read-only filesystems**: Where possible
3. **Minimal base images**: Alpine Linux
4. **Security scanning**: Regular vulnerability scans
5. **Secrets management**: Environment variables, not in images

### Network Security

```yaml
security_opt:
  - no-new-privileges:true
  - apparmor:docker-default
  - seccomp:default

cap_drop:
  - ALL

cap_add:
  - NET_BIND_SERVICE # Only for Nginx
```

## Monitoring

### Logging Configuration

```yaml
logging:
  driver: json-file
  options:
    max-size: '10m'
    max-file: '3'
    labels: 'service,environment'
```

### Metrics Collection

```yaml
# Add to docker-compose.yml for monitoring
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./docker/prometheus:/etc/prometheus
    - prometheus_data:/prometheus
  ports:
    - '9090:9090'
  profiles:
    - monitoring

grafana:
  image: grafana/grafana:latest
  volumes:
    - grafana_data:/var/lib/grafana
  ports:
    - '3001:3000'
  profiles:
    - monitoring
```

## Troubleshooting

### Common Issues

| Issue                          | Solution                                  |
| ------------------------------ | ----------------------------------------- |
| **Port conflicts**             | Change ports in .env file                 |
| **Database connection failed** | Check postgres health, verify credentials |
| **Out of memory**              | Increase Docker memory limit              |
| **Slow builds**                | Use BuildKit: `DOCKER_BUILDKIT=1`         |
| **Volume permissions**         | Run `docker compose down -v` and rebuild  |
| **SSL certificate errors**     | Verify domain DNS, check certbot logs     |

### Debug Commands

```bash
# View container logs
docker compose logs -f [service]

# Execute commands in container
docker compose exec api sh

# Inspect container
docker inspect misc-api

# Check resource usage
docker stats

# Network debugging
docker network inspect misc-poc_misc-network

# Database connection test
docker compose exec api yarn workspace @misc-poc/backend db:test
```

## Performance Optimization

### Build Optimization

```dockerfile
# Use BuildKit
# export DOCKER_BUILDKIT=1

# Multi-stage builds
# Cache dependencies separately
# Minimize layers
# Use .dockerignore
```

### Runtime Optimization

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/docker.yml
name: Docker CI

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Build images
        run: |
          docker compose build

      - name: Run tests
        run: |
          docker compose -f docker-compose.test.yml up --abort-on-container-exit

      - name: Push to registry
        if: github.ref == 'refs/heads/main'
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker compose push
```

## References

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Nginx Docker Image](https://hub.docker.com/_/nginx)
