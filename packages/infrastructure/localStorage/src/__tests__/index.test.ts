import * as LocalStorageModule from '../index';

describe('LocalStorage Infrastructure Module Exports', () => {
  it('should export StorageSchema', () => {
    expect(LocalStorageModule.StorageSchema).toBeDefined();
  });

  it('should export storage schema types', () => {
    expect(typeof LocalStorageModule.StorageSchema.createEmpty).toBe(
      'function'
    );
    expect(typeof LocalStorageModule.StorageSchema.isValid).toBe('function');
    expect(typeof LocalStorageModule.StorageSchema.migrate).toBe('function');
    expect(typeof LocalStorageModule.StorageSchema.needsMigration).toBe(
      'function'
    );
    expect(typeof LocalStorageModule.StorageSchema.toJSON).toBe('function');
    expect(typeof LocalStorageModule.StorageSchema.fromJSON).toBe('function');
  });
});
