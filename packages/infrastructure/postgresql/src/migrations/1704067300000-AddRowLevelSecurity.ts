import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRowLevelSecurity1704067300000 implements MigrationInterface {
  name = 'AddRowLevelSecurity1704067300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable Row Level Security on records table
    await queryRunner.query('ALTER TABLE records ENABLE ROW LEVEL SECURITY;');

    // Create policy for SELECT operations: users can only see their own records
    await queryRunner.query(`
      CREATE POLICY records_select_policy ON records
      FOR SELECT
      USING (user_id = current_setting('app.current_user_id')::uuid);
    `);

    // Create policy for INSERT operations: users can only insert records with their own user_id
    await queryRunner.query(`
      CREATE POLICY records_insert_policy ON records
      FOR INSERT
      WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);
    `);

    // Create policy for UPDATE operations: users can only update their own records
    await queryRunner.query(`
      CREATE POLICY records_update_policy ON records
      FOR UPDATE
      USING (user_id = current_setting('app.current_user_id')::uuid)
      WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);
    `);

    // Create policy for DELETE operations: users can only delete their own records
    await queryRunner.query(`
      CREATE POLICY records_delete_policy ON records
      FOR DELETE
      USING (user_id = current_setting('app.current_user_id')::uuid);
    `);

    // Enable RLS on user_settings table as well
    await queryRunner.query(
      'ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;'
    );

    // Create policies for user_settings table
    await queryRunner.query(`
      CREATE POLICY user_settings_select_policy ON user_settings
      FOR SELECT
      USING (user_id = current_setting('app.current_user_id')::uuid);
    `);

    await queryRunner.query(`
      CREATE POLICY user_settings_insert_policy ON user_settings
      FOR INSERT
      WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);
    `);

    await queryRunner.query(`
      CREATE POLICY user_settings_update_policy ON user_settings
      FOR UPDATE
      USING (user_id = current_setting('app.current_user_id')::uuid)
      WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);
    `);

    await queryRunner.query(`
      CREATE POLICY user_settings_delete_policy ON user_settings
      FOR DELETE
      USING (user_id = current_setting('app.current_user_id')::uuid);
    `);

    // Create a function to set the current user context
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_current_user_id(user_uuid UUID)
      RETURNS VOID AS $$
      BEGIN
        PERFORM set_config('app.current_user_id', user_uuid::text, false);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    // Create a function to get the current user context
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_current_user_id()
      RETURNS UUID AS $$
      BEGIN
        RETURN current_setting('app.current_user_id', true)::uuid;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    // Grant execute permissions on these functions to public
    await queryRunner.query(
      'GRANT EXECUTE ON FUNCTION set_current_user_id(UUID) TO public;'
    );
    await queryRunner.query(
      'GRANT EXECUTE ON FUNCTION get_current_user_id() TO public;'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop functions
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS set_current_user_id(UUID);'
    );
    await queryRunner.query('DROP FUNCTION IF EXISTS get_current_user_id();');

    // Drop policies for user_settings table
    await queryRunner.query(
      'DROP POLICY IF EXISTS user_settings_delete_policy ON user_settings;'
    );
    await queryRunner.query(
      'DROP POLICY IF EXISTS user_settings_update_policy ON user_settings;'
    );
    await queryRunner.query(
      'DROP POLICY IF EXISTS user_settings_insert_policy ON user_settings;'
    );
    await queryRunner.query(
      'DROP POLICY IF EXISTS user_settings_select_policy ON user_settings;'
    );

    // Disable RLS on user_settings table
    await queryRunner.query(
      'ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;'
    );

    // Drop policies for records table
    await queryRunner.query(
      'DROP POLICY IF EXISTS records_delete_policy ON records;'
    );
    await queryRunner.query(
      'DROP POLICY IF EXISTS records_update_policy ON records;'
    );
    await queryRunner.query(
      'DROP POLICY IF EXISTS records_insert_policy ON records;'
    );
    await queryRunner.query(
      'DROP POLICY IF EXISTS records_select_policy ON records;'
    );

    // Disable Row Level Security on records table
    await queryRunner.query('ALTER TABLE records DISABLE ROW LEVEL SECURITY;');
  }
}
