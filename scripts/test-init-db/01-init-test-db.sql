-- Test Database Initialization Script
-- This script sets up the test database with minimal configuration

-- Create test schema if it does not exist
CREATE SCHEMA IF NOT EXISTS test_schema;

-- Set search path to include test schema
ALTER DATABASE misc_poc_test SET search_path TO test_schema, public;

-- Create a test-specific user role (optional, for isolation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'test_role') THEN
        CREATE ROLE test_role;
    END IF;
END
$$;

-- Grant necessary permissions for testing
GRANT USAGE ON SCHEMA test_schema TO test_role;
GRANT CREATE ON SCHEMA test_schema TO test_role;
GRANT USAGE ON SCHEMA public TO test_role;

-- Configure test database for faster operations
ALTER DATABASE misc_poc_test SET fsync = OFF;
ALTER DATABASE misc_poc_test SET synchronous_commit = OFF;
ALTER DATABASE misc_poc_test SET full_page_writes = OFF;
ALTER DATABASE misc_poc_test SET checkpoint_segments = 32;
ALTER DATABASE misc_poc_test SET checkpoint_completion_target = 0.9;

-- Disable logging for test database
ALTER DATABASE misc_poc_test SET log_statement = 'none';
ALTER DATABASE misc_poc_test SET log_min_duration_statement = -1;
ALTER DATABASE misc_poc_test SET log_connections = OFF;
ALTER DATABASE misc_poc_test SET log_disconnections = OFF;

-- Output confirmation
SELECT 'Test database initialized successfully' AS status;