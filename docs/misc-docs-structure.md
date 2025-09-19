# MISC Documentation Restructure Plan

## Proposed Directory Structure

```
misc-poc/
├── docs/                           # Human-readable documentation
│   ├── README.md                   # Navigation and overview
│   ├── development/                # Developer documentation
│   │   ├── overview.md            # Quick project overview (created)
│   │   ├── getting-started.md    # Setup instructions
│   │   ├── contributing.md       # Contribution guidelines
│   │   └── testing-strategy.md   # TDD approach and requirements
│   │
│   ├── architecture/              # Architecture documentation
│   │   ├── README.md             # Architecture overview with diagrams
│   │   ├── clean-architecture.md # Clean Architecture principles
│   │   ├── backend/              # Backend-specific
│   │   │   ├── api-design.md    # REST API principles
│   │   │   ├── database.md      # PostgreSQL schema and migrations
│   │   │   └── authentication.md # OAuth and JWT implementation
│   │   └── frontend/             # Frontend-specific
│   │       ├── components.md    # Component architecture
│   │       └── state-management.md # State and data flow
│   │
│   ├── api/                      # API documentation
│   │   ├── openapi.yaml         # OpenAPI 3.0 specification
│   │   ├── postman/             # Postman collections
│   │   └── examples/            # Request/response examples
│   │
│   ├── deployment/              # Deployment documentation
│   │   ├── docker-setup.md     # Docker configuration
│   │   ├── ssl-setup.md        # Let's Encrypt setup
│   │   └── production.md       # Production deployment guide
│   │
│   ├── taskmaster/              # TaskMaster AI documents (source of truth)
│   │   ├── README.md           # How to work with TaskMaster
│   │   ├── prd-prototype.txt   # Archived PRD for prototype
│   │   └── prd-mvp.md          # Current PRD for MVP
│   │
│   └── archive/                # Historical documentation
│       └── prototype/          # Prototype-era documents
│           ├── adr/           # Architectural decisions
│           ├── requirements/   # Original requirements
│           └── vision-ru.md   # Original vision
│
└── .taskmaster/                # TaskMaster working directory
    ├── docs/
    │   ├── prd.txt           # Active PRD (copy of prd-mvp.md)
    │   └── migration-notes.txt # Migration from prototype to MVP
    ├── tasks/
    │   ├── tasks.json        # Current MVP tasks
    │   └── archive/
    │       └── tasks-prototype.json # Completed prototype tasks
    └── templates/            # TaskMaster templates

```

## Migration Steps

### Step 1: Create new directory structure

```bash
# Create main documentation directories
mkdir -p docs/{development,architecture,api,deployment,taskmaster,archive}
mkdir -p docs/architecture/{backend,frontend}
mkdir -p docs/api/{postman,examples}
mkdir -p docs/archive/prototype
mkdir -p .taskmaster/tasks/archive
```

### Step 2: Move existing documents

```bash
# Archive prototype documentation
mv docs/adr docs/archive/prototype/
mv docs/requirements docs/archive/prototype/
mv docs/development/vision-ru.md docs/archive/prototype/

# Move TaskMaster PRDs
cp .taskmaster/docs/prd.txt docs/taskmaster/prd-prototype.txt
cp prd.txt docs/taskmaster/prd-mvp.md  # Your new PRD

# Archive prototype tasks
cp .taskmaster/tasks/tasks.json .taskmaster/tasks/archive/tasks-prototype.json

# Keep active PRD for TaskMaster
cp docs/taskmaster/prd-mvp.md .taskmaster/docs/prd.txt
```

### Step 3: Create navigation README

```markdown
# docs/README.md

# MISC Documentation

## For Developers

- [Project Overview](./development/overview.md) - Start here!
- [Getting Started](./development/getting-started.md)
- [Architecture](./architecture/README.md)
- [API Documentation](./api/openapi.yaml)

## For TaskMaster AI

- [Current PRD (MVP)](./taskmaster/prd-mvp.md)
- [Working with TaskMaster](./taskmaster/README.md)

## Historical Documents

- [Prototype Documentation](./archive/prototype/)
- [Prototype PRD](./taskmaster/prd-prototype.txt)
```

### Step 4: Create migration notes

```markdown
# .taskmaster/docs/migration-notes.txt

# Migration from Prototype to MVP

## What Changed

- localStorage → PostgreSQL
- Single-user → Multi-user with OAuth
- Local app → Server-based with REST API
- No auth → Google OAuth + JWT

## What Remains

- Domain entities and business logic
- Clean Architecture principles
- UI components and interactions
- Tag normalization rules

## Migration Path for Users

1. Export data from prototype (JSON)
2. Create account in MVP
3. Import JSON file
4. All records migrated with timestamps

## Technical Migration

- Repository interfaces unchanged
- Use cases enhanced with user context
- Frontend adapted for async operations
- New backend package added to monorepo
```

## Benefits of This Structure

### 1. **Clear Separation of Concerns**

- `docs/` - Human-readable documentation
- `.taskmaster/` - TaskMaster working files
- `archive/` - Historical preservation

### 2. **No Contradictions**

- Single source of truth: `prd-mvp.md`
- Other docs derived from PRD
- Automated consistency checks

### 3. **Developer-Friendly**

- Clear navigation in `docs/README.md`
- Quick start in `overview.md`
- Examples and diagrams in subdirectories

### 4. **TaskMaster-Compatible**

- PRD remains in `.taskmaster/docs/`
- Clean separation of concerns
- Migration notes for context

### 5. **Version Control Friendly**

- Clear history preservation
- Atomic commits for reorganization
- Easy to track changes

## Next Steps

1. **Execute migration steps 1-4**
2. **Create missing documents:**
   - `getting-started.md`
   - `architecture/README.md`
   - `api/openapi.yaml`
3. **Update CI/CD:**
   - Add docs consistency check to pre-commit
   - Run `docs:check` in CI pipeline
4. **Generate new MVP tasks for TaskMaster**

This structure maintains the PRD as the source of truth while providing accessible documentation for human developers.
