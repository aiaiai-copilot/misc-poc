import { Record } from '../../types/Record';

// Extract the deduplication function for testing
// This mirrors the implementation from useRecordsIntegrated.ts
const deduplicateRecordsByTagSet = (records: Record[]): Record[] => {
  const uniqueRecords: Record[] = [];
  const seenTagSets = new Set<string>();

  for (const record of records) {
    // Create a normalized string representation of the tag set for comparison
    const tagSetKey = [...record.tags]
      .map(tag => tag.toLowerCase())
      .sort()
      .join(',');

    if (!seenTagSets.has(tagSetKey)) {
      seenTagSets.add(tagSetKey);
      uniqueRecords.push(record);
    }
  }

  return uniqueRecords;
};

describe('deduplicateRecordsByTagSet', () => {
  it('should remove records with identical tag sets', () => {
    const records: Record[] = [
      {
        id: 'record-1',
        tags: ['javascript', 'react'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'record-2',
        tags: ['javascript', 'react'], // Same tags as record-1
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
      {
        id: 'record-3',
        tags: ['python', 'django'],
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03'),
      },
    ];

    const result = deduplicateRecordsByTagSet(records);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('record-1'); // First occurrence kept
    expect(result[1].id).toBe('record-3'); // Different tag set kept
    expect(result.find(r => r.id === 'record-2')).toBeUndefined(); // Duplicate removed
  });

  it('should handle case-insensitive tag matching', () => {
    const records: Record[] = [
      {
        id: 'record-1',
        tags: ['JavaScript', 'React'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'record-2',
        tags: ['javascript', 'react'], // Same tags but different case
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    const result = deduplicateRecordsByTagSet(records);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('record-1');
  });

  it('should handle different tag order as same set', () => {
    const records: Record[] = [
      {
        id: 'record-1',
        tags: ['react', 'javascript'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'record-2',
        tags: ['javascript', 'react'], // Same tags but different order
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    const result = deduplicateRecordsByTagSet(records);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('record-1');
  });

  it('should keep all records when no duplicates exist', () => {
    const records: Record[] = [
      {
        id: 'record-1',
        tags: ['javascript', 'react'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'record-2',
        tags: ['python', 'django'],
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
      {
        id: 'record-3',
        tags: ['java', 'spring'],
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03'),
      },
    ];

    const result = deduplicateRecordsByTagSet(records);

    expect(result).toHaveLength(3);
    expect(result).toEqual(records);
  });

  it('should handle empty tag arrays', () => {
    const records: Record[] = [
      {
        id: 'record-1',
        tags: [],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'record-2',
        tags: [], // Also empty tags
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    const result = deduplicateRecordsByTagSet(records);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('record-1');
  });

  it('should handle empty records array', () => {
    const records: Record[] = [];
    const result = deduplicateRecordsByTagSet(records);
    expect(result).toHaveLength(0);
  });
});