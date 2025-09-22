#!/bin/bash
# Test Database Setup Script
# This script manages the test database lifecycle

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
COMPOSE_FILE="docker-compose.test.yml"
SERVICE_NAME="postgres-test"
CONTAINER_NAME="misc-poc-postgres-test"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to wait for database to be ready
wait_for_db() {
    print_status "Waiting for test database to be ready..."

    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if docker compose -f $COMPOSE_FILE exec -T $SERVICE_NAME pg_isready -U postgres_test -d misc_poc_test > /dev/null 2>&1; then
            print_status "Test database is ready!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done

    print_error "Test database failed to start after $max_attempts seconds"
    return 1
}

# Function to start test database
start_db() {
    print_status "Starting test database..."

    # Stop any existing container first
    docker compose -f $COMPOSE_FILE down > /dev/null 2>&1 || true

    # Start the test database
    docker compose -f $COMPOSE_FILE up -d

    # Wait for it to be ready
    wait_for_db
}

# Function to stop test database
stop_db() {
    print_status "Stopping test database..."
    docker compose -f $COMPOSE_FILE down

    # Clean up volumes for fresh start next time
    docker volume rm misc-poc_postgres_test_data > /dev/null 2>&1 || true

    print_status "Test database stopped and cleaned up"
}

# Function to reset test database
reset_db() {
    print_status "Resetting test database..."

    # Run cleanup script
    docker compose -f $COMPOSE_FILE exec -T $SERVICE_NAME psql -U postgres_test -d misc_poc_test -f /scripts/test-db-cleanup.sql

    print_status "Test database reset completed"
}

# Function to run SQL file
run_sql() {
    local sql_file=$1
    if [ ! -f "$sql_file" ]; then
        print_error "SQL file not found: $sql_file"
        return 1
    fi

    print_status "Running SQL file: $sql_file"
    docker compose -f $COMPOSE_FILE exec -T $SERVICE_NAME psql -U postgres_test -d misc_poc_test -f "/scripts/$(basename $sql_file)"
}

# Function to show database status
status() {
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q $CONTAINER_NAME; then
        print_status "Test database is running"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep $CONTAINER_NAME
    else
        print_warning "Test database is not running"
    fi
}

# Main script logic
case "${1:-help}" in
    start)
        start_db
        ;;
    stop)
        stop_db
        ;;
    restart)
        stop_db
        start_db
        ;;
    reset)
        reset_db
        ;;
    status)
        status
        ;;
    sql)
        if [ -z "$2" ]; then
            print_error "Please provide SQL file path"
            exit 1
        fi
        run_sql "$2"
        ;;
    help|*)
        echo "Test Database Management Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start     Start the test database"
        echo "  stop      Stop and clean up the test database"
        echo "  restart   Restart the test database"
        echo "  reset     Reset test database (cleanup test data)"
        echo "  status    Show database status"
        echo "  sql FILE  Run SQL file against test database"
        echo "  help      Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 start"
        echo "  $0 reset"
        echo "  $0 sql scripts/test-db-cleanup.sql"
        ;;
esac