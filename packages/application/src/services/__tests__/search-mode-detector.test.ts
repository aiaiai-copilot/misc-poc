import { SearchModeDetector, DisplayMode } from '../search-mode-detector';
import { SearchResultDTO } from '../../dtos/search-result-dto';
import { RecordDTO } from '../../dtos/record-dto';

describe('SearchModeDetector', () => {
  let detector: SearchModeDetector;

  beforeEach(() => {
    detector = new SearchModeDetector();
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      expect(detector).toBeInstanceOf(SearchModeDetector);
    });

    it('should accept custom threshold configuration', () => {
      const customDetector = new SearchModeDetector({
        listToCloudThreshold: 50,
        cloudToListThreshold: 20,
      });
      expect(customDetector).toBeInstanceOf(SearchModeDetector);
    });

    it('should throw error if listToCloudThreshold is less than cloudToListThreshold', () => {
      expect(() => {
        new SearchModeDetector({
          listToCloudThreshold: 10,
          cloudToListThreshold: 20,
        });
      }).toThrow(
        'listToCloudThreshold must be greater than cloudToListThreshold'
      );
    });
  });

  describe('detectMode', () => {
    it('should return LIST mode for empty search results', () => {
      const searchResult: SearchResultDTO = {
        records: [],
        total: 0,
        hasMore: false,
      };

      const mode = detector.detectMode(searchResult);
      expect(mode).toBe(DisplayMode.LIST);
    });

    it('should return LIST mode for small number of results', () => {
      const records: RecordDTO[] = Array.from({ length: 5 }, (_, i) => ({
        id: `record-${i}`,
        content: `Content ${i}`,
        tagIds: [`tag${i}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const searchResult: SearchResultDTO = {
        records,
        total: 5,
        hasMore: false,
      };

      const mode = detector.detectMode(searchResult);
      expect(mode).toBe(DisplayMode.LIST);
    });

    it('should return CLOUD mode for large number of results with default threshold', () => {
      const records: RecordDTO[] = Array.from({ length: 25 }, (_, i) => ({
        id: `record-${i}`,
        content: `Content ${i}`,
        tagIds: [`tag${i}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const searchResult: SearchResultDTO = {
        records,
        total: 25,
        hasMore: true,
      };

      const mode = detector.detectMode(searchResult);
      expect(mode).toBe(DisplayMode.CLOUD);
    });

    it('should return LIST mode when totalCount is exactly at threshold (12)', () => {
      const records: RecordDTO[] = Array.from({ length: 12 }, (_, i) => ({
        id: `record-${i}`,
        content: `Content ${i}`,
        tagIds: [`tag${i}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const searchResult: SearchResultDTO = {
        records,
        total: 12,
        hasMore: false,
      };

      const mode = detector.detectMode(searchResult);
      expect(mode).toBe(DisplayMode.LIST);
    });

    it('should return CLOUD mode when totalCount exceeds threshold (13+)', () => {
      const records: RecordDTO[] = Array.from({ length: 13 }, (_, i) => ({
        id: `record-${i}`,
        content: `Content ${i}`,
        tagIds: [`tag${i}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const searchResult: SearchResultDTO = {
        records,
        total: 13,
        hasMore: false,
      };

      const mode = detector.detectMode(searchResult);
      expect(mode).toBe(DisplayMode.CLOUD);
    });

    it('should use custom thresholds when provided', () => {
      const customDetector = new SearchModeDetector({
        listToCloudThreshold: 10,
        cloudToListThreshold: 5,
      });

      const records: RecordDTO[] = Array.from({ length: 12 }, (_, i) => ({
        id: `record-${i}`,
        content: `Content ${i}`,
        tagIds: [`tag${i}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const searchResult: SearchResultDTO = {
        records,
        total: 12,
        hasMore: false,
      };

      const mode = customDetector.detectMode(searchResult);
      expect(mode).toBe(DisplayMode.CLOUD);
    });

    it('should handle null or undefined search results gracefully', () => {
      expect(() => detector.detectMode(null as any)).toThrow(
        'SearchResult cannot be null or undefined'
      );
      expect(() => detector.detectMode(undefined as any)).toThrow(
        'SearchResult cannot be null or undefined'
      );
    });

    it('should prioritize total over records array length', () => {
      const records: RecordDTO[] = Array.from({ length: 5 }, (_, i) => ({
        id: `record-${i}`,
        content: `Content ${i}`,
        tagIds: [`tag${i}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const searchResult: SearchResultDTO = {
        records,
        total: 30, // Higher than records array length
        hasMore: true,
      };

      const mode = detector.detectMode(searchResult);
      expect(mode).toBe(DisplayMode.CLOUD);
    });
  });

  describe('getConfiguration', () => {
    it('should return current configuration', () => {
      const config = detector.getConfiguration();
      expect(config).toEqual({
        listToCloudThreshold: 12,
        cloudToListThreshold: 10,
      });
    });

    it('should return custom configuration', () => {
      const customDetector = new SearchModeDetector({
        listToCloudThreshold: 50,
        cloudToListThreshold: 25,
      });

      const config = customDetector.getConfiguration();
      expect(config).toEqual({
        listToCloudThreshold: 50,
        cloudToListThreshold: 25,
      });
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration with valid values', () => {
      detector.updateConfiguration({
        listToCloudThreshold: 30,
        cloudToListThreshold: 15,
      });

      const config = detector.getConfiguration();
      expect(config).toEqual({
        listToCloudThreshold: 30,
        cloudToListThreshold: 15,
      });
    });

    it('should throw error for invalid configuration', () => {
      expect(() => {
        detector.updateConfiguration({
          listToCloudThreshold: 5,
          cloudToListThreshold: 10,
        });
      }).toThrow(
        'listToCloudThreshold must be greater than cloudToListThreshold'
      );
    });

    it('should allow partial updates', () => {
      detector.updateConfiguration({
        listToCloudThreshold: 25,
      });

      const config = detector.getConfiguration();
      expect(config.listToCloudThreshold).toBe(25);
      expect(config.cloudToListThreshold).toBe(10); // Should remain unchanged
    });
  });
});
