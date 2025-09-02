import * as SharedModule from '../index';

describe('Shared Module Exports', () => {
  it('should export Result types', () => {
    expect(SharedModule.Ok).toBeDefined();
    expect(SharedModule.Err).toBeDefined();
  });

  it('should export UUID utilities', () => {
    expect(SharedModule.generateUuid).toBeDefined();
    expect(SharedModule.validateUuid).toBeDefined();
    expect(SharedModule.isValidUuid).toBeDefined();
    expect(SharedModule.parseUuid).toBeDefined();
  });

  it('should export date utilities', () => {
    expect(SharedModule.formatDate).toBeDefined();
    expect(SharedModule.parseDate).toBeDefined();
    expect(SharedModule.isValidDate).toBeDefined();
    expect(SharedModule.getCurrentTimestamp).toBeDefined();
    expect(SharedModule.addDays).toBeDefined();
    expect(SharedModule.subtractDays).toBeDefined();
    expect(SharedModule.daysBetween).toBeDefined();
  });

  it('should export string utilities', () => {
    expect(SharedModule.normalizeString).toBeDefined();
    expect(SharedModule.slugify).toBeDefined();
    expect(SharedModule.truncate).toBeDefined();
    expect(SharedModule.sanitizeInput).toBeDefined();
    expect(SharedModule.isEmptyOrWhitespace).toBeDefined();
  });

  it('should export validation utilities', () => {
    expect(SharedModule.ValidationConstants).toBeDefined();
    expect(SharedModule.ValidationRules).toBeDefined();
  });

  it('should export configuration', () => {
    expect(SharedModule.DefaultConfig).toBeDefined();
    expect(SharedModule.createConfig).toBeDefined();
  });
});