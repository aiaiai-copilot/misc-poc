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
    findAll = jest.fn().mockResolvedValue(Ok([]));
    search = jest.fn().mockResolvedValue(Ok([]));
    save = jest.fn().mockResolvedValue(Ok(undefined));
    delete = jest.fn().mockResolvedValue(Ok(undefined));
    bulkSave = jest.fn().mockResolvedValue(Ok(undefined));
    count = jest.fn().mockResolvedValue(Ok(0));
  }

  class MockTagRepository implements TagRepository {
    findById = jest.fn().mockResolvedValue(Ok(null));
    findAll = jest.fn().mockResolvedValue(Ok([]));
    findByNormalizedValue = jest.fn().mockResolvedValue(Ok(null));
    save = jest.fn().mockResolvedValue(Ok(undefined));
    delete = jest.fn().mockResolvedValue(Ok(undefined));
    findSuggestions = jest.fn().mockResolvedValue(Ok([]));
    bulkSave = jest.fn().mockResolvedValue(Ok(undefined));
    deleteUnused = jest.fn().mockResolvedValue(Ok(0));
    count = jest.fn().mockResolvedValue(Ok(0));
  }

  class MockUnitOfWork implements UnitOfWork {
    begin = jest.fn().mockResolvedValue(Ok(undefined));
    commit = jest.fn().mockResolvedValue(Ok(undefined));
    rollback = jest.fn().mockResolvedValue(Ok(undefined));
  }

  describe('constructor', () => {
    it('should create a new container instance', () => {
      const container = new ApplicationContainer();
      expect(container).toBeInstanceOf(ApplicationContainer);
    });

    it('should accept optional configuration', () => {
      const config = ApplicationConfig.create().unwrap();
      const container = new ApplicationContainer(config);
      expect(container).toBeInstanceOf(ApplicationContainer);
    });
  });

  describe('register', () => {
    let container: ApplicationContainer;

    beforeEach(() => {
      container = new ApplicationContainer();
    });

    it('should register a singleton service', () => {
      const result = container.register(
        'recordRepository',
        new DependencyDescriptor(
          () => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );

      expect(result.isOk()).toBe(true);
    });

    it('should register a transient service', () => {
      const result = container.register(
        'searchModeDetector',
        new DependencyDescriptor(
          () => new SearchModeDetector(),
          ServiceLifetime.TRANSIENT
        )
      );

      expect(result.isOk()).toBe(true);
    });

    it('should register a service with dependencies', () => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          () => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );

      const result = container.register(
        'searchRecords',
        new DependencyDescriptor(
          (deps) =>
            new SearchRecordsUseCase(deps.recordRepository as RecordRepository),
          ServiceLifetime.TRANSIENT,
          ['recordRepository']
        )
      );

      expect(result.isOk()).toBe(true);
    });

    it('should fail to register service with same key twice', () => {
      const descriptor = new DependencyDescriptor(
        () => new MockRecordRepository(),
        ServiceLifetime.SINGLETON
      );

      container.register('recordRepository', descriptor);
      const result = container.register('recordRepository', descriptor);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('already registered');
    });

    it('should fail to register service with circular dependency', () => {
      const result = container.register(
        'circularService',
        new DependencyDescriptor(
          (deps) => deps.circularService,
          ServiceLifetime.SINGLETON,
          ['circularService']
        )
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Circular dependency');
    });

    it('should detect complex circular dependencies', () => {
      container.register(
        'serviceA',
        new DependencyDescriptor(() => {}, ServiceLifetime.SINGLETON, [
          'serviceB',
        ])
      );

      const result = container.register(
        'serviceB',
        new DependencyDescriptor(() => {}, ServiceLifetime.SINGLETON, [
          'serviceA',
        ])
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Circular dependency');
    });
  });

  describe('resolve', () => {
    let container: ApplicationContainer;

    beforeEach(() => {
      container = new ApplicationContainer();
    });

    it('should resolve a singleton service', () => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          () => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );

      const result = container.resolve<RecordRepository>('recordRepository');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBeInstanceOf(MockRecordRepository);
    });

    it('should return the same instance for singleton services', () => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          () => new MockRecordRepository(),
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

    it('should return different instances for transient services', () => {
      container.register(
        'searchModeDetector',
        new DependencyDescriptor(
          () => new SearchModeDetector(),
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

    it('should resolve service with dependencies', () => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          () => new MockRecordRepository(),
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

    it('should resolve nested dependencies', () => {
      container.register(
        'recordRepository',
        new DependencyDescriptor(
          () => new MockRecordRepository(),
          ServiceLifetime.SINGLETON
        )
      );
      container.register(
        'tagRepository',
        new DependencyDescriptor(
          () => new MockTagRepository(),
          ServiceLifetime.SINGLETON
        )
      );
      container.register(
        'unitOfWork',
        new DependencyDescriptor(
          () => new MockUnitOfWork(),
          ServiceLifetime.SINGLETON
        )
      );
      container.register(
        'createRecord',
        new DependencyDescriptor(
          (deps) =>
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

    it('should fail to resolve unregistered service', () => {
      const result = container.resolve('nonExistentService');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('not registered');
    });

    it('should fail to resolve service with missing dependency', () => {
      container.register(
        'serviceWithMissingDep',
        new DependencyDescriptor(
          (deps) => ({ dep: deps.missingDep }),
          ServiceLifetime.SINGLETON,
          ['missingDep']
        )
      );

      const result = container.resolve('serviceWithMissingDep');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to resolve dependency');
    });

    it('should handle factory function errors gracefully', () => {
      container.register(
        'failingService',
        new DependencyDescriptor(() => {
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

    beforeEach(() => {
      container = new ApplicationContainer();
    });

    it('should return true for registered services', () => {
      container.register(
        'testService',
        new DependencyDescriptor(() => ({}), ServiceLifetime.SINGLETON)
      );

      expect(container.hasRegistration('testService')).toBe(true);
    });

    it('should return false for unregistered services', () => {
      expect(container.hasRegistration('nonExistentService')).toBe(false);
    });
  });

  describe('getRegisteredKeys', () => {
    let container: ApplicationContainer;

    beforeEach(() => {
      container = new ApplicationContainer();
    });

    it('should return empty array for new container', () => {
      const keys = container.getRegisteredKeys();
      expect(keys).toEqual([]);
    });

    it('should return all registered keys', () => {
      container.register(
        'service1',
        new DependencyDescriptor(() => ({}), ServiceLifetime.SINGLETON)
      );
      container.register(
        'service2',
        new DependencyDescriptor(() => ({}), ServiceLifetime.TRANSIENT)
      );

      const keys = container.getRegisteredKeys();
      expect(keys).toContain('service1');
      expect(keys).toContain('service2');
      expect(keys).toHaveLength(2);
    });
  });

  describe('dispose', () => {
    let container: ApplicationContainer;

    beforeEach(() => {
      container = new ApplicationContainer();
    });

    it('should dispose singleton instances with dispose method', () => {
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

    it('should clear all instances after disposal', () => {
      container.register(
        'testService',
        new DependencyDescriptor(() => ({}), ServiceLifetime.SINGLETON)
      );

      const instance1 = container.resolve('testService').unwrap();
      container.dispose();
      const instance2 = container.resolve('testService').unwrap();

      expect(instance1).not.toBe(instance2);
    });

    it('should handle disposal errors gracefully', () => {
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
  it('should create descriptor with factory only', () => {
    const factory = () => ({});
    const descriptor = new DependencyDescriptor(
      factory,
      ServiceLifetime.SINGLETON
    );

    expect(descriptor.factory).toBe(factory);
    expect(descriptor.lifetime).toBe(ServiceLifetime.SINGLETON);
    expect(descriptor.dependencies).toEqual([]);
  });

  it('should create descriptor with dependencies', () => {
    const factory = () => ({});
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

  it('should validate dependencies array', () => {
    expect(
      () =>
        new DependencyDescriptor(
          () => ({}),
          ServiceLifetime.SINGLETON,
          null as any
        )
    ).not.toThrow();

    expect(
      () =>
        new DependencyDescriptor(
          () => ({}),
          ServiceLifetime.SINGLETON,
          undefined as any
        )
    ).not.toThrow();
  });
});

describe('ServiceLifetime', () => {
  it('should have correct enum values', () => {
    expect(ServiceLifetime.SINGLETON).toBe('singleton');
    expect(ServiceLifetime.TRANSIENT).toBe('transient');
  });
});
