import { RecordContent } from '../record-content';

describe('RecordContent', () => {
  describe('constructor', () => {
    it('should create RecordContent from non-empty string', () => {
      const content = 'sample content with tags #tag1 #tag2';
      const recordContent = new RecordContent(content);
      
      expect(recordContent.toString()).toBe(content);
      expect(recordContent.value).toBe(content);
    });

    it('should preserve tag order and formatting', () => {
      const content = '#first-tag some content #second-tag more content #third-tag';
      const recordContent = new RecordContent(content);
      
      expect(recordContent.toString()).toBe(content);
      expect(recordContent.value).toBe(content);
    });

    it('should handle content with special characters and whitespace', () => {
      const content = '  #tag1 content with   multiple spaces\t\n#tag2  ';
      const recordContent = new RecordContent(content);
      
      expect(recordContent.toString()).toBe(content);
      expect(recordContent.value).toBe(content);
    });

    it('should throw error for empty string', () => {
      expect(() => new RecordContent('')).toThrow('RecordContent cannot be empty');
    });

    it('should throw error for whitespace-only string', () => {
      const whitespaceOnlyStrings = ['   ', '\t', '\n', '\r', '  \t\n  '];
      
      whitespaceOnlyStrings.forEach(content => {
        expect(() => new RecordContent(content)).toThrow('RecordContent cannot be empty');
      });
    });

    it('should throw error for null or undefined input', () => {
      expect(() => new RecordContent(null as any)).toThrow('RecordContent cannot be null or undefined');
      expect(() => new RecordContent(undefined as any)).toThrow('RecordContent cannot be null or undefined');
    });

    it('should throw error for content exceeding length limit', () => {
      const maxLength = 10000; // Assuming a reasonable limit
      const longContent = 'a'.repeat(maxLength + 1);
      
      expect(() => new RecordContent(longContent)).toThrow(`RecordContent exceeds maximum length of ${maxLength} characters`);
    });
  });

  describe('extractTokens', () => {
    it('should extract individual tokens preserving order', () => {
      const content = 'first #tag1 second #tag2 third';
      const recordContent = new RecordContent(content);
      const tokens = recordContent.extractTokens();
      
      expect(tokens).toEqual(['first', '#tag1', 'second', '#tag2', 'third']);
    });

    it('should handle multiple whitespace characters as separators', () => {
      const content = 'word1   #tag1\t\tword2\n#tag2  word3';
      const recordContent = new RecordContent(content);
      const tokens = recordContent.extractTokens();
      
      expect(tokens).toEqual(['word1', '#tag1', 'word2', '#tag2', 'word3']);
    });

    it('should return empty array for content with only whitespace after construction', () => {
      // Note: this shouldn't happen due to constructor validation, but testing edge case
      const content = 'at least one word';
      const recordContent = new RecordContent(content);
      const tokens = recordContent.extractTokens();
      
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle content with no tags', () => {
      const content = 'just some regular content without tags';
      const recordContent = new RecordContent(content);
      const tokens = recordContent.extractTokens();
      
      expect(tokens).toEqual(['just', 'some', 'regular', 'content', 'without', 'tags']);
    });

    it('should handle content with only tags', () => {
      const content = '#tag1 #tag2 #tag3';
      const recordContent = new RecordContent(content);
      const tokens = recordContent.extractTokens();
      
      expect(tokens).toEqual(['#tag1', '#tag2', '#tag3']);
    });
  });

  describe('equals', () => {
    it('should return true for RecordContents with same content', () => {
      const content = 'same content #tag1';
      const recordContent1 = new RecordContent(content);
      const recordContent2 = new RecordContent(content);
      
      expect(recordContent1.equals(recordContent2)).toBe(true);
    });

    it('should return false for RecordContents with different content', () => {
      const recordContent1 = new RecordContent('first content #tag1');
      const recordContent2 = new RecordContent('second content #tag2');
      
      expect(recordContent1.equals(recordContent2)).toBe(false);
    });

    it('should return false when comparing with null or undefined', () => {
      const recordContent = new RecordContent('test content');
      
      expect(recordContent.equals(null as any)).toBe(false);
      expect(recordContent.equals(undefined as any)).toBe(false);
    });

    it('should return false when comparing with non-RecordContent objects', () => {
      const recordContent = new RecordContent('test content');
      
      expect(recordContent.equals('string' as any)).toBe(false);
      expect(recordContent.equals({ value: recordContent.value } as any)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the original content string', () => {
      const content = 'original content #tag1 more content';
      const recordContent = new RecordContent(content);
      
      expect(recordContent.toString()).toBe(content);
    });
  });

  describe('value getter', () => {
    it('should return the original content string', () => {
      const content = 'test content #tag1';
      const recordContent = new RecordContent(content);
      
      expect(recordContent.value).toBe(content);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of internal state', () => {
      const content = 'test content #tag1';
      const recordContent = new RecordContent(content);
      const originalValue = recordContent.value;
      
      expect(() => {
        (recordContent as any).value = 'modified';
      }).toThrow();
      
      expect(recordContent.value).toBe(originalValue);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON as string', () => {
      const content = 'test content #tag1';
      const recordContent = new RecordContent(content);
      const serialized = JSON.stringify({ content: recordContent });
      const parsed = JSON.parse(serialized);
      
      expect(parsed.content).toBe(recordContent.value);
    });
  });

  describe('encoding and special characters', () => {
    it('should handle Unicode characters properly', () => {
      const content = 'content with émojis 🚀 and unicode #tag1 测试';
      const recordContent = new RecordContent(content);
      
      expect(recordContent.toString()).toBe(content);
      expect(recordContent.value).toBe(content);
    });

    it('should handle content with quotes and escaped characters', () => {
      const content = 'content with "quotes" and \'apostrophes\' #tag1 \\escaped';
      const recordContent = new RecordContent(content);
      
      expect(recordContent.toString()).toBe(content);
      expect(recordContent.value).toBe(content);
    });
  });
});