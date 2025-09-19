# MISC MVP - Getting Started Guide

## Prerequisites

Before starting, ensure you have the following installed:

### Required Software

| Software          | Version | Check Command            | Installation Guide                                                            |
| ----------------- | ------- | ------------------------ | ----------------------------------------------------------------------------- |
| Node.js           | 22.18.0 | `node -v`                | [nodejs.org](https://nodejs.org/) or use [nvm](https://github.com/nvm-sh/nvm) |
| Yarn              | 3.6.4   | `yarn -v`                | `corepack enable && corepack prepare yarn@3.6.4 --activate`                   |
| Docker            | 20.10+  | `docker -v`              | [docker.com](https://docs.docker.com/get-docker/)                             |
| Docker Compose    | 2.0+    | `docker compose version` | Included with Docker Desktop                                                  |
| Git               | 2.30+   | `git --version`          | [git-scm.com](https://git-scm.com/)                                           |
| PostgreSQL client | 15+     | `psql --version`         | Optional, for database debugging                                              |

### Google OAuth Setup

You'll need Google OAuth credentials for authentication:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
5. Save Client ID and Client Secret

## Quick Start (5 minutes)

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/aiaiai-copilot/misc-poc.git
cd misc-poc

# Use correct Node version
nvm use  # or manually install Node 22.18.0

# Enable Yarn 3
corepack enable
corepack prepare yarn@3.6.4 --activate

# Install dependencies
yarn install
```

### 2. Environment Configuration

Create `.env.local` in project root:

```env
# Database
DATABASE_URL=postgresql://misc:misc_password@localhost:5432/misc
DB_HOST=localhost
DB_PORT=5432
DB_USER=misc
DB_PASSWORD=misc_password
DB_NAME=misc

# Authentication
GOOGLE_OAUTH_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret-here
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_REFRESH_SECRET=another-super-secret-key-for-refresh-tokens

# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Optional
LOG_LEVEL=debug
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Start Development Environment

```bash
# Start PostgreSQL with Docker
docker compose up -d postgres

# Wait for database to be ready (first time only)
sleep 5

# Run database migrations
yarn workspace @misc-poc/backend migrate:run

# Start backend server (Terminal 1)
yarn workspace @misc-poc/backend dev

# Start frontend (Terminal 2)
yarn workspace @misc-poc/presentation-web dev
```

### 4. Verify Installation

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Health: http://localhost:3000/health

You should see:

- Frontend: MISC interface with input field
- Health endpoint: `{"status":"healthy","database":"connected"}`

## Project Structure

```
misc-poc/
├── packages/                      # Monorepo packages
│   ├── domain/                   # Business logic (unchanged from prototype)
│   ├── application/              # Use cases (enhanced for multi-user)
│   ├── backend/                  # NEW: Express API server
│   │   ├── src/
│   │   │   ├── api/             # Route handlers
│   │   │   ├── auth/            # Google OAuth
│   │   │   ├── middleware/      # JWT, rate limiting
│   │   │   ├── migrations/      # Database migrations
│   │   │   └── repositories/    # PostgreSQL implementations
│   │   └── package.json
│   ├── infrastructure/
│   │   └── localStorage/         # Prototype storage (preserved)
│   ├── presentation/
│   │   └── web/                 # React frontend (adapted)
│   └── shared/                  # Common utilities
└── docker-compose.yml           # Docker services configuration
```

## Development Workflow

### 1. Database Operations

```bash
# Create new migration
yarn workspace @misc-poc/backend migrate:create AddNewTable

# Run pending migrations
yarn workspace @misc-poc/backend migrate:run

# Rollback last migration
yarn workspace @misc-poc/backend migrate:rollback

# Reset database (DANGER: deletes all data)
yarn workspace @misc-poc/backend db:reset

# Access PostgreSQL directly
docker compose exec postgres psql -U misc -d misc
```

### 2. Running Tests (TDD Approach)

```bash
# Run all tests with coverage
yarn test

# Backend tests only
yarn workspace @misc-poc/backend test

# Watch mode for TDD
yarn workspace @misc-poc/backend test:watch

# E2E tests
yarn test:e2e

# Check test coverage
yarn test:coverage
```

### 3. Building for Production

```bash
# Build all packages
yarn build

# Build backend only
yarn workspace @misc-poc/backend build

# Build frontend only
yarn workspace @misc-poc/presentation-web build
```

## Docker Compose Services

### Complete Development Stack

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: misc
      POSTGRES_PASSWORD: misc_password
      POSTGRES_DB: misc
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U misc']
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://misc:misc_password@postgres:5432/misc
      GOOGLE_OAUTH_CLIENT_ID: ${GOOGLE_OAUTH_CLIENT_ID}
      GOOGLE_OAUTH_CLIENT_SECRET: ${GOOGLE_OAUTH_CLIENT_SECRET}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./packages/backend:/app/packages/backend
      - /app/packages/backend/node_modules

  frontend:
    build:
      context: .
      dockerfile: packages/presentation/web/Dockerfile
    ports:
      - '5173:5173'
    environment:
      VITE_API_URL: http://localhost:3000
    volumes:
      - ./packages/presentation/web:/app/packages/presentation/web
      - /app/packages/presentation/web/node_modules

volumes:
  postgres_data:
```

### Starting Everything with Docker

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f api

# Stop all services
docker compose down

# Stop and remove volumes (reset data)
docker compose down -v
```

## Common Issues and Solutions

### Issue: Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Issue: Database Connection Failed

```bash
# Check PostgreSQL is running
docker compose ps

# Check logs
docker compose logs postgres

# Restart PostgreSQL
docker compose restart postgres

# Verify connection
docker compose exec postgres psql -U misc -d misc -c "SELECT 1"
```

### Issue: Yarn Installation Fails

```bash
# Clear Yarn cache
yarn cache clean

# Remove node_modules and reinstall
rm -rf node_modules packages/*/node_modules
rm yarn.lock
yarn install

# Ensure correct Yarn version
yarn set version 3.6.4
```

### Issue: Google OAuth Not Working

1. Check redirect URI matches exactly: `http://localhost:3000/auth/google/callback`
2. Ensure Google+ API is enabled in Google Cloud Console
3. Verify Client ID and Secret are correct in `.env.local`
4. Check browser console for specific error messages

### Issue: Migration Errors

```bash
# Check migration status
yarn workspace @misc-poc/backend migrate:show

# Create fresh database
docker compose down -v
docker compose up -d postgres
yarn workspace @misc-poc/backend migrate:run
```

## IDE Setup

### VS Code Extensions

Install recommended extensions for best development experience:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "streetsidesoftware.code-spell-checker",
    "orta.vscode-jest",
    "firsttris.vscode-jest-runner",
    "ms-vscode.vscode-typescript-tslint-plugin",
    "mikestead.dotenv"
  ]
}
```

### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "jest.autoRun": {
    "watch": true
  }
}
```

## Testing Your Setup

### 1. Create Test User

1. Open http://localhost:5173
2. Click "Sign in with Google"
3. Complete OAuth flow
4. You should be redirected back to the app

### 2. Create Test Records

```javascript
// In browser console or via API
const testRecords = [
  'meeting project alpha tomorrow 15:00',
  'todo buy groceries milk bread eggs',
  'password github token ghp_xxxxxxxxxxxx',
  'birthday john march 15 1990',
];

// Records will be created via UI
```

### 3. Test Search

- Type "meeting" - should find meeting record
- Type "todo groceries" - should find shopping record (AND logic)
- Clear search - should show all records

### 4. Test Import/Export

1. Click Export - downloads JSON file
2. Click Import - select downloaded file
3. Verify all records preserved

## Debugging

### Enable Debug Logging

```bash
# Backend debug logs
DEBUG=misc:* yarn workspace @misc-poc/backend dev

# Database query logs
DATABASE_LOG=true yarn workspace @misc-poc/backend dev
```

### Database Inspection

```sql
-- Connect to database
docker compose exec postgres psql -U misc -d misc

-- Check tables
\dt

-- View records
SELECT * FROM records WHERE user_id = 'your-user-id';

-- Check indexes
\di

-- View active connections
SELECT * FROM pg_stat_activity;
```

### API Testing with cURL

```bash
# Health check
curl http://localhost:3000/health

# Get auth token (after login)
# Copy JWT from browser DevTools > Application > Cookies

# Test authenticated endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/records

# Create record
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"test record tags here"}' \
  http://localhost:3000/api/records
```

## Next Steps

1. **Read the Architecture Documentation**: [docs/architecture/README.md](../architecture/README.md)
2. **Understand the API**: Import [OpenAPI spec](../api/openapi.yaml) into Postman
3. **Review TDD Requirements**: [docs/development/testing-strategy.md](./testing-strategy.md)
4. **Check TaskMaster Tasks**: `.taskmaster/tasks/tasks.json`
5. **Join Development**:
   - Pick a task from TaskMaster
   - Write tests first (TDD)
   - Create feature branch
   - Submit PR with test coverage

## Useful Commands Reference

```bash
# Development
yarn dev              # Start everything
yarn test            # Run all tests
yarn lint            # Check code style
yarn typecheck       # TypeScript validation
yarn build           # Production build

# Database
yarn migrate:run     # Run migrations
yarn migrate:create  # New migration
yarn db:reset       # Reset database

# Docker
docker compose up -d      # Start services
docker compose logs -f    # View logs
docker compose down      # Stop services
docker compose down -v   # Reset everything

# Debugging
yarn workspace @misc-poc/backend dev --inspect  # Node debugger
yarn test:e2e:debug                            # E2E debug mode
```

## Getting Help

- **Documentation**: Check `/docs` folder
- **Issues**: [GitHub Issues](https://github.com/aiaiai-copilot/misc-poc/issues)
- **TaskMaster**: Review `.taskmaster/docs/prd.txt` for requirements
- **Tests**: Look at existing tests for usage examples

---

_Ready to build the MVP! Remember: Test-Driven Development is mandatory - write tests first!_
