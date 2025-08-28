# Test Specifications for TDD

Спецификации тестов для разработки через TDD. Тесты пишутся ДО реализации функциональности.

## 1. Domain Layer Tests

### 1.1 Value Objects Tests

#### RecordId Tests

```typescript
describe('RecordId', () => {
  describe('creation', () => {
    it('should generate unique UUID when created without value');
    it('should accept valid UUID string');
    it('should throw error for invalid UUID format');
  });
  
  describe('equality', () => {
    it('should be equal when values are the same');
    it('should not be equal when values are different');
  });
  
  describe('toString', () => {
    it('should return the UUID string value');
  });
});
```

#### RecordContent Tests

```typescript
describe('RecordContent', () => {
  describe('creation', () => {
    it('should accept non-empty string');
    it('should throw error for empty string');
    it('should throw error for whitespace-only string');
    it('should preserve original casing and spacing');
    it('should throw error if content exceeds max length (5000)');
  });
  
  describe('parseTokens', () => {
    it('should split by single space');
    it('should split by multiple spaces');
    it('should filter out empty tokens');
    it('should preserve token order');
    
    // Тестовые данные
    const cases = [
      {
        input: "todo встреча завтра",
        expected: ["todo", "встреча", "завтра"]
      },
      {
        input: "todo  встреча   завтра",
        expected: ["todo", "встреча", "завтра"]
      },
      {
        input: "  todo встреча  ",
        expected: ["todo", "встреча"]
      }
    ];
  });
});
```

#### SearchQuery Tests

```typescript
describe('SearchQuery', () => {
  describe('creation', () => {
    it('should normalize tokens using provided normalizer');
    it('should handle empty query');
    it('should remove duplicate normalized tokens');
    it('should preserve original query value');
  });
  
  describe('isEmpty', () => {
    it('should return true for empty query');
    it('should return true for whitespace-only query');
    it('should return false for query with valid tokens');
  });
});
```

### 1.2 Entity Tests

#### Record Entity Tests

```typescript
describe('Record', () => {
  describe('creation', () => {
    it('should create with valid content and tagIds');
    it('should generate unique ID');
    it('should set createdAt and updatedAt to current time');
    it('should throw error if content is empty');
    it('should throw error if tagIds is empty');
  });
  
  describe('hasTag', () => {
    it('should return true when tag exists');
    it('should return false when tag does not exist');
  });
  
  describe('hasSameTagSet', () => {
    it('should return true for identical tag sets');
    it('should return true regardless of tag order');
    it('should return false for different tag sets');
    it('should return false when one set is subset of another');
    
    // Тестовые данные
    const cases = [
      {
        tags1: ['id1', 'id2', 'id3'],
        tags2: ['id3', 'id1', 'id2'],
        expected: true  // порядок не важен
      },
      {
        tags1: ['id1', 'id2'],
        tags2: ['id1', 'id2', 'id3'],
        expected: false  // разный размер
      }
    ];
  });
  
  describe('immutability', () => {
    it('should not allow modification of id');
    it('should not allow modification of content');
    it('should not allow modification of tagIds');
    it('should not allow modification of dates');
  });
});
```

#### Tag Entity Tests

```typescript
describe('Tag', () => {
  describe('creation', () => {
    it('should create with normalized value');
    it('should generate unique ID');
    it('should throw error for empty normalized value');
  });
  
  describe('equality', () => {
    it('should be equal when IDs are the same');
    it('should not be equal when IDs differ');
    it('should not consider normalized value for equality');
  });
  
  describe('immutability', () => {
    it('should not allow modification of id');
    it('should not allow modification of normalizedValue');
  });
});
```

### 1.3 Domain Service Tests

#### TagNormalizer Tests

```typescript
describe('TagNormalizer', () => {
  describe('normalize with default config', () => {
    it('should convert to lowercase');
    it('should preserve Unicode characters');
    it('should preserve numbers');
    it('should not remove accents by default');
    
    const cases = [
      { input: "TODO", expected: "todo" },
      { input: "Встреча", expected: "встреча" },
      { input: "Café", expected: "café" },
      { input: "user123", expected: "user123" },
      { input: "北京", expected: "北京" }
    ];
  });
  
  describe('normalize with removeAccents', () => {
    it('should remove diacritical marks');
    it('should handle common European accents');
    
    const cases = [
      { input: "Café", expected: "cafe" },
      { input: "naïve", expected: "naive" },
      { input: "Zürich", expected: "zurich" },
      { input: "señor", expected: "senor" }
    ];
  });
  
  describe('normalize with caseSensitive', () => {
    it('should preserve original casing');
    
    const cases = [
      { input: "TODO", expected: "TODO" },
      { input: "ToDo", expected: "ToDo" }
    ];
  });
});
```

#### TagValidator Tests

```typescript
describe('TagValidator', () => {
  describe('isValid', () => {
    it('should accept valid tags');
    it('should reject empty string');
    it('should reject tags with forbidden characters');
    it('should reject tags exceeding max length');
    it('should reject tags below min length');
    it('should reject tags with spaces');
    
    const validCases = [
      "todo",
      "встреча",
      "user@email.com",
      "2024-01-01",
      "price:100$",
      "C++",
      "北京"
    ];
    
    const invalidCases = [
      "",                    // empty
      " ",                   // space
      "a b",                 // contains space
      "[tag]",               // forbidden chars
      "{tag}",               // forbidden chars
      '"tag"',               // forbidden chars
      "a".repeat(101),       // too long
      "tag\ntag",            // newline
    ];
  });
});
```

#### TagParser Tests

```typescript
describe('TagParser', () => {
  describe('parse', () => {
    it('should parse tokens from content');
    it('should normalize each token');
    it('should remove duplicates after normalization');
    it('should preserve order of first occurrence');
    it('should filter out invalid tokens');
    
    const cases = [
      {
        content: "TODO встреча TODO завтра",
        normalizer: (s) => s.toLowerCase(),
        expected: ["todo", "встреча", "завтра"]  // TODO не дублируется
      },
      {
        content: "Café cafe CAFE",
        normalizer: (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        expected: ["cafe"]  // все варианты нормализуются в одно
      }
    ];
  });
});
```

#### RecordMatcher Tests

```typescript
describe('RecordMatcher', () => {
  describe('matches', () => {
    it('should match when all query tokens present');
    it('should not match when any query token missing');
    it('should match using normalized values');
    it('should handle empty query (match all)');
    
    const cases = [
      {
        record: { tagIds: ['id1', 'id2', 'id3'] },
        tags: { 'id1': 'todo', 'id2': 'встреча', 'id3': 'завтра' },
        query: ['todo', 'встреча'],
        expected: true
      },
      {
        record: { tagIds: ['id1', 'id2'] },
        tags: { 'id1': 'todo', 'id2': 'встреча' },
        query: ['todo', 'встреча', 'завтра'],
        expected: false  // 'завтра' отсутствует
      }
    ];
  });
});
```

#### RecordDuplicateChecker Tests

```typescript
describe('RecordDuplicateChecker', () => {
  describe('findDuplicate', () => {
    it('should find record with exact same tag set');
    it('should find duplicate regardless of tag order');
    it('should return null when no duplicate exists');
    it('should not consider subset as duplicate');
    it('should not consider superset as duplicate');
    
    const cases = [
      {
        newTags: new Set(['id1', 'id2', 'id3']),
        existing: [
          { id: 'rec1', tagIds: new Set(['id1', 'id2']) },
          { id: 'rec2', tagIds: new Set(['id1', 'id2', 'id3']) },
          { id: 'rec3', tagIds: new Set(['id1', 'id2', 'id3', 'id4']) }
        ],
        expectedDuplicate: 'rec2'
      }
    ];
  });
});
```

## 2. Application Layer Tests

### 2.1 Use Case Tests

#### CreateRecord Use Case Tests

```typescript
describe('CreateRecordUseCase', () => {
  describe('execute', () => {
    it('should create record with valid content');
    it('should parse and normalize tags');
    it('should create new tags if not exist');
    it('should reuse existing tags');
    it('should reject duplicate records');
    it('should reject empty content');
    it('should reject content with only invalid tokens');
    it('should limit number of tags per record');
    
    const testCases = [
      {
        name: 'creates new record with new tags',
        input: { content: 'todo встреча завтра' },
        existingTags: [],
        existingRecords: [],
        shouldSucceed: true
      },
      {
        name: 'reuses existing tags',
        input: { content: 'todo встреча' },
        existingTags: ['todo'],
        existingRecords: [],
        shouldSucceed: true
      },
      {
        name: 'rejects duplicate',
        input: { content: 'todo встреча' },
        existingTags: ['todo', 'встреча'],
        existingRecords: [{ tagIds: ['todo', 'встреча'] }],
        shouldSucceed: false,
        expectedError: 'DuplicateRecordError'
      }
    ];
  });
});
```

#### SearchRecords Use Case Tests

```typescript
describe('SearchRecordsUseCase', () => {
  describe('execute', () => {
    it('should find records matching all query tokens');
    it('should return empty result for no matches');
    it('should return list mode when results fit screen');
    it('should return cloud mode when too many results');
    it('should handle empty query (return all)');
    it('should normalize query tokens');
    it('should calculate search time');
    
    const testCases = [
      {
        name: 'finds matching records',
        query: 'todo встреча',
        records: [
          { content: 'todo встреча завтра', tagIds: ['id1', 'id2', 'id3'] },
          { content: 'todo встреча', tagIds: ['id1', 'id2'] },
          { content: 'встреча сегодня', tagIds: ['id2', 'id4'] }
        ],
        expectedCount: 2  // первые два записи
      }
    ];
  });
  
  describe('mode detection', () => {
    it('should return list when few records');
    it('should return cloud when many records');
    it('should consider container height');
  });
});
```

#### UpdateRecord Use Case Tests

```typescript
describe('UpdateRecordUseCase', () => {
  describe('execute', () => {
    it('should update existing record');
    it('should handle tag changes');
    it('should cleanup unused tags after update');
    it('should prevent creating duplicates');
    it('should preserve record ID');
    it('should update updatedAt timestamp');
    it('should reject if record not found');
    
    const testCases = [
      {
        name: 'updates record content',
        recordId: 'rec1',
        oldContent: 'todo встреча',
        newContent: 'todo встреча завтра',
        shouldSucceed: true
      },
      {
        name: 'rejects duplicate after update',
        recordId: 'rec1',
        oldContent: 'todo встреча',
        newContent: 'работа отчёт',
        existingOther: { content: 'работа отчёт' },
        shouldSucceed: false,
        expectedError: 'DuplicateRecordError'
      }
    ];
  });
});
```

#### DeleteRecord Use Case Tests

```typescript
describe('DeleteRecordUseCase', () => {
  describe('execute', () => {
    it('should delete existing record');
    it('should cleanup unused tags after deletion');
    it('should not delete tags used by other records');
    it('should handle record not found');
    
    const testCases = [
      {
        name: 'deletes record and unused tags',
        recordId: 'rec1',
        recordTags: ['tag1', 'tag2'],
        otherRecordsTags: ['tag2', 'tag3'],
        expectedDeletedTags: ['tag1']  // tag2 используется другой записью
      }
    ];
  });
});
```

#### GetTagSuggestions Use Case Tests

```typescript
describe('GetTagSuggestionsUseCase', () => {
  describe('execute', () => {
    it('should return tags starting with partial');
    it('should normalize partial before search');
    it('should limit results to specified count');
    it('should return empty array for no matches');
    it('should handle empty partial');
    it('should sort by usage frequency');
    
    const testCases = [
      {
        partial: 'то',
        existingTags: ['todo', 'товар', 'топ', 'встреча'],
        limit: 2,
        expected: ['todo', 'товар']  // первые 2
      }
    ];
  });
});
```

#### ImportData Use Case Tests

```typescript
describe('ImportDataUseCase', () => {
  describe('execute', () => {
    it('should delete all existing data before import');
    it('should create records from valid JSON');
    it('should generate new IDs for all entities');
    it('should validate import format');
    it('should handle invalid JSON gracefully');
    it('should report parsing errors');
    it('should create backup before import');
    it('should rollback on critical errors');
    
    const validImportData = {
      version: "1.0",
      records: [
        {
          content: "todo встреча завтра",
          createdAt: "2024-01-01T10:00:00Z",
          updatedAt: "2024-01-01T10:00:00Z"
        }
      ],
      metadata: {
        exportedAt: "2024-01-15T12:00:00Z",
        recordCount: 1,
        normalizationRules: {
          caseSensitive: false,
          removeAccents: false
        }
      }
    };
    
    const invalidCases = [
      {
        name: 'invalid JSON',
        data: '{ invalid json',
        expectedError: 'Invalid JSON format'
      },
      {
        name: 'missing version',
        data: '{ "records": [] }',
        expectedError: 'Missing version field'
      },
      {
        name: 'invalid record structure',
        data: '{ "version": "1.0", "records": [{}] }',
        expectedError: 'Invalid record structure'
      }
    ];
  });
});
```

#### ExportData Use Case Tests

```typescript
describe('ExportDataUseCase', () => {
  describe('execute', () => {
    it('should export all records');
    it('should exclude internal IDs');
    it('should include metadata');
    it('should format dates as ISO 8601');
    it('should include normalization rules');
    it('should handle empty database');
    
    const testCases = [
      {
        name: 'exports records without IDs',
        records: [
          {
            id: 'uuid1',
            content: 'todo встреча',
            tagIds: ['tag1', 'tag2'],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01')
          }
        ],
        expectedOutput: {
          version: "1.0",
          records: [
            {
              content: 'todo встреча',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z'
            }
          ],
          metadata: {
            recordCount: 1,
            normalizationRules: {
              caseSensitive: false,
              removeAccents: false
            }
          }
        }
      }
    ];
  });
});
```

### 2.2 Application Service Tests

#### SearchModeDetector Tests

```typescript
describe('SearchModeDetector', () => {
  describe('detectMode', () => {
    it('should return list when records fit in container');
    it('should return cloud when records overflow');
    it('should consider record height');
    it('should handle edge cases');
    
    const testCases = [
      {
        recordCount: 5,
        containerHeight: 600,
        recordHeight: 60,
        expected: 'list'  // 5 * 60 = 300 < 600
      },
      {
        recordCount: 20,
        containerHeight: 600,
        recordHeight: 60,
        expected: 'cloud'  // 20 * 60 = 1200 > 600
      }
    ];
  });
});
```

#### TagCloudBuilder Tests

```typescript
describe('TagCloudBuilder', () => {
  describe('build', () => {
    it('should count tag usage frequency');
    it('should calculate relative sizes (1-5)');
    it('should sort by frequency descending');
    it('should limit to maxItems');
    it('should handle empty input');
    
    const testCase = {
      records: [
        { tagIds: ['id1', 'id2'] },
        { tagIds: ['id1', 'id3'] },
        { tagIds: ['id1', 'id2', 'id3'] }
      ],
      tags: {
        'id1': { normalizedValue: 'todo' },
        'id2': { normalizedValue: 'встреча' },
        'id3': { normalizedValue: 'завтра' }
      },
      expected: [
        { value: 'todo', count: 3, size: 5 },      // самый частый
        { value: 'встреча', count: 2, size: 3 },
        { value: 'завтра', count: 2, size: 3 }
      ]
    };
  });
});
```

#### ImportValidator Tests

```typescript
describe('ImportValidator', () => {
  describe('validate', () => {
    it('should accept valid import format');
    it('should reject missing version');
    it('should reject invalid version format');
    it('should reject missing records array');
    it('should reject invalid record structure');
    it('should validate each record content');
    it('should validate date formats');
    it('should provide detailed error messages');
  });
});
```

#### ExportFormatter Tests

```typescript
describe('ExportFormatter', () => {
  describe('format', () => {
    it('should format records for export');
    it('should exclude internal IDs');
    it('should add metadata');
    it('should include version');
    it('should format dates as ISO 8601');
    it('should calculate record count');
  });
});
```

## 3. Integration Tests

### 3.1 Repository Tests

#### LocalStorageRecordRepository Tests

```typescript
describe('LocalStorageRecordRepository', () => {
  describe('CRUD operations', () => {
    it('should save and retrieve record');
    it('should update existing record');
    it('should delete record');
    it('should find by tag IDs with AND logic');
    it('should handle concurrent operations');
    it('should handle storage quota exceeded');
  });
  
  describe('indexes', () => {
    it('should maintain tag-to-records index');
    it('should update indexes on record changes');
    it('should cleanup indexes on deletion');
    it('should rebuild indexes if corrupted');
  });
  
  describe('deleteAll', () => {
    it('should remove all records');
    it('should clear all indexes');
    it('should be atomic operation');
  });
  
  describe('persistence', () => {
    it('should persist data across sessions');
    it('should handle localStorage unavailable');
    it('should migrate old data format');
  });
});
```

#### LocalStorageTagRepository Tests

```typescript
describe('LocalStorageTagRepository', () => {
  describe('CRUD operations', () => {
    it('should save and retrieve tag');
    it('should find by normalized value');
    it('should find multiple by IDs');
    it('should delete unused tags');
  });
  
  describe('search', () => {
    it('should find by prefix for autocomplete');
    it('should limit results');
    it('should sort by usage frequency');
  });
  
  describe('usage tracking', () => {
    it('should track usage count');
    it('should identify unused tags');
    it('should cleanup orphaned tags');
  });
});
```

### 3.2 End-to-End Scenarios

#### User Journey Tests

```typescript
describe('E2E User Journeys', () => {
  describe('first time user', () => {
    it('should complete onboarding flow');
    it('should create first record');
    it('should discover search functionality');
    it('should understand tag concept');
  });
  
  describe('typical daily use', () => {
    it('should quickly add multiple records');
    it('should find records by partial tags');
    it('should update existing records');
    it('should see tag cloud for overview');
  });
  
  describe('power user flow', () => {
    it('should handle 1000+ records');
    it('should use keyboard shortcuts');
    it('should export and backup data');
    it('should import from backup');
  });
});
```

#### Data Integrity Tests

```typescript
describe('Data Integrity', () => {
  describe('consistency', () => {
    it('should maintain referential integrity');
    it('should prevent orphaned tags');
    it('should handle duplicate prevention');
    it('should recover from corrupted state');
  });
  
  describe('import/export cycle', () => {
    it('should preserve all data through export/import');
    it('should handle version migrations');
    it('should validate imported data');
    it('should create automatic backup');
  });
});
```

## 4. Performance Tests

```typescript
describe('Performance', () => {
  describe('search performance', () => {
    it('should search 10,000 records in < 100ms');
    it('should handle real-time search (debounced)');
    it('should efficiently match multiple tags');
  });
  
  describe('UI responsiveness', () => {
    it('should render 100 records in < 50ms');
    it('should switch modes smoothly');
    it('should handle rapid input');
  });
  
  describe('storage efficiency', () => {
    it('should compress data when needed');
    it('should handle storage limits gracefully');
    it('should optimize indexes');
  });
});
```

## 5. Test Utilities

### Test Data Builders

```typescript
// Билдеры для создания тестовых данных
class TestDataBuilder {
  static record(overrides?: Partial<Record>): Record {
    return {
      id: RecordId.generate(),
      content: RecordContent.from('test content'),
      tagIds: new Set([TagId.generate()]),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }
  
  static tag(overrides?: Partial<Tag>): Tag {
    return {
      id: TagId.generate(),
      normalizedValue: 'test-tag',
      ...overrides
    };
  }
  
  static importData(recordCount: number): ImportData {
    const records = Array.from({ length: recordCount }, (_, i) => ({
      content: `test record ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    return {
      version: "1.0",
      records,
      metadata: {
        exportedAt: new Date().toISOString(),
        recordCount,
        normalizationRules: {
          caseSensitive: false,
          removeAccents: false
        }
      }
    };
  }
}
```

### Test Fixtures

```typescript
// Фикстуры для консистентных тестовых данных
const fixtures = {
  records: {
    simple: { content: 'todo встреча завтра' },
    complex: { content: 'проект отчёт deadline понедельник важно @boss' },
    unicode: { content: '会議 明日 重要 café' }
  },
  
  tags: {
    common: ['todo', 'встреча', 'работа', 'важно'],
    special: ['@boss', '#project', 'deadline:monday'],
    unicode: ['北京', 'café', 'señor']
  },
  
  queries: {
    single: 'todo',
    multiple: 'todo встреча',
    notFound: 'несуществующий',
    partial: 'встр'
  }
};
```

### Mock Implementations

```typescript
// Моки для изоляции тестов
class MockRecordRepository implements RecordRepository {
  private records: Map<string, Record> = new Map();
  
  async save(record: Record): Promise<void> {
    this.records.set(record.id.value, record);
  }
  
  async findById(id: RecordId): Promise<Record | null> {
    return this.records.get(id.value) || null;
  }
  
  // ... остальные методы
}

class MockTagNormalizer implements TagNormalizer {
  normalize(value: string): string {
    return value.toLowerCase();
  }
}
```

## 6. Правила написания тестов

### Соглашения

1. **Naming**: Тесты называются в формате "should [expected behavior] when [condition]"
2. **Structure**: Arrange-Act-Assert (AAA) паттерн
3. **Isolation**: Каждый тест независим и не влияет на другие
4. **Mocking**: Минимальное использование моков, предпочтение реальным объектам
5. **Coverage**: Минимум 95% для Domain, 90% для Application, 80% общее

### Приоритеты тестирования

1. **Critical Path**: Создание, поиск, обновление записей
2. **Data Integrity**: Уникальность, консистентность, валидация
3. **Edge Cases**: Граничные значения, пустые данные, ошибки
4. **Performance**: Только если не достигаются целевые метрики
5. **UI**: Фокус на логике, не на визуальном представлении
