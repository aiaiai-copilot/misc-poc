# Application Layer Contracts

Контракты прикладного слоя для MISC системы. Определяет use cases, порты (интерфейсы для infrastructure) и DTO.

## 1. Use Cases

### CreateRecord

```typescript
// Use case создания новой записи
interface CreateRecordUseCase {
  execute(input: CreateRecordInput): Promise<Result<RecordDTO, DomainError>>;
}

interface CreateRecordInput {
  content: string;
}
```

### SearchRecords

```typescript
// Use case поиска записей
interface SearchRecordsUseCase {
  execute(input: SearchRecordsInput): Promise<Result<SearchResultDTO, Error>>;
}

interface SearchRecordsInput {
  query: string;
}
```

### UpdateRecord

```typescript
// Use case обновления записи
interface UpdateRecordUseCase {
  execute(input: UpdateRecordInput): Promise<Result<RecordDTO, DomainError>>;
}

interface UpdateRecordInput {
  id: string;
  content: string;
}
```

### DeleteRecord

```typescript
// Use case удаления записи
interface DeleteRecordUseCase {
  execute(input: DeleteRecordInput): Promise<Result<void, Error>>;
}

interface DeleteRecordInput {
  id: string;
}
```

### GetTagSuggestions

```typescript
// Use case получения подсказок тегов для автодополнения
interface GetTagSuggestionsUseCase {
  execute(input: GetTagSuggestionsInput): Promise<Result<string[], Error>>;
}

interface GetTagSuggestionsInput {
  partial: string;
  limit?: number;  // по умолчанию 10
}
```

### ExportData

```typescript
// Use case экспорта данных
interface ExportDataUseCase {
  execute(input: ExportDataInput): Promise<Result<ExportDTO, Error>>;
}

interface ExportDataInput {
  format: 'json';  // пока только JSON
}
```

### ImportData

```typescript
// Use case импорта данных (полная замена)
interface ImportDataUseCase {
  execute(input: ImportDataInput): Promise<Result<ImportResultDTO, Error>>;
}

interface ImportDataInput {
  data: string;    // JSON строка
  format: 'json';  // пока только JSON
}
```

## 2. Порты (Interfaces for Infrastructure)

### RecordRepository

```typescript
// Репозиторий для работы с записями
interface RecordRepository {
  save(record: Record): Promise<void>;
  findById(id: RecordId): Promise<Record | null>;
  findByTagIds(tagIds: Set<TagId>): Promise<Record[]>;
  findAll(): Promise<Record[]>;
  delete(id: RecordId): Promise<void>;
  deleteAll(): Promise<void>;  // Для полного импорта
  update(record: Record): Promise<void>;
  
  // Для поиска по всем тегам (AND логика)
  findByAllTagIds(tagIds: Set<TagId>): Promise<Record[]>;
  
  // Для проверки существования
  exists(id: RecordId): Promise<boolean>;
}
```

### TagRepository

```typescript
// Репозиторий для работы с тегами
interface TagRepository {
  save(tag: Tag): Promise<void>;
  findById(id: TagId): Promise<Tag | null>;
  findByNormalizedValue(value: string): Promise<Tag | null>;
  findByIds(ids: Set<TagId>): Promise<Map<TagId, Tag>>;
  findAll(): Promise<Tag[]>;
  deleteAll(): Promise<void>;  // Для полного импорта
  
  // Удаление неиспользуемых тегов
  deleteUnused(): Promise<number>;
  
  // Для автодополнения
  findByNormalizedValuePrefix(
    prefix: string, 
    limit: number
  ): Promise<Tag[]>;
  
  // Проверка использования тега
  isUsed(id: TagId): Promise<boolean>;
  
  // Получение статистики использования
  getUsageCount(id: TagId): Promise<number>;
}
```

### UnitOfWork

```typescript
// Паттерн Unit of Work для транзакционности
interface UnitOfWork {
  recordRepository: RecordRepository;
  tagRepository: TagRepository;
  
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

interface UnitOfWorkFactory {
  create(): UnitOfWork;
}
```

## 3. DTO (Data Transfer Objects)

### RecordDTO

```typescript
// DTO для передачи данных о записи
interface RecordDTO {
  id: string;
  content: string;      // оригинальное написание как ввёл пользователь
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}
```

### SearchResultDTO

```typescript
// DTO для результатов поиска
interface SearchResultDTO {
  mode: 'list' | 'cloud';
  records?: RecordDTO[];           // для режима list
  tagCloud?: TagCloudItemDTO[];    // для режима cloud
  total: number;
  query: string;
  searchTime: number;               // ms
}
```

### TagCloudItemDTO

```typescript
// DTO для элемента облака тегов
interface TagCloudItemDTO {
  value: string;        // нормализованное значение тега
  count: number;        // частота использования
  size: 1 | 2 | 3 | 4 | 5;  // размер в облаке
}
```

### ExportDTO

```typescript
// DTO для экспорта данных
interface ExportDTO {
  version: string;      // версия формата экспорта
  records: ExportRecordDTO[];
  metadata: ExportMetadataDTO;
}

interface ExportRecordDTO {
  content: string;      // только content - UUID не экспортируются
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}

interface ExportMetadataDTO {
  exportedAt: string;   // ISO 8601
  recordCount: number;
  normalizationRules: {
    caseSensitive: boolean;
    removeAccents: boolean;
  };
}
```

### ImportResultDTO

```typescript
// DTO для результата импорта
interface ImportResultDTO {
  imported: number;         // количество импортированных записей
  errors: ImportErrorDTO[]; // ошибки парсинга, если были
  replacedAll: boolean;     // true - всегда полная замена данных
  backupCreated: boolean;   // была ли создана резервная копия
}

interface ImportErrorDTO {
  line?: number;
  content?: string;
  reason: string;
}
```

### ValidationResultDTO

```typescript
// DTO для результатов валидации
interface ValidationResultDTO {
  isValid: boolean;
  errors: ValidationErrorDTO[];
}

interface ValidationErrorDTO {
  field: string;
  value: any;
  rule: string;
  message: string;
}
```

## 4. Application Services

### SearchModeDetector

```typescript
// Сервис определения режима отображения результатов поиска
interface SearchModeDetector {
  detectMode(params: {
    recordCount: number;
    containerHeight: number;
    recordHeight: number;
  }): 'list' | 'cloud';
}
```

### TagCloudBuilder

```typescript
// Сервис построения облака тегов
interface TagCloudBuilder {
  build(params: {
    records: Record[];
    tags: Map<TagId, Tag>;
    maxItems?: number;  // по умолчанию 50
  }): TagCloudItemDTO[];
}
```

### ImportValidator

```typescript
// Валидатор импортируемых данных
interface ImportValidator {
  validate(data: unknown): ValidationResultDTO;
}
```

### ExportFormatter

```typescript
// Форматировщик экспортируемых данных
interface ExportFormatter {
  format(records: Record[]): ExportDTO;
}
```

## 5. Configuration

```typescript
// Конфигурация приложения
interface ApplicationConfig {
  tags: {
    maxLength: number;        // 100
    maxPerRecord: number;     // 50
  };
  
  normalization: {
    caseSensitive: boolean;   // false
    removeAccents: boolean;   // false
  };
  
  search: {
    debounceMs: number;       // 300
    liveSearch: boolean;      // true
    maxSuggestions: number;   // 10
  };
  
  display: {
    recordHeight: number;     // 60px
    maxListItems: number;     // зависит от viewport
    tagCloudMaxItems: number; // 50
  };
  
  storage: {
    maxSizeMB: number;        // 5
    backupBeforeImport: boolean; // true
  };
  
  importExport: {
    warningThreshold: number; // 1000 записей
    maxImportSizeMB: number;  // 10
    version: string;          // "1.0"
  };
}
```

## 6. Error Handling

```typescript
// Ошибки прикладного слоя
class ApplicationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

class RecordNotFoundError extends ApplicationError {
  constructor(id: string) {
    super(`Record not found: ${id}`, 'RECORD_NOT_FOUND');
  }
}

class TagNotFoundError extends ApplicationError {
  constructor(value: string) {
    super(`Tag not found: ${value}`, 'TAG_NOT_FOUND');
  }
}

class ImportError extends ApplicationError {
  constructor(reason: string) {
    super(`Import failed: ${reason}`, 'IMPORT_FAILED');
  }
}

class ExportError extends ApplicationError {
  constructor(reason: string) {
    super(`Export failed: ${reason}`, 'EXPORT_FAILED');
  }
}

class StorageQuotaExceededError extends ApplicationError {
  constructor(currentMB: number, limitMB: number) {
    super(
      `Storage quota exceeded: ${currentMB}MB / ${limitMB}MB`,
      'STORAGE_QUOTA_EXCEEDED'
    );
  }
}
```

## 7. Dependency Injection

```typescript
// Контейнер зависимостей для use cases
interface ApplicationContainer {
  // Use Cases
  createRecord: CreateRecordUseCase;
  searchRecords: SearchRecordsUseCase;
  updateRecord: UpdateRecordUseCase;
  deleteRecord: DeleteRecordUseCase;
  getTagSuggestions: GetTagSuggestionsUseCase;
  exportData: ExportDataUseCase;
  importData: ImportDataUseCase;
  
  // Services
  searchModeDetector: SearchModeDetector;
  tagCloudBuilder: TagCloudBuilder;
  importValidator: ImportValidator;
  exportFormatter: ExportFormatter;
  
  // Configuration
  config: ApplicationConfig;
}

interface ApplicationContainerFactory {
  create(params: {
    repositories: {
      record: RecordRepository;
      tag: TagRepository;
    };
    domainServices: {
      tagNormalizer: TagNormalizer;
      tagParser: TagParser;
      tagValidator: TagValidator;
      recordMatcher: RecordMatcher;
      recordDuplicateChecker: RecordDuplicateChecker;
    };
    config: ApplicationConfig;
  }): ApplicationContainer;
}
```

## Правила и инварианты

### Use Case инварианты

- Все use cases возвращают Result тип для обработки ошибок
- Use cases не зависят от деталей UI или Infrastructure
- Use cases оркестрируют domain сервисы и репозитории
- Use cases отвечают за транзакционность операций

### DTO правила

- DTO не содержат бизнес-логики
- DTO используют примитивные типы (string, number, boolean)
- Даты передаются как ISO 8601 строки
- ID передаются как строки

### Repository правила

- Репозитории возвращают доменные объекты
- Репозитории не знают о деталях хранения
- Репозитории поддерживают базовые CRUD операции
- Специфичные запросы добавляются по мере необходимости
