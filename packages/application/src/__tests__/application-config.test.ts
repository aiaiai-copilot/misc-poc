import {
  ApplicationConfig,
  DefaultApplicationConfig,
  createApplicationConfig,
  ApplicationConfigOptions,
} from '../application-config';

describe('ApplicationConfig', () => {
  describe('DefaultApplicationConfig', () => {
    it('should have tag configuration', () => {
      expect(DefaultApplicationConfig.tags.maxTagsPerRecord).toBe(10);
      expect(DefaultApplicationConfig.tags.maxTagLength).toBe(50);
      expect(DefaultApplicationConfig.tags.allowDuplicates).toBe(false);
    });

    it('should have normalization rules', () => {
      expect(DefaultApplicationConfig.normalization.lowercase).toBe(true);
      expect(DefaultApplicationConfig.normalization.trimWhitespace).toBe(true);
      expect(DefaultApplicationConfig.normalization.removeDiacritics).toBe(
        false
      );
      expect(DefaultApplicationConfig.normalization.collapseWhitespace).toBe(
        true
      );
    });

    it('should have search settings', () => {
      expect(DefaultApplicationConfig.search.indexingEnabled).toBe(true);
      expect(DefaultApplicationConfig.search.fullTextSearch).toBe(true);
      expect(DefaultApplicationConfig.search.tagSearchWeight).toBe(2.0);
      expect(DefaultApplicationConfig.search.contentSearchWeight).toBe(1.0);
    });

    it('should have display preferences', () => {
      expect(DefaultApplicationConfig.display.maxTagsVisible).toBe(5);
      expect(DefaultApplicationConfig.display.sortTagsAlphabetically).toBe(
        true
      );
      expect(DefaultApplicationConfig.display.showTagCount).toBe(true);
      expect(DefaultApplicationConfig.display.truncateTagsAt).toBe(20);
    });

    it('should have storage limits', () => {
      expect(DefaultApplicationConfig.storage.maxRecords).toBe(10000);
      expect(DefaultApplicationConfig.storage.maxTotalSize).toBe(
        100 * 1024 * 1024
      ); // 100MB
      expect(DefaultApplicationConfig.storage.compressionEnabled).toBe(false);
    });

    it('should have validation rules', () => {
      expect(DefaultApplicationConfig.validation.strictMode).toBe(false);
      expect(DefaultApplicationConfig.validation.allowEmptyTags).toBe(false);
      expect(DefaultApplicationConfig.validation.allowEmptyContent).toBe(false);
    });
  });

  describe('ApplicationConfig creation', () => {
    it('should create config with valid parameters', () => {
      const config = ApplicationConfig.create({
        tags: { maxTagsPerRecord: 15 },
        search: { tagSearchWeight: 3.0 },
      });

      expect(config.isOk()).toBe(true);
      const configData = config.unwrap();
      expect(configData.tags.maxTagsPerRecord).toBe(15);
      expect(configData.search.tagSearchWeight).toBe(3.0);
      // Should keep defaults for other values
      expect(configData.tags.maxTagLength).toBe(50);
    });

    it('should validate tag limits', () => {
      const config = ApplicationConfig.create({
        tags: { maxTagsPerRecord: 0 },
      });

      expect(config.isErr()).toBe(true);
      expect(config.unwrapErr()).toContain('maxTagsPerRecord must be positive');
    });

    it('should validate tag length', () => {
      const config = ApplicationConfig.create({
        tags: { maxTagLength: 0 },
      });

      expect(config.isErr()).toBe(true);
      expect(config.unwrapErr()).toContain('maxTagLength must be positive');
    });

    it('should validate search weights', () => {
      const config = ApplicationConfig.create({
        search: { tagSearchWeight: -1.0 },
      });

      expect(config.isErr()).toBe(true);
      expect(config.unwrapErr()).toContain(
        'tagSearchWeight must be non-negative'
      );
    });

    it('should validate storage limits', () => {
      const config = ApplicationConfig.create({
        storage: { maxRecords: 0 },
      });

      expect(config.isErr()).toBe(true);
      expect(config.unwrapErr()).toContain('maxRecords must be positive');
    });

    it('should validate display preferences', () => {
      const config = ApplicationConfig.create({
        display: { maxTagsVisible: -1 },
      });

      expect(config.isErr()).toBe(true);
      expect(config.unwrapErr()).toContain(
        'maxTagsVisible must be non-negative'
      );
    });
  });

  describe('createApplicationConfig helper function', () => {
    it('should merge with defaults', () => {
      const config = createApplicationConfig({
        tags: { maxTagsPerRecord: 20 },
      });

      expect(config.tags.maxTagsPerRecord).toBe(20);
      expect(config.tags.maxTagLength).toBe(50); // Should keep default
      expect(config.search.indexingEnabled).toBe(true); // Should keep default
    });

    it('should handle empty override', () => {
      const config = createApplicationConfig({});
      expect(config).toEqual(DefaultApplicationConfig);
    });

    it('should deep merge nested objects', () => {
      const config = createApplicationConfig({
        tags: { maxTagsPerRecord: 25 },
        search: { fullTextSearch: false },
        normalization: { lowercase: false },
      });

      expect(config.tags.maxTagsPerRecord).toBe(25);
      expect(config.tags.maxTagLength).toBe(50); // Should keep default
      expect(config.search.fullTextSearch).toBe(false);
      expect(config.search.indexingEnabled).toBe(true); // Should keep default
      expect(config.normalization.lowercase).toBe(false);
      expect(config.normalization.trimWhitespace).toBe(true); // Should keep default
    });
  });

  describe('environment-based overrides', () => {
    it('should apply environment overrides', () => {
      const env = {
        APP_MAX_TAGS_PER_RECORD: '30',
        APP_STORAGE_MAX_RECORDS: '5000',
        APP_STRICT_MODE: 'true',
      };

      const config = ApplicationConfig.createFromEnvironment(env);

      expect(config.isOk()).toBe(true);
      const configData = config.unwrap();
      expect(configData.tags.maxTagsPerRecord).toBe(30);
      expect(configData.storage.maxRecords).toBe(5000);
      expect(configData.validation.strictMode).toBe(true);
    });

    it('should handle invalid environment values', () => {
      const env = {
        APP_MAX_TAGS_PER_RECORD: 'invalid',
      };

      const config = ApplicationConfig.createFromEnvironment(env);

      expect(config.isErr()).toBe(true);
      expect(config.unwrapErr()).toContain(
        'Invalid environment variable APP_MAX_TAGS_PER_RECORD'
      );
    });

    it('should fall back to defaults when environment variables are not set', () => {
      const config = ApplicationConfig.createFromEnvironment({});

      expect(config.isOk()).toBe(true);
      const configData = config.unwrap();
      expect(configData.tags).toEqual(DefaultApplicationConfig.tags);
      expect(configData.search).toEqual(DefaultApplicationConfig.search);
      expect(configData.normalization).toEqual(
        DefaultApplicationConfig.normalization
      );
      expect(configData.display).toEqual(DefaultApplicationConfig.display);
      expect(configData.storage).toEqual(DefaultApplicationConfig.storage);
      expect(configData.validation).toEqual(
        DefaultApplicationConfig.validation
      );
    });
  });

  describe('configuration immutability', () => {
    it('should return immutable config object', () => {
      const result = ApplicationConfig.create({});
      expect(result.isOk()).toBe(true);
      const config = result.unwrap();

      // Attempting to modify should throw
      expect(() => {
        (config as any).tags.maxTagsPerRecord = 999;
      }).toThrow();
    });
  });

  describe('configuration serialization', () => {
    it('should serialize to JSON', () => {
      const result = ApplicationConfig.create({
        tags: { maxTagsPerRecord: 15 },
      });
      expect(result.isOk()).toBe(true);
      const config = result.unwrap();

      const json = ApplicationConfig.toJSON(config);
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.tags.maxTagsPerRecord).toBe(15);
    });

    it('should deserialize from JSON', () => {
      const originalResult = ApplicationConfig.create({
        tags: { maxTagsPerRecord: 15 },
      });
      expect(originalResult.isOk()).toBe(true);
      const originalConfig = originalResult.unwrap();

      const json = ApplicationConfig.toJSON(originalConfig);
      const result = ApplicationConfig.fromJSON(json);

      expect(result.isOk()).toBe(true);
      const deserializedConfig = result.unwrap();
      expect(deserializedConfig.tags.maxTagsPerRecord).toBe(15);
    });

    it('should fail to deserialize invalid JSON', () => {
      const result = ApplicationConfig.fromJSON('invalid json');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Invalid JSON');
    });
  });
});
