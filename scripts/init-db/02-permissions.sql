-- Database Permissions and Security Setup
-- This script configures permissions and security settings

-- Revoke unnecessary permissions from PUBLIC role
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE misc_poc_dev FROM PUBLIC;

-- Grant specific permissions to app_user
GRANT CONNECT ON DATABASE misc_poc_dev TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA app TO app_user;

-- Allow app_user to create temporary tables
GRANT TEMP ON DATABASE misc_poc_dev TO app_user;

-- Grant sequence permissions for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Create a read-only role for reporting/analytics
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'read_only_user') THEN
        CREATE ROLE read_only_user LOGIN;
    END IF;
END
$$;

-- Grant read-only permissions
GRANT CONNECT ON DATABASE misc_poc_dev TO read_only_user;
GRANT USAGE ON SCHEMA app TO read_only_user;
GRANT USAGE ON SCHEMA public TO read_only_user;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO read_only_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_only_user;

-- Set default privileges for read-only user on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO read_only_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO read_only_user;

-- Set connection limits
ALTER ROLE read_only_user CONNECTION LIMIT 10;

-- Output confirmation
SELECT 'Database permissions configured successfully' AS status;