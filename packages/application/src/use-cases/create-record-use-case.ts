import { Result, RecordContent, TagId, Ok, Err } from '@misc-poc/shared';
import { Record, TagFactory, TagParser, DomainError } from '@misc-poc/domain';
import { RecordRepository } from '../ports/record-repository';
import { TagRepository } from '../ports/tag-repository';
import { UnitOfWork } from '../ports/unit-of-work';
import { RecordDTO, RecordDTOMapper } from '../dtos/record-dto';

export interface CreateRecordRequest {
  readonly content: string;
}

export interface CreateRecordResponse {
  readonly record: RecordDTO;
}

export class CreateRecordUseCase {
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
    request: CreateRecordRequest
  ): Promise<Result<CreateRecordResponse, DomainError>> {
    // Input validation
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
      // Parse tags from content
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

      // Create record content value object
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

      // Create record
      const record = Record.create(recordContent, tagIds);

      // Check for duplicates (using recordRepository to find records by tag set)
      const duplicateCheckResult =
        await this.recordRepository.findByTagSet(tagIds);
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

      // Begin transaction
      const beginResult = await this.unitOfWork.begin();
      if (beginResult.isErr()) {
        return Err(beginResult.unwrapErr());
      }

      try {
        // Save record
        const saveResult = await this.recordRepository.save(record);
        if (saveResult.isErr()) {
          await this.unitOfWork.rollback();
          return Err(saveResult.unwrapErr());
        }

        const savedRecord = saveResult.unwrap();

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
