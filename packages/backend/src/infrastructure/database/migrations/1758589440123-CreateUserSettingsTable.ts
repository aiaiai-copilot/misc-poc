import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableCheck,
} from 'typeorm';

export class CreateUserSettingsTable1758589440123
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_settings table with fields as specified in PRD
    await queryRunner.createTable(
      new Table({
        name: 'user_settings',
        columns: [
          {
            name: 'user_id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            comment: 'Primary key and foreign key reference to users table',
          },
          {
            name: 'case_sensitive',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment: 'Whether tag matching should be case sensitive',
          },
          {
            name: 'remove_accents',
            type: 'boolean',
            default: true,
            isNullable: false,
            comment: 'Whether to remove accents from tags during normalization',
          },
          {
            name: 'max_tag_length',
            type: 'integer',
            default: 100,
            isNullable: false,
            comment: 'Maximum length allowed for individual tags',
          },
          {
            name: 'max_tags_per_record',
            type: 'integer',
            default: 50,
            isNullable: false,
            comment: 'Maximum number of tags allowed per record',
          },
          {
            name: 'ui_language',
            type: 'varchar',
            length: '10',
            default: "'en'",
            isNullable: false,
            comment: 'User interface language preference',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Record creation timestamp',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
            comment: 'Record last update timestamp',
          },
        ],
        checks: [
          new TableCheck({
            name: 'CHK_user_settings_max_tag_length_positive',
            expression: 'max_tag_length > 0',
          }),
          new TableCheck({
            name: 'CHK_user_settings_max_tags_per_record_positive',
            expression: 'max_tags_per_record > 0',
          }),
          new TableCheck({
            name: 'CHK_user_settings_ui_language_valid',
            expression:
              "ui_language IN ('en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko')",
          }),
        ],
      }),
      true
    );

    // Create foreign key constraint to users table
    await queryRunner.createForeignKey(
      'user_settings',
      new TableForeignKey({
        name: 'FK_user_settings_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint first
    await queryRunner.dropForeignKey(
      'user_settings',
      'FK_user_settings_user_id'
    );

    // Drop the table
    await queryRunner.dropTable('user_settings');
  }
}
