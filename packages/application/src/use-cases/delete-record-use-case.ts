import { Result, RecordId, Ok, Err } from '@misc-poc/shared';
import { DomainError } from '@misc-poc/domain';
import { RecordRepository } from '../ports/record-repository';
import { TagRepository } from '../ports/tag-repository';
import { UnitOfWork } from '../ports/unit-of-work';

export interface DeleteRecordRequest {
  readonly id: string;
}

export interface DeleteRecordResponse {
  readonly deletedRecordId: string;
  readonly deletedOrphanedTags: string[];
}

export class DeleteRecordUseCase {
  private readonly recordRepository: RecordRepository;
  private readonly tagRepository: TagRepository;
  private readonly unitOfWork: UnitOfWork;

  constructor(
    recordRepository: RecordRepository,
    tagRepository: TagRepository,
    unitOfWork: UnitOfWork
  ) {
    if (recordRepository == null) {
      throw new Error('RecordRepository cannot be null or undefined');
    }
    if (tagRepository == null) {
      throw new Error('TagRepository cannot be null or undefined');
    }
    if (unitOfWork == null) {
      throw new Error('UnitOfWork cannot be null or undefined');
    }

    this.recordRepository = recordRepository;
    this.tagRepository = tagRepository;
    this.unitOfWork = unitOfWork;
  }

  async execute(
    request: DeleteRecordRequest
  ): Promise<Result<DeleteRecordResponse, DomainError>> {
    // Input validation
    if (request == null) {
      return Err(
        new DomainError(
          'VALIDATION_ERROR',
          'Request cannot be null or undefined'
        )
      );
    }

    if (request.id == null) {
      return Err(
        new DomainError(
          'VALIDATION_ERROR',
          'Record ID cannot be null or undefined'
        )
      );
    }

    // Parse and validate record ID
    let recordId: RecordId;
    try {
      recordId = new RecordId(request.id);
    } catch (error) {
      return Err(
        new DomainError(
          'VALIDATION_ERROR',
          `Invalid record ID: ${(error as Error).message}`
        )
      );
    }

    try {
      // Find the existing record
      const existingRecordResult =
        await this.recordRepository.findById(recordId);
      if (existingRecordResult.isErr()) {
        return Err(existingRecordResult.unwrapErr());
      }

      const existingRecord = existingRecordResult.unwrap();
      if (!existingRecord) {
        return Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'));
      }

      // Begin transaction
      const beginResult = await this.unitOfWork.begin();
      if (beginResult.isErr()) {
        return Err(beginResult.unwrapErr());
      }

      try {
        // Delete the record using transaction-aware repository
        const deleteResult = await this.unitOfWork.records.delete(recordId);
        if (deleteResult.isErr()) {
          await this.unitOfWork.rollback();
          return Err(deleteResult.unwrapErr());
        }

        // Find and clean up orphaned tags using transaction-aware repository
        const orphanedTagsResult = await this.unitOfWork.tags.findOrphaned();
        if (orphanedTagsResult.isErr()) {
          await this.unitOfWork.rollback();
          return Err(orphanedTagsResult.unwrapErr());
        }

        const orphanedTags = orphanedTagsResult.unwrap();
        const deletedOrphanedTagIds: string[] = [];

        if (orphanedTags.length > 0) {
          const orphanedTagIds = orphanedTags.map((tag) => tag.id);
          const deleteTagsResult =
            await this.unitOfWork.tags.deleteBatch(orphanedTagIds);
          if (deleteTagsResult.isErr()) {
            await this.unitOfWork.rollback();
            return Err(deleteTagsResult.unwrapErr());
          }

          // Store the IDs of deleted orphaned tags for response
          deletedOrphanedTagIds.push(
            ...orphanedTagIds.map((tagId) => tagId.value)
          );
        }

        // Commit transaction
        const commitResult = await this.unitOfWork.commit();
        if (commitResult.isErr()) {
          await this.unitOfWork.rollback();
          return Err(commitResult.unwrapErr());
        }

        // Return success response
        return Ok({
          deletedRecordId: recordId.value,
          deletedOrphanedTags: deletedOrphanedTagIds,
        });
      } catch (error) {
        await this.unitOfWork.rollback();
        return Err(
          new DomainError(
            'TRANSACTION_ERROR',
            `Transaction failed: ${(error as Error).message}`
          )
        );
      }
    } catch (error) {
      return Err(
        new DomainError(
          'USE_CASE_ERROR',
          `Use case execution failed: ${(error as Error).message}`
        )
      );
    }
  }
}
