import { DataSource, QueryRunner } from 'typeorm';
import {
  Result,
  Ok,
  Err,
  RecordId,
  TagId,
  SearchQuery,
  RecordContent,
} from '@misc-poc/shared';
import { Record, DomainError } from '@misc-poc/domain';
import {
  RecordRepository,
  RecordSearchOptions,
  RecordSearchResult,
  TagStatistic,
} from '@misc-poc/application';

interface DatabaseRow {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  normalized_tags: string[];
  created_at: string;
  updated_at: string;
}

export class PostgreSQLRecordRepository implements RecordRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userId: string
  ) {
    // Validate userId format to prevent SQL injection
    this.validateUserId(userId);
  }

  private validateUserId(userId: string): void {
    // Validate UUID format to prevent SQL injection
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error('Invalid user ID format');
    }
  }

  private async setUserContext(queryRunner: QueryRunner): Promise<void> {
    try {
      // Set the current user context for RLS policies
      await queryRunner.query('SELECT set_current_user_id($1)', [this.userId]);
    } catch (error) {
      // If RLS functions are not available, continue without setting context
      // This allows the repository to work with both RLS-enabled and non-RLS databases
      console.warn(
        'RLS function not available, continuing without user context:',
        error
      );
    }
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private validateStringArray(
    arr: string[],
    maxLength: number = 1000
  ): string[] {
    // Validate and sanitize string array inputs to prevent SQL injection
    return arr
      .filter((str) => typeof str === 'string')
      .map((str) => str.slice(0, maxLength)) // Truncate excessively long strings
      .filter((str) => str.length > 0); // Remove empty strings
  }

  private validateSearchParameters(
    options: RecordSearchOptions
  ): RecordSearchOptions {
    const { limit, offset, sortBy, sortOrder } = options;

    return {
      limit:
        limit && limit > 0 ? Math.min(limit, 10000) : Number.MAX_SAFE_INTEGER,
      offset: offset && offset >= 0 ? offset : 0,
      sortBy: sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt',
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    };
  }

  private async executeWithUserContext<T>(
    operation: (queryRunner: QueryRunner) => Promise<T>
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      // Set user context for RLS policies
      await this.setUserContext(queryRunner);
      return await operation(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: RecordId): Promise<Result<Record | null, DomainError>> {
    try {
      // Validate record ID format
      if (!this.isValidUUID(id.toString())) {
        return Ok(null);
      }

      const result = await this.executeWithUserContext(async (queryRunner) => {
        return await queryRunner.query(
          'SELECT * FROM records WHERE id = $1 AND user_id = $2',
          [id.toString(), this.userId]
        );
      });

      if (result.length === 0) {
        return Ok(null);
      }

      const recordData = result[0];
      const record = this.mapDatabaseRowToRecord(recordData);
      return Ok(record);
    } catch (error) {
      return this.handleError('Failed to find record by ID', error);
    }
  }

  async findAll(
    options: RecordSearchOptions = {}
  ): Promise<Result<RecordSearchResult, DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        // Set user context for RLS policies
        await this.setUserContext(queryRunner);
        const {
          limit = Number.MAX_SAFE_INTEGER,
          offset = 0,
          sortBy = 'createdAt',
          sortOrder = 'desc',
        } = options;

        const sortColumn = sortBy === 'createdAt' ? 'created_at' : 'updated_at';
        const order = sortOrder.toUpperCase();

        const records = await queryRunner.query(
          `SELECT * FROM records
           WHERE user_id = $1
           ORDER BY ${sortColumn} ${order}
           LIMIT $2 OFFSET $3`,
          [
            this.userId,
            limit === Number.MAX_SAFE_INTEGER ? null : limit,
            offset,
          ]
        );

        const totalResult = await this.count();
        if (totalResult.isErr()) {
          return Err(totalResult.unwrapErr());
        }

        const mappedRecords = records
          .map((row: DatabaseRow) => this.mapDatabaseRowToRecord(row))
          .filter((record: Record | null): record is Record => record !== null);

        return Ok({
          records: mappedRecords,
          total: totalResult.unwrap(),
          hasMore: offset + mappedRecords.length < totalResult.unwrap(),
        });
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to find all records', error);
    }
  }

  async search(
    query: SearchQuery,
    options: RecordSearchOptions = {}
  ): Promise<Result<RecordSearchResult, DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        const tokens = query.getTokens();
        if (tokens.length === 0) {
          return this.findAll(options);
        }

        const {
          limit = Number.MAX_SAFE_INTEGER,
          offset = 0,
          sortBy = 'createdAt',
          sortOrder = 'desc',
        } = options;

        const sortColumn = sortBy === 'createdAt' ? 'created_at' : 'updated_at';
        const order = sortOrder.toUpperCase();

        // Use array overlap operator for tag search with GIN index
        const records = await queryRunner.query(
          `SELECT * FROM records
           WHERE user_id = $1 AND normalized_tags && $2
           ORDER BY ${sortColumn} ${order}
           LIMIT $3 OFFSET $4`,
          [
            this.userId,
            tokens,
            limit === Number.MAX_SAFE_INTEGER ? null : limit,
            offset,
          ]
        );

        const totalQuery = await queryRunner.query(
          `SELECT COUNT(*) FROM records
           WHERE user_id = $1 AND normalized_tags && $2`,
          [this.userId, tokens]
        );

        const total = parseInt(totalQuery[0].count);

        const mappedRecords = records
          .map((row: DatabaseRow) => this.mapDatabaseRowToRecord(row))
          .filter((record: Record | null): record is Record => record !== null);

        return Ok({
          records: mappedRecords,
          total,
          hasMore: offset + mappedRecords.length < total,
        });
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to search records', error);
    }
  }

  async findByTagIds(
    tagIds: TagId[],
    options: RecordSearchOptions = {}
  ): Promise<Result<RecordSearchResult, DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        const tagIdStrings = tagIds.map((id) => id.toString());

        const {
          limit = Number.MAX_SAFE_INTEGER,
          offset = 0,
          sortBy = 'createdAt',
          sortOrder = 'desc',
        } = options;

        const sortColumn = sortBy === 'createdAt' ? 'created_at' : 'updated_at';
        const order = sortOrder.toUpperCase();

        // Use array overlap operator for tag ID search
        const records = await queryRunner.query(
          `SELECT * FROM records
           WHERE user_id = $1 AND normalized_tags && $2
           ORDER BY ${sortColumn} ${order}
           LIMIT $3 OFFSET $4`,
          [
            this.userId,
            tagIdStrings,
            limit === Number.MAX_SAFE_INTEGER ? null : limit,
            offset,
          ]
        );

        const totalQuery = await queryRunner.query(
          `SELECT COUNT(*) FROM records
           WHERE user_id = $1 AND normalized_tags && $2`,
          [this.userId, tagIdStrings]
        );

        const total = parseInt(totalQuery[0].count);

        const mappedRecords = records
          .map((row: DatabaseRow) => this.mapDatabaseRowToRecord(row))
          .filter((record: Record | null): record is Record => record !== null);

        return Ok({
          records: mappedRecords,
          total,
          hasMore: offset + mappedRecords.length < total,
        });
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to find records by tag IDs', error);
    }
  }

  async findByTags(
    tags: string[],
    options: RecordSearchOptions = {}
  ): Promise<Result<RecordSearchResult, DomainError>> {
    try {
      // Validate and sanitize input tags
      const validatedTags = this.validateStringArray(tags, 200);
      if (validatedTags.length === 0) {
        return this.findAll(options);
      }

      // Validate search parameters
      const validatedOptions = this.validateSearchParameters(options);
      const { limit, offset, sortBy, sortOrder } = validatedOptions;

      const sortColumn = sortBy === 'createdAt' ? 'created_at' : 'updated_at';
      const order = (sortOrder || 'desc').toUpperCase();

      // Use executeWithUserContext for RLS policies
      const records = await this.executeWithUserContext(async (queryRunner) => {
        return await queryRunner.query(
          `SELECT * FROM records
           WHERE user_id = $1 AND normalized_tags @> $2
           ORDER BY ${sortColumn} ${order}
           LIMIT $3 OFFSET $4`,
          [
            this.userId,
            validatedTags,
            limit === Number.MAX_SAFE_INTEGER ? null : limit,
            offset,
          ]
        );
      });

      const totalQuery = await this.executeWithUserContext(
        async (queryRunner) => {
          return await queryRunner.query(
            `SELECT COUNT(*) FROM records
           WHERE user_id = $1 AND normalized_tags @> $2`,
            [this.userId, validatedTags]
          );
        }
      );

      const total = parseInt(totalQuery[0].count);

      const mappedRecords = records
        .map((row: DatabaseRow) => this.mapDatabaseRowToRecord(row))
        .filter((record: Record | null): record is Record => record !== null);

      return Ok({
        records: mappedRecords,
        total,
        hasMore: offset + mappedRecords.length < total,
      });
    } catch (error) {
      return this.handleError('Failed to find records by tags', error);
    }
  }

  async findByTagSet(
    tagIds: Set<TagId>,
    excludeRecordId?: RecordId
  ): Promise<Result<Record[], DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        const tagIdStrings = Array.from(tagIds).map((id) => id.toString());

        let query = `SELECT * FROM records
                     WHERE user_id = $1 AND normalized_tags = $2`;
        const params: (string | string[])[] = [this.userId, tagIdStrings];

        if (excludeRecordId) {
          query += ` AND id != $3`;
          params.push(excludeRecordId.toString());
        }

        const records = await queryRunner.query(query, params);

        const mappedRecords = records
          .map((row: DatabaseRow) => this.mapDatabaseRowToRecord(row))
          .filter((record: Record | null): record is Record => record !== null);

        return Ok(mappedRecords);
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to find records by tag set', error);
    }
  }

  async save(record: Record): Promise<Result<Record, DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        const normalizedTags = Array.from(record.tagIds).map((tagId) =>
          tagId.toString()
        );

        // Check for duplicates (same normalized_tags for same user)
        const existingRecord = await queryRunner.query(
          'SELECT id FROM records WHERE user_id = $1 AND normalized_tags = $2',
          [this.userId, normalizedTags]
        );

        if (existingRecord.length > 0) {
          return Err(
            new DomainError(
              'DUPLICATE_RECORD',
              'Record with same tags already exists'
            )
          );
        }

        // Insert new record
        const result = await queryRunner.query(
          `INSERT INTO records (user_id, content, tags, normalized_tags, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            this.userId,
            record.content.toString(),
            normalizedTags,
            normalizedTags,
            record.createdAt.toISOString(),
            record.updatedAt.toISOString(),
          ]
        );

        const savedRecord = this.mapDatabaseRowToRecord(result[0]);
        return savedRecord
          ? Ok(savedRecord)
          : Err(new DomainError('SAVE_FAILED', 'Failed to save record'));
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to save record', error);
    }
  }

  async update(record: Record): Promise<Result<Record, DomainError>> {
    try {
      // Validate record ID format
      if (!this.isValidUUID(record.id.toString())) {
        return Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'));
      }

      const normalizedTags = Array.from(record.tagIds).map((tagId) =>
        tagId.toString()
      );

      // Check if record exists and belongs to user
      const existingRecord = await this.executeWithUserContext(
        async (queryRunner) => {
          return await queryRunner.query(
            'SELECT id FROM records WHERE id = $1 AND user_id = $2',
            [record.id.toString(), this.userId]
          );
        }
      );

      if (existingRecord.length === 0) {
        return Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'));
      }

      // Update record
      const result = await this.executeWithUserContext(async (queryRunner) => {
        return await queryRunner.query(
          `UPDATE records
           SET content = $1, tags = $2, normalized_tags = $3, updated_at = $4
           WHERE id = $5 AND user_id = $6
           RETURNING *`,
          [
            record.content.toString(),
            normalizedTags,
            normalizedTags,
            record.updatedAt.toISOString(),
            record.id.toString(),
            this.userId,
          ]
        );
      });

      // Handle the result format properly - PostgreSQL returns [[rows], affectedCount]
      const resultRow =
        Array.isArray(result) &&
        result.length > 0 &&
        Array.isArray(result[0]) &&
        result[0].length > 0
          ? result[0][0]
          : null;

      if (!resultRow) {
        return Err(new DomainError('UPDATE_FAILED', 'Failed to update record'));
      }

      const updatedRecord = this.mapDatabaseRowToRecord(resultRow);
      return updatedRecord
        ? Ok(updatedRecord)
        : Err(new DomainError('UPDATE_FAILED', 'Failed to update record'));
    } catch (error) {
      return this.handleError('Failed to update record', error);
    }
  }

  async delete(id: RecordId): Promise<Result<void, DomainError>> {
    try {
      // Validate record ID format
      if (!this.isValidUUID(id.toString())) {
        return Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'));
      }

      const result = await this.executeWithUserContext(async (queryRunner) => {
        return await queryRunner.query(
          'DELETE FROM records WHERE id = $1 AND user_id = $2',
          [id.toString(), this.userId]
        );
      });

      // For PostgreSQL DELETE queries, the result format is [[], affectedRows]
      const deletedRows = Array.isArray(result)
        ? result[1]
        : (result.rowCount ?? 0);
      if (deletedRows === 0) {
        return Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'));
      }

      return Ok(undefined);
    } catch (error) {
      return this.handleError('Failed to delete record', error);
    }
  }

  async saveBatch(records: Record[]): Promise<Result<Record[], DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.startTransaction();

      try {
        const savedRecords: Record[] = [];

        for (const record of records) {
          const saveResult = await this.save(record);
          if (saveResult.isErr()) {
            await queryRunner.rollbackTransaction();
            return Err(saveResult.unwrapErr());
          }
          savedRecords.push(saveResult.unwrap());
        }

        await queryRunner.commitTransaction();
        return Ok(savedRecords);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to save record batch', error);
    }
  }

  async deleteAll(): Promise<Result<void, DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        await queryRunner.query('DELETE FROM records WHERE user_id = $1', [
          this.userId,
        ]);

        return Ok(undefined);
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to delete all records', error);
    }
  }

  async count(): Promise<Result<number, DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        const result = await queryRunner.query(
          'SELECT COUNT(*) FROM records WHERE user_id = $1',
          [this.userId]
        );

        const count = parseInt(result[0].count);
        return Ok(count);
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to count records', error);
    }
  }

  async exists(id: RecordId): Promise<Result<boolean, DomainError>> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        const result = await queryRunner.query(
          'SELECT 1 FROM records WHERE id = $1 AND user_id = $2',
          [id.toString(), this.userId]
        );

        return Ok(result.length > 0);
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      return this.handleError('Failed to check record existence', error);
    }
  }

  async getTagStatistics(): Promise<Result<TagStatistic[], DomainError>> {
    try {
      const result = await this.executeWithUserContext(async (queryRunner) => {
        return await queryRunner.query(
          `SELECT
             tag,
             COUNT(*) as count
           FROM (
             SELECT UNNEST(normalized_tags) as tag
             FROM records
             WHERE user_id = $1
           ) AS tag_counts
           GROUP BY tag
           ORDER BY COUNT(*) DESC, tag ASC`,
          [this.userId]
        );
      });

      const statistics: TagStatistic[] = result.map(
        (row: { tag: string; count: string }) => ({
          tag: row.tag,
          count: parseInt(row.count),
        })
      );

      return Ok(statistics);
    } catch (error) {
      return this.handleError('Failed to get tag statistics', error);
    }
  }

  private mapDatabaseRowToRecord(row: DatabaseRow): Record | null {
    try {
      const id = new RecordId(row.id);
      const content = new RecordContent(row.content);
      const tagIds = new Set<TagId>(
        row.tags.map((tag: string) => new TagId(tag))
      );
      const createdAt = new Date(row.created_at);
      const updatedAt = new Date(row.updated_at);

      return new Record(id, content, tagIds, createdAt, updatedAt);
    } catch (error) {
      console.warn('Failed to map database row to record:', error);
      return null;
    }
  }

  private handleError(
    message: string,
    error: unknown
  ): Result<never, DomainError> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`${message}:`, error);
    return Err(
      new DomainError('DATABASE_ERROR', `${message}: ${errorMessage}`)
    );
  }
}
