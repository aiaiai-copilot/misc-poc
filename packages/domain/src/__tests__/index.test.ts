import { TagNormalizer, TagNormalizerConfig } from '../index';

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
});
