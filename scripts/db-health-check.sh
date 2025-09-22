#!/bin/bash
# Enhanced Database Health Check Script
# Provides comprehensive health checking with detailed output and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_HOST="localhost"
DEFAULT_PORT="5432"
DEFAULT_USER="postgres"
DEFAULT_DB="misc_poc_dev"
DEFAULT_TIMEOUT=30
DEFAULT_RETRIES=5

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Database Health Check Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --host HOST         Database host (default: $DEFAULT_HOST)"
    echo "  -p, --port PORT         Database port (default: $DEFAULT_PORT)"
    echo "  -U, --username USER     Database username (default: $DEFAULT_USER)"
    echo "  -d, --database DB       Database name (default: $DEFAULT_DB)"
    echo "  -t, --timeout SECONDS   Connection timeout (default: $DEFAULT_TIMEOUT)"
    echo "  -r, --retries COUNT     Number of retries (default: $DEFAULT_RETRIES)"
    echo "  -v, --verbose           Verbose output"
    echo "  -q, --quiet             Quiet output (errors only)"
    echo "  -m, --monitor           Continuous monitoring mode"
    echo "  -i, --interval SECONDS  Monitoring interval (default: 10)"
    echo "  --test                  Run test database health check"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Check default database"
    echo "  $0 --test                            # Check test database"
    echo "  $0 -h db.example.com -p 5433         # Check remote database"
    echo "  $0 --monitor --interval 5            # Monitor every 5 seconds"
    echo "  $0 --verbose --retries 10            # Verbose output with 10 retries"
}

# Function to check database connection
check_connection() {
    local host=$1
    local port=$2
    local user=$3
    local database=$4
    local timeout=$5
    local attempt=$6
    local max_retries=$7

    if [ "$VERBOSE" = true ]; then
        print_info "Attempt $attempt/$max_retries: Checking connection to $user@$host:$port/$database"
    fi

    # Check basic connectivity with pg_isready
    if timeout "$timeout" pg_isready -h "$host" -p "$port" -U "$user" -d "$database" > /dev/null 2>&1; then
        if [ "$VERBOSE" = true ]; then
            print_success "pg_isready check passed"
        fi

        # Additional connection test with actual database query
        if timeout "$timeout" psql -h "$host" -p "$port" -U "$user" -d "$database" -c "SELECT 1;" > /dev/null 2>&1; then
            if [ "$VERBOSE" = true ]; then
                print_success "Database query test passed"
            fi
            return 0
        else
            print_warning "pg_isready passed but database query failed"
            return 1
        fi
    else
        if [ "$VERBOSE" = true ]; then
            print_warning "pg_isready check failed"
        fi
        return 1
    fi
}

# Function to get database statistics
get_db_stats() {
    local host=$1
    local port=$2
    local user=$3
    local database=$4

    if [ "$VERBOSE" = true ]; then
        print_info "Gathering database statistics..."

        # Get connection count
        local conn_count=$(psql -h "$host" -p "$port" -U "$user" -d "$database" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | tr -d ' ')

        # Get database size
        local db_size=$(psql -h "$host" -p "$port" -U "$user" -d "$database" -t -c "SELECT pg_size_pretty(pg_database_size('$database'));" 2>/dev/null | tr -d ' ')

        # Get uptime
        local uptime=$(psql -h "$host" -p "$port" -U "$user" -d "$database" -t -c "SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time());" 2>/dev/null | tr -d ' ')

        echo "  Active connections: ${conn_count:-unknown}"
        echo "  Database size: ${db_size:-unknown}"
        echo "  Server uptime: ${uptime:-unknown}"
    fi
}

# Function to perform comprehensive health check
health_check() {
    local host=$1
    local port=$2
    local user=$3
    local database=$4
    local timeout=$5
    local max_retries=$6
    local start_time=$(date +%s)

    if [ "$QUIET" != true ]; then
        print_info "Starting health check for $user@$host:$port/$database"
        print_info "Timeout: ${timeout}s, Max retries: $max_retries"
    fi

    for attempt in $(seq 1 "$max_retries"); do
        if check_connection "$host" "$port" "$user" "$database" "$timeout" "$attempt" "$max_retries"; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))

            if [ "$QUIET" != true ]; then
                print_success "Database is healthy! (took ${duration}s, attempt $attempt/$max_retries)"
                get_db_stats "$host" "$port" "$user" "$database"
            fi
            return 0
        fi

        if [ "$attempt" -lt "$max_retries" ]; then
            if [ "$VERBOSE" = true ]; then
                print_warning "Attempt $attempt failed, retrying in 2 seconds..."
            fi
            sleep 2
        fi
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    print_error "Database health check failed after $max_retries attempts (${duration}s total)"
    return 1
}

# Function for continuous monitoring
monitor_database() {
    local host=$1
    local port=$2
    local user=$3
    local database=$4
    local timeout=$5
    local max_retries=$6
    local interval=$7

    print_info "Starting continuous monitoring (interval: ${interval}s, Ctrl+C to stop)"
    print_info "Monitoring: $user@$host:$port/$database"
    echo ""

    local check_count=0
    local success_count=0
    local failure_count=0

    while true; do
        check_count=$((check_count + 1))
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

        printf "[%s] Check #%d: " "$timestamp" "$check_count"

        if check_connection "$host" "$port" "$user" "$database" "$timeout" 1 1; then
            success_count=$((success_count + 1))
            printf "${GREEN}HEALTHY${NC}\n"
        else
            failure_count=$((failure_count + 1))
            printf "${RED}UNHEALTHY${NC}\n"
        fi

        # Show stats every 10 checks
        if [ $((check_count % 10)) -eq 0 ]; then
            local success_rate=$((success_count * 100 / check_count))
            echo "  Stats: $success_count/$check_count successful (${success_rate}%)"
        fi

        sleep "$interval"
    done
}

# Parse command line arguments
HOST="$DEFAULT_HOST"
PORT="$DEFAULT_PORT"
USER="$DEFAULT_USER"
DATABASE="$DEFAULT_DB"
TIMEOUT="$DEFAULT_TIMEOUT"
RETRIES="$DEFAULT_RETRIES"
VERBOSE=false
QUIET=false
MONITOR=false
INTERVAL=10
TEST_MODE=false

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
        -U|--username)
            USER="$2"
            shift 2
            ;;
        -d|--database)
            DATABASE="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            RETRIES="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -m|--monitor)
            MONITOR=true
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        --test)
            TEST_MODE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
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
    PORT="5433"
    USER="postgres_test"
    DATABASE="misc_poc_test"
    if [ "$QUIET" != true ]; then
        print_info "Test mode enabled - using test database configuration"
    fi
fi

# Check if required tools are available
if ! command -v pg_isready > /dev/null 2>&1; then
    print_error "pg_isready not found. Please install PostgreSQL client tools."
    exit 1
fi

if ! command -v psql > /dev/null 2>&1; then
    print_error "psql not found. Please install PostgreSQL client tools."
    exit 1
fi

# Main execution
if [ "$MONITOR" = true ]; then
    monitor_database "$HOST" "$PORT" "$USER" "$DATABASE" "$TIMEOUT" "$RETRIES" "$INTERVAL"
else
    health_check "$HOST" "$PORT" "$USER" "$DATABASE" "$TIMEOUT" "$RETRIES"
fi