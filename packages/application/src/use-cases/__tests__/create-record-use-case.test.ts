import {
  CreateRecordUseCase,
  CreateRecordRequest,
  CreateRecordResponse,
} from '../create-record-use-case';
import { RecordRepository } from '../../ports/record-repository';
import { TagRepository } from '../../ports/tag-repository';
import { UnitOfWork } from '../../ports/unit-of-work';
import { Result, RecordContent, TagId, Ok, Err } from '@misc-poc/shared';
import { Record, Tag, DomainError } from '@misc-poc/domain';

describe('CreateRecordUseCase', () => {
  let useCase: CreateRecordUseCase;
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
      begin: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn().mockResolvedValue(Ok(undefined)),
    };

    useCase = new CreateRecordUseCase(
      mockRecordRepository,
      mockTagRepository,
      mockUnitOfWork
    );
  });

  describe('execute', () => {
    describe('when given valid input', () => {
      it('should create a record successfully with tags', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content #tag1 #tag2',
        };

        const tag1 = new Tag(TagId.generate(), 'tag1', 'tag1');
        const tag2 = new Tag(TagId.generate(), 'tag2', 'tag2');
        const createdRecord = Record.create(
          new RecordContent('Test content #tag1 #tag2'),
          new Set([tag1.id, tag2.id])
        );

        mockTagRepository.findByNormalizedValue.mockImplementation(
          (normalizedValue: string) => {
            if (normalizedValue === 'tag1') {
              return Promise.resolve(Ok(tag1));
            }
            if (normalizedValue === 'tag2') {
              return Promise.resolve(Ok(tag2));
            }
            return Promise.resolve(Ok(null));
          }
        );

        mockRecordRepository.findByTagSet.mockResolvedValue(Ok([]));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.save.mockResolvedValue(Ok(createdRecord));
        mockUnitOfWork.commit.mockResolvedValue(Ok(undefined));

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isOk()).toBe(true);
        const response = result.unwrap() as CreateRecordResponse;
        expect(response.record).toBeDefined();
        expect(response.record.content).toBe('Test content #tag1 #tag2');
        expect(response.record.tagIds).toHaveLength(2);
        expect(mockUnitOfWork.begin).toHaveBeenCalled();
        expect(mockUnitOfWork.commit).toHaveBeenCalled();
        expect(mockRecordRepository.save).toHaveBeenCalledWith(
          expect.any(Record)
        );
      });

      it('should create tags that do not exist', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content #newtag',
        };

        const newTag = new Tag(TagId.generate(), 'newtag', 'newtag');
        const createdRecord = Record.create(
          new RecordContent('Test content #newtag'),
          new Set([newTag.id])
        );

        mockTagRepository.findByNormalizedValue.mockResolvedValue(Ok(null));
        mockTagRepository.save.mockResolvedValue(Ok(newTag));
        mockRecordRepository.findByTagSet.mockResolvedValue(Ok([]));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.save.mockResolvedValue(Ok(createdRecord));
        mockUnitOfWork.commit.mockResolvedValue(Ok(undefined));

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isOk()).toBe(true);
        expect(mockTagRepository.save).toHaveBeenCalledWith(expect.any(Tag));
      });

      it('should create a record with no tags', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content without tags',
        };

        const createdRecord = Record.create(
          new RecordContent('Test content without tags'),
          new Set()
        );

        mockRecordRepository.findByTagSet.mockResolvedValue(Ok([]));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.save.mockResolvedValue(Ok(createdRecord));
        mockUnitOfWork.commit.mockResolvedValue(Ok(undefined));

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isOk()).toBe(true);
        const response = result.unwrap() as CreateRecordResponse;
        expect(response.record.tagIds).toHaveLength(0);
      });
    });

    describe('when input validation fails', () => {
      it('should return validation error for null content', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: null as any,
        };

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toContain('Content cannot be null or undefined');
      });

      it('should return validation error for undefined content', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: undefined as any,
        };

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toContain('Content cannot be null or undefined');
      });

      it('should return validation error for empty content', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: '',
        };

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toContain('Content cannot be empty');
      });

      it('should return validation error for whitespace-only content', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: '   \t\n  ',
        };

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toContain('Content cannot be empty');
      });
    });

    describe('when duplicate checking finds duplicates', () => {
      it('should return duplicate error when exact duplicate exists', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content #tag1',
        };

        const existingRecord = Record.create(
          new RecordContent('Existing content with same tags'),
          new Set([TagId.generate()])
        );

        mockTagRepository.findByNormalizedValue.mockResolvedValue(
          Ok(new Tag(TagId.generate(), 'tag1', 'tag1'))
        );

        mockRecordRepository.findByTagSet.mockResolvedValue(
          Ok([existingRecord])
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toContain('same tag set');
      });
    });

    describe('when tag operations fail', () => {
      it('should return error when tag repository fails', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content #tag1',
        };

        mockTagRepository.findByNormalizedValue.mockResolvedValue(
          Err(new DomainError('REPOSITORY_ERROR', 'Tag repository error'))
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toBe('Tag repository error');
      });

      it('should return error when tag creation fails', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content #newtag',
        };

        mockTagRepository.findByNormalizedValue.mockResolvedValue(Ok(null));
        mockTagRepository.save.mockResolvedValue(
          Err(new DomainError('REPOSITORY_ERROR', 'Tag creation failed'))
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toBe('Tag creation failed');
      });
    });

    describe('when record operations fail', () => {
      it('should return error when record save fails', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content',
        };

        mockRecordRepository.findByTagSet.mockResolvedValue(Ok([]));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.save.mockResolvedValue(
          Err(new DomainError('REPOSITORY_ERROR', 'Record save failed'))
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toBe('Record save failed');
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
      });
    });

    describe('when unit of work operations fail', () => {
      it('should return error when transaction begin fails', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content',
        };

        mockRecordRepository.findByTagSet.mockResolvedValue(Ok([]));
        mockUnitOfWork.begin.mockResolvedValue(
          Err(new DomainError('TRANSACTION_ERROR', 'Transaction begin failed'))
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toBe('Transaction begin failed');
      });

      it('should return error when transaction commit fails', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content',
        };

        const createdRecord = Record.create(
          new RecordContent('Test content'),
          new Set()
        );

        mockRecordRepository.findByTagSet.mockResolvedValue(Ok([]));
        mockUnitOfWork.begin.mockResolvedValue(Ok(undefined));
        mockRecordRepository.save.mockResolvedValue(Ok(createdRecord));
        mockUnitOfWork.commit.mockResolvedValue(
          Err(new DomainError('TRANSACTION_ERROR', 'Transaction commit failed'))
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toBe('Transaction commit failed');
        expect(mockUnitOfWork.rollback).toHaveBeenCalled();
      });
    });

    describe('when duplicate checker fails', () => {
      it('should return error when duplicate checker fails', async () => {
        // Arrange
        const request: CreateRecordRequest = {
          content: 'Test content #tag1',
        };

        mockTagRepository.findByNormalizedValue.mockResolvedValue(
          Ok(new Tag(TagId.generate(), 'tag1', 'tag1'))
        );

        mockRecordRepository.findByTagSet.mockResolvedValue(
          Err(new DomainError('REPOSITORY_ERROR', 'Duplicate check failed'))
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isErr()).toBe(true);
        const error = result.unwrapErr();
        expect(error.message).toBe('Duplicate check failed');
      });
    });
  });

  describe('constructor', () => {
    it('should throw error when recordRepository is null', () => {
      expect(() => {
        new CreateRecordUseCase(null as any, mockTagRepository, mockUnitOfWork);
      }).toThrow('RecordRepository cannot be null or undefined');
    });

    it('should throw error when tagRepository is null', () => {
      expect(() => {
        new CreateRecordUseCase(
          mockRecordRepository,
          null as any,
          mockUnitOfWork
        );
      }).toThrow('TagRepository cannot be null or undefined');
    });

    it('should throw error when unitOfWork is null', () => {
      expect(() => {
        new CreateRecordUseCase(
          mockRecordRepository,
          mockTagRepository,
          null as any
        );
      }).toThrow('UnitOfWork cannot be null or undefined');
    });
  });
});
