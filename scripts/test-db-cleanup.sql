-- Test Database Cleanup Script
-- This script cleans up test data between test runs

-- Disable foreign key checks temporarily for faster cleanup
SET session_replication_role = 'replica';

-- Function to truncate all tables in test_schema
DO $$
DECLARE
    table_name TEXT;
BEGIN
    -- Get all table names in test_schema
    FOR table_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'test_schema'
    LOOP
        -- Truncate each table with CASCADE to handle foreign keys
        EXECUTE 'TRUNCATE TABLE test_schema.' || quote_ident(table_name) || ' CASCADE';
        RAISE NOTICE 'Truncated table: %', table_name;
    END LOOP;
END $$;

-- Reset sequences in test_schema
DO $$
DECLARE
    seq_name TEXT;
BEGIN
    FOR seq_name IN
        SELECT sequencename
        FROM pg_sequences
        WHERE schemaname = 'test_schema'
    LOOP
        EXECUTE 'ALTER SEQUENCE test_schema.' || quote_ident(seq_name) || ' RESTART WITH 1';
        RAISE NOTICE 'Reset sequence: %', seq_name;
    END LOOP;
END $$;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Vacuum and analyze for better performance
VACUUM ANALYZE;

SELECT 'Test database cleanup completed successfully' AS status;