import {
  Result,
  RecordContent,
  TagId,
  RecordId,
  Ok,
  Err,
} from '@misc-poc/shared';
import { Record, TagFactory, TagParser, DomainError } from '@misc-poc/domain';
import { RecordRepository } from '../ports/record-repository';
import { TagRepository } from '../ports/tag-repository';
import { UnitOfWork } from '../ports/unit-of-work';
import { RecordDTO, RecordDTOMapper } from '../dtos/record-dto';

export interface UpdateRecordRequest {
  readonly id: string;
  readonly content: string;
}

export interface UpdateRecordResponse {
  readonly record: RecordDTO;
}

export class UpdateRecordUseCase {
  private readonly recordRepository: RecordRepository;
  private readonly tagRepository: TagRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly tagParser: TagParser;
  private readonly tagFactory: TagFactory;

  constructor(
    recordRepository: RecordRepository,
    tagRepository: TagRepository,
    unitOfWork: UnitOfWork,
    tagParser?: TagParser,
    tagFactory?: TagFactory
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
    this.tagParser = tagParser || new TagParser();
    this.tagFactory = tagFactory || new TagFactory();
  }

  async execute(
    request: UpdateRecordRequest
  ): Promise<Result<UpdateRecordResponse, DomainError>> {
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

    if (request.content == null) {
      return Err(
        new DomainError(
          'VALIDATION_ERROR',
          'Content cannot be null or undefined'
        )
      );
    }

    if (typeof request.content !== 'string' || request.content.trim() === '') {
      return Err(
        new DomainError('VALIDATION_ERROR', 'Content cannot be empty')
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

      // Parse tags from new content
      const tagStrings = this.tagParser.parse(request.content);

      // Process tags (find existing ones, create new ones)
      const tagIds = new Set<TagId>();

      for (const tagString of tagStrings) {
        // Try to find existing tag
        const existingTagResult =
          await this.tagRepository.findByNormalizedValue(tagString);
        if (existingTagResult.isErr()) {
          return Err(existingTagResult.unwrapErr());
        }

        let tag = existingTagResult.unwrap();

        if (!tag) {
          // Create new tag
          try {
            const newTag = this.tagFactory.createFromString(tagString);
            const saveTagResult = await this.tagRepository.save(newTag);
            if (saveTagResult.isErr()) {
              return Err(saveTagResult.unwrapErr());
            }
            tag = saveTagResult.unwrap();
          } catch (error) {
            return Err(
              new DomainError(
                'TAG_CREATION_ERROR',
                `Failed to create tag: ${(error as Error).message}`
              )
            );
          }
        }

        tagIds.add(tag.id);
      }

      // Check for duplicates (excluding current record)
      const duplicateCheckResult = await this.recordRepository.findByTagSet(
        tagIds,
        recordId
      );
      if (duplicateCheckResult.isErr()) {
        return Err(duplicateCheckResult.unwrapErr());
      }

      const duplicates = duplicateCheckResult.unwrap();
      if (duplicates.length > 0) {
        return Err(
          new DomainError(
            'DUPLICATE_RECORD',
            'A record with the same tag set already exists'
          )
        );
      }

      // Create updated record content
      let recordContent: RecordContent;
      try {
        recordContent = new RecordContent(request.content);
      } catch (error) {
        return Err(
          new DomainError(
            'VALIDATION_ERROR',
            `Invalid record content: ${(error as Error).message}`
          )
        );
      }

      // Create updated record with new content and tags
      // Since Record is immutable, we create a new instance with updated content and tags
      const updatedRecord = new Record(
        existingRecord.id,
        recordContent,
        tagIds,
        existingRecord.createdAt,
        new Date() // Update timestamp
      );

      // Begin transaction
      const beginResult = await this.unitOfWork.begin();
      if (beginResult.isErr()) {
        return Err(beginResult.unwrapErr());
      }

      try {
        // Update record
        const updateResult = await this.recordRepository.update(updatedRecord);
        if (updateResult.isErr()) {
          await this.unitOfWork.rollback();
          return Err(updateResult.unwrapErr());
        }

        const savedRecord = updateResult.unwrap();

        // Clean up orphaned tags
        const orphanedTagsResult = await this.tagRepository.findOrphaned();
        if (orphanedTagsResult.isErr()) {
          await this.unitOfWork.rollback();
          return Err(orphanedTagsResult.unwrapErr());
        }

        const orphanedTags = orphanedTagsResult.unwrap();
        if (orphanedTags.length > 0) {
          const orphanedTagIds = orphanedTags.map((tag) => tag.id);
          const deleteResult =
            await this.tagRepository.deleteBatch(orphanedTagIds);
          if (deleteResult.isErr()) {
            await this.unitOfWork.rollback();
            return Err(deleteResult.unwrapErr());
          }
        }

        // Commit transaction
        const commitResult = await this.unitOfWork.commit();
        if (commitResult.isErr()) {
          await this.unitOfWork.rollback();
          return Err(commitResult.unwrapErr());
        }

        // Return success response
        return Ok({
          record: RecordDTOMapper.toDTO(savedRecord),
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
