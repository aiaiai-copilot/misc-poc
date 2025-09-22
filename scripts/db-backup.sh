#!/bin/bash

# Database Backup Script
# This script creates backups of the PostgreSQL database

set -e

# Configuration
COMPOSE_FILE="docker-compose.yml"
DB_SERVICE="postgres"
DB_NAME="${POSTGRES_DB:-misc_poc_dev}"
DB_USER="${POSTGRES_USER:-postgres}"
BACKUP_DIR="./data/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

echo "💾 Database Backup Script"
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

# Function to ensure backup directory exists
ensure_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        echo "📁 Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Function to check if database is running and accessible
check_database() {
    echo "🔍 Checking database connection..."
    if ! $DOCKER_COMPOSE -f $COMPOSE_FILE exec -T $DB_SERVICE pg_isready -U $DB_USER -d $DB_NAME >/dev/null 2>&1; then
        echo "❌ Database is not accessible. Please ensure the database service is running."
        echo "   Try: $DOCKER_COMPOSE -f $COMPOSE_FILE up -d $DB_SERVICE"
        exit 1
    fi
    echo "✅ Database is accessible"
}

# Function to create backup
create_backup() {
    echo "📦 Creating backup: $BACKUP_FILE"

    # Create the backup using pg_dump
    if $DOCKER_COMPOSE -f $COMPOSE_FILE exec -T $DB_SERVICE pg_dump -U $DB_USER -d $DB_NAME --verbose --clean --no-owner --no-privileges > "$BACKUP_PATH"; then
        echo "✅ Backup created successfully: $BACKUP_PATH"

        # Get backup file size
        local size=$(du -h "$BACKUP_PATH" | cut -f1)
        echo "📊 Backup size: $size"
    else
        echo "❌ Backup failed"
        # Clean up failed backup file
        rm -f "$BACKUP_PATH"
        exit 1
    fi
}

# Function to compress backup (optional)
compress_backup() {
    if command -v gzip >/dev/null 2>&1; then
        echo "🗜️ Compressing backup..."
        gzip "$BACKUP_PATH"
        local compressed_file="${BACKUP_PATH}.gz"
        local size=$(du -h "$compressed_file" | cut -f1)
        echo "✅ Backup compressed: ${compressed_file} (${size})"
        BACKUP_PATH="$compressed_file"
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    local keep_days=${BACKUP_RETENTION_DAYS:-7}
    echo "🧹 Cleaning up backups older than $keep_days days..."

    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql*" -type f -mtime +$keep_days -delete 2>/dev/null || true

    local remaining=$(find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql*" -type f | wc -l)
    echo "📂 Remaining backups: $remaining"
}

# Function to list existing backups
list_backups() {
    echo "📋 Existing backups:"
    if ls "$BACKUP_DIR"/backup_${DB_NAME}_*.sql* >/dev/null 2>&1; then
        ls -lh "$BACKUP_DIR"/backup_${DB_NAME}_*.sql* | awk '{print "   " $9 " (" $5 ", " $6 " " $7 " " $8 ")"}'
    else
        echo "   No backups found"
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        echo "❌ Backup file not found: $backup_file"
        exit 1
    fi

    echo "⚠️  This will restore the database from backup and overwrite current data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Restore operation cancelled"
        exit 1
    fi

    echo "🔄 Restoring database from: $backup_file"

    # Handle compressed files
    if [[ "$backup_file" == *.gz ]]; then
        echo "📦 Decompressing backup..."
        gunzip -c "$backup_file" | $DOCKER_COMPOSE -f $COMPOSE_FILE exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME
    else
        $DOCKER_COMPOSE -f $COMPOSE_FILE exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME < "$backup_file"
    fi

    echo "✅ Database restored successfully"
}

# Show help
show_help() {
    echo "Database Backup Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  backup         Create a new backup (default)"
    echo "  list           List existing backups"
    echo "  restore FILE   Restore from backup file"
    echo ""
    echo "Options:"
    echo "  --compress     Compress backup with gzip"
    echo "  --no-cleanup   Skip cleanup of old backups"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  POSTGRES_DB             Database name (default: misc_poc_dev)"
    echo "  POSTGRES_USER           Database user (default: postgres)"
    echo "  BACKUP_RETENTION_DAYS   Days to keep backups (default: 7)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Create backup"
    echo "  $0 backup --compress                 # Create compressed backup"
    echo "  $0 list                              # List backups"
    echo "  $0 restore backup_misc_poc_dev_20241022_143022.sql"
}

# Main execution
main() {
    check_docker_compose
    ensure_backup_dir

    local command="backup"
    local compress=false
    local cleanup=true

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            backup)
                command="backup"
                shift
                ;;
            list)
                command="list"
                shift
                ;;
            restore)
                command="restore"
                shift
                local restore_file="$1"
                shift
                ;;
            --compress)
                compress=true
                shift
                ;;
            --no-cleanup)
                cleanup=false
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "❌ Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    case $command in
        backup)
            check_database
            create_backup
            if [ "$compress" = true ]; then
                compress_backup
            fi
            if [ "$cleanup" = true ]; then
                cleanup_old_backups
            fi
            list_backups
            ;;
        list)
            list_backups
            ;;
        restore)
            if [ -z "$restore_file" ]; then
                echo "❌ Please specify a backup file to restore"
                echo "Use '$0 list' to see available backups"
                exit 1
            fi
            check_database
            restore_backup "$restore_file"
            ;;
    esac
}

# Run main function
main "$@"