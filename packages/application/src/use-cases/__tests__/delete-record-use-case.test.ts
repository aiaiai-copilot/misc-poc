import {
  DeleteRecordUseCase,
  DeleteRecordRequest,
  DeleteRecordResponse,
} from '../delete-record-use-case';
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
import { Record, Tag, DomainError } from '@misc-poc/domain';

describe('DeleteRecordUseCase', () => {
  let useCase: DeleteRecordUseCase;
  let mockRecordRepository: jest.Mocked<RecordRepository>;
  let mockTagRepository: jest.Mocked<TagRepository>;
  let mockUnitOfWork: jest.Mocked<UnitOfWork>;

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
      records: {
        ...mockRecordRepository,
        delete: jest.fn().mockResolvedValue(Ok(undefined)),
      },
      tags: {
        ...mockTagRepository,
        findOrphaned: jest.fn().mockResolvedValue(Ok([])),
        deleteBatch: jest.fn().mockResolvedValue(Ok(undefined)),
      },
      begin: jest.fn().mockResolvedValue(Ok(undefined)),
      commit: jest.fn().mockResolvedValue(Ok(undefined)),
      rollback: jest.fn().mockResolvedValue(Ok(undefined)),
      execute: jest.fn(),
      isActive: jest.fn(),
      dispose: jest.fn(),
    };

    useCase = new DeleteRecordUseCase(
      mockRecordRepository,
      mockUnitOfWork
    );
  });

  describe('constructor', () => {
    it('should throw error when RecordRepository is null', () => {
      expect(() => {
        new DeleteRecordUseCase(null as any, mockUnitOfWork);
      }).toThrow('RecordRepository cannot be null or undefined');
    });

    it('should throw error when RecordRepository is undefined', () => {
      expect(() => {
        new DeleteRecordUseCase(
          undefined as any,
          mockUnitOfWork
        );
      }).toThrow('RecordRepository cannot be null or undefined');
    });

    it('should throw error when UnitOfWork is null', () => {
      expect(() => {
        new DeleteRecordUseCase(
          mockRecordRepository,
          null as any
        );
      }).toThrow('UnitOfWork cannot be null or undefined');
    });

    it('should throw error when UnitOfWork is undefined', () => {
      expect(() => {
        new DeleteRecordUseCase(
          mockRecordRepository,
          undefined as any
        );
      }).toThrow('UnitOfWork cannot be null or undefined');
    });

    it('should create instance with valid dependencies', () => {
      expect(useCase).toBeInstanceOf(DeleteRecordUseCase);
    });
  });

  describe('execute', () => {
    const validRecordId = new RecordId('550e8400-e29b-41d4-a716-446655440001');
    const tagId1 = new TagId('550e8400-e29b-41d4-a716-446655441001');
    const tagId2 = new TagId('550e8400-e29b-41d4-a716-446655441002');
    const tagIds = new Set([tagId1, tagId2]);

    const existingRecord = new Record(
      validRecordId,
      new RecordContent('Test content #tag1 #tag2'),
      tagIds,
      new Date('2023-01-01'),
      new Date('2023-01-02')
    );

    const orphanedTag1 = new Tag(tagId1, 'tag1');
    const orphanedTag2 = new Tag(tagId2, 'tag2');

    describe('input validation', () => {
      it('should return error when request is null', async () => {
        const result = await useCase.execute(null as any);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toEqual(
          new DomainError(
            'VALIDATION_ERROR',
            'Request cannot be null or undefined'
          )
        );
      });

      it('should return error when request is undefined', async () => {
        const result = await useCase.execute(undefined as any);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toEqual(
          new DomainError(
            'VALIDATION_ERROR',
            'Request cannot be null or undefined'
          )
        );
      });

      it('should return error when record ID is null', async () => {
        const request: DeleteRecordRequest = { id: null as any };

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toEqual(
          new DomainError(
            'VALIDATION_ERROR',
            'Record ID cannot be null or undefined'
          )
        );
      });

      it('should return error when record ID is undefined', async () => {
        const request: DeleteRecordRequest = { id: undefined as any };

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toEqual(
          new DomainError(
            'VALIDATION_ERROR',
            'Record ID cannot be null or undefined'
          )
        );
      });

      it('should return error when record ID is invalid', async () => {
        const request: DeleteRecordRequest = { id: '' };

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toContain('Invalid record ID');
      });
    });

    describe('record not found scenarios', () => {
      it('should return error when record does not exist', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };

        mockRecordRepository.findById.mockResolvedValue(Ok(null));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toEqual(
          new DomainError('RECORD_NOT_FOUND', 'Record not found')
        );
        expect(mockRecordRepository.findById).toHaveBeenCalledWith(
          validRecordId
        );
      });

      it('should return error when repository findById fails', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const repositoryError = new DomainError(
          'REPOSITORY_ERROR',
          'Database connection failed'
        );

        mockRecordRepository.findById.mockResolvedValue(Err(repositoryError));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(repositoryError);
        expect(mockRecordRepository.findById).toHaveBeenCalledWith(
          validRecordId
        );
      });
    });

    describe('successful deletion', () => {
      it('should successfully delete record without orphaned tags', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockResolvedValue(Ok(undefined));
        mockTagRepository.findOrphaned.mockResolvedValue(Ok([]));
        mockUnitOfWork.commit.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toEqual({
          deletedRecordId: validRecordId.value,
          deletedOrphanedTags: [],
        });

        expect(mockRecordRepository.findById).toHaveBeenCalledWith(
          validRecordId
        );
        expect(mockUnitOfWork.begin).toHaveBeenCalled();
        expect(mockRecordRepository.delete).toHaveBeenCalledWith(validRecordId);
        expect(mockTagRepository.findOrphaned).toHaveBeenCalled();
        expect(mockTagRepository.deleteBatch).not.toHaveBeenCalled();
        expect(mockUnitOfWork.commit).toHaveBeenCalled();
        expect(mockUnitOfWork.rollback).not.toHaveBeenCalled();
      });

      it('should successfully delete record and cleanup orphaned tags', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const orphanedTags = [orphanedTag1, orphanedTag2];

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockResolvedValue(Ok(undefined));
        mockTagRepository.findOrphaned.mockResolvedValue(Ok(orphanedTags));
        mockTagRepository.deleteBatch.mockResolvedValue(Ok(undefined));
        mockUnitOfWork.commit.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toEqual({
          deletedRecordId: validRecordId.value,
          deletedOrphanedTags: [tagId1.value, tagId2.value],
        });

        expect(mockRecordRepository.findById).toHaveBeenCalledWith(
          validRecordId
        );
        expect(mockUnitOfWork.begin).toHaveBeenCalled();
        expect(mockRecordRepository.delete).toHaveBeenCalledWith(validRecordId);
        expect(mockTagRepository.findOrphaned).toHaveBeenCalled();
        expect(mockTagRepository.deleteBatch).toHaveBeenCalledWith([
          tagId1,
          tagId2,
        ]);
        expect(mockUnitOfWork.commit).toHaveBeenCalled();
        expect(mockUnitOfWork.rollback).not.toHaveBeenCalled();
      });
    });

    describe('transaction handling', () => {
      it('should rollback transaction when begin fails', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const transactionError = new DomainError(
          'TRANSACTION_ERROR',
          'Failed to begin transaction'
        );

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Err(transactionError));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(transactionError);
        expect(mockRecordRepository.delete).not.toHaveBeenCalled();
        expect(mockUnitOfWork.rollback).not.toHaveBeenCalled();
        expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      });

      it('should rollback transaction when record deletion fails', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const deleteError = new DomainError(
          'REPOSITORY_ERROR',
          'Failed to delete record'
        );

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockResolvedValue(Err(deleteError));
        mockUnitOfWork.rollback.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(deleteError);
        expect(mockRecordRepository.delete).toHaveBeenCalledWith(validRecordId);
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
        expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      });

      it('should rollback transaction when finding orphaned tags fails', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const orphanedTagsError = new DomainError(
          'REPOSITORY_ERROR',
          'Failed to find orphaned tags'
        );

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockResolvedValue(Ok(undefined));
        mockTagRepository.findOrphaned.mockResolvedValue(
          Err(orphanedTagsError)
        );
        mockUnitOfWork.rollback.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(orphanedTagsError);
        expect(mockRecordRepository.delete).toHaveBeenCalledWith(validRecordId);
        expect(mockTagRepository.findOrphaned).toHaveBeenCalled();
        expect(mockTagRepository.deleteBatch).not.toHaveBeenCalled();
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
        expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      });

      it('should rollback transaction when deleting orphaned tags fails', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const orphanedTags = [orphanedTag1, orphanedTag2];
        const deleteTagsError = new DomainError(
          'REPOSITORY_ERROR',
          'Failed to delete orphaned tags'
        );

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockResolvedValue(Ok(undefined));
        mockTagRepository.findOrphaned.mockResolvedValue(Ok(orphanedTags));
        mockTagRepository.deleteBatch.mockResolvedValue(Err(deleteTagsError));
        mockUnitOfWork.rollback.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(deleteTagsError);
        expect(mockRecordRepository.delete).toHaveBeenCalledWith(validRecordId);
        expect(mockTagRepository.findOrphaned).toHaveBeenCalled();
        expect(mockTagRepository.deleteBatch).toHaveBeenCalledWith([
          tagId1,
          tagId2,
        ]);
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
        expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      });

      it('should rollback transaction when commit fails', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const commitError = new DomainError(
          'TRANSACTION_ERROR',
          'Failed to commit transaction'
        );

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockResolvedValue(Ok(undefined));
        mockTagRepository.findOrphaned.mockResolvedValue(Ok([]));
        mockUnitOfWork.commit.mockResolvedValue(Err(commitError));
        mockUnitOfWork.rollback.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe(commitError);
        expect(mockRecordRepository.delete).toHaveBeenCalledWith(validRecordId);
        expect(mockTagRepository.findOrphaned).toHaveBeenCalled();
        expect(mockUnitOfWork.commit).toHaveBeenCalled();
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
      });

      it('should handle general exception during transaction', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const generalError = new Error('Unexpected error');

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockRejectedValue(generalError);
        mockUnitOfWork.rollback.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('TRANSACTION_ERROR');
        expect(result.unwrapErr().message).toContain(
          'Transaction failed: Unexpected error'
        );
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
        expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should handle general exception outside transaction', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const generalError = new Error('Unexpected database error');

        mockRecordRepository.findById.mockRejectedValue(generalError);

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('USE_CASE_ERROR');
        expect(result.unwrapErr().message).toContain(
          'Use case execution failed: Unexpected database error'
        );
        expect(mockUnitOfWork.begin).not.toHaveBeenCalled();
        expect(mockUnitOfWork.rollback).not.toHaveBeenCalled();
        expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
      });
    });

    describe('edge cases', () => {
      it('should handle empty string record ID', async () => {
        const request: DeleteRecordRequest = { id: '' };

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toContain('Invalid record ID');
      });

      it('should handle whitespace-only record ID', async () => {
        const request: DeleteRecordRequest = { id: '   ' };

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('VALIDATION_ERROR');
        expect(result.unwrapErr().message).toContain('Invalid record ID');
      });
    });

    describe('concurrent deletion scenarios', () => {
      it('should handle case where record was already deleted by another process', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };

        // First call finds the record, but when we try to delete it's already gone
        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockResolvedValue(
          Err(new DomainError('RECORD_NOT_FOUND', 'Record not found'))
        );
        mockUnitOfWork.rollback.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('RECORD_NOT_FOUND');
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
      });
    });

    describe('referential integrity', () => {
      it('should ensure orphaned tag cleanup is atomic with record deletion', async () => {
        const request: DeleteRecordRequest = { id: validRecordId.value };
        const orphanedTags = [orphanedTag1];

        mockRecordRepository.findById.mockResolvedValue(Ok(existingRecord));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.delete.mockResolvedValue(Ok(undefined));
        mockTagRepository.findOrphaned.mockResolvedValue(Ok(orphanedTags));
        mockTagRepository.deleteBatch.mockResolvedValue(Ok(undefined));
        mockUnitOfWork.commit.mockResolvedValue(Ok(undefined));

        const result = await useCase.execute(request);

        expect(result.isOk()).toBe(true);

        // Verify all operations were called within the transaction
        expect(mockUnitOfWork.begin).toHaveBeenCalled();
        expect(mockRecordRepository.delete).toHaveBeenCalledWith(validRecordId);
        expect(mockTagRepository.findOrphaned).toHaveBeenCalled();
        expect(mockTagRepository.deleteBatch).toHaveBeenCalledWith([tagId1]);
        expect(mockUnitOfWork.commit).toHaveBeenCalled();
      });
    });
  });
});
