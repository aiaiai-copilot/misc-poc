# Package Dependency Diagram

## Architecture Overview

This project follows **Clean Architecture** principles with clear dependency rules flowing inward from presentation → application → domain.

```mermaid
graph TD
    %% Core/Domain Layer
    SHARED[shared]
    DOMAIN[domain]

    %% Application Layer
    APP[application]

    %% Infrastructure Layer
    INFRA_CACHE[infrastructure-cache]
    INFRA_LS[infrastructure-localstorage]
    INFRA_PG[infrastructure-postgresql]

    %% Presentation Layer
    PRES_WEB[presentation-web]
    PRES_CLI[presentation-cli]

    %% Backend/API Layer
    BACKEND[backend]

    %% Core dependencies
    SHARED --> DOMAIN
    DOMAIN --> APP
    SHARED --> APP

    %% Infrastructure dependencies
    APP --> INFRA_CACHE
    DOMAIN --> INFRA_LS
    SHARED --> INFRA_LS
    APP --> INFRA_PG
    DOMAIN --> INFRA_PG
    SHARED --> INFRA_PG

    %% Backend dependencies
    APP --> BACKEND
    DOMAIN --> BACKEND
    INFRA_CACHE --> BACKEND

    %% Presentation dependencies
    APP --> PRES_WEB
    DOMAIN --> PRES_WEB
    INFRA_LS --> PRES_WEB
    SHARED --> PRES_WEB

    APP --> PRES_CLI
    DOMAIN --> PRES_CLI
    SHARED --> PRES_CLI

    %% Styling
    classDef coreLayer fill:#E1F5FE,stroke:#01579B,stroke-width:3px
    classDef appLayer fill:#F3E5F5,stroke:#4A148C,stroke-width:3px
    classDef infraLayer fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    classDef presLayer fill:#E8F5E9,stroke:#1B5E20,stroke-width:2px
    classDef backendLayer fill:#FCE4EC,stroke:#880E4F,stroke-width:2px

    class SHARED,DOMAIN coreLayer
    class APP appLayer
    class INFRA_CACHE,INFRA_LS,INFRA_PG infraLayer
    class PRES_WEB,PRES_CLI presLayer
    class BACKEND backendLayer
```

## Layer-Based View

```mermaid
graph TB
    subgraph "Layer 1: Core (No Dependencies)"
        L1A[shared]
        L1B[domain]
    end

    subgraph "Layer 2: Application"
        L2[application]
    end

    subgraph "Layer 3: Infrastructure"
        L3A[infrastructure/cache]
        L3B[infrastructure/localStorage]
        L3C[infrastructure/postgresql]
    end

    subgraph "Layer 4: Backend API"
        L4[backend]
    end

    subgraph "Layer 5: Presentation"
        L5A[presentation/web]
        L5B[presentation/cli]
    end

    L1A --> L1B
    L1A --> L2
    L1B --> L2

    L2 --> L3A
    L1A --> L3B
    L1B --> L3B
    L2 --> L3C
    L1A --> L3C
    L1B --> L3C

    L2 --> L4
    L1B --> L4
    L3A --> L4

    L2 --> L5A
    L1B --> L5A
    L3B --> L5A
    L1A --> L5A

    L2 --> L5B
    L1B --> L5B
    L1A --> L5B

    classDef layer1 fill:#E1F5FE,stroke:#01579B,stroke-width:3px
    classDef layer2 fill:#F3E5F5,stroke:#4A148C,stroke-width:3px
    classDef layer3 fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    classDef layer4 fill:#FCE4EC,stroke:#880E4F,stroke-width:2px
    classDef layer5 fill:#E8F5E9,stroke:#1B5E20,stroke-width:2px

    class L1A,L1B layer1
    class L2 layer2
    class L3A,L3B,L3C layer3
    class L4 layer4
    class L5A,L5B layer5
```

## Detailed Package Information

### Layer 1: Core (Foundation)

#### 1. **shared** (`@misc-poc/shared`)

- **Path**: `packages/shared`
- **Dependencies**: None
- **Purpose**: Common utilities, types, and helpers used across all packages
- **Dependents**: domain, application, infrastructure/localStorage, infrastructure/postgresql, presentation/web, presentation/cli

#### 2. **domain** (`@misc-poc/domain`)

- **Path**: `packages/domain`
- **Dependencies**:
  - `@misc-poc/shared`
- **Purpose**: Domain entities, value objects, and business rules
- **Dependents**: application, infrastructure/localStorage, infrastructure/postgresql, backend, presentation/web, presentation/cli

### Layer 2: Application

#### 3. **application** (`@misc-poc/application`)

- **Path**: `packages/application`
- **Dependencies**:
  - `@misc-poc/domain`
  - `@misc-poc/shared`
- **Purpose**: Use cases, application services, and repository interfaces
- **Dependents**: infrastructure/cache, infrastructure/postgresql, backend, presentation/web, presentation/cli

### Layer 3: Infrastructure

#### 4. **infrastructure/cache** (`@misc-poc/infrastructure-cache`)

- **Path**: `packages/infrastructure/cache`
- **Dependencies**:
  - `@misc-poc/application`
- **Purpose**: Caching implementations (Redis, in-memory)
- **Dependents**: backend

#### 5. **infrastructure/localStorage** (`@misc-poc/infrastructure-localstorage`)

- **Path**: `packages/infrastructure/localStorage`
- **Dependencies**:
  - `@misc-poc/domain`
  - `@misc-poc/shared`
- **Purpose**: Browser localStorage repository implementation
- **Dependents**: presentation/web

#### 6. **infrastructure/postgresql** (`@misc-poc/infrastructure-postgresql`)

- **Path**: `packages/infrastructure/postgresql`
- **Dependencies**:
  - `@misc-poc/application`
  - `@misc-poc/domain`
  - `@misc-poc/shared`
- **Purpose**: PostgreSQL repository implementations and migrations
- **Dependents**: None (used at runtime by backend)

### Layer 4: Backend API

#### 7. **backend** (`@misc-poc/backend`)

- **Path**: `packages/backend`
- **Dependencies**:
  - `@misc-poc/application`
  - `@misc-poc/domain`
  - `@misc-poc/infrastructure-cache`
- **Purpose**: Express API server, authentication, routes, middleware
- **Dependents**: None (top-level server)

### Layer 5: Presentation

#### 8. **presentation/web** (`@misc-poc/presentation-web`)

- **Path**: `packages/presentation/web`
- **Dependencies**:
  - `@misc-poc/application`
  - `@misc-poc/domain`
  - `@misc-poc/infrastructure-localstorage`
  - `@misc-poc/shared`
- **Purpose**: React SPA with Vite
- **Dependents**: None (top-level UI)

#### 9. **presentation/cli** (`@misc-poc/presentation-cli`)

- **Path**: `packages/presentation/cli`
- **Dependencies**:
  - `@misc-poc/application`
  - `@misc-poc/domain`
  - `@misc-poc/shared`
- **Purpose**: Command-line interface
- **Dependents**: None (top-level CLI)

## Dependency Rules

### ✅ Allowed Dependencies

1. **Shared** → No dependencies (foundation layer)
2. **Domain** → Shared only
3. **Application** → Domain, Shared
4. **Infrastructure** → Application, Domain, Shared (implements application interfaces)
5. **Backend** → Application, Domain, Infrastructure/Cache
6. **Presentation** → Application, Domain, Infrastructure, Shared

### ❌ Forbidden Dependencies

- **No circular dependencies** between packages
- **Domain** MUST NOT depend on Application or Infrastructure
- **Application** MUST NOT depend on Infrastructure or Presentation
- **Infrastructure** MUST NOT depend on Backend or Presentation
- **Shared** MUST remain dependency-free

## Build Order

Due to dependencies, packages must be built in this order:

1. **shared** (no dependencies)
2. **domain** (depends on shared)
3. **application** (depends on domain, shared)
4. **infrastructure/cache** (depends on application)
5. **infrastructure/localStorage** (depends on domain, shared)
6. **infrastructure/postgresql** (depends on application, domain, shared)
7. **backend** (depends on application, domain, infrastructure/cache)
8. **presentation/cli** (depends on application, domain, shared)
9. **presentation/web** (depends on application, domain, infrastructure/localStorage, shared)

## Dependency Graph Statistics

- **Total Packages**: 9
- **Zero Dependencies**: 1 (shared)
- **Core Layer**: 2 packages (shared, domain)
- **Application Layer**: 1 package
- **Infrastructure Layer**: 3 packages
- **Backend Layer**: 1 package
- **Presentation Layer**: 2 packages

## Architecture Compliance

This architecture follows:

- ✅ **Clean Architecture** - Dependencies point inward
- ✅ **Dependency Inversion Principle** - Application defines interfaces, infrastructure implements
- ✅ **Single Responsibility** - Each package has a clear purpose
- ✅ **Separation of Concerns** - Domain logic separated from infrastructure
- ✅ **Testability** - Infrastructure can be mocked via application interfaces

## Legend

- 🔵 **Blue** (Core Layer): Foundation with no external dependencies
- 🟣 **Purple** (Application Layer): Business logic and use cases
- 🟠 **Orange** (Infrastructure Layer): Technical implementations
- 🔴 **Pink** (Backend Layer): API and server
- 🟢 **Green** (Presentation Layer): User interfaces
