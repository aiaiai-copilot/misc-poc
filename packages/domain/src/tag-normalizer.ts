// @ts-expect-error - CommonJS require in ES module context
const removeAccents: (str: string) => string = require('remove-accents');

export interface TagNormalizerConfig {
  lowercase?: boolean;
  removeDiacritics?: boolean;
  unicodeNormalization?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | false;
}

const DEFAULT_CONFIG: Required<TagNormalizerConfig> = {
  lowercase: true,
  removeDiacritics: true,
  unicodeNormalization: 'NFC',
};

const VALID_UNICODE_FORMS = ['NFC', 'NFD', 'NFKC', 'NFKD'] as const;

export class TagNormalizer {
  private readonly config: Required<TagNormalizerConfig>;

  constructor(config: TagNormalizerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validateConfig();
  }

  private validateConfig(): void {
    if (
      this.config.unicodeNormalization !== false &&
      !VALID_UNICODE_FORMS.includes(
        this.config.unicodeNormalization as (typeof VALID_UNICODE_FORMS)[number]
      )
    ) {
      throw new Error('Invalid Unicode normalization form');
    }
  }

  normalize(input: string): string {
    if (input == null) {
      throw new Error('Input cannot be null or undefined');
    }

    let result = input;

    // Apply Unicode normalization first if enabled
    if (this.config.unicodeNormalization !== false) {
      result = result.normalize(this.config.unicodeNormalization);
    }

    // Remove diacritics if enabled
    if (this.config.removeDiacritics) {
      result = removeAccents(result);
    }

    // Convert to lowercase if enabled
    if (this.config.lowercase) {
      result = result.toLowerCase();
    }

    return result;
  }
}
