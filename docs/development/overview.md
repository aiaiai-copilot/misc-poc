# MISC MVP - Developer Overview

## What is MISC?

MISC (MindSection) is a radical experiment in information management that follows a single principle: **everything is tags**. No folders, no categories, no document types - just words separated by spaces.

### Core Philosophy

Every record is simply a set of words. Each word is simultaneously:

- The content itself
- A way to find that content

**Example:**

```
peter ivanov phone 89151234455 birthday march 15
github password qwerty123 igor@gmail.com
meeting tomorrow 15:00 office project_alpha
```

Search "peter phone" → find Peter's contact  
Search "password" → see all saved passwords  
Search "birthday" → list all birthdays

## From Prototype to MVP

### Prototype (Completed) ✅

- Single-user web application
- localStorage for data persistence
- Clean Architecture implementation
- 50 tasks completed with 95%+ test coverage
- Instant search and tag management

### MVP (Current Phase) 🚀

Transforming the prototype into a production-ready multi-user system while preserving the radical simplicity.

#### Key Additions:

- **Multi-user support** with complete data isolation
- **Server backend** (Node.js/Express)
- **PostgreSQL database** replacing localStorage
- **Google OAuth** authentication
- **RESTful API** for all operations
- **Docker deployment** ready for self-hosting

#### What Stays the Same:

- Core business logic (Domain & Application layers)
- Minimalist UI philosophy
- Instant search experience
- Zero learning curve
- Tag normalization and validation rules

## Architecture Overview

### Layered Architecture (Clean Architecture)

```
┌─────────────────────────────────────┐
│     Presentation (React SPA)        │ ← User Interface
├─────────────────────────────────────┤
│      REST API (Express)             │ ← API Gateway
├─────────────────────────────────────┤
│   Application (Use Cases)           │ ← Business Operations
├─────────────────────────────────────┤
│    Domain (Entities & Rules)        │ ← Core Business Logic
├─────────────────────────────────────┤
│  Infrastructure (PostgreSQL)        │ ← Data Persistence
└─────────────────────────────────────┘
```

### Key Architectural Decisions:

1. **Domain logic unchanged** - All business rules from prototype preserved
2. **Repository pattern** - Easy switch between localStorage and PostgreSQL
3. **TDD mandatory** - Every feature starts with a failing test
4. **JWT authentication** - Stateless, scalable user sessions
5. **Docker-first** - Consistent development and deployment

## Development Approach

### Test-Driven Development (Strict)

```
1. RED    → Write failing test (specification)
2. GREEN  → Write minimal code to pass
3. REFACTOR → Improve while keeping tests green
```

**Coverage Requirements:**

- Domain Layer: >95%
- Use Cases: >90%
- API Routes: >85%

### Development Phases

| Phase                | Duration  | Focus                               |
| -------------------- | --------- | ----------------------------------- |
| Backend Foundation   | Week 1-2  | PostgreSQL, Migrations, User entity |
| Authentication       | Week 3    | Google OAuth, JWT, Sessions         |
| Core API             | Week 4-5  | CRUD, Search, Tag statistics        |
| Frontend Integration | Week 6-7  | API client, Async state             |
| Import/Export        | Week 8    | Data migration from v1.0            |
| Deployment           | Week 9-10 | Docker, SSL, Production             |

## Quick Start for Developers

### Prerequisites

```bash
# Required versions (from .nvmrc and package.json)
Node.js 22.18.0
Yarn 3.6.4
Docker & Docker Compose
PostgreSQL 15+
```

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/aiaiai-copilot/misc-poc.git
cd misc-poc

# 2. Install dependencies
nvm use
yarn install

# 3. Start PostgreSQL (Docker)
docker-compose up -d postgres

# 4. Run migrations
yarn workspace @misc-poc/backend migrate

# 5. Start development server
yarn workspace @misc-poc/backend dev

# 6. Start frontend (separate terminal)
yarn workspace @misc-poc/presentation-web dev
```

### Environment Variables

```env
# .env.local
DATABASE_URL=postgresql://misc:password@localhost:5432/misc
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
JWT_SECRET=your-secret-key
```

## Key Technical Decisions

### Why PostgreSQL over localStorage?

- **Multi-user support** - Concurrent access with ACID guarantees
- **Scalability** - Can handle 100+ concurrent users
- **Backup/Recovery** - Built-in tools for data safety
- **Performance** - Indexed searches on 10K+ records in <200ms

### Why Google OAuth?

- **Zero passwords** - No password management needed
- **Trusted provider** - Users already have Google accounts
- **Quick implementation** - Well-documented, battle-tested
- **Future expansion** - Easy to add more providers

### Why Docker?

- **Consistent environments** - Same setup for all developers
- **Easy deployment** - Single `docker-compose up`
- **Dependency management** - PostgreSQL, Nginx bundled
- **Scaling ready** - Path to Kubernetes when needed

## Performance Targets

| Operation            | Target | Rationale                         |
| -------------------- | ------ | --------------------------------- |
| Authentication       | <2s    | Including Google OAuth round-trip |
| Record Creation      | <100ms | Near-instant feedback             |
| Search (10K records) | <200ms | Perceived as instant              |
| Export (10K records) | <5s    | Acceptable for bulk operation     |
| Page Load            | <2s    | First meaningful paint            |

## Security Considerations

- **JWT in httpOnly cookies** - XSS protection
- **HTTPS only** - Let's Encrypt certificates
- **Input sanitization** - Prevent SQL injection
- **Rate limiting** - 100 requests/minute per user
- **CORS restricted** - Only application domain
- **CSP headers** - XSS mitigation

## Migration from Prototype

### Data Migration Path

1. User exports data from prototype (JSON format)
2. Creates account in MVP (Google OAuth)
3. Imports JSON file
4. System validates and migrates data
5. All records available with preserved timestamps

### What Changes for Users?

- **Added**: Login with Google
- **Added**: Data persists across devices
- **Added**: Automatic backups
- **Same**: UI and interaction patterns
- **Same**: All keyboard shortcuts
- **Same**: Search behavior

## Contributing

### Working with TaskMaster AI

The project uses TaskMaster AI for task management. The source of truth for requirements is:

```
.taskmaster/docs/prd.txt
```

### Development Workflow

1. Pick task from TaskMaster
2. Write tests first (TDD)
3. Implement to pass tests
4. Ensure >90% coverage
5. Create PR with test evidence
6. Pass CI checks

### Code Style

- TypeScript strict mode
- ESLint + Prettier configured
- Pre-commit hooks via Husky
- Conventional commits

## Next Steps After MVP

### Planned Enhancements

- Email/password authentication option
- Team workspaces
- API for third-party integrations
- Mobile app (React Native)
- Real-time collaboration
- Advanced search operators

### Scaling Considerations

- Redis for session cache
- Read replicas for search
- CDN for static assets
- Horizontal scaling via Kubernetes

## Resources

- [Full PRD Document](.taskmaster/docs/prd.txt) - Detailed requirements for TaskMaster AI
- [API Documentation](./api/README.md) - OpenAPI specification
- [Architecture Diagrams](./architecture/README.md) - Visual system design
- [Deployment Guide](./deployment/README.md) - Production setup instructions

## Support

- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **TaskMaster**: Check task status in `.taskmaster/tasks/`

---

_MISC MVP - Where less is truly more._
