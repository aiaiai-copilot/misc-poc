import { formatDate, parseDate, isValidDate, getCurrentTimestamp, addDays, subtractDays, daysBetween } from '../date-utils';
import { Result } from '../result';

describe('Date Utilities', () => {
  const testDate = new Date('2023-12-25T10:30:45.123Z');
  const testTimestamp = testDate.getTime();

  describe('formatDate', () => {
    it('should format date to ISO string', () => {
      const result = formatDate(testDate);
      expect(result).toBe('2023-12-25T10:30:45.123Z');
    });

    it('should format timestamp to ISO string', () => {
      const result = formatDate(testTimestamp);
      expect(result).toBe('2023-12-25T10:30:45.123Z');
    });

    it('should format date with custom format', () => {
      const result = formatDate(testDate, 'YYYY-MM-DD');
      expect(result).toBe('2023-12-25');
    });

    it('should format date to date only', () => {
      const result = formatDate(testDate, 'date-only');
      expect(result).toBe('2023-12-25');
    });

    it('should format date to time only', () => {
      const result = formatDate(testDate, 'time-only');
      expect(result).toBe('10:30:45');
    });

    it('should format date with timezone', () => {
      const result = formatDate(testDate, 'datetime-local');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it('should handle invalid date input', () => {
      const result = formatDate('invalid' as any);
      expect(result).toBe('Invalid Date');
    });

    it('should handle Date object that throws error', () => {
      const result = formatDate(NaN);
      expect(result).toBe('Invalid Date');
    });

    it('should use default format for unknown format', () => {
      const result = formatDate(testDate, 'unknown' as any);
      expect(result).toBe('2023-12-25T10:30:45.123Z');
    });

    it('should handle exception in formatDate', () => {
      // Mock Date.prototype.toISOString to throw
      const originalToISOString = Date.prototype.toISOString;
      Date.prototype.toISOString = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });
      
      const result = formatDate(testDate);
      expect(result).toBe('Invalid Date');
      
      // Restore original method
      Date.prototype.toISOString = originalToISOString;
    });
  });

  describe('parseDate', () => {
    it('should parse valid ISO string', () => {
      const isoString = '2023-12-25T10:30:45.123Z';
      const result = parseDate(isoString);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(testDate);
    });

    it('should parse valid date string', () => {
      const dateString = '2023-12-25';
      const result = parseDate(dateString);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().getFullYear()).toBe(2023);
      expect(result.unwrap().getMonth()).toBe(11); // December is month 11
      expect(result.unwrap().getDate()).toBe(25);
    });

    it('should parse timestamp number', () => {
      const result = parseDate(testTimestamp);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(testDate);
    });

    it('should parse Date object', () => {
      const result = parseDate(testDate);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(testDate);
    });

    it('should return Err for invalid string', () => {
      const result = parseDate('invalid-date');
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Invalid date string');
    });

    it('should return Err for null input', () => {
      const result = parseDate(null as any);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Date input cannot be null or undefined');
    });

    it('should return Err for undefined input', () => {
      const result = parseDate(undefined as any);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Date input cannot be null or undefined');
    });

    it('should handle edge case where Date constructor throws', () => {
      // Test case that could cause Date constructor to throw
      const result = parseDate({} as any);
      expect(result.isErr()).toBe(true);
    });

    it('should handle Date constructor throwing an error', () => {
      // Mock Date constructor to throw
      const OriginalDate = global.Date;
      global.Date = jest.fn().mockImplementation(() => {
        throw new Error('Mock Date error');
      }) as any;
      
      const result = parseDate('2023-12-25');
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to parse date');
      
      // Restore original Date
      global.Date = OriginalDate;
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid Date object', () => {
      expect(isValidDate(testDate)).toBe(true);
    });

    it('should return true for valid timestamp', () => {
      expect(isValidDate(testTimestamp)).toBe(true);
    });

    it('should return true for valid date string', () => {
      expect(isValidDate('2023-12-25T10:30:45.123Z')).toBe(true);
    });

    it('should return false for invalid Date object', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
    });

    it('should return false for invalid string', () => {
      expect(isValidDate('not-a-date')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidDate(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidDate(undefined as any)).toBe(false);
    });
  });

  describe('getCurrentTimestamp', () => {
    it('should return current timestamp as number', () => {
      const before = Date.now();
      const timestamp = getCurrentTimestamp();
      const after = Date.now();

      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('addDays', () => {
    it('should add days to date', () => {
      const result = addDays(testDate, 5);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().getDate()).toBe(30);
    });

    it('should add days crossing month boundary', () => {
      const result = addDays(testDate, 10);
      expect(result.isOk()).toBe(true);
      const newDate = result.unwrap();
      expect(newDate.getMonth()).toBe(0); // January
      expect(newDate.getFullYear()).toBe(2024);
      expect(newDate.getDate()).toBe(4);
    });

    it('should handle negative days', () => {
      const result = addDays(testDate, -5);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().getDate()).toBe(20);
    });

    it('should handle timestamp input', () => {
      const result = addDays(testTimestamp, 5);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().getDate()).toBe(30);
    });

    it('should return Err for invalid input', () => {
      const result = addDays('invalid' as any, 5);
      expect(result.isErr()).toBe(true);
    });

    it('should handle edge case with very large day values', () => {
      const result = addDays(testDate, 1000000);
      expect(result.isOk()).toBe(true);
    });

    it('should handle date manipulation throwing error', () => {
      // Mock Date.prototype.setDate to throw
      const originalSetDate = Date.prototype.setDate;
      Date.prototype.setDate = jest.fn().mockImplementation(() => {
        throw new Error('Mock setDate error');
      });
      
      const result = addDays(testDate, 5);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to add days');
      
      // Restore original method
      Date.prototype.setDate = originalSetDate;
    });
  });

  describe('subtractDays', () => {
    it('should subtract days from date', () => {
      const result = subtractDays(testDate, 5);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().getDate()).toBe(20);
    });

    it('should subtract days crossing month boundary', () => {
      const result = subtractDays(testDate, 30);
      expect(result.isOk()).toBe(true);
      const newDate = result.unwrap();
      expect(newDate.getMonth()).toBe(10); // November
      expect(newDate.getDate()).toBe(25);
    });

    it('should handle negative days', () => {
      const result = subtractDays(testDate, -5);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().getDate()).toBe(30);
    });

    it('should return Err for invalid input', () => {
      const result = subtractDays('invalid' as any, 5);
      expect(result.isErr()).toBe(true);
    });
  });

  describe('daysBetween', () => {
    const laterDate = new Date('2023-12-30T10:30:45.123Z');

    it('should calculate days between two dates', () => {
      const result = daysBetween(testDate, laterDate);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(5);
    });

    it('should return positive number for future date', () => {
      const result = daysBetween(testDate, laterDate);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(5);
    });

    it('should return negative number for past date', () => {
      const result = daysBetween(laterDate, testDate);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(-5);
    });

    it('should return 0 for same date', () => {
      const result = daysBetween(testDate, testDate);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(0);
    });

    it('should handle timestamp inputs', () => {
      const result = daysBetween(testTimestamp, laterDate.getTime());
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(5);
    });

    it('should return Err for invalid start date', () => {
      const result = daysBetween('invalid' as any, laterDate);
      expect(result.isErr()).toBe(true);
    });

    it('should return Err for invalid end date', () => {
      const result = daysBetween(testDate, 'invalid' as any);
      expect(result.isErr()).toBe(true);
    });

  });

  describe('integration with Result type', () => {
    it('should work seamlessly with Result chaining', () => {
      const result = parseDate('2023-12-25T10:30:45.123Z')
        .andThen(date => addDays(date, 5))
        .map(date => formatDate(date, 'date-only'));

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('2023-12-30');
    });

    it('should propagate errors in Result chain', () => {
      const result = parseDate('invalid-date')
        .andThen(date => addDays(date, 5))
        .map(date => formatDate(date));

      expect(result.isErr()).toBe(true);
    });
  });
});