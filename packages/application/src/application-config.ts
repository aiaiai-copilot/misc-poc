import { Result, Ok, Err } from '@misc-poc/shared';

export interface TagsConfig {
  maxTagsPerRecord: number;
  maxTagLength: number;
  allowDuplicates: boolean;
}

export interface NormalizationConfig {
  lowercase: boolean;
  trimWhitespace: boolean;
  removeDiacritics: boolean;
  collapseWhitespace: boolean;
}

export interface SearchConfig {
  indexingEnabled: boolean;
  fullTextSearch: boolean;
  tagSearchWeight: number;
  contentSearchWeight: number;
}

export interface DisplayConfig {
  maxTagsVisible: number;
  sortTagsAlphabetically: boolean;
  showTagCount: boolean;
  truncateTagsAt: number;
}

export interface StorageConfig {
  maxRecords: number;
  maxTotalSize: number;
  compressionEnabled: boolean;
}

export interface ValidationConfig {
  strictMode: boolean;
  allowEmptyTags: boolean;
  allowEmptyContent: boolean;
}

export interface ApplicationConfigData {
  tags: TagsConfig;
  normalization: NormalizationConfig;
  search: SearchConfig;
  display: DisplayConfig;
  storage: StorageConfig;
  validation: ValidationConfig;
}

export type ApplicationConfigOptions = Partial<{
  tags: Partial<TagsConfig>;
  normalization: Partial<NormalizationConfig>;
  search: Partial<SearchConfig>;
  display: Partial<DisplayConfig>;
  storage: Partial<StorageConfig>;
  validation: Partial<ValidationConfig>;
}>;

export const DefaultApplicationConfig: ApplicationConfigData = {
  tags: {
    maxTagsPerRecord: 10,
    maxTagLength: 50,
    allowDuplicates: false,
  },
  normalization: {
    lowercase: true,
    trimWhitespace: true,
    removeDiacritics: false,
    collapseWhitespace: true,
  },
  search: {
    indexingEnabled: true,
    fullTextSearch: true,
    tagSearchWeight: 2.0,
    contentSearchWeight: 1.0,
  },
  display: {
    maxTagsVisible: 5,
    sortTagsAlphabetically: true,
    showTagCount: true,
    truncateTagsAt: 20,
  },
  storage: {
    maxRecords: 10000,
    maxTotalSize: 100 * 1024 * 1024, // 100MB
    compressionEnabled: false,
  },
  validation: {
    strictMode: false,
    allowEmptyTags: false,
    allowEmptyContent: false,
  },
};

export class ApplicationConfig {
  private constructor(private readonly data: ApplicationConfigData) {
    // Make the configuration immutable
    Object.freeze(this.data);
    Object.freeze(this.data.tags);
    Object.freeze(this.data.normalization);
    Object.freeze(this.data.search);
    Object.freeze(this.data.display);
    Object.freeze(this.data.storage);
    Object.freeze(this.data.validation);
    Object.freeze(this);
  }

  get tags(): TagsConfig {
    return this.data.tags;
  }

  get normalization(): NormalizationConfig {
    return this.data.normalization;
  }

  get search(): SearchConfig {
    return this.data.search;
  }

  get display(): DisplayConfig {
    return this.data.display;
  }

  get storage(): StorageConfig {
    return this.data.storage;
  }

  get validation(): ValidationConfig {
    return this.data.validation;
  }

  static create(
    options: ApplicationConfigOptions = {}
  ): Result<ApplicationConfig, string> {
    const config = this.mergeWithDefaults(options);

    // Validate the configuration
    const validationResult = this.validateConfig(config);
    if (validationResult.isErr()) {
      return Err(validationResult.unwrapErr());
    }

    return Ok(new ApplicationConfig(config));
  }

  static createFromEnvironment(
    env: Record<string, string | undefined> = {}
  ): Result<ApplicationConfig, string> {
    const options: ApplicationConfigOptions = {};

    try {
      // Parse environment variables
      if (env.APP_MAX_TAGS_PER_RECORD) {
        const value = parseInt(env.APP_MAX_TAGS_PER_RECORD, 10);
        if (isNaN(value)) {
          return Err(
            'Invalid environment variable APP_MAX_TAGS_PER_RECORD: must be a number'
          );
        }
        options.tags = { ...options.tags, maxTagsPerRecord: value };
      }

      if (env.APP_MAX_TAG_LENGTH) {
        const value = parseInt(env.APP_MAX_TAG_LENGTH, 10);
        if (isNaN(value)) {
          return Err(
            'Invalid environment variable APP_MAX_TAG_LENGTH: must be a number'
          );
        }
        options.tags = { ...options.tags, maxTagLength: value };
      }

      if (env.APP_STORAGE_MAX_RECORDS) {
        const value = parseInt(env.APP_STORAGE_MAX_RECORDS, 10);
        if (isNaN(value)) {
          return Err(
            'Invalid environment variable APP_STORAGE_MAX_RECORDS: must be a number'
          );
        }
        options.storage = { ...options.storage, maxRecords: value };
      }

      if (env.APP_STRICT_MODE) {
        const value = env.APP_STRICT_MODE.toLowerCase();
        if (value !== 'true' && value !== 'false') {
          return Err(
            'Invalid environment variable APP_STRICT_MODE: must be "true" or "false"'
          );
        }
        options.validation = {
          ...options.validation,
          strictMode: value === 'true',
        };
      }

      if (env.APP_TAG_SEARCH_WEIGHT) {
        const value = parseFloat(env.APP_TAG_SEARCH_WEIGHT);
        if (isNaN(value)) {
          return Err(
            'Invalid environment variable APP_TAG_SEARCH_WEIGHT: must be a number'
          );
        }
        options.search = { ...options.search, tagSearchWeight: value };
      }

      if (env.APP_CONTENT_SEARCH_WEIGHT) {
        const value = parseFloat(env.APP_CONTENT_SEARCH_WEIGHT);
        if (isNaN(value)) {
          return Err(
            'Invalid environment variable APP_CONTENT_SEARCH_WEIGHT: must be a number'
          );
        }
        options.search = { ...options.search, contentSearchWeight: value };
      }

      return this.create(options);
    } catch (error) {
      return Err(`Error parsing environment variables: ${error}`);
    }
  }

  static toJSON(config: ApplicationConfig): string {
    return JSON.stringify(config.data, null, 2);
  }

  static fromJSON(json: string): Result<ApplicationConfig, string> {
    try {
      const data = JSON.parse(json);
      return this.create(data);
    } catch (error) {
      return Err(`Invalid JSON: ${error}`);
    }
  }

  private static mergeWithDefaults(
    options: ApplicationConfigOptions
  ): ApplicationConfigData {
    return {
      tags: { ...DefaultApplicationConfig.tags, ...options.tags },
      normalization: {
        ...DefaultApplicationConfig.normalization,
        ...options.normalization,
      },
      search: { ...DefaultApplicationConfig.search, ...options.search },
      display: { ...DefaultApplicationConfig.display, ...options.display },
      storage: { ...DefaultApplicationConfig.storage, ...options.storage },
      validation: {
        ...DefaultApplicationConfig.validation,
        ...options.validation,
      },
    };
  }

  private static validateConfig(
    config: ApplicationConfigData
  ): Result<void, string> {
    // Validate tags configuration
    if (config.tags.maxTagsPerRecord <= 0) {
      return Err('maxTagsPerRecord must be positive');
    }

    if (config.tags.maxTagLength <= 0) {
      return Err('maxTagLength must be positive');
    }

    // Validate search configuration
    if (config.search.tagSearchWeight < 0) {
      return Err('tagSearchWeight must be non-negative');
    }

    if (config.search.contentSearchWeight < 0) {
      return Err('contentSearchWeight must be non-negative');
    }

    // Validate display configuration
    if (config.display.maxTagsVisible < 0) {
      return Err('maxTagsVisible must be non-negative');
    }

    if (config.display.truncateTagsAt <= 0) {
      return Err('truncateTagsAt must be positive');
    }

    // Validate storage configuration
    if (config.storage.maxRecords <= 0) {
      return Err('maxRecords must be positive');
    }

    if (config.storage.maxTotalSize <= 0) {
      return Err('maxTotalSize must be positive');
    }

    return Ok(undefined);
  }
}

export function createApplicationConfig(
  options: ApplicationConfigOptions = {}
): ApplicationConfigData {
  return {
    tags: { ...DefaultApplicationConfig.tags, ...options.tags },
    normalization: {
      ...DefaultApplicationConfig.normalization,
      ...options.normalization,
    },
    search: { ...DefaultApplicationConfig.search, ...options.search },
    display: { ...DefaultApplicationConfig.display, ...options.display },
    storage: { ...DefaultApplicationConfig.storage, ...options.storage },
    validation: {
      ...DefaultApplicationConfig.validation,
      ...options.validation,
    },
  };
}
