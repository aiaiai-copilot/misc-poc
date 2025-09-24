import { UserSettings } from '../user-settings';

describe('UserSettings Value Object', () => {
  describe('constructor', () => {
    it('should create UserSettings with valid parameters', () => {
      const settings = new UserSettings(true, false, 200, 100, 'es');

      expect(settings.caseSensitive).toBe(true);
      expect(settings.removeAccents).toBe(false);
      expect(settings.maxTagLength).toBe(200);
      expect(settings.maxTagsPerRecord).toBe(100);
      expect(settings.uiLanguage).toBe('es');
    });

    it('should throw error when maxTagLength is null or undefined', () => {
      expect(
        () => new UserSettings(false, true, null as any, 50, 'en')
      ).toThrow('Max tag length cannot be null or undefined');

      expect(
        () => new UserSettings(false, true, undefined as any, 50, 'en')
      ).toThrow('Max tag length cannot be null or undefined');
    });

    it('should throw error when maxTagLength is less than minimum', () => {
      expect(() => new UserSettings(false, true, 0, 50, 'en')).toThrow(
        'Max tag length must be between 1 and 500'
      );

      expect(() => new UserSettings(false, true, -1, 50, 'en')).toThrow(
        'Max tag length must be between 1 and 500'
      );
    });

    it('should throw error when maxTagLength exceeds maximum', () => {
      expect(() => new UserSettings(false, true, 501, 50, 'en')).toThrow(
        'Max tag length must be between 1 and 500'
      );
    });

    it('should throw error when maxTagsPerRecord is null or undefined', () => {
      expect(
        () => new UserSettings(false, true, 100, null as any, 'en')
      ).toThrow('Max tags per record cannot be null or undefined');

      expect(
        () => new UserSettings(false, true, 100, undefined as any, 'en')
      ).toThrow('Max tags per record cannot be null or undefined');
    });

    it('should throw error when maxTagsPerRecord is less than minimum', () => {
      expect(() => new UserSettings(false, true, 100, 0, 'en')).toThrow(
        'Max tags per record must be between 1 and 1000'
      );

      expect(() => new UserSettings(false, true, 100, -1, 'en')).toThrow(
        'Max tags per record must be between 1 and 1000'
      );
    });

    it('should throw error when maxTagsPerRecord exceeds maximum', () => {
      expect(() => new UserSettings(false, true, 100, 1001, 'en')).toThrow(
        'Max tags per record must be between 1 and 1000'
      );
    });

    it('should throw error when uiLanguage is null or undefined', () => {
      expect(() => new UserSettings(false, true, 100, 50, null as any)).toThrow(
        'UI language cannot be null or undefined'
      );

      expect(
        () => new UserSettings(false, true, 100, 50, undefined as any)
      ).toThrow('UI language cannot be null or undefined');
    });

    it('should throw error when uiLanguage is empty', () => {
      expect(() => new UserSettings(false, true, 100, 50, '')).toThrow(
        'UI language cannot be empty'
      );

      expect(() => new UserSettings(false, true, 100, 50, '   ')).toThrow(
        'UI language cannot be empty'
      );
    });

    it('should throw error when uiLanguage has invalid format', () => {
      expect(() => new UserSettings(false, true, 100, 50, 'invalid')).toThrow(
        'UI language must be a valid ISO 639-1 code'
      );

      expect(() => new UserSettings(false, true, 100, 50, 'eng')).toThrow(
        'UI language must be a valid ISO 639-1 code'
      );

      expect(() => new UserSettings(false, true, 100, 50, 'e')).toThrow(
        'UI language must be a valid ISO 639-1 code'
      );
    });

    it('should accept valid ISO 639-1 language codes', () => {
      const validLanguages = [
        'en',
        'es',
        'fr',
        'de',
        'it',
        'pt',
        'ru',
        'zh',
        'ja',
        'ko',
      ];

      validLanguages.forEach((lang) => {
        const settings = new UserSettings(false, true, 100, 50, lang);
        expect(settings.uiLanguage).toBe(lang);
      });
    });

    it('should accept boundary values for numeric fields', () => {
      const minSettings = new UserSettings(false, true, 1, 1, 'en');
      expect(minSettings.maxTagLength).toBe(1);
      expect(minSettings.maxTagsPerRecord).toBe(1);

      const maxSettings = new UserSettings(false, true, 500, 1000, 'en');
      expect(maxSettings.maxTagLength).toBe(500);
      expect(maxSettings.maxTagsPerRecord).toBe(1000);
    });
  });

  describe('createDefault', () => {
    it('should create UserSettings with default values', () => {
      const settings = UserSettings.createDefault();

      expect(settings.caseSensitive).toBe(false);
      expect(settings.removeAccents).toBe(true);
      expect(settings.maxTagLength).toBe(100);
      expect(settings.maxTagsPerRecord).toBe(50);
      expect(settings.uiLanguage).toBe('en');
    });

    it('should create consistent default settings', () => {
      const settings1 = UserSettings.createDefault();
      const settings2 = UserSettings.createDefault();

      expect(settings1.caseSensitive).toBe(settings2.caseSensitive);
      expect(settings1.removeAccents).toBe(settings2.removeAccents);
      expect(settings1.maxTagLength).toBe(settings2.maxTagLength);
      expect(settings1.maxTagsPerRecord).toBe(settings2.maxTagsPerRecord);
      expect(settings1.uiLanguage).toBe(settings2.uiLanguage);
    });
  });

  describe('equals', () => {
    it('should return true for UserSettings with same values', () => {
      const settings1 = new UserSettings(true, false, 200, 100, 'es');
      const settings2 = new UserSettings(true, false, 200, 100, 'es');

      expect(settings1.equals(settings2)).toBe(true);
    });

    it('should return false for UserSettings with different caseSensitive', () => {
      const settings1 = new UserSettings(true, false, 200, 100, 'es');
      const settings2 = new UserSettings(false, false, 200, 100, 'es');

      expect(settings1.equals(settings2)).toBe(false);
    });

    it('should return false for UserSettings with different removeAccents', () => {
      const settings1 = new UserSettings(true, true, 200, 100, 'es');
      const settings2 = new UserSettings(true, false, 200, 100, 'es');

      expect(settings1.equals(settings2)).toBe(false);
    });

    it('should return false for UserSettings with different maxTagLength', () => {
      const settings1 = new UserSettings(true, false, 200, 100, 'es');
      const settings2 = new UserSettings(true, false, 150, 100, 'es');

      expect(settings1.equals(settings2)).toBe(false);
    });

    it('should return false for UserSettings with different maxTagsPerRecord', () => {
      const settings1 = new UserSettings(true, false, 200, 100, 'es');
      const settings2 = new UserSettings(true, false, 200, 75, 'es');

      expect(settings1.equals(settings2)).toBe(false);
    });

    it('should return false for UserSettings with different uiLanguage', () => {
      const settings1 = new UserSettings(true, false, 200, 100, 'es');
      const settings2 = new UserSettings(true, false, 200, 100, 'en');

      expect(settings1.equals(settings2)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      const settings = UserSettings.createDefault();

      expect(settings.equals(null as any)).toBe(false);
      expect(settings.equals(undefined as any)).toBe(false);
    });

    it('should return false for non-UserSettings objects', () => {
      const settings = UserSettings.createDefault();

      expect(settings.equals('settings' as any)).toBe(false);
      expect(settings.equals({ caseSensitive: false } as any)).toBe(false);
    });
  });

  describe('withUpdatedSettings', () => {
    it('should create new UserSettings with updated caseSensitive', () => {
      const original = UserSettings.createDefault();
      const updated = original.withUpdatedSettings({ caseSensitive: true });

      expect(updated.caseSensitive).toBe(true);
      expect(updated.removeAccents).toBe(original.removeAccents);
      expect(updated.maxTagLength).toBe(original.maxTagLength);
      expect(updated.maxTagsPerRecord).toBe(original.maxTagsPerRecord);
      expect(updated.uiLanguage).toBe(original.uiLanguage);
    });

    it('should create new UserSettings with updated removeAccents', () => {
      const original = UserSettings.createDefault();
      const updated = original.withUpdatedSettings({ removeAccents: false });

      expect(updated.removeAccents).toBe(false);
      expect(updated.caseSensitive).toBe(original.caseSensitive);
      expect(updated.maxTagLength).toBe(original.maxTagLength);
      expect(updated.maxTagsPerRecord).toBe(original.maxTagsPerRecord);
      expect(updated.uiLanguage).toBe(original.uiLanguage);
    });

    it('should create new UserSettings with multiple updated fields', () => {
      const original = UserSettings.createDefault();
      const updated = original.withUpdatedSettings({
        caseSensitive: true,
        maxTagLength: 200,
        uiLanguage: 'es',
      });

      expect(updated.caseSensitive).toBe(true);
      expect(updated.maxTagLength).toBe(200);
      expect(updated.uiLanguage).toBe('es');
      expect(updated.removeAccents).toBe(original.removeAccents);
      expect(updated.maxTagsPerRecord).toBe(original.maxTagsPerRecord);
    });

    it('should validate updated values', () => {
      const original = UserSettings.createDefault();

      expect(() => original.withUpdatedSettings({ maxTagLength: 0 })).toThrow(
        'Max tag length must be between 1 and 500'
      );

      expect(() =>
        original.withUpdatedSettings({ maxTagsPerRecord: 1001 })
      ).toThrow('Max tags per record must be between 1 and 1000');

      expect(() =>
        original.withUpdatedSettings({ uiLanguage: 'invalid' })
      ).toThrow('UI language must be a valid ISO 639-1 code');
    });

    it('should maintain immutability', () => {
      const original = UserSettings.createDefault();
      const updated = original.withUpdatedSettings({ caseSensitive: true });

      expect(original.caseSensitive).toBe(false);
      expect(updated.caseSensitive).toBe(true);
      expect(original).not.toBe(updated);
    });
  });

  describe('getNormalizationConfig', () => {
    it('should return normalization configuration for tag processing', () => {
      const settings = new UserSettings(true, false, 200, 100, 'es');
      const config = settings.getNormalizationConfig();

      expect(config.lowercase).toBe(false); // caseSensitive=true means lowercase=false
      expect(config.removeDiacritics).toBe(false);
    });

    it('should return correct config for default settings', () => {
      const settings = UserSettings.createDefault();
      const config = settings.getNormalizationConfig();

      expect(config.lowercase).toBe(true); // caseSensitive=false means lowercase=true
      expect(config.removeDiacritics).toBe(true);
    });
  });

  describe('business rules', () => {
    it('should enforce reasonable limits for tag constraints', () => {
      // Ensure the limits are reasonable for typical usage
      const settings = new UserSettings(false, true, 100, 50, 'en');

      expect(settings.maxTagLength).toBeGreaterThan(10); // Allow meaningful tags
      expect(settings.maxTagsPerRecord).toBeGreaterThan(5); // Allow complex records
      expect(settings.maxTagLength).toBeLessThan(1000); // Prevent abuse
      expect(settings.maxTagsPerRecord).toBeLessThan(10000); // Prevent abuse
    });

    it('should maintain consistency between normalization settings', () => {
      const caseSensitiveSettings = new UserSettings(true, true, 100, 50, 'en');
      const caseInsensitiveSettings = new UserSettings(
        false,
        true,
        100,
        50,
        'en'
      );

      // Both should be valid configurations
      expect(caseSensitiveSettings.caseSensitive).toBe(true);
      expect(caseInsensitiveSettings.caseSensitive).toBe(false);
    });
  });
});
