#!/bin/bash
# Wait for Database Script
# Application startup helper that waits for database to become available

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration from environment or fallback values
HOST=${DATABASE_HOST:-${POSTGRES_HOST:-localhost}}
PORT=${DATABASE_PORT:-${POSTGRES_PORT:-5432}}
USER=${DATABASE_USER:-${POSTGRES_USER:-postgres}}
DATABASE=${DATABASE_NAME:-${POSTGRES_DB:-misc_poc_dev}}
PASSWORD=${DATABASE_PASSWORD:-${POSTGRES_PASSWORD:-}}
MAX_WAIT=${DATABASE_MAX_WAIT:-60}
CHECK_INTERVAL=${DATABASE_CHECK_INTERVAL:-2}
QUIET=${DATABASE_QUIET:-false}

# Function to print colored output
print_info() {
    if [ "$QUIET" != "true" ]; then
        echo -e "${BLUE}[WAIT-FOR-DB]${NC} $1"
    fi
}

print_success() {
    if [ "$QUIET" != "true" ]; then
        echo -e "${GREEN}[WAIT-FOR-DB]${NC} $1"
    fi
}

print_warning() {
    echo -e "${YELLOW}[WAIT-FOR-DB]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[WAIT-FOR-DB]${NC} $1" >&2
}

# Function to show usage
show_usage() {
    echo "Wait for Database Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [-- COMMAND [ARGS...]]"
    echo ""
    echo "Options:"
    echo "  -h, --host HOST         Database host (default: $HOST)"
    echo "  -p, --port PORT         Database port (default: $PORT)"
    echo "  -U, --user USER         Database username (default: $USER)"
    echo "  -d, --database DB       Database name (default: $DATABASE)"
    echo "  -w, --password PASS     Database password (default: from env)"
    echo "  -t, --timeout SECONDS   Maximum wait time (default: $MAX_WAIT)"
    echo "  -i, --interval SECONDS  Check interval (default: $CHECK_INTERVAL)"
    echo "  -q, --quiet             Quiet output"
    echo "  -s, --strict            Strict mode (exit on first failure)"
    echo "  --test                  Use test database configuration"
    echo "  --help                  Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_HOST, POSTGRES_HOST           Database host"
    echo "  DATABASE_PORT, POSTGRES_PORT           Database port"
    echo "  DATABASE_USER, POSTGRES_USER           Database username"
    echo "  DATABASE_NAME, POSTGRES_DB             Database name"
    echo "  DATABASE_PASSWORD, POSTGRES_PASSWORD   Database password"
    echo "  DATABASE_MAX_WAIT                      Maximum wait time in seconds"
    echo "  DATABASE_CHECK_INTERVAL                Check interval in seconds"
    echo "  DATABASE_QUIET                         Quiet output (true/false)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Wait for default database"
    echo "  $0 --test                            # Wait for test database"
    echo "  $0 -- npm start                      # Wait then run npm start"
    echo "  $0 -t 30 -- yarn dev                 # Wait max 30s then run yarn dev"
    echo "  $0 -q -- /app/server                 # Quiet mode then run server"
}

# Function to check database connection
check_database() {
    local host=$1
    local port=$2
    local user=$3
    local database=$4
    local password=$5

    # Set password for psql if provided
    if [ -n "$password" ]; then
        export PGPASSWORD="$password"
    fi

    # First check with pg_isready for basic connectivity
    if pg_isready -h "$host" -p "$port" -U "$user" -d "$database" >/dev/null 2>&1; then
        # Then verify with actual database connection
        if psql -h "$host" -p "$port" -U "$user" -d "$database" -c "SELECT 1;" >/dev/null 2>&1; then
            return 0
        fi
    fi

    return 1
}

# Function to wait for database with retry logic
wait_for_database() {
    local host=$1
    local port=$2
    local user=$3
    local database=$4
    local password=$5
    local max_wait=$6
    local check_interval=$7
    local strict_mode=$8

    local start_time=$(date +%s)
    local attempt=1

    print_info "Waiting for database $user@$host:$port/$database"
    print_info "Max wait time: ${max_wait}s, Check interval: ${check_interval}s"

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -ge $max_wait ]; then
            print_error "Timeout: Database not available after ${max_wait} seconds"
            return 1
        fi

        print_info "Attempt $attempt (${elapsed}s elapsed)..."

        if check_database "$host" "$port" "$user" "$database" "$password"; then
            print_success "Database is ready! (took ${elapsed}s, $attempt attempts)"
            return 0
        fi

        if [ "$strict_mode" = true ]; then
            print_error "Strict mode: Database check failed on attempt $attempt"
            return 1
        fi

        attempt=$((attempt + 1))
        sleep "$check_interval"
    done
}

# Function to execute command after database is ready
execute_command() {
    local cmd_args=("$@")

    if [ ${#cmd_args[@]} -eq 0 ]; then
        print_info "Database is ready - no command to execute"
        return 0
    fi

    print_info "Executing command: ${cmd_args[*]}"
    exec "${cmd_args[@]}"
}

# Parse command line arguments
STRICT_MODE=false
TEST_MODE=false
COMMAND_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            HOST="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -U|--user)
            USER="$2"
            shift 2
            ;;
        -d|--database)
            DATABASE="$2"
            shift 2
            ;;
        -w|--password)
            PASSWORD="$2"
            shift 2
            ;;
        -t|--timeout)
            MAX_WAIT="$2"
            shift 2
            ;;
        -i|--interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -s|--strict)
            STRICT_MODE=true
            shift
            ;;
        --test)
            TEST_MODE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        --)
            shift
            COMMAND_ARGS=("$@")
            break
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set test database parameters if in test mode
if [ "$TEST_MODE" = true ]; then
    HOST=${TEST_DATABASE_HOST:-localhost}
    PORT=${TEST_DATABASE_PORT:-5433}
    USER=${TEST_DATABASE_USER:-postgres_test}
    DATABASE=${TEST_DATABASE_NAME:-misc_poc_test}
    PASSWORD=${TEST_DATABASE_PASSWORD:-test_password}
    print_info "Test mode enabled - using test database configuration"
fi

# Validate required tools
if ! command -v pg_isready >/dev/null 2>&1; then
    print_error "pg_isready not found. Please install PostgreSQL client tools."
    exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
    print_error "psql not found. Please install PostgreSQL client tools."
    exit 1
fi

# Validate parameters
if [ -z "$HOST" ] || [ -z "$PORT" ] || [ -z "$USER" ] || [ -z "$DATABASE" ]; then
    print_error "Missing required database connection parameters"
    show_usage
    exit 1
fi

# Main execution
if wait_for_database "$HOST" "$PORT" "$USER" "$DATABASE" "$PASSWORD" "$MAX_WAIT" "$CHECK_INTERVAL" "$STRICT_MODE"; then
    execute_command "${COMMAND_ARGS[@]}"
    exit 0
else
    print_error "Failed to connect to database"
    exit 1
fi