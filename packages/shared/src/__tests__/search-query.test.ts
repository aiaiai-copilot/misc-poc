import { SearchQuery } from '../search-query';

describe('SearchQuery', () => {
  describe('constructor', () => {
    it('should create SearchQuery from non-empty string', () => {
      const query = 'hello world';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
      expect(searchQuery.value).toBe(query);
    });

    it('should handle single term query', () => {
      const query = 'single';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
      expect(searchQuery.value).toBe(query);
    });

    it('should handle query with extra whitespace', () => {
      const query = '  hello   world  ';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
      expect(searchQuery.value).toBe(query);
    });

    it('should create SearchQuery with empty string', () => {
      const query = '';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
      expect(searchQuery.value).toBe(query);
    });

    it('should create SearchQuery with whitespace-only string', () => {
      const query = '   ';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
      expect(searchQuery.value).toBe(query);
    });

    it('should throw error for null or undefined input', () => {
      expect(() => new SearchQuery(null as any)).toThrow(
        'SearchQuery cannot be null or undefined'
      );
      expect(() => new SearchQuery(undefined as any)).toThrow(
        'SearchQuery cannot be null or undefined'
      );
    });
  });

  describe('getTokens', () => {
    it('should extract tokens from query string', () => {
      const query = 'hello world search';
      const searchQuery = new SearchQuery(query);
      const tokens = searchQuery.getTokens();

      expect(tokens).toEqual(['hello', 'world', 'search']);
    });

    it('should handle multiple whitespace characters as separators', () => {
      const query = 'word1   word2\t\tword3\nword4';
      const searchQuery = new SearchQuery(query);
      const tokens = searchQuery.getTokens();

      expect(tokens).toEqual(['word1', 'word2', 'word3', 'word4']);
    });

    it('should return empty array for empty query', () => {
      const searchQuery = new SearchQuery('');
      const tokens = searchQuery.getTokens();

      expect(tokens).toEqual([]);
    });

    it('should return empty array for whitespace-only query', () => {
      const searchQuery = new SearchQuery('   \t\n  ');
      const tokens = searchQuery.getTokens();

      expect(tokens).toEqual([]);
    });

    it('should handle single token', () => {
      const searchQuery = new SearchQuery('single');
      const tokens = searchQuery.getTokens();

      expect(tokens).toEqual(['single']);
    });
  });

  describe('getNormalizedTokens', () => {
    it('should normalize tokens to lowercase', () => {
      const query = 'Hello World SEARCH';
      const searchQuery = new SearchQuery(query);
      const normalizedTokens = searchQuery.getNormalizedTokens();

      expect(normalizedTokens).toEqual(['hello', 'world', 'search']);
    });

    it('should handle mixed case input', () => {
      const query = 'CamelCase kebab-case UPPER_CASE';
      const searchQuery = new SearchQuery(query);
      const normalizedTokens = searchQuery.getNormalizedTokens();

      expect(normalizedTokens).toEqual([
        'camelcase',
        'kebab-case',
        'upper_case',
      ]);
    });

    it('should return empty array for empty query', () => {
      const searchQuery = new SearchQuery('');
      const normalizedTokens = searchQuery.getNormalizedTokens();

      expect(normalizedTokens).toEqual([]);
    });

    it('should preserve special characters in tokens', () => {
      const query = 'hello-world @user #tag';
      const searchQuery = new SearchQuery(query);
      const normalizedTokens = searchQuery.getNormalizedTokens();

      expect(normalizedTokens).toEqual(['hello-world', '@user', '#tag']);
    });
  });

  describe('getNormalizedTokens with diacritic removal', () => {
    it('should remove diacritics when removeDiacritics is true', () => {
      const query = 'café naïve résumé';
      const searchQuery = new SearchQuery(query);
      const normalizedTokens = searchQuery.getNormalizedTokens(true);

      expect(normalizedTokens).toEqual(['cafe', 'naive', 'resume']);
    });

    it('should preserve diacritics when removeDiacritics is false or not specified', () => {
      const query = 'café naïve résumé';
      const searchQuery = new SearchQuery(query);
      const normalizedTokensDefault = searchQuery.getNormalizedTokens();
      const normalizedTokensFalse = searchQuery.getNormalizedTokens(false);

      expect(normalizedTokensDefault).toEqual(['café', 'naïve', 'résumé']);
      expect(normalizedTokensFalse).toEqual(['café', 'naïve', 'résumé']);
    });

    it('should handle various accented characters', () => {
      const query = 'àáâãäå èéêë ìíîï òóôõö ùúûü ÿý';
      const searchQuery = new SearchQuery(query);
      const normalizedTokens = searchQuery.getNormalizedTokens(true);

      expect(normalizedTokens).toEqual([
        'aaaaaa',
        'eeee',
        'iiii',
        'ooooo',
        'uuuu',
        'yy',
      ]);
    });

    it('should handle mixed regular and accented characters', () => {
      const query = 'regular café mixed naïve text';
      const searchQuery = new SearchQuery(query);
      const normalizedTokens = searchQuery.getNormalizedTokens(true);

      expect(normalizedTokens).toEqual([
        'regular',
        'cafe',
        'mixed',
        'naive',
        'text',
      ]);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty query', () => {
      const searchQuery = new SearchQuery('');

      expect(searchQuery.isEmpty()).toBe(true);
    });

    it('should return true for whitespace-only query', () => {
      const whitespaceQueries = ['   ', '\t', '\n', '\r', '  \t\n  '];

      whitespaceQueries.forEach((query) => {
        const searchQuery = new SearchQuery(query);
        expect(searchQuery.isEmpty()).toBe(true);
      });
    });

    it('should return false for non-empty query', () => {
      const searchQuery = new SearchQuery('hello world');

      expect(searchQuery.isEmpty()).toBe(false);
    });

    it('should return false for query with only whitespace and content', () => {
      const searchQuery = new SearchQuery('  hello  ');

      expect(searchQuery.isEmpty()).toBe(false);
    });
  });

  describe('matches - AND logic', () => {
    it('should match when all query tokens are present in text', () => {
      const searchQuery = new SearchQuery('hello world');

      expect(searchQuery.matches('hello beautiful world')).toBe(true);
      expect(searchQuery.matches('world hello')).toBe(true);
      expect(searchQuery.matches('say hello to the world')).toBe(true);
    });

    it('should not match when any query token is missing', () => {
      const searchQuery = new SearchQuery('hello world');

      expect(searchQuery.matches('hello')).toBe(false);
      expect(searchQuery.matches('world')).toBe(false);
      expect(searchQuery.matches('goodbye world')).toBe(false);
      expect(searchQuery.matches('hello universe')).toBe(false);
    });

    it('should be case insensitive by default', () => {
      const searchQuery = new SearchQuery('hello world');

      expect(searchQuery.matches('HELLO WORLD')).toBe(true);
      expect(searchQuery.matches('Hello World')).toBe(true);
      expect(searchQuery.matches('hElLo WoRlD')).toBe(true);
    });

    it('should match empty query against any text', () => {
      const searchQuery = new SearchQuery('');

      expect(searchQuery.matches('any text')).toBe(true);
      expect(searchQuery.matches('')).toBe(true);
      expect(searchQuery.matches('hello world')).toBe(true);
    });

    it('should handle single token queries', () => {
      const searchQuery = new SearchQuery('hello');

      expect(searchQuery.matches('hello world')).toBe(true);
      expect(searchQuery.matches('say hello')).toBe(true);
      expect(searchQuery.matches('hello')).toBe(true);
      expect(searchQuery.matches('world')).toBe(false);
    });

    it('should handle partial word matching', () => {
      const searchQuery = new SearchQuery('cat dog');

      expect(searchQuery.matches('category dogma')).toBe(true);
      expect(searchQuery.matches('concatenate bulldogs')).toBe(true);
      expect(searchQuery.matches('cat dog')).toBe(true);
    });

    it('should respect diacritic settings in matching', () => {
      const searchQuery = new SearchQuery('cafe');

      expect(searchQuery.matches('café', false)).toBe(false);
      expect(searchQuery.matches('café', true)).toBe(true);
      expect(searchQuery.matches('CAFÉ', true)).toBe(true);
    });
  });

  describe('equals', () => {
    it('should return true for SearchQueries with same query string', () => {
      const query = 'same query string';
      const searchQuery1 = new SearchQuery(query);
      const searchQuery2 = new SearchQuery(query);

      expect(searchQuery1.equals(searchQuery2)).toBe(true);
    });

    it('should return false for SearchQueries with different query strings', () => {
      const searchQuery1 = new SearchQuery('first query');
      const searchQuery2 = new SearchQuery('second query');

      expect(searchQuery1.equals(searchQuery2)).toBe(false);
    });

    it('should return false when comparing with null or undefined', () => {
      const searchQuery = new SearchQuery('test query');

      expect(searchQuery.equals(null as any)).toBe(false);
      expect(searchQuery.equals(undefined as any)).toBe(false);
    });

    it('should return false when comparing with non-SearchQuery objects', () => {
      const searchQuery = new SearchQuery('test query');

      expect(searchQuery.equals('string' as any)).toBe(false);
      expect(searchQuery.equals({ value: searchQuery.value } as any)).toBe(
        false
      );
    });
  });

  describe('toString', () => {
    it('should return the original query string', () => {
      const query = 'original query string';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
    });

    it('should preserve whitespace in original query', () => {
      const query = '  query  with   spaces  ';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
    });
  });

  describe('value getter', () => {
    it('should return the original query string', () => {
      const query = 'test query';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.value).toBe(query);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of internal state', () => {
      const query = 'test query';
      const searchQuery = new SearchQuery(query);
      const originalValue = searchQuery.value;

      expect(() => {
        (searchQuery as any).value = 'modified';
      }).toThrow();

      expect(searchQuery.value).toBe(originalValue);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON as string', () => {
      const query = 'test query';
      const searchQuery = new SearchQuery(query);
      const serialized = JSON.stringify({ query: searchQuery });
      const parsed = JSON.parse(serialized);

      expect(parsed.query).toBe(searchQuery.value);
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle Unicode characters properly', () => {
      const query = 'query with émojis 🚀 and unicode 测试';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
      expect(searchQuery.value).toBe(query);
    });

    it('should tokenize Unicode characters correctly', () => {
      const query = 'émojis 🚀 测试';
      const searchQuery = new SearchQuery(query);
      const tokens = searchQuery.getTokens();

      expect(tokens).toEqual(['émojis', '🚀', '测试']);
    });

    it('should handle content with quotes and escaped characters', () => {
      const query = 'query with "quotes" and \'apostrophes\' \\escaped';
      const searchQuery = new SearchQuery(query);

      expect(searchQuery.toString()).toBe(query);
      expect(searchQuery.value).toBe(query);
    });
  });
});
