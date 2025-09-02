export interface AppConfig {
  database: {
    name: string;
    version: number;
    objectStores: string[];
  };
  search: {
    maxResults: number;
    fuzzyThreshold: number;
    caseSensitive: boolean;
  };
  ui: {
    theme: 'light' | 'dark';
    pageSize: number;
    showTimestamps: boolean;
  };
  export: {
    maxFileSize: number;
    supportedFormats: string[];
  };
}

export const DefaultConfig: AppConfig = {
  database: {
    name: 'records-app',
    version: 1,
    objectStores: ['records', 'tags', 'metadata']
  },
  search: {
    maxResults: 100,
    fuzzyThreshold: 0.8,
    caseSensitive: false
  },
  ui: {
    theme: 'light',
    pageSize: 20,
    showTimestamps: true
  },
  export: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedFormats: ['json', 'csv', 'xml']
  }
};

export function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    database: { ...DefaultConfig.database, ...overrides.database },
    search: { ...DefaultConfig.search, ...overrides.search },
    ui: { ...DefaultConfig.ui, ...overrides.ui },
    export: { ...DefaultConfig.export, ...overrides.export }
  };
}