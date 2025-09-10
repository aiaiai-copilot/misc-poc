import { 
  TagNormalizer, 
  TagNormalizerConfig,
  TagValidator,
  TagParser,
  Tag,
  TagFactory,
  Record,
  RecordFactory,
  RecordDuplicateChecker,
  RecordMatcher,
  DomainError,
  InvalidRecordContentError,
  InvalidTagError,
  DuplicateRecordError,
  TagLimitExceededError
} from '../index';

describe('index exports', () => {
  it('should export TagNormalizer class', () => {
    expect(TagNormalizer).toBeDefined();
    expect(typeof TagNormalizer).toBe('function');
  });

  it('should allow creating TagNormalizer instance', () => {
    const normalizer = new TagNormalizer();
    expect(normalizer).toBeInstanceOf(TagNormalizer);
  });

  it('should export TagNormalizerConfig interface', () => {
    // Test that the interface is available for type checking
    const config: TagNormalizerConfig = {
      lowercase: true,
      removeDiacritics: true,
      unicodeNormalization: 'NFC',
    };

    expect(config).toBeDefined();
  });

  it('should export TagValidator class', () => {
    expect(TagValidator).toBeDefined();
    expect(typeof TagValidator).toBe('function');
  });

  it('should export TagParser class', () => {
    expect(TagParser).toBeDefined();
    expect(typeof TagParser).toBe('function');
  });

  it('should export Tag class', () => {
    expect(Tag).toBeDefined();
    expect(typeof Tag).toBe('function');
  });

  it('should export TagFactory class', () => {
    expect(TagFactory).toBeDefined();
    expect(typeof TagFactory).toBe('function');
  });

  it('should export Record class', () => {
    expect(Record).toBeDefined();
    expect(typeof Record).toBe('function');
  });

  it('should export RecordFactory class', () => {
    expect(RecordFactory).toBeDefined();
    expect(typeof RecordFactory).toBe('function');
  });

  it('should export RecordDuplicateChecker class', () => {
    expect(RecordDuplicateChecker).toBeDefined();
    expect(typeof RecordDuplicateChecker).toBe('function');
  });

  it('should export RecordMatcher class', () => {
    expect(RecordMatcher).toBeDefined();
    expect(typeof RecordMatcher).toBe('function');
  });

  it('should export DomainError class', () => {
    expect(DomainError).toBeDefined();
    expect(typeof DomainError).toBe('function');
  });

  it('should export InvalidRecordContentError class', () => {
    expect(InvalidRecordContentError).toBeDefined();
    expect(typeof InvalidRecordContentError).toBe('function');
  });

  it('should export InvalidTagError class', () => {
    expect(InvalidTagError).toBeDefined();
    expect(typeof InvalidTagError).toBe('function');
  });

  it('should export DuplicateRecordError class', () => {
    expect(DuplicateRecordError).toBeDefined();
    expect(typeof DuplicateRecordError).toBe('function');
  });

  it('should export TagLimitExceededError class', () => {
    expect(TagLimitExceededError).toBeDefined();
    expect(typeof TagLimitExceededError).toBe('function');
  });
});
