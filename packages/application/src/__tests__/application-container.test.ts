import {
  ApplicationContainer,
  DependencyDescriptor,
  ServiceLifetime,
  DependencyKey,
} from '../application-container';
import {
  ApplicationConfig,
  ApplicationConfigData,
} from '../application-config';
import { RecordRepository } from '../ports/record-repository';
import { TagRepository } from '../ports/tag-repository';
import { UnitOfWork } from '../ports/unit-of-work';
import { CreateRecordUseCase } from '../use-cases/create-record-use-case';
import { SearchRecordsUseCase } from '../use-cases/search-records-use-case';
import { SearchModeDetector } from '../services/search-mode-detector';
import { Result, Ok, Err } from '@misc-poc/shared';

describe('ApplicationContainer', () => {
  // Mock implementations for testing
  class MockRecordRepository implements RecordRepository {
    findById = jest.fn().mockResolvedValue(Ok(null));
    findAll = jest
      .fn()
      .mockResolvedValue(Ok({ records: [], total: 0, hasMore: false }));
    search = jest
      .fn()
      .mockResolvedValue(Ok({ records: [], total: 0, hasMore: false }));
    findByTagIds = jest
      .fn()
      .mockResolvedValue(Ok({ records: [], total: 0, hasMore: false }));
    findByTagSet = jest.fn().mockResolvedValue(Ok([]));
    save = jest.fn().mockResolvedValue(Ok(undefined));
    update = jest.fn().mockResolvedValue(Ok(undefined));
    delete = jest.fn().mockResolvedValue(Ok(undefined));
    saveBatch = jest.fn().mockResolvedValue(Ok([]));
    deleteAll = jest.fn().mockResolvedValue(Ok(undefined));
    count = jest.fn().mockResolvedValue(Ok(0));
    exists = jest.fn().mockResolvedValue(Ok(false));
  }

  class MockTagRepository implements TagRepository {
    findById = jest.fn().mockResolvedValue(Ok(null));
    findByNormalizedValue = jest.fn().mockResolvedValue(Ok(null));
    findByNormalizedValues = jest.fn().mockResolvedValue(Ok([]));
    findAll = jest.fn().mockResolvedValue(Ok([]));
    findByPrefix = jest.fn().mockResolvedValue(Ok([]));
    getUsageInfo = jest.fn().mockResolvedValue(Ok([]));
    findOrphaned = jest.fn().mockResolvedValue(Ok([]));
    save = jest.fn().mockResolvedValue(Ok(undefined));
    update = jest.fn().mockResolvedValue(Ok(undefined));
    delete = jest.fn().mockResolvedValue(Ok(undefined));
    deleteBatch = jest.fn().mockResolvedValue(Ok(undefined));
    saveBatch = jest.fn().mockResolvedValue(Ok([]));
    deleteAll = jest.fn().mockResolvedValue(Ok(undefined));
    count = jest.fn().mockResolvedValue(Ok(0));
    existsByNormalizedValue = jest.fn().mockResolvedValue(Ok(false));
    exists = jest.fn().mockResolvedValue(Ok(false));
    getUsageCount = jest.fn().mockResolvedValue(Ok(0));
  }

  class MockUnitOfWork implements UnitOfWork {
    records = {} as RecordRepository;
    tags = {} as TagRepository;
    begin = jest.fn().mockResolvedValue(Ok(undefined));
    commit = jest.fn().mockResolvedValue(Ok(undefined));
    rollback = jest.fn().mockResolvedValue(Ok(undefined));
    execute = jest.fn().mockResolvedValue(Ok(undefined));
    isActive = jest.fn().mockReturnValue(false);
    dispose = jest.fn().mockResolvedValue(undefined);
  }

  describe('constructor', () => {
    it('should create a new container instance', (): void => {
      const container = new ApplicationContainer();
      expect(container).toBeInstanceOf(ApplicationContainer);
    });

    it('should accept optional configuration', (): void => {
      const config = ApplicationConfig.create().unwrap();
      const container = new ApplicationContainer(config);
      expect(container).toBeInstanceOf(ApplicationContainer);
    });
  });

  describe('register', () => {
    let container: ApplicationContainer;

    beforeEach((): void => {
      container = new ApplicationContainer();
    });

    it('should register a singleton service', (): void => {
      const result = container.register(
        'recordRepository',
        new DependencyDescriptor(
          (): MockRecordRepository => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );

      expect(result.isOk()).toBe(true);
    });

    it('should register a transient service', (): void => {
      const result = container.register(
        'searchModeDetector',
        new DependencyDescriptor(
          (): SearchModeDetector => new SearchModeDetector(),
          ServiceLifetime.TRANSIENT
        )
      );

      expect(result.isOk()).toBe(true);
    });

    it('should register a service with dependencies', (): void => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          (): MockRecordRepository => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );

      const result = container.register(
        'searchRecords',
        new DependencyDescriptor(
          (deps): SearchRecordsUseCase =>
            new SearchRecordsUseCase(deps.recordRepository as RecordRepository),
          ServiceLifetime.TRANSIENT,
          ['recordRepository']
        )
      );

      expect(result.isOk()).toBe(true);
    });

    it('should fail to register service with same key twice', (): void => {
      const descriptor = new DependencyDescriptor(
        () => new MockRecordRepository(),
        ServiceLifetime.SINGLETON
      );

      container.register('recordRepository', descriptor);
      const result = container.register('recordRepository', descriptor);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('already registered');
    });

    it('should fail to register service with circular dependency', (): void => {
      const result = container.register(
        'circularService',
        new DependencyDescriptor(
          (deps): unknown => deps.circularService,
          ServiceLifetime.SINGLETON,
          ['circularService']
        )
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Circular dependency');
    });

    it('should detect complex circular dependencies', (): void => {
      container.register(
        'serviceA',
        new DependencyDescriptor(
          (): object => ({}),
          ServiceLifetime.SINGLETON,
          ['serviceB']
        )
      );

      const result = container.register(
        'serviceB',
        new DependencyDescriptor(
          (): object => ({}),
          ServiceLifetime.SINGLETON,
          ['serviceA']
        )
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Circular dependency');
    });
  });

  describe('resolve', () => {
    let container: ApplicationContainer;

    beforeEach((): void => {
      container = new ApplicationContainer();
    });

    it('should resolve a singleton service', (): void => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          (): MockRecordRepository => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );

      const result = container.resolve<RecordRepository>('recordRepository');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeInstanceOf(MockRecordRepository);
    });

    it('should return the same instance for singleton services', (): void => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          (): MockRecordRepository => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );

      const instance1 = container
        .resolve<RecordRepository>('recordRepository')
        .unwrap();
      const instance2 = container
        .resolve<RecordRepository>('recordRepository')
        .unwrap();

      expect(instance1).toBe(instance2);
    });

    it('should return different instances for transient services', (): void => {
      container.register(
        'searchModeDetector',
        new DependencyDescriptor(
          (): SearchModeDetector => new SearchModeDetector(),
          ServiceLifetime.TRANSIENT
        )
      );

      const instance1 = container
        .resolve<SearchModeDetector>('searchModeDetector')
        .unwrap();
      const instance2 = container
        .resolve<SearchModeDetector>('searchModeDetector')
        .unwrap();

      expect(instance1).not.toBe(instance2);
      expect(instance1).toBeInstanceOf(SearchModeDetector);
      expect(instance2).toBeInstanceOf(SearchModeDetector);
    });

    it('should resolve service with dependencies', (): void => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          (): MockRecordRepository => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );
      container.register(
        'searchRecords',
        new DependencyDescriptor(
          (deps) =>
            new SearchRecordsUseCase(deps.recordRepository as RecordRepository),
          ServiceLifetime.TRANSIENT,
          ['recordRepository']
        )
      );

      const result = container.resolve<SearchRecordsUseCase>('searchRecords');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeInstanceOf(SearchRecordsUseCase);
    });

    it('should resolve nested dependencies', (): void => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          (): MockRecordRepository => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );
      container.register(
        'tagRepository',
        new DependencyDescriptor(
          (): MockTagRepository => new MockTagRepository(),
          ServiceLifetime.SINGLETON
        )
      );
      container.register(
        'unitOfWork',
        new DependencyDescriptor(
          (): MockUnitOfWork => new MockUnitOfWork(),
          ServiceLifetime.SINGLETON
        )
      );
      container.register(
        'createRecord',
        new DependencyDescriptor(
          (deps): CreateRecordUseCase =>
            new CreateRecordUseCase(
              deps.recordRepository as RecordRepository,
              deps.tagRepository as TagRepository,
              deps.unitOfWork as UnitOfWork
            ),
          ServiceLifetime.TRANSIENT,
          ['recordRepository', 'tagRepository', 'unitOfWork']
        )
      );

      const result = container.resolve<CreateRecordUseCase>('createRecord');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeInstanceOf(CreateRecordUseCase);
    });

    it('should fail to resolve unregistered service', (): void => {
      const result = container.resolve('nonExistentService');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('not registered');
    });

    it('should fail to resolve service with missing dependency', (): void => {
      container.register(
        'serviceWithMissingDep',
        new DependencyDescriptor(
          (deps): object => ({ dep: deps.missingDep }),
          ServiceLifetime.SINGLETON,
          ['missingDep']
        )
      );

      const result = container.resolve('serviceWithMissingDep');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to resolve dependency');
    });

    it('should handle factory function errors gracefully', (): void => {
      container.register(
        'failingService',
        new DependencyDescriptor((): never => {
          throw new Error('Factory error');
        }, ServiceLifetime.SINGLETON)
      );

      const result = container.resolve('failingService');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Error creating service');
    });
  });

  describe('hasRegistration', () => {
    let container: ApplicationContainer;

    beforeEach((): void => {
      container = new ApplicationContainer();
    });

    it('should return true for registered services', (): void => {
      container.register(
        'testService',
        new DependencyDescriptor((): object => ({}), ServiceLifetime.SINGLETON)
      );

      expect(container.hasRegistration('testService')).toBe(true);
    });

    it('should return false for unregistered services', (): void => {
      expect(container.hasRegistration('nonExistentService')).toBe(false);
    });
  });

  describe('getRegisteredKeys', () => {
    let container: ApplicationContainer;

    beforeEach((): void => {
      container = new ApplicationContainer();
    });

    it('should return empty array for new container', (): void => {
      const keys = container.getRegisteredKeys();
      expect(keys).toEqual([]);
    });

    it('should return all registered keys', (): void => {
      container.register(
        'service1',
        new DependencyDescriptor((): object => ({}), ServiceLifetime.SINGLETON)
      );
      container.register(
        'service2',
        new DependencyDescriptor((): object => ({}), ServiceLifetime.TRANSIENT)
      );

      const keys = container.getRegisteredKeys();
      expect(keys).toContain('service1');
      expect(keys).toContain('service2');
      expect(keys).toHaveLength(2);
    });
  });

  describe('dispose', () => {
    let container: ApplicationContainer;

    beforeEach((): void => {
      container = new ApplicationContainer();
    });

    it('should dispose singleton instances with dispose method', (): void => {
      const mockService = {
        dispose: jest.fn(),
      };

      container.register(
        'disposableService',
        new DependencyDescriptor(() => mockService, ServiceLifetime.SINGLETON)
      );

      // Create instance
      container.resolve('disposableService');

      // Dispose container
      container.dispose();

      expect(mockService.dispose).toHaveBeenCalled();
    });

    it('should clear all instances after disposal', (): void => {
      container.register(
        'testService',
        new DependencyDescriptor((): object => ({}), ServiceLifetime.SINGLETON)
      );

      const instance1 = container.resolve('testService').unwrap();
      container.dispose();
      const instance2 = container.resolve('testService').unwrap();

      expect(instance1).not.toBe(instance2);
    });

    it('should handle disposal errors gracefully', (): void => {
      const mockService = {
        dispose: jest.fn().mockImplementation(() => {
          throw new Error('Disposal error');
        }),
      };

      container.register(
        'failingDisposableService',
        new DependencyDescriptor(() => mockService, ServiceLifetime.SINGLETON)
      );

      container.resolve('failingDisposableService');

      // Should not throw
      expect(() => container.dispose()).not.toThrow();
    });
  });
});

describe('DependencyDescriptor', () => {
  it('should create descriptor with factory only', (): void => {
    const factory = (): object => ({});
    const descriptor = new DependencyDescriptor(
      factory,
      ServiceLifetime.SINGLETON
    );

    expect(descriptor.factory).toBe(factory);
    expect(descriptor.lifetime).toBe(ServiceLifetime.SINGLETON);
    expect(descriptor.dependencies).toEqual([]);
  });

  it('should create descriptor with dependencies', (): void => {
    const factory = (): object => ({});
    const dependencies = ['dep1', 'dep2'];
    const descriptor = new DependencyDescriptor(
      factory,
      ServiceLifetime.TRANSIENT,
      dependencies
    );

    expect(descriptor.factory).toBe(factory);
    expect(descriptor.lifetime).toBe(ServiceLifetime.TRANSIENT);
    expect(descriptor.dependencies).toEqual(dependencies);
  });

  it('should validate dependencies array', (): void => {
    expect(
      (): DependencyDescriptor =>
        new DependencyDescriptor(
          (): object => ({}),
          ServiceLifetime.SINGLETON,
          null as any
        )
    ).not.toThrow();

    expect(
      (): DependencyDescriptor =>
        new DependencyDescriptor(
          (): object => ({}),
          ServiceLifetime.SINGLETON,
          undefined as any
        )
    ).not.toThrow();
  });
});

describe('ServiceLifetime', () => {
  it('should have correct enum values', (): void => {
    expect(ServiceLifetime.SINGLETON).toBe('singleton');
    expect(ServiceLifetime.TRANSIENT).toBe('transient');
  });
});
