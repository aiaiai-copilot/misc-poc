import {
  UpdateRecordUseCase,
  UpdateRecordRequest,
  UpdateRecordResponse,
} from '../update-record-use-case';
import { RecordRepository } from '../../ports/record-repository';
import { TagRepository } from '../../ports/tag-repository';
import { UnitOfWork } from '../../ports/unit-of-work';
import {
  Result,
  RecordContent,
  TagId,
  RecordId,
  Ok,
  Err,
} from '@misc-poc/shared';
import {
  Record,
  Tag,
  DomainError,
  TagParser,
  TagFactory,
} from '@misc-poc/domain';

describe('UpdateRecordUseCase', () => {
  let useCase: UpdateRecordUseCase;
  let mockRecordRepository: jest.Mocked<RecordRepository>;
  let mockTagRepository: jest.Mocked<TagRepository>;
  let mockUnitOfWork: jest.Mocked<UnitOfWork>;
  let mockTagParser: jest.Mocked<TagParser>;
  let mockTagFactory: jest.Mocked<TagFactory>;

  beforeEach(() => {
    mockRecordRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      search: jest.fn(),
      findByTagIds: jest.fn(),
      findByTagSet: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      saveBatch: jest.fn(),
      deleteAll: jest.fn(),
      count: jest.fn(),
      exists: jest.fn(),
    };

    mockTagRepository = {
      findById: jest.fn(),
      findByNormalizedValue: jest.fn(),
      findByNormalizedValues: jest.fn(),
      findAll: jest.fn(),
      findByPrefix: jest.fn(),
      getUsageInfo: jest.fn(),
      findOrphaned: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteBatch: jest.fn(),
      saveBatch: jest.fn(),
      deleteAll: jest.fn(),
      count: jest.fn(),
      existsByNormalizedValue: jest.fn(),
      exists: jest.fn(),
      getUsageCount: jest.fn(),
    };

    mockUnitOfWork = {
      records: mockRecordRepository,
      tags: mockTagRepository,
      begin: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      execute: jest.fn(),
      isActive: jest.fn(),
      dispose: jest.fn(),
    };

    mockTagParser = {
      parse: jest.fn(),
    } as jest.Mocked<TagParser>;

    mockTagFactory = {
      createFromString: jest.fn(),
    } as jest.Mocked<TagFactory>;

    useCase = new UpdateRecordUseCase(
      mockRecordRepository,
      mockTagRepository,
      mockUnitOfWork,
      mockTagParser,
      mockTagFactory
    );
  });

  describe('constructor', () => {
    it('should throw error when RecordRepository is null', () => {
      expect(() => {
        new UpdateRecordUseCase(null as any, mockTagRepository, mockUnitOfWork);
      }).toThrow('RecordRepository cannot be null or undefined');
    });

    it('should throw error when TagRepository is null', () => {
      expect(() => {
        new UpdateRecordUseCase(
          mockRecordRepository,
          null as any,
          mockUnitOfWork
        );
      }).toThrow('TagRepository cannot be null or undefined');
    });

    it('should throw error when UnitOfWork is null', () => {
      expect(() => {
        new UpdateRecordUseCase(
          mockRecordRepository,
          mockTagRepository,
          null as any
        );
      }).toThrow('UnitOfWork cannot be null or undefined');
    });

    it('should use default TagParser when not provided', () => {
      const useCaseWithDefaults = new UpdateRecordUseCase(
        mockRecordRepository,
        mockTagRepository,
        mockUnitOfWork
      );
      expect(useCaseWithDefaults).toBeDefined();
    });
  });

  describe('execute', () => {
    const recordId = RecordId.generate();
    const validRequest: UpdateRecordRequest = {
      id: recordId.toString(),
      content: 'updated content tag1 tag2',
    };

    const existingRecord = Record.create(
      new RecordContent('original content tag3 tag4'),
      new Set([TagId.generate(), TagId.generate()])
    );

    beforeEach(() => {
      // Reset all mocks
      jest.resetAllMocks();

      // Set up default successful mocks
      mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
      mockTagParser.parse.mockReturnValue(['tag1', 'tag2']);

      // Create default tags for testing
      const tag1 = Tag.create('tag1');
      const tag2 = Tag.create('tag2');
      mockTagRepository.findByNormalizedValue
        .mockResolvedValueOnce(Ok(tag1))
        .mockResolvedValueOnce(Ok(tag2));

      mockRecordRepository.findByTagSet.mockResolvedValue(Ok([]));
      mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
      mockUnitOfWork.commit.mockResolvedValue(Ok(undefined));
      mockRecordRepository.update.mockResolvedValue(Ok(existingRecord));
      mockTagRepository.findOrphaned.mockResolvedValue(Ok([]));
    });

    describe('input validation', () => {
      it('should return error when request is null', async () => {
        const result = await useCase.execute(null as any);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toBe(
          'Request cannot be null or undefined'
        );
      });

      it('should return error when record ID is null', async () => {
        const result = await useCase.execute({
          id: null as any,
          content: 'test',
        });

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toBe(
          'Record ID cannot be null or undefined'
        );
      });

      it('should return error when record ID is invalid', async () => {
        const result = await useCase.execute({
          id: 'invalid-id',
          content: 'test',
        });

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toContain('Invalid record ID');
      });

      it('should return error when content is null', async () => {
        const result = await useCase.execute({
          id: recordId.toString(),
          content: null as any,
        });

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toBe(
          'Content cannot be null or undefined'
        );
      });

      it('should return error when content is empty', async () => {
        const result = await useCase.execute({
          id: recordId.toString(),
          content: '',
        });

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toBe('Content cannot be empty');
      });

      it('should return error when content is only whitespace', async () => {
        const result = await useCase.execute({
          id: recordId.toString(),
          content: '   ',
        });

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toBe('Content cannot be empty');
      });
    });

    describe('record existence check', () => {
      it('should return error when record does not exist', async () => {
        mockRecordRepository.findById.mockResolvedValue(Ok(null));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('RECORD_NOT_FOUND');
        expect(result.unwrapErr().message).toBe('Record not found');
        expect(mockRecordRepository.findById).toHaveBeenCalledWith(recordId);
      });

      it('should return error when record repository fails', async () => {
        const error = new DomainError('REPOSITORY_ERROR', 'Database error');
        mockRecordRepository.findById.mockResolvedValue(Err(error));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(error);
      });
    });

    describe('content parsing and tag creation', () => {
      it('should parse content using TagParser', async () => {
        mockTagParser.parse.mockReturnValue(['tag1', 'tag2', 'tag3']);

        await useCase.execute(validRequest);

        expect(mockTagParser.parse).toHaveBeenCalledWith(
          'updated content tag1 tag2'
        );
      });

      it('should find existing tags by normalized value', async () => {
        const existingTag = Tag.create('tag1');
        mockTagRepository.findByNormalizedValue.mockResolvedValue(
          Ok(existingTag)
        );

        await useCase.execute(validRequest);

        expect(mockTagRepository.findByNormalizedValue).toHaveBeenCalledWith(
          'tag1'
        );
        expect(mockTagRepository.findByNormalizedValue).toHaveBeenCalledWith(
          'tag2'
        );
      });

      it('should create new tags when they do not exist', async () => {
        const newTag = Tag.create('tag1');
        // Override default mock to return null (tag doesn't exist)
        mockTagRepository.findByNormalizedValue.mockReset();
        mockTagRepository.findByNormalizedValue.mockResolvedValue(Ok(null));
        mockTagFactory.createFromString.mockReturnValue(newTag);
        mockTagRepository.save.mockResolvedValue(Ok(newTag));

        await useCase.execute(validRequest);

        expect(mockTagFactory.createFromString).toHaveBeenCalledWith('tag1');
        expect(mockTagRepository.save).toHaveBeenCalledWith(newTag);
      });

      it('should return error when tag creation fails', async () => {
        // Override default mock to return null (tag doesn't exist)
        mockTagRepository.findByNormalizedValue.mockReset();
        mockTagRepository.findByNormalizedValue.mockResolvedValue(Ok(null));
        mockTagFactory.createFromString.mockImplementation(() => {
          throw new Error('Invalid tag format');
        });

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('TAG_CREATION_ERROR');
        expect(result.unwrapErr().message).toContain('Failed to create tag');
      });

      it('should return error when tag save fails', async () => {
        const error = new DomainError('SAVE_ERROR', 'Save failed');
        // Override default mock to return null (tag doesn't exist)
        mockTagRepository.findByNormalizedValue.mockReset();
        mockTagRepository.findByNormalizedValue.mockResolvedValue(Ok(null));
        mockTagFactory.createFromString.mockReturnValue(Tag.create('tag1'));
        mockTagRepository.save.mockResolvedValue(Err(error));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(error);
      });
    });

    describe('duplicate checking', () => {
      it('should check for duplicates excluding current record', async () => {
        // Create specific tags for this test
        const tag1 = Tag.create('tag1');
        const tag2 = Tag.create('tag2');

        // Override default mock with specific tags
        mockTagRepository.findByNormalizedValue.mockReset();
        mockTagRepository.findByNormalizedValue
          .mockResolvedValueOnce(Ok(tag1))
          .mockResolvedValueOnce(Ok(tag2));

        await useCase.execute(validRequest);

        expect(mockRecordRepository.findByTagSet).toHaveBeenCalledWith(
          new Set([tag1.id, tag2.id]),
          recordId
        );
      });

      it('should return error when duplicate record found', async () => {
        const duplicateRecord = Record.create(
          new RecordContent('duplicate'),
          new Set([TagId.generate()])
        );

        // Set up mock to return existing tags
        const tag1 = Tag.create('tag1');
        const tag2 = Tag.create('tag2');
        mockTagRepository.findByNormalizedValue
          .mockResolvedValueOnce(Ok(tag1))
          .mockResolvedValueOnce(Ok(tag2));

        mockRecordRepository.findByTagSet.mockResolvedValue(
          Ok([duplicateRecord])
        );

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('DUPLICATE_RECORD');
        expect(result.unwrapErr().message).toBe(
          'A record with the same tag set already exists'
        );
      });

      it('should return error when duplicate check fails', async () => {
        const error = new DomainError('REPOSITORY_ERROR', 'Database error');
        mockRecordRepository.findByTagSet.mockResolvedValue(Err(error));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(error);
      });
    });

    describe('transaction management', () => {
      it('should begin transaction before updating', async () => {
        await useCase.execute(validRequest);

        expect(mockUnitOfWork.begin).toHaveBeenCalled();
      });

      it('should rollback transaction when begin fails', async () => {
        const error = new DomainError('TRANSACTION_ERROR', 'Begin failed');
        mockUnitOfWork.begin.mockResolvedValue(Err(error));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(error);
      });

      it('should rollback transaction when update fails', async () => {
        const error = new DomainError('UPDATE_ERROR', 'Update failed');
        mockRecordRepository.update.mockResolvedValue(Err(error));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
        expect(result.unwrapErr()).toBe(error);
      });

      it('should rollback transaction when commit fails', async () => {
        const error = new DomainError('COMMIT_ERROR', 'Commit failed');
        mockUnitOfWork.commit.mockResolvedValue(Err(error));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
        expect(result.unwrapErr()).toBe(error);
      });

      it('should rollback transaction when cleanup fails', async () => {
        const error = new DomainError('CLEANUP_ERROR', 'Cleanup failed');
        mockTagRepository.findOrphaned.mockResolvedValue(Err(error));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
        expect(result.unwrapErr()).toBe(error);
      });
    });

    describe('record update', () => {
      it('should update record with new content and tags', async () => {
        const tag1 = Tag.create('tag1');
        const tag2 = Tag.create('tag2');
        mockTagRepository.findByNormalizedValue
          .mockResolvedValueOnce(Ok(tag1))
          .mockResolvedValueOnce(Ok(tag2));

        await useCase.execute(validRequest);

        expect(mockRecordRepository.update).toHaveBeenCalledWith(
          expect.objectContaining({
            id: existingRecord.id,
            content: expect.any(RecordContent),
            tagIds: new Set([tag1.id, tag2.id]),
          })
        );
      });

      it('should preserve record ID and timestamps when updating', async () => {
        const originalId = existingRecord.id;
        const originalCreatedAt = existingRecord.createdAt;

        await useCase.execute(validRequest);

        const updateCall = mockRecordRepository.update.mock.calls[0][0];
        expect(updateCall.id).toBe(originalId);
        expect(updateCall.createdAt).toBe(originalCreatedAt);
        expect(updateCall.updatedAt).not.toBe(existingRecord.updatedAt);
      });
    });

    describe('orphaned tag cleanup', () => {
      it('should find and delete orphaned tags after update', async () => {
        const orphanedTag = Tag.create('orphaned');
        mockTagRepository.findOrphaned.mockResolvedValue(Ok([orphanedTag]));
        mockTagRepository.deleteBatch.mockResolvedValue(Ok(undefined));

        await useCase.execute(validRequest);

        expect(mockTagRepository.findOrphaned).toHaveBeenCalled();
        expect(mockTagRepository.deleteBatch).toHaveBeenCalledWith([
          orphanedTag.id,
        ]);
      });

      it('should not call deleteBatch when no orphaned tags found', async () => {
        mockTagRepository.findOrphaned.mockResolvedValue(Ok([]));

        await useCase.execute(validRequest);

        expect(mockTagRepository.findOrphaned).toHaveBeenCalled();
        expect(mockTagRepository.deleteBatch).not.toHaveBeenCalled();
      });

      it('should return error when orphaned tag deletion fails', async () => {
        const orphanedTag = Tag.create('orphaned');
        const error = new DomainError('DELETE_ERROR', 'Delete failed');
        mockTagRepository.findOrphaned.mockResolvedValue(Ok([orphanedTag]));
        mockTagRepository.deleteBatch.mockResolvedValue(Err(error));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
        expect(result.unwrapErr()).toBe(error);
      });
    });

    describe('optimistic locking', () => {
      it('should handle concurrent modification gracefully', async () => {
        // Simulate concurrent modification by changing the record between find and update
        const modifiedRecord = Record.create(
          new RecordContent('modified by someone else'),
          new Set([TagId.generate()])
        );
        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockRecordRepository.update.mockResolvedValue(Ok(modifiedRecord));

        const result = await useCase.execute(validRequest);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap().record.id).toBe(modifiedRecord.id.toString());
      });

      it('should handle version conflict error', async () => {
        const versionError = new DomainError(
          'VERSION_CONFLICT',
          'Record was modified by another user'
        );
        mockRecordRepository.update.mockResolvedValue(Err(versionError));

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VERSION_CONFLICT');
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
      });
    });

    describe('successful execution', () => {
      it('should return success response with updated record DTO', async () => {
        const updatedRecord = Record.create(
          new RecordContent('updated content'),
          new Set([TagId.generate()])
        );
        mockRecordRepository.update.mockResolvedValue(Ok(updatedRecord));

        const result = await useCase.execute(validRequest);

        expect(result.isOk()).toBe(true);
        const response = result.unwrap();
        expect(response.record.id).toBe(updatedRecord.id.toString());
        expect(response.record.content).toBe('updated content');
        expect(mockUnitOfWork.commit).toHaveBeenCalled();
      });

      it('should complete entire workflow in correct order', async () => {
        const callOrder: string[] = [];

        // Reset all mocks first
        jest.resetAllMocks();

        mockRecordRepository.findById.mockImplementation(async () => {
          callOrder.push('findById');
          return Ok(existingRecord);
        });

        mockTagParser.parse.mockImplementation(() => {
          callOrder.push('parse');
          return ['tag1'];
        });

        mockTagRepository.findByNormalizedValue.mockImplementation(async () => {
          callOrder.push('findByNormalizedValue');
          return Ok(Tag.create('tag1'));
        });

        mockRecordRepository.findByTagSet.mockImplementation(async () => {
          callOrder.push('findByTagSet');
          return Ok([]);
        });

        mockUnitOfWork.begin.mockImplementation(async () => {
          callOrder.push('begin');
          return Ok(undefined);
        });

        mockRecordRepository.update.mockImplementation(async () => {
          callOrder.push('update');
          return Ok(existingRecord);
        });

        mockTagRepository.findOrphaned.mockImplementation(async () => {
          callOrder.push('findOrphaned');
          return Ok([]);
        });

        mockUnitOfWork.commit.mockImplementation(async () => {
          callOrder.push('commit');
          return Ok(undefined);
        });

        await useCase.execute(validRequest);

        expect(callOrder).toEqual([
          'findById',
          'parse',
          'findByNormalizedValue',
          'findByTagSet',
          'begin',
          'update',
          'findOrphaned',
          'commit',
        ]);
      });
    });

    describe('error handling', () => {
      it('should handle unexpected errors gracefully', async () => {
        mockRecordRepository.findById.mockRejectedValue(
          new Error('Unexpected error')
        );

        const result = await useCase.execute(validRequest);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('USE_CASE_ERROR');
        expect(result.unwrapErr().message).toContain(
          'Use case execution failed'
        );
      });
    });
  });
});
