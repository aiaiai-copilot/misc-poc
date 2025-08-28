# Domain Layer Contracts

Контракты доменного слоя для MISC системы. Все типы и интерфейсы независимы от деталей реализации.

## 1. Entities

### Record Entity

```typescript
// Запись - основная сущность системы
interface Record {
  readonly id: RecordId;
  readonly content: RecordContent;
  readonly tagIds: Set<TagId>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  
  hasTag(tagId: TagId): boolean;
  hasSameTagSet(other: Record): boolean;
  equals(other: Record): boolean;
}

// Фабрика для создания Record
interface RecordFactory {
  create(params: {
    content: RecordContent;
    tagIds: Set<TagId>;
  }): Record;
  
  restore(params: {
    id: RecordId;
    content: RecordContent;
    tagIds: Set<TagId>;
    createdAt: Date;
    updatedAt: Date;
  }): Record;
}
```

### Tag Entity

```typescript
// Тег как сущность - уникальный концепт в системе
interface Tag {
  readonly id: TagId;
  readonly normalizedValue: string;
  
  equals(other: Tag): boolean;
}

// Фабрика для создания Tag
interface TagFactory {
  create(normalizedValue: string): Tag;
  
  restore(params: {
    id: TagId;
    normalizedValue: string;
  }): Tag;
}
```

## 2. Value Objects

### RecordId

```typescript
// Идентификатор записи (UUID)
interface RecordId {
  readonly value: string;
  
  toString(): string;
  equals(other: RecordId): boolean;
}

interface RecordIdFactory {
  generate(): RecordId;
  from(value: string): RecordId;
}
```

### TagId

```typescript
// Идентификатор тега (UUID)
interface TagId {
  readonly value: string;
  
  toString(): string;
  equals(other: TagId): boolean;
}

interface TagIdFactory {
  generate(): TagId;
  from(value: string): TagId;
}
```

### RecordContent

```typescript
// Содержимое записи - строка тегов как ввёл пользователь
interface RecordContent {
  readonly value: string;
  
  parseTokens(): string[];
  isEmpty(): boolean;
  toString(): string;
}

interface RecordContentFactory {
  from(value: string): RecordContent;
}

// Правила валидации
interface RecordContentValidation {
  minLength: 1;
  maxLength: 5000;
  cannotBeEmpty: true;
}
```

### SearchQuery

```typescript
// Поисковый запрос пользователя
interface SearchQuery {
  readonly value: string;
  readonly normalizedTokens: string[];
  
  isEmpty(): boolean;
}

interface SearchQueryFactory {
  create(value: string, normalizer: TagNormalizer): SearchQuery;
}
```

## 3. Domain Services

### TagNormalizer

```typescript
// Сервис нормализации тегов
interface TagNormalizer {
  normalize(value: string): string;
}

// Конфигурация нормализации
interface NormalizationConfig {
  caseSensitive: boolean;    // false по умолчанию
  removeAccents: boolean;    // false по умолчанию
}
```

### TagParser

```typescript
// Сервис парсинга content в теги
interface TagParser {
  parse(content: RecordContent, normalizer: TagNormalizer): string[];
}
```

### TagValidator

```typescript
// Валидация токенов
interface TagValidator {
  isValid(token: string): boolean;
}

// Конфигурация валидации
interface TagValidationConfig {
  minLength: number;           // 1
  maxLength: number;           // 100
  maxPerRecord: number;        // 50
  forbiddenChars: string[];    // ['[', ']', '{', '}', ':', ',', '"', '\']
}
```

### RecordMatcher

```typescript
// Сервис проверки соответствия записи поисковому запросу
interface RecordMatcher {
  matches(
    record: Record, 
    query: SearchQuery, 
    tags: Map<TagId, Tag>
  ): boolean;
}
```

### RecordDuplicateChecker

```typescript
// Сервис проверки уникальности записи
interface RecordDuplicateChecker {
  findDuplicate(
    tagIds: Set<TagId>, 
    existingRecords: Record[]
  ): Record | null;
}
```

## 4. Domain Errors

```typescript
// Базовый класс доменных ошибок
abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Специфичные ошибки домена
class InvalidRecordContentError extends DomainError {
  constructor(content: string, reason: string) {
    super(`Invalid record content: ${reason}`);
  }
}

class InvalidTagError extends DomainError {
  constructor(tag: string, reason: string) {
    super(`Invalid tag "${tag}": ${reason}`);
  }
}

class DuplicateRecordError extends DomainError {
  constructor(existingRecordId: string) {
    super(`Record with same tag set already exists: ${existingRecordId}`);
  }
}

class TagLimitExceededError extends DomainError {
  constructor(count: number, limit: number) {
    super(`Tag count ${count} exceeds limit ${limit}`);
  }
}
```

## 5. Aggregate Roots

```typescript
// Record является aggregate root
interface RecordAggregate {
  readonly record: Record;
  readonly tags: Map<TagId, Tag>;
  
  updateContent(
    newContent: RecordContent,
    tagResolver: (normalized: string) => Tag
  ): void;
  
  validateInvariants(): void;
}
```

## 6. Вспомогательные типы

```typescript
// Результат операции
type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

// Спецификация для поиска
interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}
```

## Инварианты и правила

### Record инварианты:
- ID неизменен после создания
- Content не может быть пустым
- Content должен содержать хотя бы один валидный тег
- tagIds содержит все теги из content (синхронизация)
- Дата обновления >= дата создания

### Tag инварианты:
- ID неизменен после создания
- normalizedValue уникален в системе
- normalizedValue не может быть пустым

### Правила нормализации:
- Приведение к нижнему регистру (если не caseSensitive)
- Удаление диакритики (если removeAccents)
- Сохранение всех остальных Unicode символов

### Правила валидации тегов:
- Длина от 1 до 100 символов
- Не содержит запрещённых символов
- Не содержит пробелов (токен разделяется пробелами)
