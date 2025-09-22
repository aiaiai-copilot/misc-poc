-- Main Database Initialization Script
-- This script sets up the main development database with proper configuration

-- Create main application schema if it does not exist
CREATE SCHEMA IF NOT EXISTS app;

-- Set search path to include app schema
ALTER DATABASE misc_poc_dev SET search_path TO app, public;

-- Create application-specific user role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN;
    END IF;
END
$$;

-- Grant necessary permissions for application
GRANT USAGE ON SCHEMA app TO app_user;
GRANT CREATE ON SCHEMA app TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Create extensions that might be useful for the application
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create a basic audit table for tracking changes (optional)
CREATE TABLE IF NOT EXISTS app.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant permissions on audit table
GRANT SELECT, INSERT, UPDATE, DELETE ON app.audit_log TO app_user;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON app.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON app.audit_log(changed_at);

-- Set up connection limits for the application user
ALTER ROLE app_user CONNECTION LIMIT 20;

-- Configure database for development (optimized for development speed)
ALTER DATABASE misc_poc_dev SET shared_preload_libraries = 'pg_stat_statements';
ALTER DATABASE misc_poc_dev SET log_statement = 'all';
ALTER DATABASE misc_poc_dev SET log_min_duration_statement = 1000; -- Log queries > 1 second

-- Output confirmation
SELECT 'Main database initialized successfully' AS status;