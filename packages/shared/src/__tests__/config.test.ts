import { DefaultConfig, createConfig } from '../config';

describe('Configuration', () => {
  describe('DefaultConfig', () => {
    it('should have database configuration', () => {
      expect(DefaultConfig.database.name).toBe('records-app');
      expect(DefaultConfig.database.version).toBe(1);
    });

    it('should have search configuration', () => {
      expect(DefaultConfig.search.maxResults).toBe(100);
      expect(DefaultConfig.search.fuzzyThreshold).toBe(0.8);
    });

    it('should have UI configuration', () => {
      expect(DefaultConfig.ui.theme).toBe('light');
      expect(DefaultConfig.ui.pageSize).toBe(20);
    });
  });

  describe('createConfig', () => {
    it('should merge with defaults', () => {
      const config = createConfig({ ui: { theme: 'dark' } });
      expect(config.ui.theme).toBe('dark');
      expect(config.ui.pageSize).toBe(20); // Should keep default
    });

    it('should handle empty override', () => {
      const config = createConfig({});
      expect(config).toEqual(DefaultConfig);
    });

    it('should handle no parameters (default argument)', () => {
      const config = createConfig();
      expect(config).toEqual(DefaultConfig);
    });

    it('should deep merge nested objects', () => {
      const config = createConfig({ 
        database: { name: 'custom-db' },
        search: { maxResults: 50 }
      });
      expect(config.database.name).toBe('custom-db');
      expect(config.database.version).toBe(1); // Should keep default
      expect(config.search.maxResults).toBe(50);
    });

    it('should handle partial nested overrides', () => {
      const config = createConfig({ 
        database: { version: 2 } as any,
        ui: { theme: 'dark' as const }
      });
      expect(config.database.version).toBe(2);
      expect(config.database.name).toBe('records-app'); // Should keep default
      expect(config.ui.theme).toBe('dark');
      expect(config.ui.pageSize).toBe(20); // Should keep default
    });
  });
});