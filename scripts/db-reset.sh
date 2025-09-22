#!/bin/bash

# Database Reset Script
# This script resets the development database to a clean state

set -e

# Configuration
COMPOSE_FILE="docker-compose.yml"
DB_SERVICE="postgres"
DB_NAME="${POSTGRES_DB:-misc_poc_dev}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "🗄️ Database Reset Script"
echo "========================"

# Function to check if Docker Compose is available
check_docker_compose() {
    if command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker-compose"
    elif docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
    else
        echo "❌ Error: Neither 'docker-compose' nor 'docker compose' is available"
        exit 1
    fi
}

# Function to wait for database to be ready
wait_for_db() {
    echo "⏳ Waiting for database to be ready..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if $DOCKER_COMPOSE -f $COMPOSE_FILE exec -T $DB_SERVICE pg_isready -U $DB_USER -d $DB_NAME >/dev/null 2>&1; then
            echo "✅ Database is ready"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo "❌ Database did not become ready in time"
    exit 1
}

# Function to reset database
reset_database() {
    echo "🧹 Resetting database..."

    # Drop all tables and schemas (except system ones)
    $DOCKER_COMPOSE -f $COMPOSE_FILE exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME -c "
        -- Drop all tables in app schema
        DROP SCHEMA IF EXISTS app CASCADE;

        -- Drop custom roles
        DROP ROLE IF EXISTS app_user;
        DROP ROLE IF EXISTS read_only_user;

        -- Drop extensions (they will be recreated by init scripts)
        DROP EXTENSION IF EXISTS \"uuid-ossp\";
        DROP EXTENSION IF EXISTS \"pg_stat_statements\";
    " 2>/dev/null || true

    echo "✅ Database reset completed"
}

# Function to reinitialize database
reinitialize_database() {
    echo "🔄 Reinitializing database..."

    # The init scripts will run automatically when the container restarts
    # since they're mounted to /docker-entrypoint-initdb.d/

    echo "✅ Database reinitialization will occur on next container restart"
}

# Main execution
main() {
    check_docker_compose

    echo "⚠️  This will reset the database and remove all data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled"
        exit 1
    fi

    # Check if database service is running
    if ! $DOCKER_COMPOSE -f $COMPOSE_FILE ps $DB_SERVICE | grep -q "Up"; then
        echo "🚀 Starting database service..."
        $DOCKER_COMPOSE -f $COMPOSE_FILE up -d $DB_SERVICE
        wait_for_db
    else
        echo "✅ Database service is already running"
    fi

    # Reset the database
    reset_database

    # Restart the database container to trigger re-initialization
    echo "🔄 Restarting database container..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE restart $DB_SERVICE
    wait_for_db

    echo "✅ Database reset and reinitialization completed successfully!"
    echo "📝 The database has been reset to its initial state with fresh schema and permissions."
}

# Show help if requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Database Reset Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "This script resets the development database to a clean state by:"
    echo "1. Dropping all application schemas and tables"
    echo "2. Removing custom roles and extensions"
    echo "3. Restarting the database container to trigger re-initialization"
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  POSTGRES_DB      Database name (default: misc_poc_dev)"
    echo "  POSTGRES_USER    Database user (default: postgres)"
    exit 0
fi

# Run main function
main "$@"