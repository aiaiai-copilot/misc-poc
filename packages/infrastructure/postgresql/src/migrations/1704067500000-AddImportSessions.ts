/**
 * Migration: Add Import Sessions Table
 * Task 12.7: Support for partial import continuation and error recovery
 *
 * This migration adds the import_sessions table to track import progress,
 * enable resume functionality, and maintain detailed error logs.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImportSessions1704067500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create import_sessions table
    await queryRunner.query(`
      CREATE TABLE import_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN (
          'initializing',
          'in-progress',
          'paused',
          'completed',
          'failed',
          'cancelled'
        )),
        total_records INTEGER NOT NULL CHECK (total_records >= 0),
        processed_records INTEGER NOT NULL DEFAULT 0 CHECK (processed_records >= 0),
        imported_records INTEGER NOT NULL DEFAULT 0 CHECK (imported_records >= 0),
        failed_records INTEGER NOT NULL DEFAULT 0 CHECK (failed_records >= 0),
        last_processed_index INTEGER,
        error_log JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        -- Constraints
        CONSTRAINT valid_record_counts CHECK (
          processed_records <= total_records AND
          imported_records <= processed_records AND
          failed_records <= processed_records
        )
      );
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX idx_import_sessions_user_id
      ON import_sessions(user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_import_sessions_session_id
      ON import_sessions(session_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_import_sessions_status
      ON import_sessions(status);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_import_sessions_created_at
      ON import_sessions(created_at DESC);
    `);

    // Create index for finding resumable sessions
    await queryRunner.query(`
      CREATE INDEX idx_import_sessions_resumable
      ON import_sessions(user_id, status)
      WHERE status IN ('paused', 'failed');
    `);

    // Add trigger to automatically update updated_at timestamp
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_import_sessions_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trigger_update_import_sessions_updated_at
      BEFORE UPDATE ON import_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_import_sessions_updated_at();
    `);

    // Add comment for documentation
    await queryRunner.query(`
      COMMENT ON TABLE import_sessions IS
      'Tracks import operations for error recovery and partial import continuation';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN import_sessions.session_id IS
      'Unique identifier for import session, used for resume operations';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN import_sessions.error_log IS
      'JSONB array of error entries with details for each failed record';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN import_sessions.last_processed_index IS
      'Index of last successfully processed record for resume capability';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger and function
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trigger_update_import_sessions_updated_at
      ON import_sessions;
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS update_import_sessions_updated_at();
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_import_sessions_resumable;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_import_sessions_created_at;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_import_sessions_status;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_import_sessions_session_id;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_import_sessions_user_id;
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS import_sessions;
    `);
  }
}
